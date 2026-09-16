using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;
using WordQuest.Shared.Kernel;

namespace WordQuest.Learning.Tests;

/// <summary>
/// Spielt ein volles Schuljahr mit einem synthetischen Lernenden durch.
///
/// Das ist der wichtigste Test des Projekts. Ein einzelnes falsch berechnetes
/// Intervall faellt niemandem auf — aber ein Terminierungsfehler summiert sich
/// ueber Wochen zu einem Tag mit 300 faelligen Karten, und an dem Tag hoert
/// das Kind auf. Genau das prueft dieser Test: nicht ob eine Formel stimmt,
/// sondern ob die Arbeitslast ueber ein Jahr beschraenkt bleibt.
/// </summary>
public sealed class YearLongSimulationTests
{
    private const int TotalCards = 600;        // 300 Vokabeln in zwei Richtungen
    private const int Days = 365;
    private const int DailyNewLimit = 5;
    // Vier kurze Einheiten sind die Obergrenze dessen, was ein Kind an einem
    // Tag freiwillig macht. Mehr Kapazitaet gibt es nicht - der Scheduler muss
    // also mit diesem Budget auskommen.
    private const int SessionsPerDay = 4;

    private sealed class CardState
    {
        public ReviewSnapshot Snapshot { get; set; }
        public DateTimeOffset DueAt { get; set; }
    }

    [Fact]
    public void DailyWorkloadStaysBoundedOverAFullSchoolYear()
    {
        var options = new SchedulerOptions();
        var scheduler = new Sm2Scheduler(options, new Random(4711));
        var composer = new SessionComposer(options);
        var rng = new Random(99);

        List<Guid> allCards = [.. Enumerable.Range(0, TotalCards).Select(_ => Guid.CreateVersion7())];
        var states = new Dictionary<Guid, CardState>();

        DateTimeOffset start = new(2026, 1, 5, 17, 0, 0, TimeSpan.Zero);

        var dueEachMorning = new List<int>();
        var answeredEachDay = new List<int>();
        int worstNewPerDay = 0;

        for (int day = 0; day < Days; day++)
        {
            DateTimeOffset morning = start.AddDays(day);

            dueEachMorning.Add(states.Count(s => s.Value.DueAt <= morning));

            int newToday = 0;
            int answeredToday = 0;

            for (int session = 0; session < SessionsPerDay; session++)
            {
                // Sessions liegen 15 Minuten auseinander, damit in derselben
                // Session falsch beantwortete Karten (Wiedervorlage nach
                // 10 Minuten) tatsaechlich wieder auftauchen.
                DateTimeOffset now = morning.AddMinutes(15 * session);

                List<SessionCandidate> relearning =
                [
                    .. states
                        .Where(s => s.Value.Snapshot.State == ReviewCardState.Relearning
                                    && s.Value.DueAt <= now)
                        .Select(s => new SessionCandidate(s.Key, s.Value.Snapshot.State, s.Value.DueAt))
                ];

                List<SessionCandidate> due =
                [
                    .. states
                        .Where(s => s.Value.Snapshot.State == ReviewCardState.Review
                                    && s.Value.DueAt <= now)
                        .Select(s => new SessionCandidate(s.Key, s.Value.Snapshot.State, s.Value.DueAt))
                ];

                List<SessionCandidate> fresh =
                [
                    .. allCards
                        .Where(c => !states.ContainsKey(c))
                        .Take(DailyNewLimit)
                        .Select(c => new SessionCandidate(c, ReviewCardState.New, now))
                ];

                IReadOnlyList<SessionCandidate> plan = composer.Compose(
                    relearning, due, fresh, DailyNewLimit - newToday, now);

                if (plan.Count == 0)
                {
                    break;
                }

                DateTimeOffset answerTime = now;
                foreach (SessionCandidate candidate in plan)
                {
                    answerTime = answerTime.AddSeconds(20);

                    if (!states.TryGetValue(candidate.CardId, out CardState? state))
                    {
                        state = new CardState
                        {
                            Snapshot = ReviewSnapshot.ForNewCard(options),
                            DueAt = now,
                        };
                        states[candidate.CardId] = state;
                        newToday++;
                    }

                    Grade grade = SimulateAnswer(rng, state.Snapshot);
                    ReviewOutcome outcome = scheduler.Schedule(state.Snapshot, grade, answerTime);

                    state.Snapshot = new ReviewSnapshot(
                        outcome.EaseFactor, outcome.IntervalDays,
                        outcome.Repetitions, outcome.Lapses, outcome.State);
                    state.DueAt = outcome.DueAt;

                    answeredToday++;
                }
            }

            worstNewPerDay = Math.Max(worstNewPerDay, newToday);
            answeredEachDay.Add(answeredToday);
        }

        int peakDue = dueEachMorning.Max();
        double steadyState = dueEachMorning.TakeLast(60).Average();
        double averageAnswered = answeredEachDay.Average();

        List<double> intervals = [.. states.Values.Select(s => s.Snapshot.IntervalDays).Order()];
        double medianInterval = intervals[intervals.Count / 2];

        // 1. Das Tagesbudget haelt. Ohne diese Deckelung entsteht die Lawine.
        Assert.True(worstNewPerDay <= DailyNewLimit,
            $"An einem Tag wurden {worstNewPerDay} neue Karten eingefuehrt, erlaubt sind {DailyNewLimit}.");

        // 2. Der Berg faelliger Karten laeuft nicht davon. Bei einem
        //    Terminierungsfehler liegt dieser Wert im vierstelligen Bereich.
        // Die Schwellen sind bewusst grosszuegig: sie sollen eine echte
        // Entgleisung fangen (die liegt im vierstelligen Bereich), nicht die
        // normale Schwankung eines stochastischen Modells.
        Assert.True(peakDue < 250,
            $"Spitzenlast {peakDue} faellige Karten an einem Morgen — das ueberfordert ein Kind.");

        // 3. Im eingeschwungenen Zustand bleibt es bei einer Handvoll
        //    Sessions pro Tag.
        Assert.True(steadyState < 120,
            $"Im letzten Vierteljahr im Schnitt {steadyState:F0} faellige Karten pro Morgen.");

        // 4. Es passiert ueberhaupt etwas — ein Scheduler, der nie etwas
        //    faellig stellt, wuerde die Pruefungen 2 und 3 sonst bestehen.
        Assert.True(averageAnswered > 10,
            $"Nur {averageAnswered:F1} Antworten pro Tag — der Scheduler legt zu selten vor.");

        // 5. Und es fuehrt zu etwas: nach einem Jahr sind die Intervalle
        //    gewachsen. Ein Scheduler, der jede Karte dauerhaft auf einem Tag
        //    stehen laesst, wuerde die Pruefungen 1 bis 4 sonst bestehen.
        Assert.True(medianInterval > 5,
            $"Median-Intervall nach einem Jahr nur {medianInterval:F1} Tage — es festigt sich nichts.");
    }

    [Fact]
    public void AllCardsGetIntroducedEventually()
    {
        var options = new SchedulerOptions();
        var composer = new SessionComposer(options);

        var seen = new HashSet<Guid>();
        List<Guid> allCards = [.. Enumerable.Range(0, 100).Select(_ => Guid.CreateVersion7())];
        DateTimeOffset now = new(2026, 1, 5, 17, 0, 0, TimeSpan.Zero);

        for (int day = 0; day < 30; day++)
        {
            List<SessionCandidate> fresh =
            [
                .. allCards.Where(c => !seen.Contains(c))
                    .Take(DailyNewLimit)
                    .Select(c => new SessionCandidate(c, ReviewCardState.New, now))
            ];

            foreach (SessionCandidate candidate in composer.Compose([], [], fresh, DailyNewLimit, now))
            {
                seen.Add(candidate.CardId);
            }

            now = now.AddDays(1);
        }

        // 30 Tage × 5 neue Karten reichen fuer 100 Karten mit Reserve.
        Assert.Equal(allCards.Count, seen.Count);
    }

    /// <summary>
    /// Antwortmodell eines realistischen Kindes: neue Woerter sitzen selten,
    /// oft wiederholte fast immer — aber nie ganz sicher.
    /// </summary>
    private static Grade SimulateAnswer(Random rng, ReviewSnapshot snapshot)
    {
        double accuracy = Math.Min(0.92, 0.55 + (0.06 * Math.Min(snapshot.Repetitions, 6)));

        if (rng.NextDouble() > accuracy)
        {
            return Grade.Again;
        }

        double roll = rng.NextDouble();
        return roll < 0.25 ? Grade.Easy
            : roll < 0.80 ? Grade.Good
            : Grade.Hard;
    }
}
