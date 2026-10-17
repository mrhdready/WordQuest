using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Set und Vokabel loeschen hinterlassen keinen Lernstand (FIX-02, D-06);
/// Rundenstart prueft die optionale setId (FIX-04, T-02-35). Gemeinsame
/// Factory, deshalb eigene Familien je Fall und keine globalen Zaehlungen
/// (Isolationsregel ApiFactory). Keine Aufrufe der Policy "auth".
/// </summary>
public sealed class SetDeleteTests : IClassFixture<ApiFactory>
{
    private const string Sessions = "/api/v1/sessions";
    private const string CardGone = "Diese Karte gehört nicht zu dieser Runde. Starte eine neue Runde.";
    private const string SetGone = "Dieses Set gibt es nicht (mehr).";
    private const string EntryGone = "Diese Vokabel gibt es nicht (mehr).";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiFactory _factory;

    public SetDeleteTests(ApiFactory factory) => _factory = factory;

    /// <summary>Lerndaten zu einer Kartenmenge.</summary>
    private sealed record Learning(int States, int Logs, int Items);

    // ------------------------------------------------------------ Hilfen

    private static Task<HttpResponseMessage> PostStartAsync(HttpClient client, Guid learnerId, Guid? setId) =>
        client.PostAsJsonAsync(Sessions, new { learnerId, setId, gameKey = "classic", size = (int?)null });

    private static async Task<SessionView> StartAsync(HttpClient client, Guid learnerId, Guid? setId = null)
    {
        HttpResponseMessage response = await PostStartAsync(client, learnerId, setId);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        SessionView? view = await response.Content.ReadFromJsonAsync<SessionView>(Json);
        Assert.NotNull(view);
        return view;
    }

    private static Task<HttpResponseMessage> AnswerAsync(HttpClient client, Guid sessionId, SessionItemView item, string answer) =>
        client.PostAsJsonAsync($"{Sessions}/{sessionId}/answers", new
        {
            itemId = item.ItemId,
            givenAnswer = answer,
            answerMs = 2000,
            clientAnswerId = Guid.NewGuid(),
            hintUsed = false,
        });

    /// <summary>Startet eine Runde zum Set und beantwortet alle Aufgaben richtig.</summary>
    private static async Task<SessionView> PlayAllAsync(HttpClient client, Guid learnerId, SeededSet set)
    {
        SessionView view = await StartAsync(client, learnerId, set.Set.Id);
        Assert.NotEmpty(view.Items);
        foreach (SessionItemView item in view.Items)
        {
            HttpResponseMessage answer = await AnswerAsync(client, view.SessionId, item, set.AnswerFor(item.Prompt));
            Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
        }

        return view;
    }

    private static async Task<string?> DetailAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(Json);
        Assert.NotNull(problem);
        return problem.Detail;
    }

    private async Task<Learning> LearningAsync(IEnumerable<Guid> cards)
    {
        List<Guid> ids = cards.ToList();
        await using var db = _factory.CreateSystemDbContext();
        return new Learning(
            await db.ReviewStates.CountAsync(r => ids.Contains(r.CardId)),
            await db.ReviewLogs.CountAsync(l => ids.Contains(l.CardId)),
            await db.SessionItems.CountAsync(i => ids.Contains(i.CardId)));
    }

    private async Task<int> SessionCountAsync(Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.LearningSessions.CountAsync(s => s.LearnerId == learnerId);
    }

    private static IEnumerable<Guid> CardsOf(SeededSet set) => set.Cards.Select(c => c.Id);

    // ------------------------------------------------------------ FIX-02

    [Fact]
    public async Task Set_loeschen_entfernt_Lerndaten_und_laesst_die_Runde_ohne_Set_stehen()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: 20);
        SeededSet s1 = await SeedSetAsync(_factory, family, entries: 2);
        SeededSet s2 = await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView round1 = await PlayAllAsync(child, family.Child.Id, s1);
        await PlayAllAsync(child, family.Child.Id, s2);
        Learning beforeS1 = await LearningAsync(CardsOf(s1));
        Learning beforeS2 = await LearningAsync(CardsOf(s2));
        Assert.True(beforeS1.States > 0 && beforeS1.Logs > 0 && beforeS1.Items > 0);

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        HttpResponseMessage response = await owner.DeleteAsync($"/api/v1/sets/{s1.Set.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(new Learning(0, 0, 0), await LearningAsync(CardsOf(s1)));
        Assert.Equal(beforeS2, await LearningAsync(CardsOf(s2)));
        await using (var db = _factory.CreateSystemDbContext())
        {
            Guid? setId = await db.LearningSessions
                .Where(s => s.Id == round1.SessionId)
                .Select(s => s.SetId)
                .SingleAsync();
            Assert.Null(setId);
        }

        SessionView next = await StartAsync(child, family.Child.Id);
        Assert.DoesNotContain(next.Items, i => CardsOf(s1).Contains(i.CardId));
    }

    [Fact]
    public async Task Vokabel_loeschen_entfernt_die_Lerndaten_ihrer_zwei_Karten()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, dailyNewLimit: 20);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        await PlayAllAsync(child, family.Child.Id, set);
        Guid entryId = set.Entries[0].Id;
        Guid[] gone = set.Cards.Where(c => c.EntryId == entryId).Select(c => c.Id).ToArray();
        Guid[] kept = set.Cards.Where(c => c.EntryId != entryId).Select(c => c.Id).ToArray();
        Assert.Equal(2, gone.Length);
        Learning beforeGone = await LearningAsync(gone);
        Learning beforeKept = await LearningAsync(kept);
        Assert.True(beforeGone.States > 0 && beforeGone.Logs > 0 && beforeGone.Items > 0);

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        HttpResponseMessage response = await owner.DeleteAsync($"/api/v1/sets/{set.Set.Id}/entries/{entryId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(new Learning(0, 0, 0), await LearningAsync(gone));
        Assert.Equal(beforeKept, await LearningAsync(kept));
    }

    [Fact]
    public async Task Antwort_auf_die_Karte_einer_geloeschten_Vokabel_ergibt_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        SessionView view = await StartAsync(child, family.Child.Id, set.Set.Id);
        SessionItemView item = view.Items[0];
        Guid entryId = set.Cards.Single(c => c.Id == item.CardId).EntryId;

        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Assert.Equal(HttpStatusCode.NoContent,
            (await owner.DeleteAsync($"/api/v1/sets/{set.Set.Id}/entries/{entryId}")).StatusCode);
        HttpResponseMessage answer = await AnswerAsync(child, view.SessionId, item, set.AnswerFor(item.Prompt));

        Assert.Equal(CardGone, await DetailAsync(answer, HttpStatusCode.NotFound));
    }

    // ------------------------------------------- Set loeschen: IDOR und Rolle

    [Fact]
    public async Task Set_einer_anderen_Familie_oder_unbekannt_ergibt_404_mit_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededFamily other = await SeedFamilyAsync(_factory);
        SeededSet foreign = await SeedSetAsync(_factory, other);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await owner.DeleteAsync($"/api/v1/sets/{foreign.Set.Id}");
        HttpResponseMessage unknown = await owner.DeleteAsync($"/api/v1/sets/{Guid.NewGuid()}");

        Assert.Equal(SetGone, await DetailAsync(response, HttpStatusCode.NotFound));
        Assert.Equal(SetGone, await DetailAsync(unknown, HttpStatusCode.NotFound));
        await using var db = _factory.CreateSystemDbContext();
        Assert.True(await db.VocabularySets.AnyAsync(s => s.Id == foreign.Set.Id));
    }

    [Fact]
    public async Task Set_loeschen_mit_Kinder_Token_ergibt_403()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        HttpResponseMessage response = await child.DeleteAsync($"/api/v1/sets/{set.Set.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await using var db = _factory.CreateSystemDbContext();
        Assert.True(await db.VocabularySets.AnyAsync(s => s.Id == set.Set.Id));
    }

    // ---------------------------------------- Vokabel loeschen: IDOR und 404

    [Fact]
    public async Task Vokabel_einer_anderen_Familie_oder_unbekannt_ergibt_404_mit_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet own = await SeedSetAsync(_factory, family, entries: 1);
        SeededFamily other = await SeedFamilyAsync(_factory);
        SeededSet foreign = await SeedSetAsync(_factory, other, entries: 1);
        Guid foreignEntry = foreign.Entries[0].Id;
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await owner.DeleteAsync($"/api/v1/sets/{foreign.Set.Id}/entries/{foreignEntry}");
        HttpResponseMessage unknown = await owner.DeleteAsync($"/api/v1/sets/{own.Set.Id}/entries/{Guid.NewGuid()}");

        Assert.Equal(EntryGone, await DetailAsync(response, HttpStatusCode.NotFound));
        Assert.Equal(EntryGone, await DetailAsync(unknown, HttpStatusCode.NotFound));
        await using var db = _factory.CreateSystemDbContext();
        Assert.True(await db.VocabularyEntries.AnyAsync(e => e.Id == foreignEntry));
    }

    // ------------------------------------------------- Rundenstart mit setId

    [Fact]
    public async Task Rundenstart_mit_geloeschtem_oder_unbekanntem_Set_ergibt_404_ohne_Runde()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/api/v1/sets/{set.Set.Id}")).StatusCode);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        HttpResponseMessage deleted = await PostStartAsync(child, family.Child.Id, set.Set.Id);
        HttpResponseMessage unknown = await PostStartAsync(child, family.Child.Id, Guid.NewGuid());

        Assert.Equal(SetGone, await DetailAsync(deleted, HttpStatusCode.NotFound));
        Assert.Equal(SetGone, await DetailAsync(unknown, HttpStatusCode.NotFound));
        Assert.Equal(0, await SessionCountAsync(family.Child.Id));
    }

    [Fact]
    public async Task Rundenstart_mit_dem_Set_einer_anderen_Familie_ergibt_404_ohne_Runde()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family);
        SeededFamily other = await SeedFamilyAsync(_factory);
        SeededSet foreign = await SeedSetAsync(_factory, other);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        HttpResponseMessage response = await PostStartAsync(child, family.Child.Id, foreign.Set.Id);

        Assert.Equal(SetGone, await DetailAsync(response, HttpStatusCode.NotFound));
        Assert.Equal(0, await SessionCountAsync(family.Child.Id));
    }

    [Fact]
    public async Task Rundenstart_mit_eigenem_Set_traegt_die_setId()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family);
        using HttpClient child = _factory.CreateClientFor(family.Child);

        SessionView view = await StartAsync(child, family.Child.Id, set.Set.Id);

        await using var db = _factory.CreateSystemDbContext();
        Guid? setId = await db.LearningSessions.Where(s => s.Id == view.SessionId).Select(s => s.SetId).SingleAsync();
        Assert.Equal(set.Set.Id, setId);
    }
}
