using System.Buffers.Binary;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Bild je Vokabel (IMG-01, D-06 bis D-10, D-16): speichern, ersetzen, mit Anmeldung
/// abrufen; nur Bild-Signatur bis 300 KB; Familien und Rollen getrennt; Kaskade beim
/// Loeschen. Eigene Familien je Fall (Isolationsregel ApiFactory). Die Byte-Hilfen
/// sind <c>internal</c>, weil die folgenden Plaene der Phase sie wiederverwenden.
/// </summary>
public sealed class PictureTests : IClassFixture<ApiFactory>
{
    /// <summary>Spiegel von <c>PictureRules.MaxBytes</c>; bewusst als Zahl, damit der Test die Grenze festnagelt.</summary>
    internal const int MaxBytes = 300 * 1024;

    private const string EntryGone = "Diese Vokabel gibt es nicht (mehr).";
    private const string NotAPicture = "Das Bild muss eine vollständige WebP-, JPEG- oder PNG-Datei sein.";
    private const string TooLarge = "Das Bild ist zu groß. Erlaubt sind höchstens 300 KB.";
    private const string Empty = "Es ist kein Bild angekommen. Wähle das Bild noch einmal aus.";
    private const string Conflict = "Das Bild wurde gerade gleichzeitig geändert. Versuche es noch einmal.";

    private readonly ApiFactory _factory;

    public PictureTests(ApiFactory factory) => _factory = factory;

    // ------------------------------------------------------------ Byte-Hilfen

    /// <summary>Strukturell schluessiges JPEG: <c>FF D8 FF E0</c>, Nullbytes, <c>FF D9</c>.</summary>
    internal static byte[] Jpeg(int length)
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

    /// <summary>Strukturell schluessiges PNG (45 Byte): Signatur, IHDR fuer 1 x 1 Pixel, IEND.</summary>
    internal static byte[] Png()
    {
        var data = new List<byte> { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        data.AddRange([0x00, 0x00, 0x00, 0x0D]);
        data.AddRange("IHDR"u8.ToArray());
        data.AddRange([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00]);
        data.AddRange([0x00, 0x00, 0x00, 0x00]);
        data.AddRange([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
        return [.. data];
    }

    /// <summary>Strukturell schluessiges WebP: <c>RIFF</c>, Laenge <c>length - 8</c>, <c>WEBPVP8 </c>, Nullbytes.</summary>
    internal static byte[] WebP(int length)
    {
        byte[] data = new byte[length];
        "RIFF"u8.CopyTo(data);
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(4), (uint)(length - 8));
        "WEBPVP8 "u8.CopyTo(data.AsSpan(8));
        return data;
    }

    internal static Task<HttpResponseMessage> PutPictureAsync(
        HttpClient client, Guid setId, Guid entryId, byte[] data, string contentType)
    {
        var content = new ByteArrayContent(data);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return client.PutAsync($"/api/v1/sets/{setId}/entries/{entryId}/picture", content);
    }

    /// <summary>Liest <c>pictureVersion</c> aus einer 200-Antwort des PUT.</summary>
    internal static async Task<Guid> VersionAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("pictureVersion").GetGuid();
    }

    /// <summary>Body ohne bekannte Laenge: der Client sendet ihn ohne Content-Length.</summary>
    private sealed class NonSeekableStream(byte[] data) : MemoryStream(data)
    {
        public override bool CanSeek => false;
    }

    // ------------------------------------------------------------ Pruefhilfen

    private async Task<int> PictureRowsAsync(params Guid[] entryIds)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.Database
            .SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM vocabulary_picture WHERE id = ANY({entryIds})")
            .SingleAsync();
    }

    private static async Task<string?> ProblemDetailAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        return problem.Detail;
    }

    private static async Task<string> PictureErrorAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
        Assert.NotNull(problem);
        return problem.Errors["picture"][0];
    }

    // ------------------------------------------------------------ Speichern, Ersetzen, Abrufen

    [Fact]
    public async Task Bild_speichern_und_abrufen_liefert_dieselben_Bytes()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        byte[] jpeg = Jpeg(1000);

        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, jpeg, "image/jpeg"));
        HttpResponseMessage get = await owner.GetAsync($"/api/v1/pictures/{version}");

        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("image/jpeg", get.Content.Headers.ContentType?.MediaType);
        Assert.True(get.Headers.CacheControl?.NoStore);
        Assert.Equal(jpeg, await get.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Ersetzen_gibt_neue_Version_und_die_alte_URL_ist_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid entryId = set.Entries[0].Id;
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        byte[] png = Png();

        Guid first = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, entryId, Jpeg(1000), "image/jpeg"));
        Guid second = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, entryId, png, "image/png"));

        Assert.NotEqual(first, second);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/v1/pictures/{first}")).StatusCode);
        HttpResponseMessage get = await owner.GetAsync($"/api/v1/pictures/{second}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("image/png", get.Content.Headers.ContentType?.MediaType);
        Assert.Equal(png, await get.Content.ReadAsByteArrayAsync());
        Assert.Equal(1, await PictureRowsAsync(entryId));
    }

    // ------------------------------------------------------------ Vertrauensgrenze

    // Text, SVG, GIF.
    public static TheoryData<byte[]> NoPictureSignature => new()
    {
        Encoding.UTF8.GetBytes("hallo"),
        Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
        Encoding.ASCII.GetBytes("GIF89a").Concat(new byte[100]).ToArray(),
    };

    [Theory]
    [MemberData(nameof(NoPictureSignature))]
    public async Task Ohne_Bild_Signatur_ergibt_400_und_speichert_nichts(byte[] data)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, data, "image/png");

        Assert.Equal(NotAPicture, await PictureErrorAsync(response));
        Assert.Equal(0, await PictureRowsAsync(set.Entries[0].Id));
    }

    // Gueltiger Kopf, kaputte Struktur (D-16): JPEG ohne FF D9, PNG ohne IEND,
    // WebP mit falscher RIFF-Laenge, JPEG nur Kopf.
    public static TheoryData<byte[]> BrokenStructure => new()
    {
        Jpeg(1000)[..998],
        Png()[..^12],
        BrokenRiffLength(),
        new byte[] { 0xFF, 0xD8, 0xFF },
    };

    private static byte[] BrokenRiffLength()
    {
        byte[] data = WebP(1000);
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(4), 1000 - 8 + 1);
        return data;
    }

    [Theory]
    [MemberData(nameof(BrokenStructure))]
    public async Task Kaputte_Struktur_ergibt_400_und_das_vorherige_Bild_bleibt(byte[] data)
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        byte[] png = Png();
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, png, "image/png"));

        HttpResponseMessage response = await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, data, "image/png");

        Assert.Equal(NotAPicture, await PictureErrorAsync(response));
        HttpResponseMessage get = await owner.GetAsync($"/api/v1/pictures/{version}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal(png, await get.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Leerer_Body_ergibt_400_mit_eigenem_Text()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, [], "image/png");

        Assert.Equal(Empty, await PictureErrorAsync(response));
        Assert.Equal(0, await PictureRowsAsync(set.Entries[0].Id));
    }

    [Fact]
    public async Task Genau_300_KB_sind_erlaubt()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(MaxBytes), "image/jpeg");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, await PictureRowsAsync(set.Entries[0].Id));
    }

    [Fact]
    public async Task Mehr_als_300_KB_mit_Content_Length_ergibt_413()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage response = await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(MaxBytes + 1), "image/jpeg");

        Assert.Equal(TooLarge, await ProblemDetailAsync(response, HttpStatusCode.RequestEntityTooLarge));
        Assert.Equal(0, await PictureRowsAsync(set.Entries[0].Id));
    }

    [Fact]
    public async Task Mehr_als_300_KB_ohne_Content_Length_ergibt_413()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        var content = new StreamContent(new NonSeekableStream(Jpeg(MaxBytes + 1)));
        content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        Assert.Null(content.Headers.ContentLength);

        HttpResponseMessage response = await owner.PutAsync(
            $"/api/v1/sets/{set.Set.Id}/entries/{set.Entries[0].Id}/picture", content);

        Assert.Equal(TooLarge, await ProblemDetailAsync(response, HttpStatusCode.RequestEntityTooLarge));
        Assert.Equal(0, await PictureRowsAsync(set.Entries[0].Id));
    }

    // ------------------------------------------------------------ Familien und Rollen (D-07, D-10)

    [Fact]
    public async Task Andere_Familie_bekommt_beim_Lesen_und_Schreiben_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        SeededFamily other = await SeedFamilyAsync(_factory);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        using HttpClient stranger = _factory.CreateClientFor(other.Owner);
        using HttpClient strangerChild = _factory.CreateClientFor(other.Child);
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        HttpResponseMessage put = await PutPictureAsync(stranger, set.Set.Id, set.Entries[0].Id, Png(), "image/png");

        Assert.Equal(EntryGone, await ProblemDetailAsync(put, HttpStatusCode.NotFound));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/v1/pictures/{version}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await strangerChild.GetAsync($"/api/v1/pictures/{version}")).StatusCode);
        HttpResponseMessage still = await owner.GetAsync($"/api/v1/pictures/{version}");
        Assert.Equal(Jpeg(1000), await still.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Kind_derselben_Familie_liest_aber_schreibt_nicht()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        HttpResponseMessage get = await child.GetAsync($"/api/v1/pictures/{version}");
        HttpResponseMessage put = await PutPictureAsync(child, set.Set.Id, set.Entries[0].Id, Png(), "image/png");

        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
        HttpResponseMessage still = await owner.GetAsync($"/api/v1/pictures/{version}");
        Assert.Equal(HttpStatusCode.OK, still.StatusCode);
    }

    [Fact]
    public async Task Ohne_Anmeldung_ergibt_401()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        using HttpClient anonymous = _factory.CreateClient();
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        HttpResponseMessage get = await anonymous.GetAsync($"/api/v1/pictures/{version}");
        HttpResponseMessage put = await PutPictureAsync(anonymous, set.Set.Id, set.Entries[0].Id, Png(), "image/png");

        Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, put.StatusCode);
    }

    [Fact]
    public async Task Vokabel_aus_anderem_Set_oder_unbekannt_ergibt_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        SeededSet otherSet = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        HttpResponseMessage wrongSet = await PutPictureAsync(owner, otherSet.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg");
        HttpResponseMessage unknown = await PutPictureAsync(owner, set.Set.Id, Guid.NewGuid(), Jpeg(1000), "image/jpeg");

        Assert.Equal(EntryGone, await ProblemDetailAsync(wrongSet, HttpStatusCode.NotFound));
        Assert.Equal(EntryGone, await ProblemDetailAsync(unknown, HttpStatusCode.NotFound));
        Assert.Equal(0, await PictureRowsAsync(set.Entries[0].Id));
    }

    // ------------------------------------------------------------ Kaskade (D-06)

    [Fact]
    public async Task Vokabel_loeschen_entfernt_das_Bild()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));
        Assert.Equal(1, await PictureRowsAsync(set.Entries[0].Id));

        HttpResponseMessage delete = await owner.DeleteAsync($"/api/v1/sets/{set.Set.Id}/entries/{set.Entries[0].Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(0, await PictureRowsAsync(set.Entries[0].Id));
    }

    [Fact]
    public async Task Set_loeschen_entfernt_die_Bilder_des_Sets()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Guid[] entryIds = [set.Entries[0].Id, set.Entries[1].Id];
        await VersionAsync(await PutPictureAsync(owner, set.Set.Id, entryIds[0], Jpeg(1000), "image/jpeg"));
        await VersionAsync(await PutPictureAsync(owner, set.Set.Id, entryIds[1], Png(), "image/png"));
        Assert.Equal(2, await PictureRowsAsync(entryIds));

        HttpResponseMessage delete = await owner.DeleteAsync($"/api/v1/sets/{set.Set.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(0, await PictureRowsAsync(entryIds));
    }

    // ------------------------------------------------------------ Entfernen (D-07, D-10)

    private static Task<HttpResponseMessage> DeletePictureAsync(HttpClient client, Guid setId, Guid entryId) =>
        client.DeleteAsync($"/api/v1/sets/{setId}/entries/{entryId}/picture");

    private static async Task<JsonElement> ListedVersionAsync(HttpClient client, Guid setId, Guid entryId)
    {
        using JsonDocument list = JsonDocument.Parse(await client.GetStringAsync($"/api/v1/sets/{setId}/entries"));
        return list.RootElement.EnumerateArray()
            .Single(entry => entry.GetProperty("id").GetGuid() == entryId)
            .GetProperty("pictureVersion")
            .Clone();
    }

    [Fact]
    public async Task Entfernen_ergibt_204_ohne_Bild_in_Liste_und_Abruf_und_zweimal_204()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid entryId = set.Entries[0].Id;
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, entryId, Jpeg(1000), "image/jpeg"));

        HttpResponseMessage first = await DeletePictureAsync(owner, set.Set.Id, entryId);
        HttpResponseMessage second = await DeletePictureAsync(owner, set.Set.Id, entryId);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ListedVersionAsync(owner, set.Set.Id, entryId)).ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/v1/pictures/{version}")).StatusCode);
        Assert.Equal(0, await PictureRowsAsync(entryId));
    }

    [Fact]
    public async Task Entfernen_durch_andere_Familie_ergibt_404_und_das_Bild_bleibt()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        SeededFamily other = await SeedFamilyAsync(_factory);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        using HttpClient stranger = _factory.CreateClientFor(other.Owner);
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        HttpResponseMessage delete = await DeletePictureAsync(stranger, set.Set.Id, set.Entries[0].Id);

        Assert.Equal(EntryGone, await ProblemDetailAsync(delete, HttpStatusCode.NotFound));
        Assert.Equal(1, await PictureRowsAsync(set.Entries[0].Id));
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/api/v1/pictures/{version}")).StatusCode);
    }

    [Fact]
    public async Task Entfernen_als_Kind_ergibt_403_und_ohne_Anmeldung_401()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        using HttpClient child = _factory.CreateClientFor(family.Child);
        using HttpClient anonymous = _factory.CreateClient();
        await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        Assert.Equal(HttpStatusCode.Forbidden, (await DeletePictureAsync(child, set.Set.Id, set.Entries[0].Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await DeletePictureAsync(anonymous, set.Set.Id, set.Entries[0].Id)).StatusCode);
        Assert.Equal(1, await PictureRowsAsync(set.Entries[0].Id));
    }

    [Fact]
    public async Task Entfernen_mit_falschem_Set_oder_unbekannter_Vokabel_ergibt_404()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        SeededSet otherSet = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        HttpResponseMessage wrongSet = await DeletePictureAsync(owner, otherSet.Set.Id, set.Entries[0].Id);
        HttpResponseMessage unknown = await DeletePictureAsync(owner, set.Set.Id, Guid.NewGuid());

        Assert.Equal(EntryGone, await ProblemDetailAsync(wrongSet, HttpStatusCode.NotFound));
        Assert.Equal(EntryGone, await ProblemDetailAsync(unknown, HttpStatusCode.NotFound));
        Assert.Equal(1, await PictureRowsAsync(set.Entries[0].Id));
    }

    // ------------------------------------------------------------ Konflikt

    [Fact]
    public async Task Gleichzeitige_erste_Uploads_ergeben_200_und_409()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid entryId = set.Entries[0].Id;
        using HttpClient owner = _factory.CreateClientFor(family.Owner);

        // Beide Anfragen sehen noch kein Bild und fuegen ein. Das INSERT prueft den
        // Fremdschluessel mit FOR KEY SHARE auf der Vokabelzeile und wartet deshalb
        // auf die Sperre; die zweite wartet danach auf den Primaerschluessel der ersten.
        var held = await _factory.LockRowsAsync(("vocabulary_entry", entryId));
        Task<HttpResponseMessage> one = PutPictureAsync(owner, set.Set.Id, entryId, Jpeg(1000), "image/jpeg");
        Task<HttpResponseMessage> two = PutPictureAsync(owner, set.Set.Id, entryId, Png(), "image/png");
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        HttpResponseMessage conflict = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(Conflict, await ProblemDetailAsync(conflict, HttpStatusCode.Conflict));
        Assert.Equal(1, await PictureRowsAsync(entryId));
    }
}
