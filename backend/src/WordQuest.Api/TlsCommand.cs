using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace WordQuest.Api;

/// <summary>
/// Verb <c>tls</c> fuer den Dienst certs: <c>tls watch</c> ist der einzige Schreiber der
/// Zertifikatsdateien (Codex 1). Die Namensliste kommt nur aus WQ_TLS_NAMES.
/// Ablage unter &lt;dir&gt;: ca/ca.key (0600), ca/ca.crt (0644), tls/server.pem
/// (Zertifikat und Schluessel, 0640, nginx liest ueber Gruppe 101) und
/// tls/wordquest-ca.crt (DER, 0644, zum Herunterladen).
/// </summary>
public static class TlsCommand
{
    private const int UsageError = 64;
    private const string DefaultDirectory = "/certs";

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

        string directory = args is [_, _, "--dir", string dir] ? dir : DefaultDirectory;
        List<string> dnsNames = [];
        List<IPAddress> ipAddresses = [];
        foreach (string name in (names ?? string.Empty).Split(','))
        {
            if (IPAddress.TryParse(name, out IPAddress? ip))
            {
                ipAddresses.Add(ip);
            }
            else
            {
                dnsNames.Add(name);
            }
        }

        var files = new Files(directory);
        Check(files, dnsNames, ipAddresses, time.GetUtcNow(), output);

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

            Check(files, dnsNames, ipAddresses, time.GetUtcNow(), output);
        }
    }

    private static void Check(
        Files files, List<string> dnsNames, List<IPAddress> ipAddresses, DateTimeOffset now, TextWriter output)
    {
        X509Certificate2 authority;
        if (!File.Exists(files.CaKey) && !File.Exists(files.CaCert))
        {
            authority = TlsCertificates.CreateAuthority(dnsNames.FirstOrDefault() ?? "WordQuest", now);
            using RSA caKey = authority.GetRSAPrivateKey()!;
            WriteAtomic(files.CaKey, Encoding.ASCII.GetBytes(caKey.ExportPkcs8PrivateKeyPem() + "\n"), OwnerOnly);
            WriteAtomic(files.CaCert, Encoding.ASCII.GetBytes(authority.ExportCertificatePem() + "\n"), WorldReadable);
            output.WriteLine($"✓ Zertifizierungsstelle angelegt (gültig bis {Day(authority.NotAfter)}).");
        }
        else
        {
            authority = X509Certificate2.CreateFromPem(File.ReadAllText(files.CaCert), File.ReadAllText(files.CaKey));
            output.WriteLine("✓ Zertifizierungsstelle existiert bereits — unverändert.");
        }

        using (authority)
        {
            if (!File.Exists(files.ServerPem))
            {
                using X509Certificate2 server = TlsCertificates.IssueServer(authority, dnsNames, ipAddresses, now);
                using RSA serverKey = server.GetRSAPrivateKey()!;
                WriteAtomic(
                    files.ServerPem,
                    Encoding.ASCII.GetBytes(server.ExportCertificatePem() + "\n" + serverKey.ExportPkcs8PrivateKeyPem() + "\n"),
                    GroupReadable);
                output.WriteLine($"✓ Zertifikat für WordQuest ausgestellt (gültig bis {Day(server.NotAfter)}).");
            }
            else
            {
                output.WriteLine("✓ Zertifikat für WordQuest ist aktuell — unverändert.");
            }

            if (!File.Exists(files.CaDownload))
            {
                WriteAtomic(files.CaDownload, authority.RawData, WorldReadable);
            }
        }
    }

    private static string Day(DateTime notAfter) => notAfter.ToUniversalTime().ToString("dd.MM.yyyy");

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

    private sealed record Files(string Directory)
    {
        public string CaKey => Path.Combine(Directory, "ca", "ca.key");

        public string CaCert => Path.Combine(Directory, "ca", "ca.crt");

        public string ServerPem => Path.Combine(Directory, "tls", "server.pem");

        public string CaDownload => Path.Combine(Directory, "tls", "wordquest-ca.crt");
    }
}
