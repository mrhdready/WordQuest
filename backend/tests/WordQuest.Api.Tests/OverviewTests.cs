using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// GET /api/v1/learners/{id}/overview zeigt die aktuelle Serie (FIX-05, D-12)
/// und zaehlt sicher gelernte Woerter wie die Ampel (FIX-06, D-16).
/// Gemeinsame Factory, jede Familie eindeutig (Isolationsregel ApiFactory).
/// </summary>
public sealed class OverviewTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public OverviewTests(ApiFactory factory) => _factory = factory;

    // Heutiges Datum in Ortszeit, wie es die Uebersicht berechnet.
    private DateOnly Today() =>
        _factory.Services.GetRequiredService<Sm2Scheduler>().LocalDate(DateTimeOffset.UtcNow);

    private async Task<SeededFamily> FamilyWithStreakAsync(int? daysAgo, int streak = 5)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await using var db = _factory.CreateSystemDbContext();
        GamificationProfile profile = await db.GamificationProfiles.SingleAsync(g => g.Id == family.Child.Id);
        profile.CurrentStreak = daysAgo is null ? 0 : streak;
        profile.LongestStreak = streak;
        profile.LastActiveDate = daysAgo is null ? null : Today().AddDays(-daysAgo.Value);
        await db.SaveChangesAsync();
        return family;
    }

    private async Task<LearnerOverviewDto> OverviewAsync(SeededFamily family)
    {
        using HttpClient client = _factory.CreateClientFor(family.Owner);
        return (await client.GetFromJsonAsync<LearnerOverviewDto>($"/api/v1/learners/{family.Child.Id}/overview"))!;
    }

    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 5)] // ein verpasster Tag, Retter verfuegbar
    [InlineData(3, 0)] // zwei verpasste Tage
    public async Task Uebersicht_zeigt_die_aktuelle_Serie(int daysAgo, int expected)
    {
        SeededFamily family = await FamilyWithStreakAsync(daysAgo);

        Assert.Equal(expected, (await OverviewAsync(family)).Streak);
    }

    [Fact]
    public async Task Uebersicht_ohne_Aktivitaet_zeigt_Serie_0()
    {
        SeededFamily family = await FamilyWithStreakAsync(daysAgo: null);

        Assert.Equal(0, (await OverviewAsync(family)).Streak);
    }

    [Fact]
    public async Task Uebersicht_schreibt_die_gerissene_Serie_nicht_zurueck()
    {
        SeededFamily family = await FamilyWithStreakAsync(daysAgo: 3);

        Assert.Equal(0, (await OverviewAsync(family)).Streak);

        await using var db = _factory.CreateSystemDbContext();
        GamificationProfile stored = await db.GamificationProfiles.AsNoTracking().SingleAsync(g => g.Id == family.Child.Id);
        Assert.Equal(5, stored.CurrentStreak);
        Assert.Equal(Today().AddDays(-3), stored.LastActiveDate);
    }

    private static ReviewState Answered(SeededFamily family, Card card, int repetitions = 3, double easeFactor = 2.3, int lapses = 0) => new()
    {
        TenantId = family.Tenant.Id,
        LearnerId = family.Child.Id,
        CardId = card.Id,
        Repetitions = repetitions,
        EaseFactor = easeFactor,
        Lapses = lapses,
        DueAt = DateTimeOffset.UtcNow.AddDays(3),
        FirstSeenAt = DateTimeOffset.UtcNow.AddDays(-20),
        LastReviewedAt = DateTimeOffset.UtcNow.AddDays(-1),
        State = ReviewCardState.Review,
    };

    [Fact]
    public async Task Uebersicht_zaehlt_sicher_gelernte_Woerter_wie_die_Ampel()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet first = await SeedSetAsync(_factory, family, entries: 3);
        SeededSet second = await SeedSetAsync(_factory, family, entries: 2);

        // Je Wort zwei Karten (beide Richtungen), in der Reihenfolge der Woerter.
        await using (var db = _factory.CreateSystemDbContext())
        {
            db.ReviewStates.AddRange(
                Answered(family, first.Cards[0]),                 // Wort 1: beide gemeistert
                Answered(family, first.Cards[1]),
                Answered(family, first.Cards[2]),                 // Wort 2: eine gemeistert, eine ohne Lernstand
                                                                  // Wort 3: ohne Lernstand
                Answered(family, second.Cards[0], lapses: 3),     // Wort 4: dreimal vergessen
                Answered(family, second.Cards[2], repetitions: 0, easeFactor: 2.5), // Wort 5: neue Karten
                Answered(family, second.Cards[3], repetitions: 0, easeFactor: 2.5));
            await db.SaveChangesAsync();
        }

        LearnerOverviewDto overview = await OverviewAsync(family);
        using HttpClient client = _factory.CreateClientFor(family.Owner);
        List<TrafficLightDto> lights = (await client.GetFromJsonAsync<List<TrafficLightDto>>(
            $"/api/v1/learners/{family.Child.Id}/traffic-light"))!;

        Assert.Equal(1, overview.CardsMastered);
        Assert.Equal(5, overview.CardsTotal);
        Assert.Equal(5, lights.Count);
        Assert.Equal(overview.CardsMastered, lights.Count(l => l.Status == "green"));
        Assert.Equal(first.Entries[0].Id, lights.Single(l => l.Status == "green").EntryId);
    }

    // WR-05: Fuer ein geloeschtes oder unbekanntes Kind meldete die Ampel 200 mit
    // jedem Wort als "neu", als waere der Lernstand zurueckgesetzt.
    [Fact]
    public async Task Ampel_fuer_unbekanntes_Kind_ergibt_404_mit_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient client = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await client.GetAsync($"/api/v1/learners/{Guid.NewGuid()}/traffic-light");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Dieses Kind gibt es nicht (mehr).", problem?.Detail);
    }
}
