using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace WordQuest.Api;

/// <summary>
/// Verb <c>tls</c> fuer den Dienst certs: <c>tls watch</c> ist der einzige Schreiber der
/// Zertifikatsdateien (Codex 1), <c>tls show</c> liest nur. Die Namensliste kommt nur aus
/// WQ_TLS_NAMES. Ablage unter &lt;dir&gt;: ca/ca.key (0600), ca/ca.crt (0644),
/// tls/server.pem (Zertifikat und Schluessel, 0640, nginx liest ueber Gruppe 101) und
/// tls/wordquest-ca.crt (DER, 0644, zum Herunterladen).
/// </summary>
public static class TlsCommand
{
    private const int UsageError = 64;
    private const string DefaultDirectory = "/certs";
    private const string UsageLine = "Aufruf: tls watch [--dir <Ordner>] oder tls show [--dir <Ordner>]";
    private const string Way =
        " Es wurde nichts geändert. Wie es weitergeht, steht in der Installationsanleitung unter „Zertifizierungsstelle neu anlegen“.";

    private const UnixFileMode OwnerOnly = UnixFileMode.UserRead | UnixFileMode.UserWrite;
    private const UnixFileMode GroupReadable = OwnerOnly | UnixFileMode.GroupRead;
    private const UnixFileMode WorldReadable = GroupReadable | UnixFileMode.OtherRead;

    public static bool IsCommand(string[] args) => args is ["tls", ..];

    public static async Task<int> RunAsync(
        string[] args,
        string? names,
        TextWriter output,
        TextWriter error,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(output);
        ArgumentNullException.ThrowIfNull(error);
        ArgumentNullException.ThrowIfNull(time);

        (string? verb, string directory) = args switch
        {
            ["tls", "watch" or "show"] => (args[1], DefaultDirectory),
            ["tls", "watch" or "show", "--dir", string dir] => (args[1], dir),
            _ => (null, DefaultDirectory),
        };
        if (verb is null)
        {
            await error.WriteLineAsync(UsageLine);
            return UsageError;
        }

        if (string.IsNullOrEmpty(names))
        {
            await error.WriteLineAsync("WQ_TLS_NAMES fehlt.");
            return UsageError;
        }

        if (!TlsCertificates.TryParseNames(
                names, out IReadOnlyList<string> dnsNames, out IReadOnlyList<IPAddress> ipAddresses, out string? invalid))
        {
            await error.WriteLineAsync($"Ungültiger Eintrag in WQ_TLS_NAMES: {invalid}");
            return UsageError;
        }

        var check = new Check(new Files(directory), dnsNames, ipAddresses, output);
        return verb == "show"
            ? await ShowAsync(check, time.GetUtcNow(), output, error)
            : await WatchAsync(check, time, error, cancellationToken);
    }

    private static async Task<int> WatchAsync(Check check, TimeProvider time, TextWriter error, CancellationToken cancellationToken)
    {
        // Ein Fehler schon beim Start endet mit 1; Docker startet certs neu und versucht es wieder.
        try
        {
            check.Run(time.GetUtcNow(), initial: true);
        }
        catch (Exception exception) when (IsCheckFailure(exception))
        {
            await error.WriteLineAsync(exception.Message);
            return 1;
        }

        while (true)
        {
            try
            {
                // Task.Delay mit TimeProvider legt je Takt einen neuen Timer an; das macht den Takt testbar.
                await Task.Delay(TimeSpan.FromDays(1), time, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                return 0;
            }

            // Spaetere Fehler beenden den Dienst nicht: Das bestehende Zertifikat gilt noch Wochen.
            try
            {
                check.Run(time.GetUtcNow(), initial: false);
            }
            catch (Exception exception) when (IsCheckFailure(exception))
            {
                await error.WriteLineAsync(
                    $"Prüfung des Zertifikats fehlgeschlagen: {exception.Message} Nächster Versuch in 24 Stunden.");
            }
        }
    }

    private static async Task<int> ShowAsync(Check check, DateTimeOffset now, TextWriter output, TextWriter error)
    {
        try
        {
            using X509Certificate2? authority = check.Files.HasAnyAuthorityFile ? check.Files.LoadAuthority() : null;
            using X509Certificate2? server = check.Files.LoadServerOrNull();
            if (authority is null || server is null
                || TlsCertificates.NeedsReissue(server, authority, check.DnsNames, check.IpAddresses, now))
            {
                await error.WriteLineAsync("Das Zertifikat für WordQuest ist noch nicht bereit.");
                return 1;
            }

            await output.WriteLineAsync($"Fingerabdruck von WordQuest (SHA-256): {TlsCertificates.Fingerprint(server)}");
            await output.WriteLineAsync(
                $"Fingerabdruck der Zertifizierungsstelle (SHA-256): {TlsCertificates.Fingerprint(authority)}");
            return 0;
        }
        catch (Exception exception) when (IsCheckFailure(exception))
        {
            await error.WriteLineAsync(exception.Message);
            return 1;
        }
    }

    private static bool IsCheckFailure(Exception exception) =>
        exception is IOException or UnauthorizedAccessException or CryptographicException or AuthorityException;

    private static string Day(DateTime notAfter) => notAfter.ToUniversalTime().ToString("dd.MM.yyyy");

    private sealed record Check(Files Files, IReadOnlyList<string> DnsNames, IReadOnlyList<IPAddress> IpAddresses, TextWriter Output)
    {
        // Spaetere Takte melden nur Aenderungen; die erste Pruefung meldet immer den Stand.
        public void Run(DateTimeOffset now, bool initial)
        {
            using X509Certificate2 authority = EnsureAuthority(now, initial);
            EnsureServer(authority, now, initial);

            if (!File.Exists(Files.CaDownload) || !File.ReadAllBytes(Files.CaDownload).AsSpan().SequenceEqual(authority.RawData))
            {
                WriteAtomic(Files.CaDownload, authority.RawData, WorldReadable);
            }
        }

        private X509Certificate2 EnsureAuthority(DateTimeOffset now, bool initial)
        {
            // Neue CA nur, wenn keine ihrer Dateien existiert; jeder Rest stoppt vorher (Codex 2).
            if (Files.HasAnyAuthorityFile)
            {
                X509Certificate2 existing = Files.LoadAuthority();
                if (initial)
                {
                    Output.WriteLine("✓ Zertifizierungsstelle existiert bereits — unverändert.");
                }

                return existing;
            }

            X509Certificate2 created = TlsCertificates.CreateAuthority(DnsNames.FirstOrDefault() ?? "WordQuest", now);
            using (RSA key = created.GetRSAPrivateKey()!)
            {
                // Erst der Schluessel: ein Abbruch dazwischen hinterlaesst "unvollstaendig", nie eine stille neue CA.
                WriteAtomic(Files.CaKey, Encoding.ASCII.GetBytes(key.ExportPkcs8PrivateKeyPem() + "\n"), OwnerOnly);
            }

            WriteAtomic(Files.CaCert, Encoding.ASCII.GetBytes(created.ExportCertificatePem() + "\n"), WorldReadable);
            Output.WriteLine($"✓ Zertifizierungsstelle angelegt (gültig bis {Day(created.NotAfter)}).");
            return created;
        }

        private void EnsureServer(X509Certificate2 authority, DateTimeOffset now, bool initial)
        {
            string? done;
            using (X509Certificate2? current = Files.LoadServerOrNull())
            {
                done = current is null || !TlsCertificates.NamesMatch(current, DnsNames, IpAddresses)
                    ? "ausgestellt"
                    : TlsCertificates.NeedsReissue(current, authority, DnsNames, IpAddresses, now) ? "erneuert" : null;
            }

            if (done is null)
            {
                if (initial)
                {
                    Output.WriteLine("✓ Zertifikat für WordQuest ist aktuell — unverändert.");
                }

                return;
            }

            using X509Certificate2 server = TlsCertificates.IssueServer(authority, DnsNames, IpAddresses, now);
            using RSA key = server.GetRSAPrivateKey()!;
            WriteAtomic(
                Files.ServerPem,
                Encoding.ASCII.GetBytes(server.ExportCertificatePem() + "\n" + key.ExportPkcs8PrivateKeyPem() + "\n"),
                GroupReadable);
            Output.WriteLine($"✓ Zertifikat für WordQuest {done} (gültig bis {Day(server.NotAfter)}).");
        }
    }

    private sealed record Files(string Directory)
    {
        public string CaKey => Path.Combine(Directory, "ca", "ca.key");

        public string CaCert => Path.Combine(Directory, "ca", "ca.crt");

        public string ServerPem => Path.Combine(Directory, "tls", "server.pem");

        public string CaDownload => Path.Combine(Directory, "tls", "wordquest-ca.crt");

        public bool HasAnyAuthorityFile => File.Exists(CaKey) || File.Exists(CaCert) || File.Exists(CaDownload);

        /// <summary>Laedt die CA mit Schluessel oder wirft <see cref="AuthorityException"/>, ohne etwas zu schreiben.</summary>
        public X509Certificate2 LoadAuthority()
        {
            string[] missing = [.. new[] { (CaKey, "ca/ca.key"), (CaCert, "ca/ca.crt") }
                .Where(file => !File.Exists(file.Item1))
                .Select(file => file.Item2)];
            if (missing.Length > 0)
            {
                throw new AuthorityException(
                    $"Die Zertifizierungsstelle ist unvollständig (es fehlt: {string.Join(", ", missing)}).{Way}");
            }

            using X509Certificate2 certificate = Read(CaCert, "ca/ca.crt", pem => X509Certificate2.CreateFromPem(pem));
            using RSA key = Read(CaKey, "ca/ca.key", pem =>
            {
                var rsa = RSA.Create();
                rsa.ImportFromPem(pem);
                return rsa;
            });

            using RSA? publicKey = certificate.GetRSAPublicKey();
            if (publicKey is null
                || !publicKey.ExportSubjectPublicKeyInfo().AsSpan().SequenceEqual(key.ExportSubjectPublicKeyInfo()))
            {
                throw Broken("Schlüssel und Zertifikat passen nicht zusammen");
            }

            if (certificate.Extensions.OfType<X509BasicConstraintsExtension>().FirstOrDefault() is not { CertificateAuthority: true })
            {
                throw Broken("das Zertifikat ist keine Zertifizierungsstelle");
            }

            return certificate.CopyWithPrivateKey(key);
        }

        /// <summary>Fehlendes oder unlesbares server.pem heisst: neu ausstellen bzw. noch nicht bereit.</summary>
        public X509Certificate2? LoadServerOrNull()
        {
            if (!File.Exists(ServerPem))
            {
                return null;
            }

            string pem = File.ReadAllText(ServerPem);
            try
            {
                return X509Certificate2.CreateFromPem(pem, pem);
            }
            catch (Exception exception) when (exception is CryptographicException or ArgumentException)
            {
                return null;
            }
        }

        private static T Read<T>(string path, string name, Func<string, T> parse)
        {
            try
            {
                return parse(File.ReadAllText(path));
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException
                                                  or CryptographicException or ArgumentException)
            {
                throw Broken($"{name} lässt sich nicht lesen");
            }
        }

        private static AuthorityException Broken(string reason) =>
            new($"Die Zertifizierungsstelle ist beschädigt ({reason}).{Way}");
    }

    // Temporaere Datei im selben Ordner mit dem Zielmodus schon beim Anlegen, dann Umbenennen:
    // nginx sieht nie eine halbe Datei, und es gibt keinen Moment mit zu weiten Rechten (Codex 10).
    private static void WriteAtomic(string path, byte[] content, UnixFileMode mode)
    {
        // certs laeuft nur im Linux-Container; Dateimodi gibt es unter Windows nicht.
        if (OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("tls laeuft nur unter Linux.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporary = path + ".tmp";
        File.Delete(temporary);
        using (var stream = new FileStream(temporary, new FileStreamOptions
        {
            Mode = FileMode.CreateNew,
            Access = FileAccess.Write,
            UnixCreateMode = mode,
        }))
        {
            // Die umask koennte den Modus beim Anlegen enger machen; nginx braucht genau diesen.
            File.SetUnixFileMode(stream.SafeFileHandle, mode);
            stream.Write(content);
            stream.Flush(true);
        }

        File.Move(temporary, path, true);
    }

    /// <summary>Unklarer CA-Zustand: Meldung fuer den Betreiber, es wurde nichts geschrieben.</summary>
    private sealed class AuthorityException(string message) : Exception(message);
}
