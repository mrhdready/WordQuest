using System.Buffers.Binary;
using System.Text;
using WordQuest.Modules.Content.Services;

namespace WordQuest.Learning.Tests;

/// <summary>
/// Nur Bild-Signatur mit schluessiger Struktur (D-08, D-16): JPEG endet auf <c>FF D9</c>,
/// PNG beginnt mit IHDR und endet mit IEND, WebP hat die passende RIFF-Laenge.
/// Die Hilfen bauen dieselben Puffer wie <c>PictureTests</c> im Api-Testprojekt.
/// </summary>
public sealed class PictureRulesTests
{
    private static byte[] Jpeg(int length)
    {
        byte[] data = new byte[length];
        data[0] = 0xFF;
        data[1] = 0xD8;
        data[2] = 0xFF;
        data[3] = 0xE0;
        data[^2] = 0xFF;
        data[^1] = 0xD9;
        return data;
    }

    private static byte[] Png(string firstChunk = "IHDR")
    {
        var data = new List<byte> { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        data.AddRange([0x00, 0x00, 0x00, 0x0D]);
        data.AddRange(Encoding.ASCII.GetBytes(firstChunk));
        data.AddRange([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00]);
        data.AddRange([0x00, 0x00, 0x00, 0x00]);
        data.AddRange([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
        return [.. data];
    }

    private static byte[] Riff(int length, string form, int lengthOffset = 0)
    {
        byte[] data = new byte[length];
        "RIFF"u8.CopyTo(data);
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(4), (uint)(length - 8 + lengthOffset));
        Encoding.ASCII.GetBytes(form).CopyTo(data.AsSpan(8));
        return data;
    }

    private static byte[] WebP(int length, int lengthOffset = 0) => Riff(length, "WEBPVP8 ", lengthOffset);

    // ------------------------------------------------------------ gueltig

    [Fact]
    public void Jpeg_wird_erkannt() => Assert.Equal("image/jpeg", PictureRules.DetectContentType(Jpeg(1000)));

    [Fact]
    public void Png_wird_erkannt() => Assert.Equal("image/png", PictureRules.DetectContentType(Png()));

    [Fact]
    public void WebP_wird_erkannt() => Assert.Equal("image/webp", PictureRules.DetectContentType(WebP(1000)));

    // ------------------------------------------------------------ kein Bild

    public static TheoryData<byte[]> NoPicture => new()
    {
        Array.Empty<byte>(),
        Encoding.UTF8.GetBytes("hallo"),
        Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
        Encoding.ASCII.GetBytes("GIF89a").Concat(new byte[100]).ToArray(),
        Riff(1000, "WAVEfmt "),
    };

    [Theory]
    [MemberData(nameof(NoPicture))]
    public void Ohne_Bild_Signatur_kein_Typ(byte[] data) => Assert.Null(PictureRules.DetectContentType(data));

    // ------------------------------------------------------------ Kopf gueltig, Struktur kaputt

    public static TheoryData<byte[]> BrokenStructure => new()
    {
        new byte[] { 0xFF, 0xD8, 0xFF },
        new byte[] { 0xFF, 0xD8, 0xFF, 0xD9 },
        Jpeg(1000)[..998],
        Png()[..8],
        Png("IDAT"),
        Png()[..^12],
        WebP(1000)[..14],
        WebP(1000, lengthOffset: 1),
        WebP(1000, lengthOffset: -1),
        WebP(1000)[..990],
    };

    [Theory]
    [MemberData(nameof(BrokenStructure))]
    public void Kaputte_Struktur_kein_Typ(byte[] data) => Assert.Null(PictureRules.DetectContentType(data));
}
