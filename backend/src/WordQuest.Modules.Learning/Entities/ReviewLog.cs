using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Entities;

/// <summary>
/// Append-only-Protokoll jeder Antwort. Wird nie aktualisiert.
///
/// Alle Auswertungen (Ampel, Wochenreport, Problemwoerter) leiten sich hieraus
/// ab. Dadurch laesst sich der Lernalgorithmus spaeter wechseln und der
/// Fortschritt aus dem Protokoll neu berechnen, statt ihn zu verlieren
/// (Konzept §5.2).
/// </summary>
public sealed class ReviewLog : ITenantOwned
{
    public long Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid LearnerId { get; set; }
    public Guid CardId { get; set; }
    public Guid? SessionId { get; set; }

    /// <summary>"classic", "wordcatcher", "memory", "cram", …</summary>
    public required string GameKey { get; set; }

    public Grade Grade { get; set; }
    public int AnswerMs { get; set; }
    public string? GivenAnswer { get; set; }

    /// <summary>
    /// Intervall in Tagen, das aus dieser Antwort resultierte. Erlaubt es,
    /// die Terminierung im Nachhinein zu analysieren.
    /// </summary>
    public double ResultingIntervalDays { get; set; }

    public DateTimeOffset ReviewedAt { get; set; } = DateTimeOffset.UtcNow;
}
