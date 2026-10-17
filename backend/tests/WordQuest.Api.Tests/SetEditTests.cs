using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Content.Entities;
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
    private const string EntryGone = "Diese Vokabel gibt es nicht (mehr).";
    private const string SourceMissing = "Bitte gib das deutsche Wort ein.";
    private const string TargetMissing = "Bitte gib das englische Wort ein.";
    private const string WordTooLong = "Das Wort darf höchstens 200 Zeichen lang sein.";

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

    private static Task<HttpResponseMessage> PutEntryAsync(
        HttpClient client, Guid setId, Guid entryId, string? sourceText, string? targetText) =>
        client.PutAsJsonAsync($"/api/v1/sets/{setId}/entries/{entryId}", new { sourceText, targetText });

    private static async Task<IDictionary<string, string[]>> FieldErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
        Assert.NotNull(problem);
        return problem.Errors;
    }

    private async Task<(string Source, string Target)> WordsAsync(Guid entryId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.VocabularyEntries.Where(e => e.Id == entryId)
            .Select(e => new ValueTuple<string, string>(e.SourceText, e.TargetText)).SingleAsync();
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

    // ------------------------------------------------- PAR-04: Vokabel korrigieren

    [Fact]
    public async Task Vokabel_korrigieren_behaelt_IDs_Lernstand_und_Zusatzfelder()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, children: 2, dailyNewLimit: 20);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 2);
        VocabularyEntry typo = set.Entries[0];
        typo.SourceText = "Hnud";
        typo.TargetText = "dgo";
        typo.Emoji = "🐶";
        typo.TargetAlternatives = ["hound"];
        await using (var db = _factory.CreateSystemDbContext())
        {
            db.VocabularyEntries.Update(typo);
            await db.SaveChangesAsync();
        }

        using HttpClient child = _factory.CreateClientFor(family.Child);
        await PlayAllAsync(child, family.Child.Id, set);
        Snapshot before = await SnapshotAsync(set.Set.Id);
        Assert.NotEmpty(before.States);

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        HttpResponseMessage response = await PutEntryAsync(owner, set.Set.Id, typo.Id, "  Hund ", "dog");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        VocabularyEntryDto? dto = await response.Content.ReadFromJsonAsync<VocabularyEntryDto>();
        Assert.NotNull(dto);
        Assert.Equal(typo.Id, dto.Id);
        Assert.Equal("Hund", dto.SourceText);
        Assert.Equal("dog", dto.TargetText);
        Assert.Equal("🐶", dto.Emoji);
        Assert.Equal(new[] { "hound" }, dto.TargetAlternatives);
        Snapshot after = await SnapshotAsync(set.Set.Id);
        Assert.Equal(before.Entries, after.Entries);
        Assert.Equal(before.Cards, after.Cards);
        Assert.Equal(before.States, after.States);
        await using (var db = _factory.CreateSystemDbContext())
        {
            VocabularyEntry stored = await db.VocabularyEntries.SingleAsync(e => e.Id == typo.Id);
            Assert.Equal("🐶", stored.Emoji);
            Assert.Equal(new[] { "hound" }, stored.TargetAlternatives);
        }

        // Das zweite Kind hat die Karten noch nie gesehen: seine Runde zeigt den neuen Text.
        using HttpClient sibling = _factory.CreateClientFor(family.Children[1]);
        HttpResponseMessage start = await sibling.PostAsJsonAsync("/api/v1/sessions",
            new { learnerId = family.Children[1].Id, setId = set.Set.Id, gameKey = "classic", size = (int?)null });
        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        SessionView? view = await start.Content.ReadFromJsonAsync<SessionView>(Json);
        Assert.NotNull(view);
        string[] prompts = [.. view.Items.Select(i => i.Prompt)];
        Assert.Contains(prompts, p => p is "Hund" or "dog");
        Assert.DoesNotContain(prompts, p => p is "Hnud" or "dgo");
    }

    public static TheoryData<string, string, string, string> InvalidWords => new()
    {
        { "", "dog", "sourceText", SourceMissing },
        { "   ", "dog", "sourceText", SourceMissing },
        { new string('a', 201), "dog", "sourceText", WordTooLong },
        { "Hund", "", "targetText", TargetMissing },
        { "Hund", "   ", "targetText", TargetMissing },
        { "Hund", new string('b', 201), "targetText", WordTooLong },
    };

    [Theory]
    [MemberData(nameof(InvalidWords))]
    public async Task Ungueltiges_Wort_ergibt_400_am_Feld_und_aendert_nichts(
        string sourceText, string targetText, string key, string message)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        VocabularyEntry entry = set.Entries[0];
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PutEntryAsync(owner, set.Set.Id, entry.Id, sourceText, targetText);

        IDictionary<string, string[]> errors = await FieldErrorsAsync(response);
        Assert.Equal(new[] { key }, errors.Keys);
        Assert.Equal(message, errors[key][0]);
        Assert.Equal((entry.SourceText, entry.TargetText), await WordsAsync(entry.Id));
    }

    [Fact]
    public async Task Beide_Woerter_leer_ergibt_beide_Feldfehler_200_Zeichen_sind_erlaubt()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid entryId = set.Entries[0].Id;
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        IDictionary<string, string[]> errors = await FieldErrorsAsync(await PutEntryAsync(owner, set.Set.Id, entryId, "", " "));
        Assert.Equal(SourceMissing, errors["sourceText"][0]);
        Assert.Equal(TargetMissing, errors["targetText"][0]);

        HttpResponseMessage exact = await PutEntryAsync(owner, set.Set.Id, entryId, new string('a', 200), new string('b', 200));
        Assert.Equal(HttpStatusCode.OK, exact.StatusCode);
        Assert.Equal((new string('a', 200), new string('b', 200)), await WordsAsync(entryId));
    }

    [Fact]
    public async Task Vokabel_einer_anderen_Familie_unbekannt_oder_aus_anderem_Set_ergibt_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet own = await SeedSetAsync(_factory, family, entries: 1);
        SeededSet ownOther = await SeedSetAsync(_factory, family, entries: 1);
        SeededFamily other = await SeedFamilyAsync(_factory);
        SeededSet foreign = await SeedSetAsync(_factory, other, entries: 1);
        VocabularyEntry foreignEntry = foreign.Entries[0];
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage foreignResponse = await PutEntryAsync(owner, foreign.Set.Id, foreignEntry.Id, "Gekapert", "hijacked");
        HttpResponseMessage unknown = await PutEntryAsync(owner, own.Set.Id, Guid.NewGuid(), "Hund", "dog");
        HttpResponseMessage wrongSet = await PutEntryAsync(owner, ownOther.Set.Id, own.Entries[0].Id, "Hund", "dog");

        Assert.Equal(EntryGone, await DetailAsync(foreignResponse));
        Assert.Equal(EntryGone, await DetailAsync(unknown));
        Assert.Equal(EntryGone, await DetailAsync(wrongSet));
        Assert.Equal((foreignEntry.SourceText, foreignEntry.TargetText), await WordsAsync(foreignEntry.Id));
        Assert.Equal((own.Entries[0].SourceText, own.Entries[0].TargetText), await WordsAsync(own.Entries[0].Id));
    }

    [Fact]
    public async Task Vokabel_korrigieren_mit_Kinder_Token_ergibt_403()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        VocabularyEntry entry = set.Entries[0];
        using HttpClient child = _factory.CreateClientFor(family.Child);

        HttpResponseMessage response = await PutEntryAsync(child, set.Set.Id, entry.Id, "Vom", "Kind");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal((entry.SourceText, entry.TargetText), await WordsAsync(entry.Id));
    }

    // ------------------------------------------------- Hinzufuegen: Laenge und 404

    private static Task<HttpResponseMessage> PostEntryAsync(HttpClient client, Guid setId, string sourceText, string targetText) =>
        client.PostAsJsonAsync($"/api/v1/sets/{setId}/entries", new { sourceText, targetText });

    private async Task<int> EntryCountAsync(Guid setId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.VocabularyEntries.CountAsync(e => e.SetId == setId);
    }

    public static TheoryData<string, string, string> TooLongWords => new()
    {
        { new string('a', 201), "dog", "sourceText" },
        { "Hund", new string('b', 201), "targetText" },
    };

    [Theory]
    [MemberData(nameof(TooLongWords))]
    public async Task Hinzufuegen_mit_201_Zeichen_ergibt_400_statt_500(string sourceText, string targetText, string key)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PostEntryAsync(owner, set.Set.Id, sourceText, targetText);

        IDictionary<string, string[]> errors = await FieldErrorsAsync(response);
        Assert.Equal(new[] { key }, errors.Keys);
        Assert.Equal(WordTooLong, errors[key][0]);
        Assert.Equal(1, await EntryCountAsync(set.Set.Id));
    }

    [Fact]
    public async Task Hinzufuegen_zu_unbekanntem_oder_fremdem_Set_ergibt_404_mit_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededFamily other = await SeedFamilyAsync(_factory);
        SeededSet foreign = await SeedSetAsync(_factory, other, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage unknown = await PostEntryAsync(owner, Guid.NewGuid(), "Hund", "dog");
        HttpResponseMessage foreignResponse = await PostEntryAsync(owner, foreign.Set.Id, "Hund", "dog");

        Assert.Equal(SetGone, await DetailAsync(unknown));
        Assert.Equal(SetGone, await DetailAsync(foreignResponse));
        Assert.Equal(1, await EntryCountAsync(foreign.Set.Id));
    }

    [Fact]
    public async Task Hinzufuegen_mit_leerer_Spalte_behaelt_den_Bestandstext()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        IDictionary<string, string[]> errors = await FieldErrorsAsync(await PostEntryAsync(owner, set.Set.Id, "  ", "dog"));

        Assert.Equal("Beide Spalten muessen befuellt sein.", errors["entry"][0]);
        Assert.Equal(1, await EntryCountAsync(set.Set.Id));
    }
}
