using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Content.Entities;

/// <summary>Eine Vokabelsammlung, typischerweise eine Unit aus dem Schulbuch.</summary>
public sealed class VocabularySet : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }

    public required string Title { get; set; }
    public string? Description { get; set; }

    /// <summary>ISO-639-1, z. B. "de". Die Sprache, in der das Kind denkt.</summary>
    public string SourceLanguage { get; set; } = "de";

    /// <summary>ISO-639-1, z. B. "en". Die Zielsprache.</summary>
    public string TargetLanguage { get; set; } = "en";

    /// <summary>Wer das Set angelegt hat (Guardian).</summary>
    public Guid CreatedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<VocabularyEntry> Entries { get; set; } = [];
}
