using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Gamification.Services;
using WordQuest.Shared.Kernel;

namespace WordQuest.Learning.Tests;

public sealed class LevelCurveTests
{
    [Theory]
    [InlineData(0, 1)]
    [InlineData(279, 1)]
    [InlineData(280, 2)]
    [InlineData(1750, 5)]
    [InlineData(7000, 10)]
    [InlineData(43750, 25)]
    [InlineData(175000, 50)]
    public void MatchesTheDocumentedThresholds(int xp, int expectedLevel)
    {
        Assert.Equal(expectedLevel, LevelCurve.LevelFor(xp));
    }

    [Fact]
    public void TheFirstLevelUpHappensOnTheFirstEvening()
    {
        // Eine typische Session gibt 150-250 XP. Level 2 muss davon
        // erreichbar sein, sonst entscheidet das Kind nach dem ersten Abend,
        // dass nichts passiert.
        Assert.True(LevelCurve.XpRequiredFor(2) <= 300);
    }

    [Fact]
    public void LevelIsCappedAndNeverBelowOne()
    {
        Assert.Equal(1, LevelCurve.LevelFor(-5));
        Assert.Equal(LevelCurve.MaxLevel, LevelCurve.LevelFor(int.MaxValue));
    }

    [Fact]
    public void ProgressRunsFromZeroToOneWithinALevel()
    {
        int floor = LevelCurve.XpRequiredFor(5);
        int ceiling = LevelCurve.XpRequiredFor(6);

        Assert.Equal(0.0, LevelCurve.ProgressInLevel(floor), 3);
        Assert.InRange(LevelCurve.ProgressInLevel((floor + ceiling) / 2), 0.4, 0.6);
        Assert.True(LevelCurve.ProgressInLevel(ceiling - 1) > 0.9);
    }
}

public sealed class XpRulesTests
{
    [Fact]
    public void AWrongAnswerCostsNothing()
    {
        (int xp, int coins) = XpRules.ForAnswer(Grade.Again, 1.0);

        Assert.Equal(0, xp);
        Assert.Equal(0, coins);
    }

    [Fact]
    public void AFastAnswerIsWorthMoreThanASlowOne()
    {
        Assert.True(XpRules.ForAnswer(Grade.Easy, 1.0).Xp > XpRules.ForAnswer(Grade.Good, 1.0).Xp);
    }

    [Fact]
    public void MemoryCountsHalf()
    {
        Assert.Equal(5, XpRules.ForAnswer(Grade.Good, 0.5).Xp);
        Assert.Equal(10, XpRules.ForAnswer(Grade.Good, 1.0).Xp);
    }

    [Fact]
    public void APerfectSessionGetsTheBonus()
    {
        Assert.True(
            XpRules.ForSessionCompletion(10, 10).Xp > XpRules.ForSessionCompletion(10, 9).Xp);
    }

    [Fact]
    public void AnEmptySessionGetsNothing()
    {
        Assert.Equal(0, XpRules.ForSessionCompletion(0, 0).Xp);
    }
}

public sealed class StreakRulesTests
{
    private static GamificationProfile NewProfile() => new() { Id = Guid.NewGuid() };

    [Fact]
    public void ConsecutiveDaysIncreaseTheStreak()
    {
        GamificationProfile profile = NewProfile();
        var day = new DateOnly(2026, 5, 1);

        for (int i = 0; i < 5; i++)
        {
            StreakRules.RegisterActivity(profile, day.AddDays(i));
        }

        Assert.Equal(5, profile.CurrentStreak);
        Assert.Equal(5, profile.LongestStreak);
    }

    [Fact]
    public void TwiceOnTheSameDayCountsOnce()
    {
        GamificationProfile profile = NewProfile();
        var day = new DateOnly(2026, 5, 1);

        StreakRules.RegisterActivity(profile, day);
        StreakResult second = StreakRules.RegisterActivity(profile, day);

        Assert.Equal(1, profile.CurrentStreak);
        Assert.False(second.Increased);
    }

    [Fact]
    public void OneMissedDayIsBridgedAutomatically()
    {
        GamificationProfile profile = NewProfile();
        var start = new DateOnly(2026, 5, 1);

        for (int i = 0; i < 10; i++)
        {
            StreakRules.RegisterActivity(profile, start.AddDays(i));
        }

        // Tag 11 verpasst, an Tag 12 wieder da.
        StreakResult result = StreakRules.RegisterActivity(profile, start.AddDays(11));

        Assert.True(result.SaverUsed);
        Assert.False(result.Reset);
        Assert.Equal(12, profile.CurrentStreak);
        Assert.Equal(1, profile.StreakSaversLeft);
    }

    [Fact]
    public void TwoMissedDaysInARowResetTheStreak()
    {
        GamificationProfile profile = NewProfile();
        var start = new DateOnly(2026, 5, 1);

        StreakRules.RegisterActivity(profile, start);
        StreakResult result = StreakRules.RegisterActivity(profile, start.AddDays(3));

        Assert.True(result.Reset);
        Assert.Equal(1, profile.CurrentStreak);
    }

    [Fact]
    public void SaversAreLimitedPerMonthAndRefillOnTheFirst()
    {
        GamificationProfile profile = NewProfile();
        var day = new DateOnly(2026, 5, 1);

        StreakRules.RegisterActivity(profile, day);
        StreakRules.RegisterActivity(profile, day.AddDays(2));   // Retter 1
        StreakRules.RegisterActivity(profile, day.AddDays(4));   // Retter 2
        StreakResult third = StreakRules.RegisterActivity(profile, day.AddDays(6));

        Assert.True(third.Reset);
        Assert.Equal(0, profile.StreakSaversLeft);

        // Neuer Monat: Retter sind wieder da.
        StreakRules.RegisterActivity(profile, new DateOnly(2026, 6, 1));
        Assert.Equal(GamificationProfile.MonthlyStreakSavers, profile.StreakSaversLeft);
    }

    [Fact]
    public void ADateGoingBackwardsDoesNotDamageTheStreak()
    {
        // Kann bei Zeitumstellung oder beim Nachtragen offline erfasster
        // Sessions vorkommen.
        GamificationProfile profile = NewProfile();
        var day = new DateOnly(2026, 5, 10);

        StreakRules.RegisterActivity(profile, day);
        StreakRules.RegisterActivity(profile, day.AddDays(1));
        StreakResult late = StreakRules.RegisterActivity(profile, day);

        Assert.Equal(2, profile.CurrentStreak);
        Assert.False(late.Reset);
    }
}
