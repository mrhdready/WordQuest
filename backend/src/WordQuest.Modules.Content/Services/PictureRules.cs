using System.Buffers.Binary;

namespace WordQuest.Modules.Content.Services;

/// <summary>
/// Grenze und Formate fuer Vokabelbilder (D-08, D-16). Der Typ kommt aus den
/// Bytes, nie aus dem Request: Signatur nach WHATWG MIME Sniffing, "image type
/// pattern matching" (https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern),
/// dazu eine Pruefung, ob die Struktur schluessig ist.
/// </summary>
/// <remarks>
/// Kein Decoder: Die BCL hat keinen plattformunabhaengigen, eine neue Dependency
/// ist ausgeschlossen. Sicherheitsziel ist, dass nur Bildinhalte mit Bild-Content-Type
/// und nosniff ausgeliefert werden; ob der Browser das Bild dekodieren kann, sichert
/// der Client (Rueckfall auf das Emoji, D-16).
/// </remarks>
public static class PictureRules
{
    /// <summary>300 KB: der unguenstigste gemessene Fall, 512 px als WebP/JPEG, liegt bei rund 180 KB.</summary>
    public const int MaxBytes = 300 * 1024;

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    // Erster Chunk: Laenge 13, Typ IHDR.
    private static ReadOnlySpan<byte> PngIhdr => [0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52];

    // Letzter Chunk: Laenge 0, Typ IEND, feste CRC.
    private static ReadOnlySpan<byte> PngIend => [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];

    private static ReadOnlySpan<byte> JpegStart => [0xFF, 0xD8, 0xFF];
    private static ReadOnlySpan<byte> JpegEnd => [0xFF, 0xD9];

    /// <summary>
    /// Erkannter Typ (<c>image/png</c>, <c>image/jpeg</c>, <c>image/webp</c>) oder
    /// <c>null</c>, wenn Signatur oder Struktur nicht passen.
    /// </summary>
    public static string? DetectContentType(ReadOnlySpan<byte> data)
    {
        // PNG: Signatur (8) + IHDR-Chunk (25) + IEND-Chunk (12).
        if (data.StartsWith(PngSignature))
        {
            return data.Length >= 45 && data[8..16].SequenceEqual(PngIhdr) && data.EndsWith(PngIend)
                ? "image/png"
                : null;
        }

        // JPEG: SOI-Marker am Anfang, EOI-Marker am Ende; dazwischen mindestens ein Byte.
        if (data.StartsWith(JpegStart))
        {
            return data.Length >= 5 && data.EndsWith(JpegEnd) ? "image/jpeg" : null;
        }

        // WebP: RIFF-Laenge plus Kopf (8) ist genau die Dateigroesse, Kennung WEBP mit VP8-Chunk.
        if (data.Length >= 16 && data[..4].SequenceEqual("RIFF"u8) && data[8..15].SequenceEqual("WEBPVP8"u8))
        {
            return BinaryPrimitives.ReadUInt32LittleEndian(data[4..8]) + 8L == data.Length ? "image/webp" : null;
        }

        return null;
    }
}
