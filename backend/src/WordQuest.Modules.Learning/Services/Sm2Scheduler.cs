using WordQuest.Modules.Learning.Entities;
using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Services;

/// <summary>Lernstand einer Karte als reiner Wert — ohne Datenbankbezug.</summary>
public readonly record struct ReviewSnapshot(
    double EaseFactor,
    double IntervalDays,
    int Repetitions,
    int Lapses,
    ReviewCardState State)
{
    public static ReviewSnapshot ForNewCard(SchedulerOptions options) =>
        new(options.InitialEaseFactor, 0, 0, 0, ReviewCardState.New);

    public static ReviewSnapshot From(ReviewState state) =>
        new(state.EaseFactor, state.IntervalDays, state.Repetitions, state.Lapses, state.State);
}

/// <summary>Ergebnis einer Terminierung.</summary>
public readonly record struct ReviewOutcome(
    double EaseFactor,
    double IntervalDays,
    int Repetitions,
    int Lapses,
    ReviewCardState State,
    DateTimeOffset DueAt);

/// <summary>
/// Terminierung nach SM-2 mit vierstufiger Bewertung (Konzept §6.1/§6.2).
///
/// Bewusst zustandslos und ohne Datenbankzugriff: Diese Klasse ist der Teil des
/// Systems, in dem ein Fehler unsichtbar schadet — ein falsch berechnetes
/// Intervall merkt niemand, aber das Kind lernt schlechter. Deshalb muss sie
/// vollstaendig als reine Funktion testbar sein.
/// </summary>
public sealed class Sm2Scheduler
{
    private readonly SchedulerOptions _options;
    private readonly Random _random;
    private readonly TimeZoneInfo _timeZone;

    public Sm2Scheduler(SchedulerOptions? options = null, Random? random = null)
    {
        _options = options ?? new SchedulerOptions();
        _random = random ?? Random.Shared;
        _timeZone = ResolveTimeZone(_options.TimeZoneId);
    }

    public SchedulerOptions Options => _options;

    /// <summary>Kalendertag in Ortszeit — Basis fuer Tagesbudget und Streak.</summary>
    public DateOnly LocalDate(DateTimeOffset now) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, _timeZone).Date);

    /// <summary>Beginn des aktuellen Kalendertags in Ortszeit, als UTC-Zeitpunkt.</summary>
    public DateTimeOffset StartOfLocalDay(DateTimeOffset now)
    {
        DateTimeOffset local = TimeZoneInfo.ConvertTime(now, _timeZone);
        DateTime startLocal = DateTime.SpecifyKind(local.Date, DateTimeKind.Unspecified);
        return new DateTimeOffset(startLocal, _timeZone.GetUtcOffset(startLocal)).ToUniversalTime();
    }

    public ReviewOutcome Schedule(ReviewSnapshot current, Grade grade, DateTimeOffset now)
    {
        return grade == Grade.Again
            ? Lapse(current, now)
            : Advance(current, grade, now);
    }

    /// <summary>Uebertraegt das Ergebnis auf die persistierte Entitaet.</summary>
    public ReviewOutcome Apply(ReviewState state, Grade grade, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(state);

        ReviewOutcome outcome = Schedule(ReviewSnapshot.From(state), grade, now);

        state.EaseFactor = outcome.EaseFactor;
        state.IntervalDays = outcome.IntervalDays;
        state.Repetitions = outcome.Repetitions;
        state.Lapses = outcome.Lapses;
        state.State = outcome.State;
        state.DueAt = outcome.DueAt;
        state.LastReviewedAt = now;
        state.LastGrade = grade;

        return outcome;
    }

    private ReviewOutcome Lapse(ReviewSnapshot current, DateTimeOffset now)
    {
        double ease = Math.Max(_options.MinEaseFactor, current.EaseFactor - _options.LapseEasePenalty);

        return new ReviewOutcome(
            EaseFactor: ease,
            // Das Intervall faellt auf null zurueck: die Karte durchlaeuft
            // wieder 1 Tag → 3 Tage → Rampe. Wer hier das alte Intervall
            // stehen laesst, terminiert eine gerade vergessene Karte nach
            // drei richtigen Antworten wieder auf ein halbes Jahr.
            IntervalDays: 0,
            Repetitions: 0,
            Lapses: current.Lapses + 1,
            State: ReviewCardState.Relearning,
            DueAt: (now + _options.RelearnDelay).ToUniversalTime());
    }

    private ReviewOutcome Advance(ReviewSnapshot current, Grade grade, DateTimeOffset now)
    {
        int gap = (int)Grade.Easy - (int)grade;          // 0 bei Easy, 2 bei Hard
        double delta = 0.1 - (gap * (0.08 + (gap * 0.02)));
        double ease = Math.Clamp(
            current.EaseFactor + delta, _options.MinEaseFactor, _options.MaxEaseFactor);

        int repetitions = current.Repetitions + 1;
        double hardFactor = grade == Grade.Hard ? _options.HardIntervalFactor : 1.0;

        double interval = repetitions switch
        {
            1 => _options.FirstIntervalDays,
            2 => _options.SecondIntervalDays,
            _ => Math.Max(current.IntervalDays, _options.FirstIntervalDays) * ease,
        };

        interval *= hardFactor;
        interval *= Fuzz();
        interval = Math.Clamp(interval, 1.0, _options.MaxIntervalDays);

        return new ReviewOutcome(
            EaseFactor: ease,
            IntervalDays: interval,
            Repetitions: repetitions,
            Lapses: current.Lapses,
            State: ReviewCardState.Review,
            DueAt: NextDueDate(now, interval));
    }

    private double Fuzz()
    {
        if (_options.FuzzFactor <= 0)
        {
            return 1.0;
        }

        return 1.0 + ((_random.NextDouble() * 2.0 - 1.0) * _options.FuzzFactor);
    }

    /// <summary>
    /// Faelligkeit auf <see cref="SchedulerOptions.DueHourLocal"/> Ortszeit
    /// normalisieren. Das Kind soll morgens vor der Schule sehen, was heute
    /// ansteht — nicht exakt 24 Stunden nach der letzten Antwort.
    /// </summary>
    private DateTimeOffset NextDueDate(DateTimeOffset now, double intervalDays)
    {
        DateTimeOffset local = TimeZoneInfo.ConvertTime(now, _timeZone);
        int wholeDays = Math.Max(1, (int)Math.Round(intervalDays, MidpointRounding.AwayFromZero));

        DateTime dueLocal = DateTime.SpecifyKind(
            local.Date.AddDays(wholeDays).AddHours(_options.DueHourLocal),
            DateTimeKind.Unspecified);

        // GetUtcOffset behandelt eine DateTime mit Kind=Unspecified als
        // Ortszeit dieser Zeitzone — genau das ist hier gemeint.
        TimeSpan offset = _timeZone.GetUtcOffset(dueLocal);

        // Als UTC zurueckgeben: Npgsql schreibt in eine timestamptz-Spalte nur
        // DateTimeOffset mit Offset 0. Der Zeitpunkt bleibt derselbe — die
        // Ortszeit war nur der Rechenweg, nicht das Ergebnis.
        return new DateTimeOffset(dueLocal, offset).ToUniversalTime();
    }

    private static TimeZoneInfo ResolveTimeZone(string id)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // Lieber UTC als ein Absturz beim Start: eine um zwei Stunden
            // verschobene Faelligkeit ist ein Schoenheitsfehler, eine nicht
            // startende Instanz nicht.
            return TimeZoneInfo.Utc;
        }
    }
}
