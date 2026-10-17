using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WordQuest.Api.Contracts;
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
}
