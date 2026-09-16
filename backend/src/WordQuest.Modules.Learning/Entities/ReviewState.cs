using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Entities;

public enum ReviewCardState
{
    /// <summary>Noch nie abgefragt.</summary>
    New = 0,

    /// <summary>Reserviert fuer mehrstufige Einfuehrung — im MVP nicht benutzt.</summary>
    Learning = 1,

    /// <summary>In regulaerer Wiederholung.</summary>
    Review = 2,

    /// <summary>Zuletzt falsch beantwortet, kommt in derselben Session wieder.</summary>
    Relearning = 3,

    /// <summary>Vom Guardian pausiert. Wird nicht mehr terminiert.</summary>
    Suspended = 4,
}

/// <summary>
/// Lernstand eines Kindes zu EINER Karte (= einem Vokabelpaar in einer
/// Richtung). Primaerschluessel ist (LearnerId, CardId).
/// </summary>
public sealed class ReviewState : ITenantOwned
{
    public Guid TenantId { get; set; }
    public Guid LearnerId { get; set; }
    public Guid CardId { get; set; }

    /// <summary>SM-2-Leichtigkeitsfaktor. Startwert 2.5, Bereich 1.3 bis 2.8.</summary>
    public double EaseFactor { get; set; } = 2.5;

    /// <summary>Aktuelles Intervall in Tagen, ungerundet.</summary>
    public double IntervalDays { get; set; }

    /// <summary>Zahl der aufeinanderfolgenden richtigen Antworten.</summary>
    public int Repetitions { get; set; }

    /// <summary>Wie oft die Karte insgesamt vergessen wurde. Basis der roten Ampel.</summary>
    public int Lapses { get; set; }

    public DateTimeOffset DueAt { get; set; }

    /// <summary>
    /// Wann die Karte dem Kind zum ersten Mal vorgelegt wurde. Basis fuer das
    /// Tagesbudget neuer Karten — ohne diesen Zeitstempel laesst sich
    /// "heute schon eingefuehrt" nicht sauber zaehlen.
    /// </summary>
    public DateTimeOffset FirstSeenAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? LastReviewedAt { get; set; }
    public Grade? LastGrade { get; set; }
    public ReviewCardState State { get; set; } = ReviewCardState.New;
}
