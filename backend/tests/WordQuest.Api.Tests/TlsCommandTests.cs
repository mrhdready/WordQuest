using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace WordQuest.Api.Tests;

/// <summary>
/// Verb tls gegen ein echtes Verzeichnis: CA-Zustaende, Neuausstellung, Dateimodi,
/// show und der Takt von watch mit Testuhr (TLS-01, TLS-02, Codex 1, 2, 7, 8, 10).
/// </summary>
public sealed class TlsCommandTests : IDisposable
{
    private const string Names = "pi,pi.local,localhost,192.168.178.20,127.0.0.1";
    private const string Usage = "Aufruf: tls watch [--dir <Ordner>] oder tls show [--dir <Ordner>]";
    private const string NotReady = "Das Zertifikat für WordQuest ist noch nicht bereit.";
    private const string Way = " Es wurde nichts geändert. Wie es weitergeht, steht in der Installationsanleitung unter „Zertifizierungsstelle neu anlegen“.";
    private const string CertificateLabel = "CERTIFICATE";
    private const string KeyLabel = "PRIVATE KEY";

    private static readonly DateTimeOffset Start = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Limit = TimeSpan.FromSeconds(30);

    // Ein fertiger Stand fuer alle Tests, die nicht beim leeren Ordner beginnen (RSA 3072 ist langsam).
    private static readonly Lazy<Dictionary<string, byte[]>> Template = new(CreateTemplate);

    private readonly DirectoryInfo _root = Directory.CreateTempSubdirectory("wq-tls-");
    private readonly StringWriter _outputText = new();
    private readonly StringWriter _errorText = new();
    private readonly TextWriter _output;
    private readonly TextWriter _error;

    public TlsCommandTests()
    {
        _output = TextWriter.Synchronized(_outputText);
        _error = TextWriter.Synchronized(_errorText);
    }

    public void Dispose() => _root.Delete(true);

    // Dateimodi gibt es nur unter Linux; dort laeuft der Dienst certs.
    [Fact]
    [UnsupportedOSPlatform("windows")]
    public async Task Watch_on_empty_directory_creates_authority_and_server_with_modes()
    {
        Watch watch = StartWatch();
        await watch.Time.WaitForTimersAsync(1);

        Assert.Equal(["ca/ca.crt", "ca/ca.key", "tls/server.pem", "tls/wordquest-ca.crt"], Snapshot().Keys.Order());
        Assert.Equal(
            [
                $"✓ Zertifizierungsstelle angelegt (gültig bis {Day(Start.AddHours(-1).AddYears(10))}).",
                $"✓ Zertifikat für WordQuest ausgestellt (gültig bis {Day(Start.AddHours(-1).AddDays(800))}).",
            ],
            OutputLines());
        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, File.GetUnixFileMode(PathOf("ca/ca.key")));
        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead, File.GetUnixFileMode(PathOf("tls/server.pem")));
        UnixFileMode worldReadable = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead;
        Assert.Equal(worldReadable, File.GetUnixFileMode(PathOf("ca/ca.crt")));
        Assert.Equal(worldReadable, File.GetUnixFileMode(PathOf("tls/wordquest-ca.crt")));

        string serverPem = File.ReadAllText(PathOf("tls/server.pem"));
        Assert.Equal([CertificateLabel, KeyLabel], PemLabels(serverPem));
        // Der CA-Schluessel liegt nie im Volume, das nginx einbindet (T-fpi-01).
        Assert.DoesNotContain(File.ReadAllText(PathOf("ca/ca.key")).Trim(), serverPem);
        Assert.Empty(PemLabels(File.ReadAllText(PathOf("tls/wordquest-ca.crt"))));
        Assert.Equal(Authority().RawData, File.ReadAllBytes(PathOf("tls/wordquest-ca.crt")));

        Assert.Equal(0, await watch.StopAsync());
        Assert.Empty(_errorText.ToString());
    }

    [Fact]
    public async Task Watch_restart_with_same_names_changes_nothing()
    {
        Restore(Template.Value);
        Dictionary<string, byte[]> before = Snapshot();

        Watch watch = StartWatch();
        await watch.Time.WaitForTimersAsync(1);

        Assert.Equal(
            ["✓ Zertifizierungsstelle existiert bereits — unverändert.", "✓ Zertifikat für WordQuest ist aktuell — unverändert."],
            OutputLines());
        AssertSame(before, Snapshot());
        Assert.Equal(0, await watch.StopAsync());
    }

    [Fact]
    public async Task Watch_restart_with_changed_names_issues_new_server_and_keeps_authority()
    {
        Restore(Template.Value);
        Dictionary<string, byte[]> before = Snapshot();

        Watch watch = StartWatch("pi,localhost,wordquest.test,127.0.0.1");
        await watch.Time.WaitForTimersAsync(1);

        Assert.Equal("✓ Zertifizierungsstelle existiert bereits — unverändert.", OutputLines()[0]);
        Assert.StartsWith("✓ Zertifikat für WordQuest ausgestellt (gültig bis ", OutputLines()[1]);
        Assert.Equal(["127.0.0.1", "localhost", "pi", "wordquest.test"], TlsCertificates.SubjectAlternativeNames(Server()).Order());
        AssertAuthorityUnchanged(before);
        Assert.Equal(0, await watch.StopAsync());
    }

    [Fact]
    public async Task Watch_tick_renews_29_days_before_expiry_without_changing_authority()
    {
        Watch watch = StartWatch();
        await watch.Time.WaitForTimersAsync(1);
        Dictionary<string, byte[]> before = Snapshot();
        X509Certificate2 old = Server();
        int lines = OutputLines().Length;

        watch.Time.Now = new DateTimeOffset(old.NotAfter).AddDays(-29);
        watch.Time.FireLatest();
        await watch.Time.WaitForTimersAsync(2);

        Assert.Equal(lines + 1, OutputLines().Length);
        Assert.StartsWith("✓ Zertifikat für WordQuest erneuert (gültig bis ", OutputLines()[^1]);
        Assert.NotEqual(old.SerialNumber, Server().SerialNumber);
        Assert.Equal(TlsCertificates.SubjectAlternativeNames(old).Order(), TlsCertificates.SubjectAlternativeNames(Server()).Order());
        AssertAuthorityUnchanged(before);
        Assert.Equal(0, await watch.StopAsync());
    }

    [Fact]
    public async Task Watch_tick_31_days_before_expiry_changes_nothing()
    {
        Watch watch = StartWatch();
        await watch.Time.WaitForTimersAsync(1);
        Dictionary<string, byte[]> before = Snapshot();
        int lines = OutputLines().Length;

        watch.Time.Now = new DateTimeOffset(Server().NotAfter).AddDays(-31);
        watch.Time.FireLatest();
        await watch.Time.WaitForTimersAsync(2);

        Assert.Equal(lines, OutputLines().Length);
        AssertSame(before, Snapshot());
        Assert.Equal(0, await watch.StopAsync());
    }

    [Fact]
    public async Task Watch_tick_failure_keeps_running_and_next_tick_succeeds()
    {
        Watch watch = StartWatch();
        await watch.Time.WaitForTimersAsync(1);
        byte[] authorityPem = File.ReadAllBytes(PathOf("ca/ca.crt"));
        byte[] serverPem = File.ReadAllBytes(PathOf("tls/server.pem"));
        DateTimeOffset renewAt = new DateTimeOffset(Server().NotAfter).AddDays(-29);

        File.WriteAllText(PathOf("ca/ca.crt"), "Unsinn");
        watch.Time.FireLatest();
        await watch.Time.WaitForTimersAsync(2);

        Assert.StartsWith("Prüfung des Zertifikats fehlgeschlagen: ", _errorText.ToString());
        Assert.Contains("beschädigt", _errorText.ToString());
        Assert.Contains("Nächster Versuch in 24 Stunden.", _errorText.ToString());
        Assert.Equal(serverPem, File.ReadAllBytes(PathOf("tls/server.pem")));
        Assert.False(watch.Task.IsCompleted);

        File.WriteAllBytes(PathOf("ca/ca.crt"), authorityPem);
        watch.Time.Now = renewAt;
        watch.Time.FireLatest();
        await watch.Time.WaitForTimersAsync(3);

        Assert.StartsWith("✓ Zertifikat für WordQuest erneuert (gültig bis ", OutputLines()[^1]);
        Assert.Equal(0, await watch.StopAsync());
    }

    public static TheoryData<string, string> BrokenAuthorities => new()
    {
        { "nur ca.key", "Die Zertifizierungsstelle ist unvollständig (es fehlt: ca/ca.crt)." + Way },
        { "nur ca.crt", "Die Zertifizierungsstelle ist unvollständig (es fehlt: ca/ca.key)." + Way },
        { "nur wordquest-ca.crt", "Die Zertifizierungsstelle ist unvollständig (es fehlt: ca/ca.key, ca/ca.crt)." + Way },
        { "fremder Schluessel", "Die Zertifizierungsstelle ist beschädigt (Schlüssel und Zertifikat passen nicht zusammen)." + Way },
        { "Unsinn in ca.crt", "Die Zertifizierungsstelle ist beschädigt (ca/ca.crt lässt sich nicht lesen)." + Way },
        { "Unsinn in ca.key", "Die Zertifizierungsstelle ist beschädigt (ca/ca.key lässt sich nicht lesen)." + Way },
        { "Server statt CA", "Die Zertifizierungsstelle ist beschädigt (das Zertifikat ist keine Zertifizierungsstelle)." + Way },
    };

    [Theory]
    [MemberData(nameof(BrokenAuthorities))]
    public async Task Watch_stops_on_unclear_authority_without_changing_files(string state, string message)
    {
        Restore(Template.Value);
        switch (state)
        {
            case "nur ca.key":
                File.Delete(PathOf("ca/ca.crt"));
                break;
            case "nur ca.crt":
                File.Delete(PathOf("ca/ca.key"));
                break;
            case "nur wordquest-ca.crt":
                File.Delete(PathOf("ca/ca.key"));
                File.Delete(PathOf("ca/ca.crt"));
                File.Delete(PathOf("tls/server.pem"));
                break;
            case "fremder Schluessel":
                using (RSA other = RSA.Create(2048))
                {
                    File.WriteAllText(PathOf("ca/ca.key"), other.ExportPkcs8PrivateKeyPem());
                }

                break;
            case "Unsinn in ca.crt":
                File.WriteAllText(PathOf("ca/ca.crt"), "Unsinn");
                break;
            case "Unsinn in ca.key":
                File.WriteAllText(PathOf("ca/ca.key"), "Unsinn");
                break;
            case "Server statt CA":
                // Schluessel und Zertifikat passen zusammen, sind aber keine CA.
                string serverPem = File.ReadAllText(PathOf("tls/server.pem"));
                File.WriteAllText(PathOf("ca/ca.crt"), PemBlock(serverPem, CertificateLabel));
                File.WriteAllText(PathOf("ca/ca.key"), PemBlock(serverPem, KeyLabel));
                break;
        }

        Dictionary<string, byte[]> before = Snapshot();

        Watch watch = StartWatch();

        Assert.Equal(1, await watch.Task.WaitAsync(Limit));
        Assert.Equal(message, _errorText.ToString().Trim());
        Assert.Equal(0, watch.Time.TimerCount);
        AssertSame(before, Snapshot());
    }

    [Fact]
    public async Task Missing_names_is_usage_error()
    {
        Assert.Equal(64, await RunAsync(["tls", "watch", "--dir", _root.FullName], null));
        Assert.Equal("WQ_TLS_NAMES fehlt.", _errorText.ToString().Trim());
        Assert.Empty(Snapshot());
    }

    [Theory]
    [MemberData(nameof(TlsCertificatesTests.InvalidNames), MemberType = typeof(TlsCertificatesTests))]
    public async Task Invalid_name_is_usage_error_without_files(string entry)
    {
        Assert.Equal(64, await RunAsync(["tls", "watch", "--dir", _root.FullName], $"pi,{entry}"));
        // TrimEnd: Beim leeren Eintrag endet die Meldung mit dem Doppelpunkt.
        Assert.Equal($"Ungültiger Eintrag in WQ_TLS_NAMES: {entry}".TrimEnd(), _errorText.ToString().Trim());
        Assert.Empty(Snapshot());
    }

    [Theory]
    [InlineData("tls")]
    [InlineData("tls renew")]
    [InlineData("tls watch --dir")]
    [InlineData("tls show --verzeichnis /tmp")]
    public async Task Unknown_call_is_usage_error(string call)
    {
        Assert.Equal(64, await RunAsync(call.Split(' '), Names));
        Assert.Equal(Usage, _errorText.ToString().Trim());
    }

    [Fact]
    public async Task Show_prints_fingerprints_and_changes_nothing()
    {
        Restore(Template.Value);
        Dictionary<string, byte[]> before = Snapshot();

        Assert.Equal(0, await RunAsync(["tls", "show", "--dir", _root.FullName], Names));

        Assert.Equal(
            [
                $"Fingerabdruck von WordQuest (SHA-256): {Hex(Server().RawData)}",
                $"Fingerabdruck der Zertifizierungsstelle (SHA-256): {Hex(File.ReadAllBytes(PathOf("tls/wordquest-ca.crt")))}",
            ],
            OutputLines());
        AssertSame(before, Snapshot());
    }

    [Theory]
    [InlineData("ohne server.pem", Names)]
    [InlineData("andere Namen", "pi,localhost")]
    [InlineData("leerer Ordner", Names)]
    public async Task Show_reports_not_ready_and_changes_nothing(string state, string names)
    {
        if (state != "leerer Ordner")
        {
            Restore(Template.Value);
        }

        if (state == "ohne server.pem")
        {
            File.Delete(PathOf("tls/server.pem"));
        }

        Dictionary<string, byte[]> before = Snapshot();

        Assert.Equal(1, await RunAsync(["tls", "show", "--dir", _root.FullName], names));

        Assert.Equal(NotReady, _errorText.ToString().Trim());
        Assert.Empty(OutputLines());
        AssertSame(before, Snapshot());
    }

    private static Dictionary<string, byte[]> CreateTemplate()
    {
        DirectoryInfo directory = Directory.CreateTempSubdirectory("wq-tls-template-");
        try
        {
            // Abgebrochenes Token: erste Pruefung, dann sofort Ende ohne Takt.
            int exitCode = TlsCommand.RunAsync(
                    ["tls", "watch", "--dir", directory.FullName], Names, TextWriter.Null, TextWriter.Null,
                    new FixedClock(Start), new CancellationToken(true))
                .WaitAsync(Limit).GetAwaiter().GetResult();
            Assert.Equal(0, exitCode);
            return Read(directory.FullName);
        }
        finally
        {
            directory.Delete(true);
        }
    }

    private Watch StartWatch(string names = Names)
    {
        var time = new ManualTimeProvider(Start);
        var cancel = new CancellationTokenSource();
        Task<int> task = TlsCommand.RunAsync(["tls", "watch", "--dir", _root.FullName], names, _output, _error, time, cancel.Token);
        return new Watch(task, time, cancel);
    }

    private Task<int> RunAsync(string[] args, string? names) =>
        TlsCommand.RunAsync(args, names, _output, _error, new FixedClock(Start), CancellationToken.None).WaitAsync(Limit);

    private string PathOf(string relative) => Path.Combine(_root.FullName, relative);

    private X509Certificate2 Server() => X509Certificate2.CreateFromPem(File.ReadAllText(PathOf("tls/server.pem")));

    private X509Certificate2 Authority() => X509Certificate2.CreateFromPem(File.ReadAllText(PathOf("ca/ca.crt")));

    private string[] OutputLines() => _outputText.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private Dictionary<string, byte[]> Snapshot() => Read(_root.FullName);

    private void Restore(Dictionary<string, byte[]> files)
    {
        foreach ((string relative, byte[] content) in files)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(PathOf(relative))!);
            File.WriteAllBytes(PathOf(relative), content);
        }
    }

    private void AssertAuthorityUnchanged(Dictionary<string, byte[]> before)
    {
        Dictionary<string, byte[]> after = Snapshot();
        foreach (string file in new[] { "ca/ca.key", "ca/ca.crt", "tls/wordquest-ca.crt" })
        {
            Assert.Equal(before[file], after[file]);
        }
    }

    private static void AssertSame(Dictionary<string, byte[]> before, Dictionary<string, byte[]> after)
    {
        Assert.Equal(before.Keys.Order(), after.Keys.Order());
        foreach (string file in before.Keys)
        {
            Assert.Equal(before[file], after[file]);
        }
    }

    private static Dictionary<string, byte[]> Read(string root) =>
        Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .ToDictionary(file => Path.GetRelativePath(root, file).Replace('\\', '/'), File.ReadAllBytes);

    // PEM-Bloecke in Reihenfolge, z. B. CERTIFICATE und danach PRIVATE KEY.
    private static List<(string Label, string Block)> PemBlocks(string text)
    {
        List<(string, string)> blocks = [];
        int offset = 0;
        while (PemEncoding.TryFind(text.AsSpan(offset), out PemFields fields))
        {
            blocks.Add((
                text[(offset + fields.Label.Start.Value)..(offset + fields.Label.End.Value)],
                text[(offset + fields.Location.Start.Value)..(offset + fields.Location.End.Value)]));
            offset += fields.Location.End.Value;
        }

        return blocks;
    }

    private static List<string> PemLabels(string text) => [.. PemBlocks(text).Select(block => block.Label)];

    private static string PemBlock(string text, string label) => PemBlocks(text).Single(block => block.Label == label).Block;

    private static string Day(DateTimeOffset value) => value.UtcDateTime.ToString("dd.MM.yyyy");

    private static string Hex(byte[] der) => Convert.ToHexString(SHA256.HashData(der)).Chunk(2)
        .Select(pair => new string(pair)).Aggregate((left, right) => left + ":" + right);

    private sealed record Watch(Task<int> Task, ManualTimeProvider Time, CancellationTokenSource Cancel)
    {
        public async Task<int> StopAsync()
        {
            await Cancel.CancelAsync();
            return await Task.WaitAsync(Limit);
        }
    }
}
