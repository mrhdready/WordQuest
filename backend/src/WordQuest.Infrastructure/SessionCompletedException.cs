namespace WordQuest.Infrastructure;

/// <summary>
/// Antwort auf eine Aufgabe einer schon abgeschlossenen Runde (IN-01). Die
/// Runde ist endgueltig; der Aufrufer meldet das als Konflikt (409).
/// </summary>
public sealed class SessionCompletedException : Exception
{
    public SessionCompletedException()
        : base("Die Runde ist schon abgeschlossen.")
    {
    }
}
