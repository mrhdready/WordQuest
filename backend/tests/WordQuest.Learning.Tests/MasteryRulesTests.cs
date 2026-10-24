using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;

namespace WordQuest.Learning.Tests;

/// <summary>Eine Meisterschaftsregel fuer Uebersicht und Ampel (FIX-06, D-05, D-16).</summary>
public sealed class MasteryRulesTests
{
    private static ReviewState State(int repetitions = 3, double easeFactor = 2.1, int lapses = 1) => new()
    {
        Repetitions = repetitions,
        EaseFactor = easeFactor,
        Lapses = lapses,
    };

    [Fact]
    public void WithoutAReviewStateACardIsNotMastered()
    {
        Assert.False(MasteryRules.IsMastered(null));
    }

    [Fact]
    public void ANewCardWithTheStartingEaseIsNotMastered()
    {
        Assert.False(MasteryRules.IsMastered(new ReviewState()));
    }

    [Fact]
    public void TheLimitsThemselvesCountAsMastered()
    {
        Assert.True(MasteryRules.IsMastered(State()));
    }

    [Theory]
    [InlineData(2, 2.1, 1)]
    [InlineData(3, 2.09, 1)]
    [InlineData(3, 2.1, 2)]
    public void BelowALimitACardIsNotMastered(int repetitions, double easeFactor, int lapses)
    {
        Assert.False(MasteryRules.IsMastered(State(repetitions, easeFactor, lapses)));
    }

    [Fact]
    public void AWordIsMasteredWhenBothDirectionsAre()
    {
        Assert.True(MasteryRules.IsWordMastered([State(), State(5, 2.5, 0)]));
    }

    [Fact]
    public void AWordWithAnUnseenDirectionIsNotMastered()
    {
        Assert.False(MasteryRules.IsWordMastered([State(), null]));
    }

    [Fact]
    public void AWordWithAnUnmasteredDirectionIsNotMastered()
    {
        Assert.False(MasteryRules.IsWordMastered([State(), State(repetitions: 1)]));
    }

    [Fact]
    public void AWordWithoutCardsIsNotMastered()
    {
        Assert.False(MasteryRules.IsWordMastered([]));
    }

    // Ampel (WR-04): dieselben Schwellen wie bisher im Endpoint, jetzt an einer Stelle.
    [Fact]
    public void AWordWithoutAnyReviewStateIsNew()
    {
        Assert.Equal(TrafficLight.New, MasteryRules.Light([null, null]));
    }

    [Theory]
    [InlineData(3, 2.5)]
    [InlineData(0, 1.79)]
    public void ManyLapsesOrALowEaseInOneDirectionIsRed(int lapses, double easeFactor)
    {
        Assert.Equal(TrafficLight.Red, MasteryRules.Light([State(), State(easeFactor: easeFactor, lapses: lapses)]));
    }

    [Fact]
    public void AnUnseenDirectionDoesNotMakeAWordRed()
    {
        Assert.Equal(TrafficLight.Yellow, MasteryRules.Light([State(repetitions: 1, easeFactor: 1.8, lapses: 2), null]));
    }

    [Fact]
    public void AWordIsGreenOnlyWhenBothDirectionsAreMastered()
    {
        Assert.Equal(TrafficLight.Green, MasteryRules.Light([State(), State()]));
        Assert.Equal(TrafficLight.Yellow, MasteryRules.Light([State(), null]));
    }
}
