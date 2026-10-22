using System.Collections.Concurrent;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using WordQuest.Infrastructure;
using static WordQuest.Api.Tests.PictureTests;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Listen kennen nur die Bildversion, nie die Bildbytes (IMG-01, D-09, Review MEDIUM):
/// Eine kleine JSON-Antwort beweist keinen kleinen Datenbankabruf, deshalb zeichnet
/// ein <see cref="DbCommandInterceptor"/> die ausgefuehrten Befehle auf. Der Kontrollfall
/// <c>GET /pictures/{version}</c> muss den Detektor ausloesen, sonst misst er nichts.
/// Eigene Factory je Testfall, weil der Interceptor vor dem Host-Start stehen muss.
/// </summary>
public sealed partial class PictureQueryTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new ApiFactory();
    private readonly SqlRecorder _recorder = new SqlRecorder();

    public PictureQueryTests() =>
        _factory.TestServices = services =>
            services.ConfigureDbContext<WordQuestDbContext>(options => options.AddInterceptors(_recorder));

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    // Spalte data von vocabulary_picture, ob als Alias (v.data) oder zitiert ("data").
    [GeneratedRegex("""(\.|")data\b""")]
    private static partial Regex DataColumn();

    private static bool SelectsPictureBytes(string sql) =>
        sql.Contains("vocabulary_picture", StringComparison.Ordinal) && DataColumn().IsMatch(sql);

    private static async Task<Dictionary<Guid, Guid?>> VersionsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.EnumerateArray().ToDictionary(
            e => e.GetProperty("id").GetGuid(),
            e => e.TryGetProperty("pictureVersion", out JsonElement v) && v.ValueKind != JsonValueKind.Null
                ? v.GetGuid()
                : (Guid?)null);
    }

    [Fact]
    public async Task Vokabelliste_nennt_die_Version_und_liest_keine_Bildbytes()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 2);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Guid version = await VersionAsync(
            await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(MaxBytes), "image/jpeg"));

        _recorder.Clear();
        Dictionary<Guid, Guid?> versions = await VersionsAsync(await owner.GetAsync($"/api/v1/sets/{set.Set.Id}/entries"));
        string[] sql = _recorder.Commands;

        Assert.Equal(version, versions[set.Entries[0].Id]);
        Assert.Null(versions[set.Entries[1].Id]);
        Assert.Contains(sql, s => s.Contains("vocabulary_picture", StringComparison.Ordinal));
        Assert.DoesNotContain(sql, SelectsPictureBytes);
    }

    [Fact]
    public async Task Kontrolle_Bildabruf_liest_die_Bildbytes()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Guid version = await VersionAsync(
            await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(1000), "image/jpeg"));

        _recorder.Clear();
        HttpResponseMessage get = await owner.GetAsync($"/api/v1/pictures/{version}");

        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Contains(_recorder.Commands, SelectsPictureBytes);
    }

    // Rundenstart und Wiederholung brauchen nur die Version; die Bytes holt der Browser (Review MEDIUM).
    private async Task<(SeededFamily Family, Guid SetId)> SeedSetWithPictureAsync()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        await VersionAsync(await PutPictureAsync(owner, set.Set.Id, set.Entries[0].Id, Jpeg(MaxBytes), "image/jpeg"));
        return (family, set.Set.Id);
    }

    private static Task<HttpResponseMessage> StartSessionAsync(HttpClient child, Guid learnerId, Guid setId) =>
        child.PostAsJsonAsync("/api/v1/sessions", new { learnerId, setId, gameKey = "classic", size = (int?)null });

    [Fact]
    public async Task Rundenstart_liest_die_Version_aber_keine_Bildbytes()
    {
        (SeededFamily family, Guid setId) = await SeedSetWithPictureAsync();
        using HttpClient child = _factory.CreateClientFor(family.Child);

        _recorder.Clear();
        HttpResponseMessage start = await StartSessionAsync(child, family.Child.Id, setId);
        string[] sql = _recorder.Commands;

        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        Assert.Contains(sql, s => s.Contains("vocabulary_picture", StringComparison.Ordinal));
        Assert.DoesNotContain(sql, SelectsPictureBytes);
    }

    [Fact]
    public async Task Wiederholung_liest_die_Version_aber_keine_Bildbytes()
    {
        (SeededFamily family, Guid setId) = await SeedSetWithPictureAsync();
        using HttpClient child = _factory.CreateClientFor(family.Child);
        HttpResponseMessage start = await StartSessionAsync(child, family.Child.Id, setId);
        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        using JsonDocument session = JsonDocument.Parse(await start.Content.ReadAsStringAsync());
        string sessionId = session.RootElement.GetProperty("sessionId").GetString()!;
        Guid itemId = session.RootElement.GetProperty("items")[0].GetProperty("itemId").GetGuid();

        _recorder.Clear();
        HttpResponseMessage answer = await child.PostAsJsonAsync($"/api/v1/sessions/{sessionId}/answers", new
        {
            itemId,
            givenAnswer = "voellig falsch",
            answerMs = 2000,
            clientAnswerId = Guid.NewGuid(),
            hintUsed = false,
        });
        string[] sql = _recorder.Commands;

        Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
        using JsonDocument result = JsonDocument.Parse(await answer.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Object, result.RootElement.GetProperty("retryItem").ValueKind);
        Assert.Contains(sql, s => s.Contains("vocabulary_picture", StringComparison.Ordinal));
        Assert.DoesNotContain(sql, SelectsPictureBytes);
    }

    // Recherche Pitfall 3: Woerter aendern darf die Version nicht verlieren.
    [Fact]
    public async Task Vokabel_bearbeiten_antwortet_mit_der_gespeicherten_Version()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid entryId = set.Entries[0].Id;
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        Guid version = await VersionAsync(await PutPictureAsync(owner, set.Set.Id, entryId, Png(), "image/png"));

        HttpResponseMessage put = await owner.PutAsJsonAsync(
            $"/api/v1/sets/{set.Set.Id}/entries/{entryId}", new { sourceText = "Hund", targetText = "dog" });

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await put.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.TryGetProperty("pictureVersion", out JsonElement saved));
        Assert.Equal(JsonValueKind.String, saved.ValueKind);
        Assert.Equal(version, saved.GetGuid());
    }

    /// <summary>Sammelt den Text jedes Lese-Befehls; Clear() direkt vor der gemessenen Anfrage.</summary>
    private sealed class SqlRecorder : DbCommandInterceptor
    {
        private readonly ConcurrentQueue<string> _commands = new ConcurrentQueue<string>();

        public string[] Commands => [.. _commands];

        public void Clear() => _commands.Clear();

        public override InterceptionResult<DbDataReader> ReaderExecuting(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
        {
            _commands.Enqueue(command.CommandText);
            return base.ReaderExecuting(command, eventData, result);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            _commands.Enqueue(command.CommandText);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
