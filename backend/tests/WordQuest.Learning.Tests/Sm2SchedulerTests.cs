using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;
using WordQuest.Shared.Kernel;

namespace WordQuest.Learning.Tests;

public sealed class Sm2SchedulerTests
{
    // Ohne Streuung sind die Intervalle exakt pruefbar. Die Streuung selbst
    // wird in FuzzStaysWithinBounds getestet.
    private static readonly SchedulerOptions NoFuzz = new() { FuzzFactor = 0 };

    private static readonly DateTimeOffset Monday =
        new(2026, 3, 2, 17, 30, 0, TimeSpan.FromHours(1));

    private static Sm2Scheduler Scheduler(SchedulerOptions? options = null) =>
        new(options ?? NoFuzz, new Random(1));

    [Fact]
    public void FirstCorrectAnswer_SchedulesOneDayAhead()
    {
        ReviewOutcome outcome = Scheduler().Schedule(
            ReviewSnapshot.ForNewCard(NoFuzz), Grade.Good, Monday);

        Assert.Equal(1, outcome.Repetitions);
        Assert.Equal(1.0, outcome.IntervalDays, 3);
        Assert.Equal(ReviewCardState.Review, outcome.State);
    }

    [Fact]
    public void SecondCorrectAnswer_SchedulesThreeDaysAhead()
    {
        var after1 = new ReviewSnapshot(2.5, 1, 1, 0, ReviewCardState.Review);

        ReviewOutcome outcome = Scheduler().Schedule(after1, Grade.Good, Monday);

        Assert.Equal(2, outcome.Repetitions);
        Assert.Equal(3.0, outcome.IntervalDays, 3);
    }

    [Fact]
    public void ThirdCorrectAnswer_MultipliesByEaseFactor()
    {
        var after2 = new ReviewSnapshot(2.5, 3, 2, 0, ReviewCardState.Review);

        ReviewOutcome outcome = Scheduler().Schedule(after2, Grade.Good, Monday);

        // 3 Tage × Ease 2.5 = 7.5 Tage
        Assert.Equal(7.5, outcome.IntervalDays, 3);
    }

    [Fact]
    public void EasyAnswer_RaisesEaseFactor_GoodLeavesItAlone()
    {
        ReviewSnapshot start = ReviewSnapshot.ForNewCard(NoFuzz);

        Assert.Equal(2.6, Scheduler().Schedule(start, Grade.Easy, Monday).EaseFactor, 3);
        Assert.Equal(2.5, Scheduler().Schedule(start, Grade.Good, Monday).EaseFactor, 3);
        Assert.Equal(2.36, Scheduler().Schedule(start, Grade.Hard, Monday).EaseFactor, 3);
    }

    [Fact]
    public void HardAnswer_ShortensTheInterval()
    {
        var after2 = new ReviewSnapshot(2.5, 3, 2, 0, ReviewCardState.Review);

        ReviewOutcome hard = Scheduler().Schedule(after2, Grade.Hard, Monday);
        ReviewOutcome good = Scheduler().Schedule(after2, Grade.Good, Monday);

        Assert.True(hard.IntervalDays < good.IntervalDays);
    }

    [Fact]
    public void WrongAnswer_ComesBackWithinTheSameSession()
    {
        var mature = new ReviewSnapshot(2.5, 60, 8, 0, ReviewCardState.Review);

        ReviewOutcome outcome = Scheduler().Schedule(mature, Grade.Again, Monday);

        Assert.Equal(ReviewCardState.Relearning, outcome.State);
        Assert.Equal(Monday.AddMinutes(10), outcome.DueAt);
        Assert.Equal(0, outcome.Repetitions);
        Assert.Equal(1, outcome.Lapses);
        Assert.Equal(2.3, outcome.EaseFactor, 3);
    }

    [Fact]
    public void WrongAnswer_ResetsTheInterval_SoAMatureCardDoesNotJumpBackToHalfAYear()
    {
        var mature = new ReviewSnapshot(2.5, 120, 10, 0, ReviewCardState.Review);
        Sm2Scheduler scheduler = Scheduler();

        ReviewOutcome lapsed = scheduler.Schedule(mature, Grade.Again, Monday);
        Assert.Equal(0.0, lapsed.IntervalDays, 3);

        // Drei richtige Antworten danach: 1 Tag, 3 Tage, dann erst die Rampe.
        ReviewOutcome r1 = scheduler.Schedule(ToSnapshot(lapsed), Grade.Good, Monday);
        ReviewOutcome r2 = scheduler.Schedule(ToSnapshot(r1), Grade.Good, Monday);
        ReviewOutcome r3 = scheduler.Schedule(ToSnapshot(r2), Grade.Good, Monday);

        Assert.Equal(1.0, r1.IntervalDays, 3);
        Assert.Equal(3.0, r2.IntervalDays, 3);
        Assert.True(r3.IntervalDays < 10, $"Erwartet < 10 Tage, war {r3.IntervalDays}.");
    }

    [Fact]
    public void EaseFactor_StaysWithinBounds()
    {
        Sm2Scheduler scheduler = Scheduler();

        var snapshot = new ReviewSnapshot(2.5, 5, 3, 0, ReviewCardState.Review);
        for (int i = 0; i < 30; i++)
        {
            snapshot = ToSnapshot(scheduler.Schedule(snapshot, Grade.Hard, Monday));
        }

        Assert.Equal(NoFuzz.MinEaseFactor, snapshot.EaseFactor, 3);

        for (int i = 0; i < 30; i++)
        {
            snapshot = ToSnapshot(scheduler.Schedule(snapshot, Grade.Easy, Monday));
        }

        Assert.Equal(NoFuzz.MaxEaseFactor, snapshot.EaseFactor, 3);
    }

    [Fact]
    public void Interval_IsCappedAtSixMonths()
    {
        var snapshot = new ReviewSnapshot(2.8, 170, 12, 0, ReviewCardState.Review);

        ReviewOutcome outcome = Scheduler().Schedule(snapshot, Grade.Easy, Monday);

        Assert.Equal(NoFuzz.MaxIntervalDays, outcome.IntervalDays, 3);
    }

    [Fact]
    public void DueDate_IsNormalisedToEarlyMorningLocalTime()
    {
        // 2. Maerz 2026 um 17:30 Ortszeit, Intervall 1 Tag
        // → faellig am 3. Maerz um 04:00 Ortszeit (= 03:00 UTC im Winter).
        ReviewOutcome outcome = Scheduler().Schedule(
            ReviewSnapshot.ForNewCard(NoFuzz), Grade.Good, Monday);

        DateTimeOffset expected = new DateTimeOffset(2026, 3, 3, 4, 0, 0, TimeSpan.FromHours(1));

        Assert.Equal(expected.UtcDateTime, outcome.DueAt.UtcDateTime);
        Assert.Equal(TimeSpan.Zero, outcome.DueAt.Offset);
    }

    [Fact]
    public void DueDate_IsStoredAsUtc_SoNpgsqlAccceptsIt()
    {
        // Npgsql schreibt in timestamptz nur DateTimeOffset mit Offset 0.
        ReviewOutcome outcome = new Sm2Scheduler(new SchedulerOptions(), new Random(7))
            .Schedule(ReviewSnapshot.ForNewCard(NoFuzz), Grade.Good, Monday);

        Assert.Equal(TimeSpan.Zero, outcome.DueAt.Offset);
    }

    [Fact]
    public void Fuzz_StaysWithinFivePercent()
    {
        var options = new SchedulerOptions { FuzzFactor = 0.05 };
        var scheduler = new Sm2Scheduler(options, new Random(42));
        var snapshot = new ReviewSnapshot(2.5, 40, 5, 0, ReviewCardState.Review);

        for (int i = 0; i < 200; i++)
        {
            double interval = scheduler.Schedule(snapshot, Grade.Good, Monday).IntervalDays;
            double expected = 40 * 2.5;

            Assert.InRange(interval, expected * 0.95, expected * 1.05);
        }
    }

    [Fact]
    public void Apply_WritesEverythingBackToTheEntity()
    {
        var state = new ReviewState
        {
            LearnerId = Guid.NewGuid(),
            CardId = Guid.NewGuid(),
            DueAt = Monday,
        };

        Scheduler().Apply(state, Grade.Good, Monday);

        Assert.Equal(1, state.Repetitions);
        Assert.Equal(ReviewCardState.Review, state.State);
        Assert.Equal(Grade.Good, state.LastGrade);
        Assert.Equal(Monday, state.LastReviewedAt);
        Assert.True(state.DueAt > Monday);
    }

    private static ReviewSnapshot ToSnapshot(ReviewOutcome outcome) =>
        new(outcome.EaseFactor, outcome.IntervalDays, outcome.Repetitions, outcome.Lapses, outcome.State);
}
