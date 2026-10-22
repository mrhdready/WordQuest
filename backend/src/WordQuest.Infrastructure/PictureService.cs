using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Content.Entities;

namespace WordQuest.Infrastructure;

/// <summary>
/// Speichert und laedt Vokabelbilder (IMG-01, D-06). Groesse und Format prueft
/// der Endpoint vorher; hier gilt nur, dass die Vokabel im Set des Mandanten liegt.
/// </summary>
public sealed class PictureService(WordQuestDbContext db)
{
    /// <summary>
    /// Legt das Bild an oder ersetzt es an Ort und Stelle mit neuer Version.
    /// <c>null</c>, wenn die Vokabel in diesem Set der Familie fehlt.
    /// </summary>
    public async Task<Guid?> SaveAsync(Guid setId, Guid entryId, byte[] data, CancellationToken ct)
    {
        // Mandantenfilter: eine fremde Vokabel ist hier unsichtbar und wird zu 404.
        bool exists = await db.VocabularyEntries.AnyAsync(e => e.Id == entryId && e.SetId == setId, ct);
        if (!exists)
        {
            return null;
        }

        VocabularyPicture? picture = await db.VocabularyPictures.FirstOrDefaultAsync(p => p.Id == entryId, ct);
        if (picture is null)
        {
            picture = new VocabularyPicture { Id = entryId, Data = data };
            db.VocabularyPictures.Add(picture);
        }
        else
        {
            // Aktualisieren statt Loeschen und Einfuegen: kein Konflikt mit dem eindeutigen Index.
            picture.Data = data;
            picture.Version = Guid.CreateVersion7();
        }

        await db.SaveChangesAsync(ct);
        return picture.Version;
    }

    /// <summary>
    /// Entfernt das Bild der Vokabel; ohne Bild passiert nichts. <c>false</c>, wenn die
    /// Vokabel in diesem Set der Familie fehlt.
    /// </summary>
    public async Task<bool> RemoveAsync(Guid setId, Guid entryId, CancellationToken ct)
    {
        // Mandantenfilter wie beim Speichern: eine fremde Vokabel ist unsichtbar und wird zu 404.
        bool exists = await db.VocabularyEntries.AnyAsync(e => e.Id == entryId && e.SetId == setId, ct);
        if (!exists)
        {
            return false;
        }

        // Der Mandantenfilter gilt auch fuer ExecuteDeleteAsync.
        await db.VocabularyPictures.Where(p => p.Id == entryId).ExecuteDeleteAsync(ct);
        return true;
    }

    /// <summary>Bytes zur Version oder <c>null</c> (fremde Familie, ersetzt oder unbekannt).</summary>
    public Task<byte[]?> LoadAsync(Guid version, CancellationToken ct) =>
        db.VocabularyPictures
            .Where(p => p.Version == version)
            .Select(p => p.Data)
            .FirstOrDefaultAsync(ct);
}
