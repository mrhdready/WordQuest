using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Learning.Services;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// GET /api/v1/learners/{id}/overview zeigt die aktuelle Serie (FIX-05, D-12).
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
}
