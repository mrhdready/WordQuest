using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Set umbenennen aendert das Set an Ort und Stelle (PAR-04, D-08): gleiche IDs,
/// Lernstand der Kinder bleibt. Titel Pflicht, hoechstens 200 Zeichen wie die
/// Spalte (T-02-13); fremde Sets sind 404 (T-02-12). Eigene Familien je Fall
/// (Isolationsregel ApiFactory), keine Aufrufe der Policy "auth".
/// </summary>
public sealed class SetEditTests : IClassFixture<ApiFactory>
{
    private const string SetGone = "Dieses Set gibt es nicht (mehr).";
    private const string TitleMissing = "Ein Set braucht einen Titel.";
    private const string TitleTooLong = "Der Titel darf höchstens 200 Zeichen lang sein.";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public SetEditTests(ApiFactory factory) => _factory = factory;

    /// <summary>Was beim Umbenennen gleich bleiben muss.</summary>
    private sealed record Snapshot(Guid[] Entries, Guid[] Cards, string[] States);

    // ------------------------------------------------------------ Hilfen

    private static Task<HttpResponseMessage> PatchAsync(HttpClient client, Guid setId, string? title) =>
        client.PatchAsJsonAsync($"/api/v1/sets/{setId}", new { title });

    /// <summary>Eine Runde zum Set, jede Aufgabe richtig beantwortet: echter Lernstand statt geseedeter Werte.</summary>
    private static async Task PlayAllAsync(HttpClient child, Guid learnerId, SeededSet set)
    {
        HttpResponseMessage start = await child.PostAsJsonAsync("/api/v1/sessions",
            new { learnerId, setId = set.Set.Id, gameKey = "classic", size = (int?)null });
        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        SessionView? view = await start.Content.ReadFromJsonAsync<SessionView>(Json);
        Assert.NotNull(view);
        Assert.NotEmpty(view.Items);
        foreach (SessionItemView item in view.Items)
        {
            HttpResponseMessage answer = await child.PostAsJsonAsync($"/api/v1/sessions/{view.SessionId}/answers", new
            {
                itemId = item.ItemId,
                givenAnswer = set.AnswerFor(item.Prompt),
                answerMs = 2000,
                clientAnswerId = Guid.NewGuid(),
                hintUsed = false,
            });
            Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
        }
    }

    private async Task<Snapshot> SnapshotAsync(Guid setId)
    {
        await using var db = _factory.CreateSystemDbContext();
        Guid[] entries = await db.VocabularyEntries.Where(e => e.SetId == setId)
            .OrderBy(e => e.Id).Select(e => e.Id).ToArrayAsync();
        Guid[] cards = await db.Cards.Where(c => entries.Contains(c.EntryId))
            .OrderBy(c => c.Id).Select(c => c.Id).ToArrayAsync();
        string[] states = await db.ReviewStates.Where(r => cards.Contains(r.CardId))
            .OrderBy(r => r.CardId).ThenBy(r => r.LearnerId)
            .Select(r => $"{r.LearnerId}/{r.CardId}/{r.Repetitions}/{r.EaseFactor}/{r.DueAt:O}")
            .ToArrayAsync();
        return new Snapshot(entries, cards, states);
    }

    private async Task<string> TitleAsync(Guid setId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.VocabularySets.Where(s => s.Id == setId).Select(s => s.Title).SingleAsync();
    }

    private static async Task<string?> TitleErrorAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
        Assert.NotNull(problem);
        return problem.Errors["title"][0];
    }

    private static async Task<string?> DetailAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        return problem.Detail;
    }

    // ------------------------------------------------------------ PAR-04

    [Fact]
    public async Task Umbenennen_behaelt_IDs_und_Lernstand()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: 20);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        await PlayAllAsync(child, family.Child.Id, set);
        Snapshot before = await SnapshotAsync(set.Set.Id);
        Assert.NotEmpty(before.States);

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        HttpResponseMessage response = await PatchAsync(owner, set.Set.Id, "  Unit 3 — At the zoo  ");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        VocabularySetDto? dto = await response.Content.ReadFromJsonAsync<VocabularySetDto>();
        Assert.NotNull(dto);
        Assert.Equal(set.Set.Id, dto.Id);
        Assert.Equal("Unit 3 — At the zoo", dto.Title);
        Assert.Equal(2, dto.EntryCount);
        List<VocabularySetDto>? list = await owner.GetFromJsonAsync<List<VocabularySetDto>>("/api/v1/sets");
        Assert.Contains(list!, s => s.Id == set.Set.Id && s.Title == "Unit 3 — At the zoo");
        Snapshot after = await SnapshotAsync(set.Set.Id);
        Assert.Equal(before.Entries, after.Entries);
        Assert.Equal(before.Cards, after.Cards);
        Assert.Equal(before.States, after.States);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Leerer_Titel_ergibt_400_und_aendert_nichts(string title)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PatchAsync(owner, set.Set.Id, title);

        Assert.Equal(TitleMissing, await TitleErrorAsync(response));
        Assert.Equal(set.Set.Title, await TitleAsync(set.Set.Id));
    }

    [Fact]
    public async Task Titel_mit_201_Zeichen_ergibt_400_mit_200_Zeichen_200()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage tooLong = await PatchAsync(owner, set.Set.Id, new string('a', 201));
        Assert.Equal(TitleTooLong, await TitleErrorAsync(tooLong));
        Assert.Equal(set.Set.Title, await TitleAsync(set.Set.Id));

        HttpResponseMessage exact = await PatchAsync(owner, set.Set.Id, new string('b', 200));
        Assert.Equal(HttpStatusCode.OK, exact.StatusCode);
        Assert.Equal(new string('b', 200), await TitleAsync(set.Set.Id));
    }

    [Fact]
    public async Task Set_einer_anderen_Familie_ergibt_404_und_bleibt_unveraendert()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededFamily other = await SeedFamilyAsync(_factory);
        SeededSet foreign = await SeedSetAsync(_factory, other);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PatchAsync(owner, foreign.Set.Id, "Gekapert");
        HttpResponseMessage unknown = await PatchAsync(owner, Guid.NewGuid(), "Gekapert");

        Assert.Equal(SetGone, await DetailAsync(response));
        Assert.Equal(SetGone, await DetailAsync(unknown));
        Assert.Equal(foreign.Set.Title, await TitleAsync(foreign.Set.Id));
    }

    [Fact]
    public async Task Kinder_Token_bekommt_403()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        HttpResponseMessage response = await PatchAsync(child, set.Set.Id, "Vom Kind");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(set.Set.Title, await TitleAsync(set.Set.Id));
    }

    [Fact]
    public async Task Anlegen_mit_201_Zeichen_ergibt_400_statt_500()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await owner.PostAsJsonAsync("/api/v1/sets", new { title = new string('a', 201) });

        Assert.Equal(TitleTooLong, await TitleErrorAsync(response));
    }
}
