namespace WordQuest.Shared.Kernel;

/// <summary>
/// Bewertung einer Antwort. Vierstufig statt der klassischen SM-2-Skala 0..5:
/// Ein Kind bewertet sich nie selbst, die Stufe wird aus dem Spielverhalten
/// abgeleitet (Richtigkeit + Antwortzeit). Siehe Konzept §6.1.
/// </summary>
public enum Grade
{
    /// <summary>Falsch. Kommt in derselben Session wieder.</summary>
    Again = 0,

    /// <summary>Richtig, aber muehsam (langsam, nach Hinweis oder mit Tippfehler).</summary>
    Hard = 1,

    /// <summary>Richtig in normaler Zeit.</summary>
    Good = 2,

    /// <summary>Sofort sicher.</summary>
    Easy = 3,
}
