using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;

namespace WordQuest.Learning.Tests;

public sealed class SessionComposerTests
{
    private static readonly DateTimeOffset Now = new(2026, 5, 4, 17, 0, 0, TimeSpan.Zero);

    private readonly SessionComposer _composer = new();

    private static List<SessionCandidate> Candidates(int count, ReviewCardState state, int minutesOverdue = 0)
        => [.. Enumerable.Range(0, count).Select(i =>
            new SessionCandidate(Guid.NewGuid(), state, Now.AddMinutes(-minutesOverdue - i)))];

    [Fact]
    public void FillsUpWithNewCardsWhenNothingIsOverdue()
    {
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            [], Candidates(8, ReviewCardState.Review, 60), Candidates(40, ReviewCardState.New), 5, Now);

        Assert.Equal(13, session.Count);   // 8 faellige + 5 neue
    }

    [Fact]
    public void StopsIntroducingNewCardsWhenTheLearnerIsBehind()
    {
        // 40 faellige Karten sind mehr als eine Session fassen kann. Wer so
        // weit hinterherhaengt, bekommt keine neuen Woerter obendrauf - sonst
        // waechst der Berg ueber Monate, bis sich nichts mehr festigt.
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            [], Candidates(40, ReviewCardState.Review, 60), Candidates(40, ReviewCardState.New), 5, Now);

        Assert.Equal(10, session.Count);
        Assert.All(session, c => Assert.Equal(ReviewCardState.Review, c.State));
    }

    [Fact]
    public void RelearningCardsCountTowardsTheBacklog()
    {
        // Zwoelf faellige plus fuenf Wiedervorlagen sind siebzehn - knapp
        // ueber der Grenze. Fehler aus der laufenden Session sind Rueckstand
        // wie jeder andere.
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            Candidates(5, ReviewCardState.Relearning, 5),
            Candidates(12, ReviewCardState.Review, 60),
            Candidates(10, ReviewCardState.New),
            newCardsAllowedToday: 5,
            Now);

        Assert.DoesNotContain(session, c => c.State == ReviewCardState.New);
    }

    [Fact]
    public void TheBacklogBrakeIsAdjustable()
    {
        var generous = new SessionComposer(new SchedulerOptions { NewCardBacklogLimit = 100 });

        IReadOnlyList<SessionCandidate> session = generous.Compose(
            [], Candidates(40, ReviewCardState.Review, 60), Candidates(40, ReviewCardState.New), 5, Now);

        Assert.Equal(15, session.Count);   // 10 faellige + 5 neue
    }

    [Fact]
    public void NeverExceedsTheDailyBudgetForNewCards()
    {
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            [], [], Candidates(40, ReviewCardState.New), newCardsAllowedToday: 5, Now);

        Assert.Equal(5, session.Count);
    }

    [Fact]
    public void AnExhaustedDailyBudgetAddsNoNewCards()
    {
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            [], Candidates(3, ReviewCardState.Review, 60), Candidates(40, ReviewCardState.New), 0, Now);

        Assert.Equal(3, session.Count);
    }

    [Fact]
    public void CapsTheNumberOfDueRepetitions()
    {
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            [], Candidates(40, ReviewCardState.Review, 60), [], 5, Now);

        Assert.Equal(10, session.Count);
    }

    [Fact]
    public void PutsThisSessionsMistakesFirst()
    {
        List<SessionCandidate> relearning = Candidates(2, ReviewCardState.Relearning, 5);

        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            relearning, Candidates(20, ReviewCardState.Review, 60), [], 5, Now);

        Assert.Equal(relearning[1].CardId, session[0].CardId);   // aelteste Faelligkeit zuerst
        Assert.Contains(session.Take(2), c => c.CardId == relearning[0].CardId);
    }

    [Fact]
    public void IgnoresCardsThatAreNotDueYet()
    {
        var future = new SessionCandidate(Guid.NewGuid(), ReviewCardState.Review, Now.AddDays(3));

        IReadOnlyList<SessionCandidate> session = _composer.Compose([], [future], [], 5, Now);

        Assert.Empty(session);
    }

    [Fact]
    public void IgnoresSuspendedCards()
    {
        var suspended = new SessionCandidate(
            Guid.NewGuid(), ReviewCardState.Suspended, Now.AddDays(-1));

        IReadOnlyList<SessionCandidate> session = _composer.Compose([], [suspended], [], 5, Now);

        Assert.Empty(session);
    }

    [Fact]
    public void NeverRepeatsTheSameCardWithinOneSession()
    {
        Guid cardId = Guid.NewGuid();
        var duplicate = new SessionCandidate(cardId, ReviewCardState.Review, Now.AddDays(-1));
        var alsoRelearning = new SessionCandidate(cardId, ReviewCardState.Relearning, Now.AddMinutes(-5));

        IReadOnlyList<SessionCandidate> session =
            _composer.Compose([alsoRelearning], [duplicate], [], 5, Now);

        Assert.Single(session);
    }

    [Fact]
    public void OldestDueCardsComeFirst()
    {
        List<SessionCandidate> due = Candidates(5, ReviewCardState.Review, 60);

        IReadOnlyList<SessionCandidate> session = _composer.Compose([], due, [], 0, Now);

        Assert.Equal(due.OrderBy(c => c.DueAt).Select(c => c.CardId), session.Select(c => c.CardId));
    }
}
