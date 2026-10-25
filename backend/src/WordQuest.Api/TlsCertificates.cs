using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;

namespace WordQuest.Api;

/// <summary>
/// Zertifikatsregeln fuer HTTPS im Heimnetz: eine eigene Zertifizierungsstelle (CA)
/// je Installation und ein davon signiertes Server-Zertifikat. Nur BCL, kein
/// Dateisystem; die Ablage macht <see cref="TlsCommand"/>.
/// RSA statt ECDSA: iOS-Profile und aeltere Geraete kommen damit sicher zurecht
/// (Codex 4); Apple nennt fuer vertrauenswuerdige Zertifikate RSA ab 2048 Bit.
/// </summary>
public static class TlsCertificates
{
    // Apple misst hoechstens 825 Tage von NotBefore bis NotAfter; 800 lassen Abstand.
    public static readonly TimeSpan ServerLifetime = TimeSpan.FromDays(800);

    // Darunter stellt der taegliche Takt ein neues Server-Zertifikat aus.
    public static readonly TimeSpan RenewBefore = TimeSpan.FromDays(30);

    // Geraete mit leicht nachgehender Uhr sollen ein frisches Zertifikat schon annehmen.
    public static readonly TimeSpan ClockSkew = TimeSpan.FromHours(1);

    // Die CA bleibt 10 Jahre: Wer sie auf einem Geraet installiert hat, soll das nicht wiederholen muessen.
    public const int AuthorityYears = 10;

    private const string ServerAuthOid = "1.3.6.1.5.5.7.3.1";
    private const string SubjectAlternativeNameOid = "2.5.29.17";

    // \z statt $: $ liesse ein abschliessendes \n durch.
    private static readonly Regex DnsName = new(
        @"\A[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\z", RegexOptions.Compiled);

    public static X509Certificate2 CreateAuthority(string label, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(label);

        using RSA key = RSA.Create(3072);
        var name = new X500DistinguishedNameBuilder();
        name.AddOrganizationName("WordQuest");
        // Datum und Name machen die CA auf den Geraeten erkennbar und je Installation eindeutig.
        name.AddCommonName($"WordQuest Zertifizierungsstelle {label} {now.UtcDateTime:yyyy-MM-dd}");

        var request = new CertificateRequest(name.Build(), key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, true, 0, true));
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign, true));
        request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));

        DateTimeOffset notBefore = now - ClockSkew;
        return request.CreateSelfSigned(notBefore, notBefore.AddYears(AuthorityYears));
    }

    public static X509Certificate2 IssueServer(
        X509Certificate2 authority,
        IReadOnlyList<string> dnsNames,
        IReadOnlyList<IPAddress> ipAddresses,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(authority);
        ArgumentNullException.ThrowIfNull(dnsNames);
        ArgumentNullException.ThrowIfNull(ipAddresses);

        using RSA key = RSA.Create(2048);
        var request = new CertificateRequest("CN=WordQuest", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(
            X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        request.CertificateExtensions.Add(
            new X509EnhancedKeyUsageExtension([new Oid(ServerAuthOid)], false));

        var san = new SubjectAlternativeNameBuilder();
        foreach (string dnsName in dnsNames)
        {
            san.AddDnsName(dnsName);
        }

        foreach (IPAddress ipAddress in ipAddresses)
        {
            san.AddIpAddress(ipAddress);
        }

        request.CertificateExtensions.Add(san.Build());
        request.CertificateExtensions.Add(
            X509AuthorityKeyIdentifierExtension.CreateFromCertificate(authority, true, false));

        DateTimeOffset notBefore = now - ClockSkew;
        DateTimeOffset authorityEnd = new(authority.NotAfter);
        DateTimeOffset notAfter = notBefore + ServerLifetime;
        if (notAfter > authorityEnd)
        {
            notAfter = authorityEnd;
        }

        // Positiv und ohne fuehrende Null-Bytes (DER-Normalform), 127 Bit Zufall.
        byte[] serial = RandomNumberGenerator.GetBytes(16);
        serial[0] = (byte)((serial[0] & 0x7F) | 0x01);

        using X509Certificate2 certificate = request.Create(authority, notBefore, notAfter, serial);
        return certificate.CopyWithPrivateKey(key);
    }

    /// <summary>
    /// Ein neues Server-Zertifikat ist noetig, wenn es nicht von genau dieser CA stammt,
    /// zum Zeitpunkt nicht gueltig ist, unter 30 Tage Rest hat oder andere Namen traegt.
    /// </summary>
    public static bool NeedsReissue(
        X509Certificate2 server,
        X509Certificate2 authority,
        IReadOnlyList<string> dnsNames,
        IReadOnlyList<IPAddress> ipAddresses,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(server);
        ArgumentNullException.ThrowIfNull(authority);
        ArgumentNullException.ThrowIfNull(dnsNames);
        ArgumentNullException.ThrowIfNull(ipAddresses);

        return !NamesMatch(server, dnsNames, ipAddresses)
            || new DateTimeOffset(server.NotAfter) - now < RenewBefore
            || !IssuedBy(server, authority, now);
    }

    public static bool NamesMatch(X509Certificate2 server, IReadOnlyList<string> dnsNames, IReadOnlyList<IPAddress> ipAddresses)
    {
        ArgumentNullException.ThrowIfNull(dnsNames);
        ArgumentNullException.ThrowIfNull(ipAddresses);

        // Ordinal: die Namensregel laesst nur Kleinbuchstaben zu, IPs in Normalform.
        return SubjectAlternativeNames(server).SetEquals(dnsNames.Concat(ipAddresses.Select(ip => ip.ToString())));
    }

    public static IReadOnlySet<string> SubjectAlternativeNames(X509Certificate2 certificate)
    {
        ArgumentNullException.ThrowIfNull(certificate);

        X509Extension? extension = certificate.Extensions[SubjectAlternativeNameOid];
        if (extension is null)
        {
            return new HashSet<string>(StringComparer.Ordinal);
        }

        var san = new X509SubjectAlternativeNameExtension(extension.RawData, extension.Critical);
        return san.EnumerateDnsNames()
            .Concat(san.EnumerateIPAddresses().Select(ip => ip.ToString()))
            .ToHashSet(StringComparer.Ordinal);
    }

    /// <summary>SHA-256 ueber DER, Grossbuchstaben, Paare mit Doppelpunkt — wie Browser und openssl es zeigen.</summary>
    public static string Fingerprint(X509Certificate2 certificate)
    {
        ArgumentNullException.ThrowIfNull(certificate);
        return BitConverter.ToString(SHA256.HashData(certificate.RawData)).Replace('-', ':');
    }

    /// <summary>
    /// Namensregel fuer WQ_TLS_NAMES, gleich in setup.sh (Codex 8): Eintraege nur aus Ziffern
    /// und Punkten muessen IPv4 in Normalform sein, alles andere ein kleingeschriebener DNS-Name.
    /// </summary>
    public static bool TryParseNames(
        string? value,
        out IReadOnlyList<string> dnsNames,
        out IReadOnlyList<IPAddress> ipAddresses,
        out string? invalid)
    {
        List<string> dns = [];
        List<IPAddress> ips = [];
        dnsNames = dns;
        ipAddresses = ips;
        invalid = null;

        foreach (string entry in (value ?? string.Empty).Split(','))
        {
            if (entry.Length > 0 && entry.All(c => char.IsAsciiDigit(c) || c == '.'))
            {
                if (!IPAddress.TryParse(entry, out IPAddress? ip)
                    || ip.AddressFamily != AddressFamily.InterNetwork
                    || ip.ToString() != entry)
                {
                    invalid = entry;
                    return false;
                }

                ips.Add(ip);
            }
            else if (entry.Length <= 253 && DnsName.IsMatch(entry))
            {
                dns.Add(entry);
            }
            else
            {
                invalid = entry;
                return false;
            }
        }

        return true;
    }

    private static bool IssuedBy(X509Certificate2 server, X509Certificate2 authority, DateTimeOffset now)
    {
        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(authority);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        chain.ChainPolicy.DisableCertificateDownloads = true;
        chain.ChainPolicy.VerificationTime = now.LocalDateTime;
        return chain.Build(server);
    }
}
