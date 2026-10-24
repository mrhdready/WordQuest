using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Content.Entities;

/// <summary>
/// Eigenes Bild einer Vokabel (IMG-01, D-06). Liegt in der Datenbank statt im
/// Dateisystem, damit Sicherung, Wiederherstellung und Update es ohne Zusatz
/// mitnehmen. Bewusst ohne Navigation an <see cref="VocabularyEntry"/>: So kann
/// keine Abfrage die Bytes per Include in Listen oder Runden mitladen.
/// </summary>
public sealed class VocabularyPicture : ITenantOwned
{
    /// <summary>Id der Vokabel (gemeinsamer Primaerschluessel, je Vokabel hoechstens ein Bild).</summary>
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>
    /// Neu bei jedem Speichern. Die Bild-URL enthaelt sie, deshalb erscheint ein
    /// ersetztes Bild sofort und die alte URL antwortet 404 (D-09).
    /// </summary>
    public Guid Version { get; set; } = Guid.CreateVersion7();

    /// <summary>Bildbytes (WebP, JPEG oder PNG), hoechstens 300 KB.</summary>
    public required byte[] Data { get; set; }
}
