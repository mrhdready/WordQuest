namespace WordQuest.Modules.Content.Services;

/// <summary>
/// Grenze und Formate fuer Vokabelbilder (D-08). Der Typ kommt aus den Bytes,
/// nie aus dem Request: Muster nach WHATWG MIME Sniffing, "image type pattern
/// matching" (https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern).
/// </summary>
public static class PictureRules
{
    /// <summary>300 KB: der unguenstigste gemessene Fall, 512 px als WebP/JPEG, liegt bei rund 180 KB.</summary>
    public const int MaxBytes = 300 * 1024;

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static ReadOnlySpan<byte> JpegSignature => [0xFF, 0xD8, 0xFF];

    /// <summary>Erkannter Typ (<c>image/png</c>, <c>image/jpeg</c>, <c>image/webp</c>) oder <c>null</c>.</summary>
    public static string? DetectContentType(ReadOnlySpan<byte> data)
    {
        if (data.StartsWith(PngSignature))
        {
            return "image/png";
        }

        if (data.StartsWith(JpegSignature))
        {
            return "image/jpeg";
        }

        if (data.Length >= 14 && data[..4].SequenceEqual("RIFF"u8) && data[8..14].SequenceEqual("WEBPVP"u8))
        {
            return "image/webp";
        }

        return null;
    }
}
