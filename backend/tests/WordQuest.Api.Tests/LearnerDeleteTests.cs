using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// DELETE /api/v1/learners/{id} (PAR-03, D-07, FIX-04/D-11). Die Lerndaten
/// entstehen ueber echte Antworten der Kinder; geloescht wird ueber die
/// Fremdschluessel der Datenbank. Gemeinsame Factory, deshalb eigene Familien
/// je Fall und keine globalen Zaehlungen (Isolationsregel ApiFactory).
/// Hoechstens 4 Aufrufe der Policy "auth" (heute 3: zwei learner-login, ein refresh).
/// </summary>
public sealed class LearnerDeleteTests : IClassFixture<ApiFactory>
{
    private const string Learners = "/api/v1/learners";
    private const string ChildGone = "Dieses Kind gibt es nicht (mehr).";
    private const string ProfileGone = "Dieses Profil gibt es nicht mehr. Bitte melde dich ab.";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public LearnerDeleteTests(ApiFactory factory) => _factory = factory;

    /// <summary>Zeilen eines Kindes je Tabelle.</summary>
    private sealed record Footprint(
        int Users, int Profiles, int States, int Logs, int Sessions, int Items, int Games, int Tokens);

    // ------------------------------------------------------------ Hilfen

    /// <summary>Startet eine Runde und beantwortet die erste Aufgabe richtig.</summary>
    private static async Task PlayOneAnswerAsync(HttpClient client, Guid learnerId, SeededSet set)
    {
        HttpResponseMessage start = await client.PostAsJsonAsync(
            "/api/v1/sessions", new { learnerId, setId = (Guid?)null, gameKey = "classic", size = (int?)null });
        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        SessionView? view = await start.Content.ReadFromJsonAsync<SessionView>(Json);
        Assert.NotNull(view);
        SessionItemView item = view.Items[0];

        HttpResponseMessage answer = await client.PostAsJsonAsync($"/api/v1/sessions/{view.SessionId}/answers", new
        {
            itemId = item.ItemId,
            givenAnswer = set.AnswerFor(item.Prompt),
            answerMs = 2000,
            clientAnswerId = Guid.NewGuid(),
            hintUsed = false,
        });
        Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
    }

    private async Task<AuthResponse> LearnerLoginAsync(Guid learnerId)
    {
        using HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/v1/auth/learner-login", new { learnerId, pin = ChildPin });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AuthResponse? tokens = await response.Content.ReadFromJsonAsync<AuthResponse>(Json);
        Assert.NotNull(tokens);
        return tokens;
    }

    private static Task<HttpResponseMessage> DeleteAsync(HttpClient client, Guid learnerId) =>
        client.DeleteAsync($"{Learners}/{learnerId}");

    private static async Task<string?> DetailAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(Json);
        Assert.NotNull(problem);
        return problem.Detail;
    }

    private async Task<List<Guid>> SessionIdsAsync(Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.LearningSessions.Where(s => s.LearnerId == learnerId).Select(s => s.Id).ToListAsync();
    }

    private async Task<Footprint> FootprintAsync(Guid learnerId, IReadOnlyCollection<Guid> sessionIds)
    {
        await using var db = _factory.CreateSystemDbContext();
        return new Footprint(
            await db.Users.CountAsync(u => u.Id == learnerId),
            await db.LearnerProfiles.CountAsync(p => p.Id == learnerId),
            await db.ReviewStates.CountAsync(r => r.LearnerId == learnerId),
            await db.ReviewLogs.CountAsync(l => l.LearnerId == learnerId),
            await db.LearningSessions.CountAsync(s => s.LearnerId == learnerId),
            await db.SessionItems.CountAsync(i => sessionIds.Contains(i.SessionId)),
            await db.GamificationProfiles.CountAsync(g => g.Id == learnerId),
            await db.RefreshTokens.CountAsync(t => t.UserId == learnerId));
    }

    private async Task<bool> UserExistsAsync(Guid userId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.Users.AnyAsync(u => u.Id == userId);
    }

    // ------------------------------------------------------------ PAR-03

    [Fact]
    public async Task Elternteil_loescht_Kind_samt_Lerndaten_und_Geschwister_bleibt_unveraendert()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, children: 2);
        SeededSet set = await SeedSetAsync(_factory, family);
        Guid childA = family.Children[0].Id;
        Guid childB = family.Children[1].Id;
        using HttpClient clientA = _factory.CreateClientFor(family.Children[0]);
        using HttpClient clientB = _factory.CreateClientFor(family.Children[1]);
        await PlayOneAnswerAsync(clientA, childA, set);
        await PlayOneAnswerAsync(clientB, childB, set);
        await LearnerLoginAsync(childA);

        List<Guid> sessionsA = await SessionIdsAsync(childA);
        List<Guid> sessionsB = await SessionIdsAsync(childB);
        Footprint beforeA = await FootprintAsync(childA, sessionsA);
        Footprint beforeB = await FootprintAsync(childB, sessionsB);
        // Ohne Daten in jeder Tabelle bewiese das Loeschen nichts.
        Assert.Equal(new Footprint(1, 1, 1, 1, 1, beforeA.Items, 1, 1), beforeA);
        Assert.True(beforeA.Items > 0);

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        HttpResponseMessage response = await DeleteAsync(owner, childA);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(new Footprint(0, 0, 0, 0, 0, 0, 0, 0), await FootprintAsync(childA, sessionsA));
        Assert.Equal(beforeB, await FootprintAsync(childB, sessionsB));
    }

    [Fact]
    public async Task Elternteil_einer_anderen_Familie_bekommt_404_und_das_Kind_bleibt()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededFamily other = await SeedFamilyAsync(_factory);

        using HttpClient stranger = _factory.CreateClientFor(other.Owner);
        HttpResponseMessage response = await DeleteAsync(stranger, family.Child.Id);

        Assert.Equal(ChildGone, await DetailAsync(response, HttpStatusCode.NotFound));
        Assert.True(await UserExistsAsync(family.Child.Id));
    }

    [Fact]
    public async Task Kinder_Token_bekommt_403()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, children: 2);

        using HttpClient sibling = _factory.CreateClientFor(family.Children[1]);
        HttpResponseMessage response = await DeleteAsync(sibling, family.Children[0].Id);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True(await UserExistsAsync(family.Children[0].Id));
    }

    [Fact]
    public async Task Elternkonto_laesst_sich_nicht_ueber_den_Kind_Endpunkt_loeschen()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        HttpResponseMessage response = await DeleteAsync(owner, family.Owner.Id);

        Assert.Equal(ChildGone, await DetailAsync(response, HttpStatusCode.NotFound));
        Assert.True(await UserExistsAsync(family.Owner.Id));
    }

    // ------------------------------------------------------------ FIX-04 / D-11

    [Fact]
    public async Task Geraet_des_geloeschten_Kindes_bekommt_401_und_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        AuthResponse device = await LearnerLoginAsync(family.Child.Id);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Assert.Equal(HttpStatusCode.NoContent, (await DeleteAsync(owner, family.Child.Id)).StatusCode);

        using HttpClient client = _factory.CreateClient();
        HttpResponseMessage refresh = await client.PostAsJsonAsync(
            "/api/v1/auth/refresh", new { refreshToken = device.RefreshToken });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", device.AccessToken);
        HttpResponseMessage overview = await client.GetAsync($"{Learners}/{family.Child.Id}/overview");
        HttpResponseMessage start = await client.PostAsJsonAsync(
            "/api/v1/sessions", new { learnerId = family.Child.Id, gameKey = "classic" });

        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        Assert.Equal(ProfileGone, await DetailAsync(overview, HttpStatusCode.NotFound));
        Assert.Equal(ChildGone, await DetailAsync(start, HttpStatusCode.NotFound));
    }
}
