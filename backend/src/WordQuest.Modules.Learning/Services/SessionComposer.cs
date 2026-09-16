using WordQuest.Modules.Learning.Entities;

namespace WordQuest.Modules.Learning.Services;

public sealed record SessionCandidate(Guid CardId, ReviewCardState State, DateTimeOffset DueAt);

/// <summary>
/// Stellt eine Lernsession zusammen (Konzept §6.3). Reine Auswahllogik ohne
/// Datenbankzugriff, damit die Deckelungen testbar sind — sie sind der Grund,
/// warum nach zwei Wochen kein Tag mit 120 faelligen Karten entsteht.
/// </summary>
public sealed class SessionComposer(SchedulerOptions? options = null)
{
    private readonly SchedulerOptions _options = options ?? new SchedulerOptions();

    /// <param name="relearning">Karten, die in dieser Session falsch beantwortet wurden.</param>
    /// <param name="due">Faellige Wiederholungen.</param>
    /// <param name="fresh">Noch nie abgefragte Karten, in Set-Reihenfolge.</param>
    /// <param name="newCardsAllowedToday">
    /// Verbleibendes Tagesbudget fuer neue Karten
    /// (<c>DailyNewLimit</c> minus heute bereits eingefuehrte).
    /// </param>
    public IReadOnlyList<SessionCandidate> Compose(
        IEnumerable<SessionCandidate> relearning,
        IEnumerable<SessionCandidate> due,
        IEnumerable<SessionCandidate> fresh,
        int newCardsAllowedToday,
        DateTimeOffset now,
        int? sessionSize = null)
    {
        ArgumentNullException.ThrowIfNull(relearning);
        ArgumentNullException.ThrowIfNull(due);
        ArgumentNullException.ThrowIfNull(fresh);

        int capacity = sessionSize ?? _options.SessionSize;
        var selected = new List<SessionCandidate>(capacity);
        var taken = new HashSet<Guid>();

        void Take(SessionCandidate candidate)
        {
            if (selected.Count < capacity && taken.Add(candidate.CardId))
            {
                selected.Add(candidate);
            }
        }

        // 1. Fehler aus dieser Session zuerst — die Wiedervorlage ist der
        //    eigentliche Lerneffekt einer falschen Antwort.
        foreach (SessionCandidate candidate in relearning
                     .Where(c => c.DueAt <= now)
                     .OrderBy(c => c.DueAt))
        {
            Take(candidate);
        }

        // 2. Faellige Wiederholungen, aelteste zuerst, gedeckelt.
        foreach (SessionCandidate candidate in due
                     .Where(c => c.State != ReviewCardState.Suspended && c.DueAt <= now)
                     .OrderBy(c => c.DueAt)
                     .Take(_options.MaxDuePerSession))
        {
            Take(candidate);
        }

        // 3. Auffuellen mit neuen Karten — nur im Rahmen des Tagesbudgets.
        //    Dies ist die wichtigste Deckelung des ganzen Systems: Wer hier
        //    40 neue Vokabeln an einem Abend einspeist, erzeugt in den
        //    Folgetagen eine Wiederholungslawine.
        int newBudget = Math.Max(0, newCardsAllowedToday);
        foreach (SessionCandidate candidate in fresh)
        {
            if (newBudget == 0 || selected.Count >= capacity)
            {
                break;
            }

            int before = selected.Count;
            Take(candidate);
            if (selected.Count > before)
            {
                newBudget--;
            }
        }

        return selected;
    }
}
