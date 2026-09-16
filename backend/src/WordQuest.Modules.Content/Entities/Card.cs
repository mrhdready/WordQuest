using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Content.Entities;

public enum CardDirection
{
    /// <summary>Deutsch → Englisch. Produktion — die schwierige Richtung.</summary>
    SourceToTarget = 0,

    /// <summary>Englisch → Deutsch. Rezeption — wird deutlich frueher beherrscht.</summary>
    TargetToSource = 1,

    /// <summary>Gehoertes englisches Wort → Deutsch. Ab dem Aussprachetrainer.</summary>
    AudioToSource = 2,
}

/// <summary>
/// Die eigentliche Lerneinheit: ein Vokabelpaar in EINER Abfragerichtung.
/// Beide Richtungen werden getrennt terminiert, weil sie unterschiedlich
/// schnell gelernt werden (Konzept §5.1).
/// </summary>
public sealed class Card : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }
    public Guid EntryId { get; set; }
    public CardDirection Direction { get; set; }

    public VocabularyEntry? Entry { get; set; }
}
