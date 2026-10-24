using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Geschwister teilen den Mandanten; der Mandantenfilter trennt sie deshalb
/// nicht. Ein Kind darf fuer ein Geschwisterkind nichts tun und nichts lesen,
/// und dessen Lernstand und XP bleiben unveraendert (QUAL-01, D-13, T-02-26).
/// Gemeinsame Factory, jede Familie eindeutig (Isolationsregel ApiFactory).
/// </summary>
public sealed class SiblingIsolationTests : IClassFixture<ApiFactory>
{
    private const string Sessions = "/api/v1/sessions";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public SiblingIsolationTests(ApiFactory factory) => _factory = factory;

    private static object Answer(Guid itemId, string answer) => new
    {
        itemId,
        givenAnswer = answer,
        answerMs = 2000,
        clientAnswerId = Guid.NewGuid(),
        hintUsed = false,
    };

    /// <summary>Lernstand, Protokoll, Runden und Spielprofil des Kindes als Vergleichswert.</summary>
    private async Task<string> SnapshotAsync(Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        var snapshot = new
        {
            States = await db.ReviewStates.AsNoTracking().Where(r => r.LearnerId == learnerId)
                .OrderBy(r => r.CardId).ToListAsync(),
            Logs = await db.ReviewLogs.AsNoTracking().Where(l => l.LearnerId == learnerId)
                .OrderBy(l => l.Id).ToListAsync(),
            Sessions = await db.LearningSessions.AsNoTracking().Where(s => s.LearnerId == learnerId)
                .OrderBy(s => s.Id).ToListAsync(),
            Items = await db.SessionItems.AsNoTracking()
                .Where(i => db.LearningSessions.Any(s => s.Id == i.SessionId && s.LearnerId == learnerId))
                .OrderBy(i => i.Id).ToListAsync(),
            Game = await db.GamificationProfiles.AsNoTracking().Where(g => g.Id == learnerId).ToListAsync(),
        };
        return JsonSerializer.Serialize(snapshot, Json);
    }

    [Fact]
    public async Task Kind_kann_fuer_ein_Geschwisterkind_nichts_tun_und_nichts_lesen()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, children: 2);
        SeededSet set = await SeedSetAsync(_factory, family);
        Guid childB = family.Children[1].Id;
        using HttpClient clientA = _factory.CreateClientFor(family.Children[0]);
        using HttpClient clientB = _factory.CreateClientFor(family.Children[1]);

        // B hat eine offene Runde mit einer Antwort.
        HttpResponseMessage started = await clientB.PostAsJsonAsync(
            Sessions, new { learnerId = childB, setId = set.Set.Id, gameKey = "classic", size = (int?)null });
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        SessionView? viewB = await started.Content.ReadFromJsonAsync<SessionView>(Json);
        Assert.NotNull(viewB);
        Assert.True(viewB.Items.Count >= 2, "B braucht mindestens zwei Aufgaben.");
        SessionItemView first = viewB.Items[0];
        SessionItemView second = viewB.Items[1];
        HttpResponseMessage answered = await clientB.PostAsJsonAsync(
            $"{Sessions}/{viewB.SessionId}/answers", Answer(first.ItemId, set.AnswerFor(first.Prompt)));
        Assert.Equal(HttpStatusCode.OK, answered.StatusCode);

        string before = await SnapshotAsync(childB);
        Assert.Contains("\"logs\":[{", before);

        HttpResponseMessage start = await clientA.PostAsJsonAsync(
            Sessions, new { learnerId = childB, setId = set.Set.Id, gameKey = "classic", size = (int?)null });
        HttpResponseMessage answer = await clientA.PostAsJsonAsync(
            $"{Sessions}/{viewB.SessionId}/answers", Answer(second.ItemId, set.AnswerFor(second.Prompt)));
        HttpResponseMessage complete = await clientA.PostAsync($"{Sessions}/{viewB.SessionId}/complete", null);
        HttpResponseMessage sync = await clientA.PostAsJsonAsync(
            $"{Sessions}/sync",
            new { sessionId = viewB.SessionId, answers = new[] { Answer(second.ItemId, set.AnswerFor(second.Prompt)) } });
        HttpResponseMessage overview = await clientA.GetAsync($"/api/v1/learners/{childB}/overview");
        HttpResponseMessage trafficLight = await clientA.GetAsync($"/api/v1/learners/{childB}/traffic-light");

        Assert.Equal(HttpStatusCode.Forbidden, start.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, answer.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, complete.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, sync.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, overview.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, trafficLight.StatusCode);
        Assert.Equal(before, await SnapshotAsync(childB));
    }
}
