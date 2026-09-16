using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Content.Entities;

public enum PartOfSpeech
{
    Unknown = 0,
    Noun = 1,
    Verb = 2,
    Adjective = 3,
    Adverb = 4,
    Phrase = 5,
}

/// <summary>
/// Ein Vokabelpaar, z. B. "Hund" ↔ "dog". Das ist NICHT die Lerneinheit —
/// gelernt werden die daraus erzeugten <see cref="Card"/>s, eine je
/// Abfragerichtung (Konzept §5.1).
/// </summary>
public sealed class VocabularyEntry : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }
    public Guid SetId { get; set; }

    /// <summary>Deutsch, z. B. "Hund".</summary>
    public required string SourceText { get; set; }

    /// <summary>Englisch, z. B. "dog".</summary>
    public required string TargetText { get; set; }

    /// <summary>
    /// Weitere gueltige Uebersetzungen, z. B. ["hound"]. Werden bei der
    /// Bewertung als richtig anerkannt.
    /// </summary>
    public string[] TargetAlternatives { get; set; } = [];

    /// <summary>
    /// Weitere gueltige Rueckuebersetzungen fuer die Richtung EN→DE.
    /// "go" darf sowohl "gehen" als auch "fahren" sein.
    /// </summary>
    public string[] SourceAlternatives { get; set; } = [];

    public PartOfSpeech PartOfSpeech { get; set; } = PartOfSpeech.Unknown;

    public string? ExampleSource { get; set; }
    public string? ExampleTarget { get; set; }

    /// <summary>Emoji fuer das Memory-Spiel, z. B. "🐶". Optional.</summary>
    public string? Emoji { get; set; }

    public string? AudioUrl { get; set; }

    public int Position { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public VocabularySet? Set { get; set; }
    public List<Card> Cards { get; set; } = [];

    /// <summary>
    /// Erzeugt die Lernkarten fuer dieses Vokabelpaar. Im MVP beide
    /// Textrichtungen; <see cref="CardDirection.AudioToSource"/> kommt
    /// mit dem Aussprachetrainer dazu.
    /// </summary>
    public IEnumerable<Card> CreateDefaultCards()
    {
        yield return new Card
        {
            TenantId = TenantId,
            EntryId = Id,
            Direction = CardDirection.SourceToTarget,
        };
        yield return new Card
        {
            TenantId = TenantId,
            EntryId = Id,
            Direction = CardDirection.TargetToSource,
        };
    }
}
