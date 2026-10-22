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
using WordQuest.Modules.Content.Entities;
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
    private const string SessionCompleted = "Diese Runde ist schon beendet. Starte eine neue Runde.";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public SessionEndpointTests(ApiFactory factory) => _factory = factory;

    // ------------------------------------------------------------ Hilfen

    private static async Task<SessionView> StartAsync(
        HttpClient client, Guid learnerId, Guid? setId = null, string gameKey = GameCatalog.Classic)
    {
        HttpResponseMessage response = await client.PostAsJsonAsync(
            Sessions, new { learnerId, setId, gameKey, size = (int?)null });
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

    private Task SeedStateAsync(User child, Guid cardId, ReviewCardState state, DateTimeOffset firstSeen, DateTimeOffset due) =>
        SeedStateAsync(_factory, child, cardId, state, firstSeen, due);

    private static async Task SeedStateAsync(
        ApiFactory factory, User child, Guid cardId, ReviewCardState state, DateTimeOffset firstSeen, DateTimeOffset due)
    {
        await using var db = factory.CreateSystemDbContext();
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

        var held = await _factory.LockRowsAsync(("session_item", item.ItemId));
        Task<HttpResponseMessage> one = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        Task<HttpResponseMessage> two = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
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

        var held = await _factory.LockRowsAsync(("session_item", item.ItemId));
        Task<HttpResponseMessage> one = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        Task<HttpResponseMessage> two = AnswerAsync(child, session.SessionId, item.ItemId, answer);
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
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

        var held = await _factory.LockRowsAsync(("learning_session", session.SessionId), ("gamification_profile", family.Child.Id));
        Task<HttpResponseMessage> one = AnswerAsync(child, session.SessionId, first.ItemId, set.AnswerFor(first.Prompt));
        Task<HttpResponseMessage> two = AnswerAsync(child, session.SessionId, second.ItemId, set.AnswerFor(second.Prompt));
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
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

        var held = await _factory.LockRowsAsync(("learning_session", session.SessionId));
        Task<HttpResponseMessage> one = child.PostAsync($"{Sessions}/{session.SessionId}/complete", null);
        Task<HttpResponseMessage> two = child.PostAsync($"{Sessions}/{session.SessionId}/complete", null);
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
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

        // Eine leere Antwort in der Liste ergab 500 (W-1).
        HttpResponseMessage nullAnswer = await child.PostAsJsonAsync(
            $"{Sessions}/sync", new { sessionId = session.SessionId, answers = new object?[] { null } });
        Assert.Equal("Es fehlen die Antworten.", await FieldErrorAsync(nullAnswer, "answers"));

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

    // IN-01: Nach dem Abschluss (auch "Schliessen" mit offenen Aufgaben, D-03) wird
    // keine neue Antwort mehr gewertet. Eine Wiederholung bleibt 200 ohne XP (Konzept §13).
    [Fact]
    public async Task Antwort_auf_abgeschlossene_Runde_ergibt_409_ohne_Wertung()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView first = session.Items[0];
        SessionItemView open = session.Items[1];
        Guid firstAnswerId = Guid.NewGuid();
        await ReadAnswerAsync(await AnswerAsync(child, session.SessionId, first.ItemId, set.AnswerFor(first.Prompt), firstAnswerId));
        Assert.Equal(HttpStatusCode.OK, (await child.PostAsync($"{Sessions}/{session.SessionId}/complete", null)).StatusCode);
        (LearningSession before, GamificationProfile profileBefore) = await CountersAsync(session.SessionId, family.Child.Id);

        HttpResponseMessage late = await AnswerAsync(child, session.SessionId, open.ItemId, set.AnswerFor(open.Prompt));
        HttpResponseMessage lateSync = await child.PostAsJsonAsync($"{Sessions}/sync", new
        {
            sessionId = session.SessionId,
            answers = new[] { new { itemId = open.ItemId, givenAnswer = set.AnswerFor(open.Prompt), answerMs = 2000, clientAnswerId = Guid.NewGuid(), hintUsed = false } },
        });
        AnswerResult replay = await ReadAnswerAsync(
            await AnswerAsync(child, session.SessionId, first.ItemId, set.AnswerFor(first.Prompt), firstAnswerId));

        Assert.Equal(SessionCompleted, await DetailAsync(late, HttpStatusCode.Conflict));
        Assert.Equal(SessionCompleted, await DetailAsync(lateSync, HttpStatusCode.Conflict));
        Assert.Equal(0, replay.XpAwarded);
        (LearningSession after, GamificationProfile profileAfter) = await CountersAsync(session.SessionId, family.Child.Id);
        Assert.Null(after.Items.Single(i => i.Id == open.ItemId).AnsweredAt);
        Assert.Equal(0, await ReviewLogCountAsync(family.Child.Id, open.CardId));
        Assert.Equal(before.XpAwarded, after.XpAwarded);
        Assert.Equal(profileBefore.Xp, profileAfter.Xp);
        Assert.Equal(profileBefore.Coins, profileAfter.Coins);
    }

    // IN-02: Karte oder Kind wird geloescht, waehrend die Antwort schon gelesen hat
    // und vor dem Schreiben steht. Das Speichern scheitert dann am Fremdschluessel
    // (23503) oder trifft die per Kaskade geloeschte Aufgabe nicht mehr (0 Zeilen).
    // Beides ist "nicht mehr da" (404), kein Serverfehler und keine Doppel-Antwort.
    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Waehrend_der_Antwort_geloeschte_Karte_oder_Kind_ergibt_404(bool deleteChild, bool withState)
    {
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: withState ? 3 : 20);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Card card = set.Cards[0];
        if (withState)
        {
            DateTimeOffset past = DateTimeOffset.UtcNow.AddDays(-2);
            await SeedStateAsync(family.Child, card.Id, ReviewCardState.Review, past, past);
        }

        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView session = await StartAsync(child, family.Child.Id);
        SessionItemView item = Assert.Single(session.Items, i => i.CardId == card.Id);

        // Loeschen in offener Transaktion: Die Antwort liest noch alles (MVCC) und
        // wartet beim Schreiben auf die Zeilensperren; erst danach wird committet.
        await using WordQuestDbContext db = _factory.CreateSystemDbContext();
        await using IDbContextTransaction delete = await db.Database.BeginTransactionAsync();
        string sql = deleteChild
            ? "DELETE FROM app_user WHERE id = {0}"
            : "DELETE FROM vocabulary_entry WHERE id = {0}";
        await db.Database.ExecuteSqlRawAsync(sql, deleteChild ? family.Child.Id : card.EntryId);

        Task<HttpResponseMessage> answer = AnswerAsync(child, session.SessionId, item.ItemId, set.AnswerFor(item.Prompt));
        await _factory.WaitForBlockedAsync(1);
        await delete.CommitAsync();

        Assert.Equal(deleteChild ? SessionGone : CardGone, await DetailAsync(await answer, HttpStatusCode.NotFound));
    }

    // ------------------------------------------------------------ HARD-02

    private static bool InSet(SeededSet set, SessionItemView item) =>
        set.Cards.Any(c => c.Id == item.CardId);

    // Codex-Befund 6, D-08: Set A hat eine faellige Wiederholung und eine Karte im
    // Neulernen, Set B nur neue Woerter.
    private async Task<(SeededFamily Family, SeededSet A, SeededSet B)> SeedDueInSetAAsync()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet a = await SeedSetAsync(_factory, family, entries: 1);
        SeededSet b = await SeedSetAsync(_factory, family);
        DateTimeOffset past = DateTimeOffset.UtcNow.AddDays(-2);
        await SeedStateAsync(family.Child, a.Cards[0].Id, ReviewCardState.Review, past, past);
        await SeedStateAsync(family.Child, a.Cards[1].Id, ReviewCardState.Relearning, past, past);
        return (family, a, b);
    }

    [Fact]
    public async Task Set_Wahl_laesst_faellige_Karten_anderer_Sets_weg()
    {
        (SeededFamily family, SeededSet a, SeededSet b) = await SeedDueInSetAAsync();
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView session = await StartAsync(child, family.Child.Id, b.Set.Id);

        Assert.DoesNotContain(session.Items, i => InSet(a, i));
        Assert.Equal(5, session.Items.Count(i => InSet(b, i)));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Faellige_Karten_kommen_mit_ihrem_Set_und_ohne_Set(bool withSet)
    {
        (SeededFamily family, SeededSet a, _) = await SeedDueInSetAAsync();
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView session = await StartAsync(child, family.Child.Id, withSet ? a.Set.Id : null);

        Assert.Contains(session.Items, i => i.CardId == a.Cards[0].Id);
        Assert.Contains(session.Items, i => i.CardId == a.Cards[1].Id);
    }

    // Absicherung (D-19): Die Rueckstandsbremse zaehlt alle faelligen Karten des
    // Kindes. Wer in Set A 16 Karten offen hat, bekommt auch in Set B keine neuen.
    [Fact]
    public async Task Rueckstand_in_einem_Set_bremst_neue_Woerter_in_jedem_Set()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet a = await SeedSetAsync(_factory, family, entries: 8);
        SeededSet b = await SeedSetAsync(_factory, family);
        DateTimeOffset past = DateTimeOffset.UtcNow.AddDays(-2);
        foreach (Card card in a.Cards)
        {
            await SeedStateAsync(family.Child, card.Id, ReviewCardState.Review, past, past);
        }

        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView session = await StartAsync(child, family.Child.Id, b.Set.Id);

        Assert.DoesNotContain(session.Items, i => InSet(b, i));
    }

    private async Task MoveStartAsync(Guid sessionId, TimeSpan back)
    {
        await using var db = _factory.CreateSystemDbContext();
        await db.LearningSessions
            .Where(s => s.Id == sessionId)
            .ExecuteUpdateAsync(u => u.SetProperty(s => s.StartedAt, s => s.StartedAt - back));
    }

    // Codex-Befund 7, D-09, D-18: Neue Woerter einer offenen, unbeantworteten
    // Runde, die vor hoechstens 30 Minuten gestartet wurde, zaehlen beim
    // naechsten Start gegen das Tageslimit.
    [Theory]
    [InlineData(false, 0, 0)]
    [InlineData(true, 0, 5)]
    [InlineData(false, 31, 5)]
    [InlineData(false, 29, 0)]
    public async Task Offene_Runde_reserviert_neue_Woerter_fuer_30_Minuten(
        bool completeFirst, int minutesAgo, int expectedFromB)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet a = await SeedSetAsync(_factory, family);
        SeededSet b = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView first = await StartAsync(child, family.Child.Id, a.Set.Id);
        Assert.Equal(5, first.Items.Count);
        if (completeFirst)
        {
            Assert.Equal(HttpStatusCode.OK, (await child.PostAsync($"{Sessions}/{first.SessionId}/complete", null)).StatusCode);
        }

        if (minutesAgo > 0)
        {
            await MoveStartAsync(first.SessionId, TimeSpan.FromMinutes(minutesAgo));
        }

        SessionView second = await StartAsync(child, family.Child.Id, b.Set.Id);

        Assert.Equal(expectedFromB, second.Items.Count(i => InSet(b, i)));
    }

    // Review 03 LOW: Beantwortete Karten zaehlen ueber ihre Antwort, nur die
    // unbeantworteten bleiben reserviert. 2 verbraucht + 2 reserviert = 2 frei.
    [Fact]
    public async Task Teilantworten_geben_ihre_Reservierung_frei()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: 6);
        SeededSet a = await SeedSetAsync(_factory, family, entries: 2);
        SeededSet b = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView first = await StartAsync(child, family.Child.Id, a.Set.Id);
        Assert.Equal(4, first.Items.Count);
        foreach (SessionItemView item in first.Items.Take(2))
        {
            await ReadAnswerAsync(await AnswerAsync(child, first.SessionId, item.ItemId, a.AnswerFor(item.Prompt)));
        }

        SessionView second = await StartAsync(child, family.Child.Id, b.Set.Id);

        Assert.Equal(2, second.Items.Count(i => InSet(b, i)));
    }

    // Review 03 LOW: Dieselbe Karte in zwei offenen Runden ist einmal reserviert.
    [Fact]
    public async Task Karte_in_zwei_offenen_Runden_zaehlt_einmal()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet a = await SeedSetAsync(_factory, family, entries: 1);
        SeededSet b = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView first = await StartAsync(child, family.Child.Id, a.Set.Id);
        SessionView again = await StartAsync(child, family.Child.Id, a.Set.Id);
        Assert.Equal(2, first.Items.Count);
        Assert.Equal(first.Items.Select(i => i.CardId).Order(), again.Items.Select(i => i.CardId).Order());

        SessionView second = await StartAsync(child, family.Child.Id, b.Set.Id);

        Assert.Equal(3, second.Items.Count(i => InSet(b, i)));
    }

    // Review-Befund LOW 1: Eine im Klassenarbeit-Modus beantwortete Karte bleibt
    // im Zustand New, zaehlt aber schon ueber ihre Antwort gegen das Tageslimit.
    // Liegt sie noch unbeantwortet in einer offenen Runde, darf sie nicht ein
    // zweites Mal als reserviert zaehlen.
    [Fact]
    public async Task Im_Klassenarbeit_Modus_beantwortete_Karte_zaehlt_einmal()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet a = await SeedSetAsync(_factory, family, entries: 1);
        SeededSet b = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView classic = await StartAsync(child, family.Child.Id, a.Set.Id);
        SessionView cram = await StartAsync(child, family.Child.Id, a.Set.Id, GameCatalog.Cram);
        Assert.Equal(2, classic.Items.Count);
        SessionItemView item = cram.Items[0];
        await ReadAnswerAsync(await AnswerAsync(child, cram.SessionId, item.ItemId, a.AnswerFor(item.Prompt)));

        SessionView second = await StartAsync(child, family.Child.Id, b.Set.Id);

        // Limit 5: 1 ueber die Antwort verbraucht, 1 reserviert, 3 frei.
        Assert.Equal(3, second.Items.Count(i => InSet(b, i)));
    }

    // Codex-Befund 8, D-10: Karte 1 hat einen faelligen Lernstand und liegt in
    // zwei offenen Runden. Beide Antworten lesen den Lernstand, dann haelt die
    // Zeilensperre sie vor dem Schreiben an. Danach darf nur eine gewertet werden.
    private static async Task<ReviewState> AnswerSameCardInTwoSessionsAsync(
        ApiFactory factory, DateTimeOffset now, DateTimeOffset? lastReviewedAt = null)
    {
        SeededFamily family = await SeedFamilyAsync(factory, dailyNewLimit: 3);
        SeededSet set = await SeedSetAsync(factory, family, entries: 1);
        Guid cardId = set.Cards[0].Id;
        DateTimeOffset past = now.AddDays(-2);
        await SeedStateAsync(factory, family.Child, cardId, ReviewCardState.Review, past, past);
        if (lastReviewedAt is { } value)
        {
            await using var db = factory.CreateSystemDbContext();
            await db.ReviewStates
                .Where(r => r.LearnerId == family.Child.Id && r.CardId == cardId)
                .ExecuteUpdateAsync(u => u.SetProperty(r => r.LastReviewedAt, value));
        }

        using HttpClient child = factory.CreateClientFor(family.Child);
        SessionView[] sessions = [await StartAsync(child, family.Child.Id), await StartAsync(child, family.Child.Id)];
        SessionItemView[] items = [.. sessions.Select(s => Assert.Single(s.Items, i => i.CardId == cardId))];
        string answer = set.AnswerFor(items[0].Prompt);

        var held = await factory.LockReviewStateAsync(family.Child.Id, cardId);
        Task<HttpResponseMessage> one = AnswerAsync(child, sessions[0].SessionId, items[0].ItemId, answer);
        Task<HttpResponseMessage> two = AnswerAsync(child, sessions[1].SessionId, items[1].ItemId, answer);
        await factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        int okIndex = Array.FindIndex(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Equal(AlreadyAnswered, await DetailAsync(responses[1 - okIndex], HttpStatusCode.Conflict));
        AnswerResult result = await ReadAnswerAsync(responses[okIndex]);
        Assert.True(result.XpAwarded > 0);

        await using var check = factory.CreateSystemDbContext();
        Assert.Equal(1, await check.ReviewLogs.CountAsync(l => l.LearnerId == family.Child.Id && l.CardId == cardId));
        ReviewState stored = await check.ReviewStates.AsNoTracking()
            .SingleAsync(r => r.LearnerId == family.Child.Id && r.CardId == cardId);
        Assert.Equal(2, stored.Repetitions);
        GamificationProfile profile = await check.GamificationProfiles.AsNoTracking().SingleAsync(p => p.Id == family.Child.Id);
        Assert.Equal(result.XpAwarded, profile.Xp);
        LearningSession lost = await check.LearningSessions.AsNoTracking()
            .SingleAsync(s => s.Id == sessions[1 - okIndex].SessionId);
        Assert.Equal(0, lost.XpAwarded);
        return stored;
    }

    [Fact]
    public async Task Gleichzeitige_Antworten_auf_dieselbe_Karte_in_zwei_Runden_ergeben_200_und_409()
    {
        await AnswerSameCardInTwoSessionsAsync(_factory, DateTimeOffset.UtcNow);
    }

    // Review 03 MEDIUM: Liefert die Uhr denselben Wert, der schon gespeichert ist,
    // bliebe das Pruefen von last_reviewed_at wirkungslos. Jede Antwort muss den
    // Wert trotzdem aendern.
    [Fact]
    public async Task Gleichzeitige_Antworten_mit_fester_Uhr_ergeben_200_und_409()
    {
        // Die gemeinsame Factory zuerst starten: Eine neue Factory setzt die
        // Verbindung per Umgebungsvariable, ein spaeter Start der gemeinsamen
        // faende sonst die Datenbank der festen Uhr.
        _ = _factory.Services;
        DateTimeOffset now = DateTimeOffset.UtcNow;
        // Auf ganze Mikrosekunden gekuerzt, wie PostgreSQL speichert.
        DateTimeOffset fixedNow = new(now.Ticks - (now.Ticks % 10), TimeSpan.Zero);
        await using var clocked = new ApiFactory
        {
            TestServices = services => services.AddSingleton<TimeProvider>(new FixedClock(fixedNow)),
        };
        await clocked.InitializeAsync();

        ReviewState stored = await AnswerSameCardInTwoSessionsAsync(clocked, fixedNow, lastReviewedAt: fixedNow);

        Assert.True(stored.LastReviewedAt > fixedNow, $"last_reviewed_at {stored.LastReviewedAt:O} liegt nicht nach {fixedNow:O}.");
    }

    // EF-Warnung 10102 (Take ohne OrderBy): Der Vorrat fuer falsche Antwortoptionen
    // war auf 40 Woerter in Tabellenreihenfolge begrenzt. In groesseren Sets kamen
    // spaetere Woerter nie als falsche Option vor, eine Option von dort war also
    // immer die richtige (Konzept §7.1: Uebung, nicht Raten).
    [Fact]
    public async Task Falsche_Antwortoptionen_kommen_aus_dem_ganzen_Set()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: 20);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 50);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        var distractors = new HashSet<string>(StringComparer.Ordinal);
        for (int round = 0; round < 10; round++)
        {
            SessionView view = await StartAsync(child, family.Child.Id, set.Set.Id, GameCatalog.WordCatcher);
            foreach (SessionItemView item in view.Items)
            {
                Assert.NotNull(item.Choices);
                string correct = set.AnswerFor(item.Prompt);
                distractors.UnionWith(item.Choices.Where(choice => choice != correct));
            }
        }

        int entriesSeen = set.Entries.Count(e => distractors.Contains(e.SourceText) || distractors.Contains(e.TargetText));
        Assert.True(entriesSeen > 41, $"Nur {entriesSeen} von 50 Woertern kamen als falsche Option vor.");
    }
}
