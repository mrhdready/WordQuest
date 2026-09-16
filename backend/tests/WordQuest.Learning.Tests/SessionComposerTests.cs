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
    public void FillsUpToTheSessionSize()
    {
        IReadOnlyList<SessionCandidate> session = _composer.Compose(
            [], Candidates(40, ReviewCardState.Review, 60), Candidates(40, ReviewCardState.New), 5, Now);

        Assert.Equal(15, session.Count);
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
