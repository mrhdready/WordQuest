using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Gamification.Services;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Sitzungs-Endpunkte gegen echtes PostgreSQL (FIX-03, FIX-09, FIX-04, QUAL-01).
/// Gemeinsame Factory, deshalb legt jeder Fall eine eigene Familie an und
/// prueft keine globalen Zaehlungen (Isolationsregel ApiFactory). Clients
/// kommen aus CreateClientFor und belasten die Policy "auth" nicht.
/// </summary>
public sealed class SessionEndpointTests : IClassFixture<ApiFactory>
{
    private const string Sessions = "/api/v1/sessions";
    private const string SessionGone = "Diese Runde gibt es nicht mehr. Starte eine neue Runde.";
    private const string CardGone = "Diese Karte gehört nicht zu dieser Runde. Starte eine neue Runde.";
    private const string ChildGone = "Dieses Kind gibt es nicht (mehr).";
    private const string SizeInvalid = "Eine Runde hat 1 bis 50 Karten.";
    private const string AlreadyAnswered = "Diese Antwort ist schon angekommen. Starte eine neue Runde, um weiterzulernen.";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public SessionEndpointTests(ApiFactory factory) => _factory = factory;

    // ------------------------------------------------------------ Hilfen

    private static async Task<SessionView> StartAsync(HttpClient client, Guid learnerId, Guid? setId = null)
    {
        HttpResponseMessage response = await client.PostAsJsonAsync(
            Sessions, new { learnerId, setId, gameKey = "classic", size = (int?)null });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        SessionView? view = await response.Content.ReadFromJsonAsync<SessionView>(Json);
        Assert.NotNull(view);
        return view;
    }

    private static Task<HttpResponseMessage> AnswerAsync(
        HttpClient client, Guid sessionId, Guid itemId, string answer, Guid? clientAnswerId = null) =>
        client.PostAsJsonAsync($"{Sessions}/{sessionId}/answers", new
        {
            itemId,
            givenAnswer = answer,
            answerMs = 2000,
            clientAnswerId = clientAnswerId ?? Guid.NewGuid(),
            hintUsed = false,
        });

    private static async Task<AnswerResult> ReadAnswerAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AnswerResult? result = await response.Content.ReadFromJsonAsync<AnswerResult>(Json);
        Assert.NotNull(result);
        return result;
    }

    private static async Task<LearnerOverviewDto> OverviewAsync(HttpClient client, Guid learnerId)
    {
        LearnerOverviewDto? overview =
            await client.GetFromJsonAsync<LearnerOverviewDto>($"/api/v1/learners/{learnerId}/overview", Json);
        Assert.NotNull(overview);
        return overview;
    }

    private DateTimeOffset StartOfToday() =>
        _factory.Services.GetRequiredService<Sm2Scheduler>().StartOfLocalDay(DateTimeOffset.UtcNow);

    private async Task<List<ReviewState>> StatesAsync(Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.ReviewStates.AsNoTracking().Where(r => r.LearnerId == learnerId).ToListAsync();
    }

    private async Task SeedStateAsync(User child, Guid cardId, ReviewCardState state, DateTimeOffset firstSeen, DateTimeOffset due)
    {
        await using var db = _factory.CreateSystemDbContext();
        db.ReviewStates.Add(new ReviewState
        {
            TenantId = child.TenantId,
            LearnerId = child.Id,
            CardId = cardId,
            State = state,
            FirstSeenAt = firstSeen,
            DueAt = due,
            // Altbestand, wie ihn der fruehere Start-Block angelegt hat: nie beantwortet.
            LastReviewedAt = state == ReviewCardState.New ? null : due.AddDays(-1),
            Repetitions = state == ReviewCardState.New ? 0 : 1,
            IntervalDays = state == ReviewCardState.New ? 0 : 1,
        });
        await db.SaveChangesAsync();
    }

    // ------------------------------------------------- FIX-03 / FIX-09

    [Fact]
    public async Task Abgebrochene_Runde_bietet_dieselben_neuen_Karten_wieder_an()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView first = await StartAsync(child, family.Child.Id);
        SessionView second = await StartAsync(child, family.Child.Id);

        Assert.Equal(5, first.Items.Count);
        foreach (SessionItemView item in first.Items)
        {
            Assert.Contains(second.Items, other => other.CardId == item.CardId);
        }

        Assert.Empty(await StatesAsync(family.Child.Id));
    }

    [Fact]
    public async Task Tageslimit_sinkt_erst_mit_der_ersten_Antwort()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        Assert.Equal(5, (await OverviewAsync(child, family.Child.Id)).NewRemainingToday);

        SessionView session = await StartAsync(child, family.Child.Id);
        Assert.Equal(5, (await OverviewAsync(child, family.Child.Id)).NewRemainingToday);
        Assert.Empty(await StatesAsync(family.Child.Id));

        DateTimeOffset before = DateTimeOffset.UtcNow;
        SessionItemView item = session.Items[0];
        await ReadAnswerAsync(await AnswerAsync(child, session.SessionId, item.ItemId, set.AnswerFor(item.Prompt)));

        Assert.Equal(4, (await OverviewAsync(child, family.Child.Id)).NewRemainingToday);
        ReviewState state = Assert.Single(await StatesAsync(family.Child.Id));
        Assert.Equal(item.CardId, state.CardId);
        Assert.NotNull(state.LastReviewedAt);
        Assert.True(state.FirstSeenAt >= before.AddSeconds(-5), $"FirstSeenAt {state.FirstSeenAt:O} liegt vor der Antwort.");
        Assert.NotEqual(ReviewCardState.New, state.State);
    }

    [Fact]
    public async Task Altbestand_von_gestern_kommt_wieder_und_zaehlt_am_Tag_der_Antwort()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        Guid legacyCard = set.Cards[1].Id;
        DateTimeOffset yesterday = StartOfToday().AddHours(-12);
        await SeedStateAsync(family.Child, legacyCard, ReviewCardState.New, yesterday, yesterday);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        Assert.Equal(5, (await OverviewAsync(child, family.Child.Id)).NewRemainingToday);

        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = Assert.Single(session.Items, i => i.CardId == legacyCard);

        DateTimeOffset before = DateTimeOffset.UtcNow;
        await ReadAnswerAsync(await AnswerAsync(child, session.SessionId, item.ItemId, set.AnswerFor(item.Prompt)));

        ReviewState state = Assert.Single(await StatesAsync(family.Child.Id));
        Assert.NotEqual(ReviewCardState.New, state.State);
        Assert.True(state.FirstSeenAt >= before.AddSeconds(-5), $"FirstSeenAt {state.FirstSeenAt:O} ist nicht der Antwortzeitpunkt.");
        Assert.Equal(4, (await OverviewAsync(child, family.Child.Id)).NewRemainingToday);
    }

    [Fact]
    public async Task Abgebrochene_Runde_ueber_mehrere_Sets_bietet_dieselben_Karten_wieder_an()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView first = await StartAsync(child, family.Child.Id);
        SessionView second = await StartAsync(child, family.Child.Id);

        Assert.Equal(
            first.Items.Select(i => i.CardId).Order(),
            second.Items.Select(i => i.CardId).Order());
    }

    [Fact]
    public async Task Altbestand_ohne_Antwort_steht_in_der_Ampel_als_neu()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        DateTimeOffset today = StartOfToday();
        await SeedStateAsync(family.Child, set.Cards[0].Id, ReviewCardState.New, today, today);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        JsonElement light = await owner.GetFromJsonAsync<JsonElement>(
            $"/api/v1/learners/{family.Child.Id}/traffic-light?setId={set.Set.Id}");

        Assert.Equal("new", light[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task Altbestand_von_heute_verbraucht_kein_Tageslimit()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        Guid legacyCard = set.Cards[1].Id;
        DateTimeOffset today = StartOfToday();
        await SeedStateAsync(family.Child, legacyCard, ReviewCardState.New, today, today);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        Assert.Equal(5, (await OverviewAsync(child, family.Child.Id)).NewRemainingToday);

        SessionView session = await StartAsync(child, family.Child.Id);
        Assert.Contains(session.Items, i => i.CardId == legacyCard);
        Assert.Equal(5, session.Items.Count);
    }

    [Fact]
    public async Task Heute_faellig_zaehlt_nur_Wiederholung_und_Neulernen()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        DateTimeOffset past = DateTimeOffset.UtcNow.AddDays(-2);
        await SeedStateAsync(family.Child, set.Cards[0].Id, ReviewCardState.New, past, past);
        await SeedStateAsync(family.Child, set.Cards[1].Id, ReviewCardState.Review, past, past);
        await SeedStateAsync(family.Child, set.Cards[2].Id, ReviewCardState.Relearning, past, past);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        Assert.Equal(2, (await OverviewAsync(child, family.Child.Id)).DueToday);
    }

    // ------------------------------------------------------------ FIX-04

    private static async Task<string?> DetailAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(Json);
        Assert.NotNull(problem);
        return problem.Detail;
    }

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string key)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem =
            await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>(Json);
        Assert.NotNull(problem);
        Assert.True(problem.Errors.ContainsKey(key), $"Schluessel {key} fehlt: {string.Join(", ", problem.Errors.Keys)}");
        return problem.Errors[key][0];
    }

    private static Task<HttpResponseMessage> StartRawAsync(HttpClient client, Guid learnerId, int? size) =>
        client.PostAsJsonAsync(Sessions, new { learnerId, setId = (Guid?)null, gameKey = "classic", size });

    private async Task<int> ReviewLogCountAsync(Guid learnerId, Guid cardId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.ReviewLogs.CountAsync(l => l.LearnerId == learnerId && l.CardId == cardId);
    }

    private async Task<(LearningSession Session, GamificationProfile Profile)> CountersAsync(Guid sessionId, Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        LearningSession session = await db.LearningSessions.AsNoTracking().Include(s => s.Items).SingleAsync(s => s.Id == sessionId);
        GamificationProfile profile = await db.GamificationProfiles.AsNoTracking().SingleAsync(p => p.Id == learnerId);
        return (session, profile);
    }

    /// <summary>
    /// Haelt in einer offenen Transaktion eine Zeilensperre (SELECT ... FOR UPDATE).
    /// Lesen bleibt frei (MVCC), Schreiben auf diese Zeilen wartet, bis der
    /// Aufrufer die Transaktion zuruecksetzt.
    /// </summary>
    private async Task<(WordQuestDbContext Db, IDbContextTransaction Lock)> LockRowsAsync(
        params (string Table, Guid Id)[] rows)
    {
        WordQuestDbContext db = _factory.CreateSystemDbContext();
        IDbContextTransaction transaction = await db.Database.BeginTransactionAsync();
        foreach ((string table, Guid id) in rows)
        {
            // Tabellennamen sind Konstanten dieser Testklasse, die Id geht als Parameter.
            string sql = "SELECT 1 FROM " + table + " WHERE id = {0} FOR UPDATE";
            await db.Database.ExecuteSqlRawAsync(sql, id);
        }

        return (db, transaction);
    }

    private static async Task ReleaseAsync((WordQuestDbContext Db, IDbContextTransaction Lock) held)
    {
        await held.Lock.RollbackAsync();
        await held.Lock.DisposeAsync();
        await held.Db.DisposeAsync();
    }

    /// <summary>
    /// Wartet, bis zwei Backends dieser Datenbank auf eine Sperre warten: Dann
    /// haben beide Anfragen gelesen und stehen vor dem Schreiben.
    /// </summary>
    private async Task WaitForTwoBlockedAsync()
    {
        await using var db = _factory.CreateSystemDbContext();
        for (int attempt = 0; attempt < 200; attempt++)
        {
            int waiting = await db.Database
                .SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'")
                .SingleAsync();
            if (waiting >= 2)
            {
                return;
            }

            await Task.Delay(50);
        }

        Assert.Fail("Nach 10 Sekunden warteten keine zwei Anfragen auf die Sperre.");
    }

    [Fact]
    public async Task Unbekannte_Runde_ergibt_404_mit_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        Guid unknown = Guid.NewGuid();

        Assert.Equal(SessionGone, await DetailAsync(
            await AnswerAsync(child, unknown, session.Items[0].ItemId, "x"), HttpStatusCode.NotFound));
        Assert.Equal(SessionGone, await DetailAsync(
            await child.PostAsync($"{Sessions}/{unknown}/complete", null), HttpStatusCode.NotFound));
    }

    [Fact]
    public async Task Fremde_Aufgabe_ergibt_404_mit_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);

        Assert.Equal(CardGone, await DetailAsync(
            await AnswerAsync(child, session.SessionId, Guid.NewGuid(), "x"), HttpStatusCode.NotFound));
    }

    [Fact]
    public async Task Waehrend_der_Runde_geloeschte_Karte_ergibt_404_statt_500()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = session.Items[0];
        Guid entryId = set.Cards.Single(c => c.Id == item.CardId).EntryId;

        HttpResponseMessage deleted = await owner.DeleteAsync($"/api/v1/sets/{set.Set.Id}/entries/{entryId}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        Assert.Equal(CardGone, await DetailAsync(
            await AnswerAsync(child, session.SessionId, item.ItemId, "x"), HttpStatusCode.NotFound));
    }

    [Fact]
    public async Task Start_fuer_fremdes_oder_unbekanntes_Kind_ergibt_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededFamily other = await SeedFamilyAsync(_factory);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        Assert.Equal(ChildGone, await DetailAsync(
            await StartRawAsync(owner, other.Child.Id, null), HttpStatusCode.NotFound));
        Assert.Equal(ChildGone, await DetailAsync(
            await StartRawAsync(owner, Guid.NewGuid(), null), HttpStatusCode.NotFound));
    }

    [Fact]
    public async Task Rundengroesse_ausserhalb_1_bis_50_ergibt_400()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        foreach (int size in new[] { 0, -1, 51 })
        {
            Assert.Equal(SizeInvalid, await FieldErrorAsync(await StartRawAsync(child, family.Child.Id, size), "size"));
        }

        foreach (int size in new[] { 1, 50 })
        {
            Assert.Equal(HttpStatusCode.OK, (await StartRawAsync(child, family.Child.Id, size)).StatusCode);
        }
    }

    [Fact]
    public async Task Wiederholte_Antwort_bleibt_200_ohne_neue_Wertung()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = session.Items[0];
        Guid clientAnswerId = Guid.NewGuid();

        AnswerResult first = await ReadAnswerAsync(
            await AnswerAsync(child, session.SessionId, item.ItemId, set.AnswerFor(item.Prompt), clientAnswerId));
        AnswerResult again = await ReadAnswerAsync(
            await AnswerAsync(child, session.SessionId, item.ItemId, set.AnswerFor(item.Prompt), clientAnswerId));

        Assert.True(first.XpAwarded > 0);
        Assert.Equal(0, again.XpAwarded);
        Assert.Equal(1, await ReviewLogCountAsync(family.Child.Id, item.CardId));
    }

    [Fact]
    public async Task Antwort_Id_einer_anderen_Aufgabe_ergibt_409()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        Guid clientAnswerId = Guid.NewGuid();

        SessionItemView first = session.Items[0];
        SessionItemView second = session.Items[1];
        await ReadAnswerAsync(await AnswerAsync(child, session.SessionId, first.ItemId, set.AnswerFor(first.Prompt), clientAnswerId));

        Assert.Equal(AlreadyAnswered, await DetailAsync(
            await AnswerAsync(child, session.SessionId, second.ItemId, set.AnswerFor(second.Prompt), clientAnswerId),
            HttpStatusCode.Conflict));
        Assert.Equal(0, await ReviewLogCountAsync(family.Child.Id, second.CardId));
    }

    [Fact]
    public async Task Gleichzeitige_Antworten_auf_dieselbe_Aufgabe_ergeben_200_und_409()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = session.Items[0];
        string answer = set.AnswerFor(item.Prompt);

        var held = await LockRowsAsync(("session_item", item.ItemId));
        Task<HttpResponseMessage> one = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        Task<HttpResponseMessage> two = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        await WaitForTwoBlockedAsync();
        await ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        HttpResponseMessage ok = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        HttpResponseMessage conflict = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(AlreadyAnswered, await DetailAsync(conflict, HttpStatusCode.Conflict));
        AnswerResult result = await ReadAnswerAsync(ok);

        Assert.Equal(1, await ReviewLogCountAsync(family.Child.Id, item.CardId));
        (LearningSession stored, GamificationProfile profile) = await CountersAsync(session.SessionId, family.Child.Id);
        Assert.True(result.XpAwarded > 0);
        Assert.Equal(result.XpAwarded, stored.XpAwarded);
        Assert.Equal(result.XpAwarded, profile.Xp);
        Assert.Equal(result.CoinsAwarded, profile.Coins);
    }

    [Fact]
    public async Task Gleichzeitige_Antworten_auf_eine_Wiederholung_ergeben_200_und_409()
    {
        // Karte mit vorhandenem Lernstand: Einzige Kollision ist das UPDATE der
        // Aufgabe, also der Pfad ueber das Concurrency-Token AnsweredAt.
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: 3);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid cardId = set.Cards[0].Id;
        DateTimeOffset past = DateTimeOffset.UtcNow.AddDays(-2);
        await SeedStateAsync(family.Child, cardId, ReviewCardState.Review, past, past);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = Assert.Single(session.Items, i => i.CardId == cardId);
        string answer = set.AnswerFor(item.Prompt);

        var held = await LockRowsAsync(("session_item", item.ItemId));
        Task<HttpResponseMessage> one = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        Task<HttpResponseMessage> two = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        await WaitForTwoBlockedAsync();
        await ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        HttpResponseMessage conflict = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(AlreadyAnswered, await DetailAsync(conflict, HttpStatusCode.Conflict));
        Assert.Equal(1, await ReviewLogCountAsync(family.Child.Id, cardId));
    }

    [Fact]
    public async Task Gleichzeitige_Antworten_auf_zwei_Aufgaben_verlieren_keine_Gutschrift()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView first = session.Items[0];
        SessionItemView second = session.Items[1];

        var held = await LockRowsAsync(("learning_session", session.SessionId), ("gamification_profile", family.Child.Id));
        Task<HttpResponseMessage> one = AnswerAsync(child, session.SessionId, first.ItemId, set.AnswerFor(first.Prompt));
        Task<HttpResponseMessage> two = AnswerAsync(child, session.SessionId, second.ItemId, set.AnswerFor(second.Prompt));
        await WaitForTwoBlockedAsync();
        await ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        AnswerResult a = await ReadAnswerAsync(responses[0]);
        AnswerResult b = await ReadAnswerAsync(responses[1]);
        (LearningSession stored, GamificationProfile profile) = await CountersAsync(session.SessionId, family.Child.Id);
        Assert.Equal(a.XpAwarded + b.XpAwarded, stored.XpAwarded);
        Assert.Equal(a.CoinsAwarded + b.CoinsAwarded, stored.CoinsAwarded);
        Assert.Equal(a.XpAwarded + b.XpAwarded, profile.Xp);
        Assert.Equal(a.CoinsAwarded + b.CoinsAwarded, profile.Coins);
    }

    [Fact]
    public async Task Gleichzeitige_Abschluesse_vergeben_den_Bonus_einmal()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = session.Items[0];
        AnswerResult answered = await ReadAnswerAsync(
            await AnswerAsync(child, session.SessionId, item.ItemId, set.AnswerFor(item.Prompt)));
        (int bonusXp, int bonusCoins) = XpRules.ForSessionCompletion(1, 1);

        var held = await LockRowsAsync(("learning_session", session.SessionId));
        Task<HttpResponseMessage> one = child.PostAsync($"{Sessions}/{session.SessionId}/complete", null);
        Task<HttpResponseMessage> two = child.PostAsync($"{Sessions}/{session.SessionId}/complete", null);
        await WaitForTwoBlockedAsync();
        await ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        (LearningSession stored, GamificationProfile profile) = await CountersAsync(session.SessionId, family.Child.Id);
        Assert.Equal(answered.XpAwarded + bonusXp, stored.XpAwarded);
        Assert.Equal(answered.CoinsAwarded + bonusCoins, stored.CoinsAwarded);
        Assert.Equal(answered.XpAwarded + bonusXp, profile.Xp);
        Assert.Equal(answered.CoinsAwarded + bonusCoins, profile.Coins);
        Assert.NotNull(stored.CompletedAt);
    }

    [Fact]
    public async Task Sync_ohne_Antworten_ergibt_400_und_fremde_Aufgabe_404_ohne_Schreiben()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = session.Items[0];

        HttpResponseMessage missing = await child.PostAsJsonAsync(
            $"{Sessions}/sync", new { sessionId = session.SessionId, answers = (object?)null });
        Assert.Equal("Es fehlen die Antworten.", await FieldErrorAsync(missing, "answers"));

        object Answer(Guid itemId, string text) =>
            new { itemId, givenAnswer = text, answerMs = 2000, clientAnswerId = Guid.NewGuid(), hintUsed = false };
        HttpResponseMessage foreign = await child.PostAsJsonAsync($"{Sessions}/sync", new
        {
            sessionId = session.SessionId,
            answers = new[] { Answer(item.ItemId, set.AnswerFor(item.Prompt)), Answer(Guid.NewGuid(), "x") },
        });
        Assert.Equal(CardGone, await DetailAsync(foreign, HttpStatusCode.NotFound));

        (LearningSession stored, _) = await CountersAsync(session.SessionId, family.Child.Id);
        Assert.All(stored.Items, i => Assert.Null(i.AnsweredAt));
        Assert.Equal(0, await ReviewLogCountAsync(family.Child.Id, item.CardId));
        Assert.Null(stored.CompletedAt);
    }
}
