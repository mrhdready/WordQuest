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
/// das Kind auf. Geprueft wird deshalb nicht, ob eine Formel stimmt, sondern
/// ob die Arbeitslast ueber ein Jahr beschraenkt bleibt und die Intervalle
/// tatsaechlich wachsen.
/// </summary>
public sealed class YearLongSimulationTests
{
    private const int TotalCards = 600;        // 300 Vokabeln in zwei Richtungen
    private const int Days = 365;
    private const int DailyNewLimit = 5;

    private sealed record Stats(
        int PeakDue,
        double SteadyStateDue,
        double AverageAnswered,
        double MedianInterval,
        int WorstNewPerDay,
        int CardsIntroduced);

    private sealed class CardState
    {
        public ReviewSnapshot Snapshot { get; set; }
        public DateTimeOffset DueAt { get; set; }
    }

    /// <summary>
    /// Ein Kind macht an manchen Tagen eine kurze Einheit, an anderen vier.
    /// Der Scheduler muss mit beidem zurechtkommen — und gerade der Fall
    /// "nur eine Einheit pro Tag" ist der gefaehrliche: dort ist die Kapazitaet
    /// am kleinsten und der Rueckstand laeuft am schnellsten davon.
    /// </summary>
    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(4)]
    public void DailyWorkloadStaysBoundedOverAFullSchoolYear(int sessionsPerDay)
    {
        Stats stats = Simulate(new SchedulerOptions(), sessionsPerDay);

        // 1. Das Tagesbudget haelt.
        Assert.True(stats.WorstNewPerDay <= DailyNewLimit,
            $"An einem Tag wurden {stats.WorstNewPerDay} neue Karten eingefuehrt, "
            + $"erlaubt sind {DailyNewLimit}.");

        // 2. Der Berg faelliger Karten laeuft nicht davon. Ohne die
        //    Rueckstandsbremse liegt dieser Wert bei ueber 250.
        Assert.True(stats.PeakDue < 120,
            $"Spitzenlast {stats.PeakDue} faellige Karten an einem Morgen — "
            + "das ueberfordert ein Kind.");

        // 3. Und er baut sich nicht dauerhaft auf.
        Assert.True(stats.SteadyStateDue < 80,
            $"Im letzten Vierteljahr im Schnitt {stats.SteadyStateDue:F0} faellige "
            + "Karten pro Morgen.");

        // 4. Es passiert ueberhaupt etwas — ein Scheduler, der nie etwas
        //    faellig stellt, wuerde die Pruefungen 2 und 3 sonst bestehen.
        Assert.True(stats.AverageAnswered > 8,
            $"Nur {stats.AverageAnswered:F1} Antworten pro Tag — der Scheduler "
            + "legt zu selten vor.");

        // 5. Und es fuehrt zu etwas. Das ist die aussagekraeftigste Zahl des
        //    ganzen Tests: Bei einem ueberlaufenden System bleibt der Median
        //    bei rund acht Tagen, weil jede Karte zu spaet drankommt und
        //    deshalb wieder vergessen wird. Gesund sind mehrere Wochen.
        Assert.True(stats.MedianInterval > 20,
            $"Median-Intervall nach einem Jahr nur {stats.MedianInterval:F1} Tage — "
            + "es festigt sich nichts.");
    }

    /// <summary>
    /// Belegt, wofuer die Rueckstandsbremse da ist. Wer sie entfernt, sieht
    /// hier, was passiert: Der Berg waechst ueber Monate, und die Intervalle
    /// bleiben klein, weil nichts mehr rechtzeitig wiederholt wird.
    /// </summary>
    [Fact]
    public void WithoutTheBacklogBrakeTheSystemDrowns()
    {
        var withBrake = new SchedulerOptions();
        var withoutBrake = new SchedulerOptions { NewCardBacklogLimit = int.MaxValue };

        Stats good = Simulate(withBrake, sessionsPerDay: 2);
        Stats bad = Simulate(withoutBrake, sessionsPerDay: 2);

        Assert.True(bad.PeakDue > good.PeakDue * 2,
            $"Ohne Bremse nur {bad.PeakDue} statt erwartet deutlich mehr als "
            + $"{good.PeakDue} — die Bremse scheint wirkungslos geworden zu sein.");

        Assert.True(good.MedianInterval > bad.MedianInterval * 2,
            $"Mit Bremse Median {good.MedianInterval:F0} Tage, ohne Bremse "
            + $"{bad.MedianInterval:F0} — der Unterschied sollte deutlich sein.");
    }

    [Fact]
    public void AllCardsGetIntroducedWhenNothingIsOverdue()
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

    // ------------------------------------------------------------- Simulation

    private static Stats Simulate(SchedulerOptions options, int sessionsPerDay)
    {
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

            for (int session = 0; session < sessionsPerDay; session++)
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

        List<double> intervals = [.. states.Values.Select(s => s.Snapshot.IntervalDays).Order()];

        return new Stats(
            PeakDue: dueEachMorning.Max(),
            SteadyStateDue: dueEachMorning.TakeLast(60).Average(),
            AverageAnswered: answeredEachDay.Average(),
            MedianInterval: intervals.Count == 0 ? 0 : intervals[intervals.Count / 2],
            WorstNewPerDay: worstNewPerDay,
            CardsIntroduced: states.Count);
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
