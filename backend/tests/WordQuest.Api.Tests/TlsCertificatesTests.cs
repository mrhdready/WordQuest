using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace WordQuest.Api.Tests;

/// <summary>Zertifikatsregeln ohne Dateisystem (OD-1, TLS-01, TLS-02, Codex 4 und 8).</summary>
public sealed class TlsCertificatesTests
{
    private const string ServerAuth = "1.3.6.1.5.5.7.3.1";

    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);

    // RSA 3072 ist langsam: eine CA fuer die ganze Klasse, eine zweite fuer "fremde CA" und "Rest 100 Tage".
    private static readonly X509Certificate2 Authority = TlsCertificates.CreateAuthority("pi", Now);
    private static readonly X509Certificate2 ShortAuthority =
        TlsCertificates.CreateAuthority("pi", Now.AddYears(-10).AddDays(100));

    private static readonly string[] Dns = ["pi", "pi.local", "localhost"];
    private static readonly IPAddress[] Ips = [IPAddress.Parse("192.168.178.20"), IPAddress.Parse("127.0.0.1")];

    [Fact]
    public void Authority_is_rsa3072_ca_with_critical_constraints_for_ten_years()
    {
        Assert.Equal(3072, Authority.GetRSAPublicKey()!.KeySize);
        Assert.Equal("1.2.840.113549.1.1.11", Authority.SignatureAlgorithm.Value);

        X509BasicConstraintsExtension constraints = Extension<X509BasicConstraintsExtension>(Authority);
        Assert.True(constraints.CertificateAuthority);
        Assert.True(constraints.HasPathLengthConstraint);
        Assert.Equal(0, constraints.PathLengthConstraint);
        Assert.True(constraints.Critical);

        X509KeyUsageExtension usage = Extension<X509KeyUsageExtension>(Authority);
        Assert.Equal(X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign, usage.KeyUsages);
        Assert.True(usage.Critical);

        Assert.NotEmpty(Extension<X509SubjectKeyIdentifierExtension>(Authority).SubjectKeyIdentifier!);

        Assert.Equal(Now.AddHours(-1), new DateTimeOffset(Authority.NotBefore));
        Assert.Equal(Now.AddHours(-1).AddYears(10), new DateTimeOffset(Authority.NotAfter));
    }

    [Fact]
    public void Server_chains_to_authority()
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);
        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(Authority);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        chain.ChainPolicy.VerificationTime = Now.LocalDateTime;

        bool valid = chain.Build(server);

        Assert.True(valid, string.Join(", ", chain.ChainStatus.Select(status => status.StatusInformation)));
    }

    [Fact]
    public void Server_is_rsa2048_with_exact_sans_server_auth_and_800_days()
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);

        Assert.Equal(2048, server.GetRSAPublicKey()!.KeySize);
        Assert.Equal("1.2.840.113549.1.1.11", server.SignatureAlgorithm.Value);

        var san = new X509SubjectAlternativeNameExtension(server.Extensions["2.5.29.17"]!.RawData);
        Assert.Equal(Dns.Order(), san.EnumerateDnsNames().Order());
        Assert.Equal(Ips.Select(ip => ip.ToString()).Order(), san.EnumerateIPAddresses().Select(ip => ip.ToString()).Order());

        X509EnhancedKeyUsageExtension eku = Extension<X509EnhancedKeyUsageExtension>(server);
        Assert.Equal([ServerAuth], eku.EnhancedKeyUsages.Cast<Oid>().Select(oid => oid.Value));

        X509KeyUsageExtension usage = Extension<X509KeyUsageExtension>(server);
        Assert.Equal(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, usage.KeyUsages);
        Assert.True(usage.Critical);

        Assert.False(Extension<X509BasicConstraintsExtension>(server).CertificateAuthority);
        Assert.Equal(TimeSpan.FromDays(800), server.NotAfter - server.NotBefore);
    }

    [Fact]
    public void Server_never_outlives_authority()
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(ShortAuthority, Dns, Ips, Now);

        Assert.True(server.NotAfter <= ShortAuthority.NotAfter);
        Assert.Equal(ShortAuthority.NotAfter, server.NotAfter);
    }

    [Fact]
    public void Server_serial_numbers_are_positive_and_differ()
    {
        using X509Certificate2 first = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);
        using X509Certificate2 second = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);

        Assert.True(first.SerialNumberBytes.Span[0] < 0x80);
        Assert.True(second.SerialNumberBytes.Span[0] < 0x80);
        Assert.NotEqual(first.SerialNumber, second.SerialNumber);
    }

    [Fact]
    public void NeedsReissue_is_false_for_same_names_in_other_order()
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);

        Assert.False(TlsCertificates.NeedsReissue(server, Authority, [.. Dns.Reverse()], [.. Ips.Reverse()], Now));
    }

    [Theory]
    [InlineData("pi,pi.local,localhost,wordquest.test", "192.168.178.20,127.0.0.1")]
    [InlineData("pi,localhost", "192.168.178.20,127.0.0.1")]
    [InlineData("pi,pi.local,localhost", "192.168.178.20,127.0.0.1,10.0.0.2")]
    [InlineData("pi,pi.local,localhost", "127.0.0.1")]
    public void NeedsReissue_is_true_for_changed_names(string dns, string ips)
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);

        Assert.True(TlsCertificates.NeedsReissue(
            server, Authority, dns.Split(','), [.. ips.Split(',').Select(IPAddress.Parse)], Now));
    }

    [Theory]
    [InlineData(29, true)]
    [InlineData(31, false)]
    public void NeedsReissue_renews_below_30_days(int daysLeft, bool expected)
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(Authority, Dns, Ips, Now);
        DateTimeOffset at = new DateTimeOffset(server.NotAfter).AddDays(-daysLeft);

        Assert.Equal(expected, TlsCertificates.NeedsReissue(server, Authority, Dns, Ips, at));
    }

    [Fact]
    public void NeedsReissue_is_true_for_foreign_authority()
    {
        using X509Certificate2 server = TlsCertificates.IssueServer(ShortAuthority, Dns, Ips, Now);

        Assert.True(TlsCertificates.NeedsReissue(server, Authority, Dns, Ips, Now));
    }

    // Gemeinsame Beispieltabelle mit setup.sh (Plan 03, Codex 8).
    public static TheoryData<string> ValidNames =>
        ["pi", "pi-5", "wordquest.test", "pi-wohnzimmer.fritz.box", new string('a', 63), "127.0.0.1", "192.168.178.20"];

    public static TheoryData<string> InvalidNames =>
    [
        "bad_name", "-x", "x-", "a..b", ".a", "a.", "Pi", "123", "1.2.3", "256.1.1.1", "01.2.3.4",
        new string('a', 64), string.Join('.', Enumerable.Repeat(new string('a', 63), 4)), "fd00::1", "",
    ];

    [Theory]
    [MemberData(nameof(ValidNames))]
    public void TryParseNames_accepts_valid_entry(string entry)
    {
        bool valid = TlsCertificates.TryParseNames(
            $"localhost,{entry}", out IReadOnlyList<string> dns, out IReadOnlyList<IPAddress> ips, out string? invalid);

        Assert.True(valid);
        Assert.Null(invalid);
        Assert.Contains(entry, dns.Concat(ips.Select(ip => ip.ToString())));
        Assert.Equal(entry.All(c => char.IsAsciiDigit(c) || c == '.'), ips.Any(ip => ip.ToString() == entry));
    }

    [Theory]
    [MemberData(nameof(InvalidNames))]
    public void TryParseNames_rejects_invalid_entry(string entry)
    {
        bool valid = TlsCertificates.TryParseNames($"localhost,{entry}", out _, out _, out string? invalid);

        Assert.False(valid);
        Assert.Equal(entry, invalid);
    }

    [Fact]
    public void Fingerprint_is_uppercase_sha256_of_der_with_colons()
    {
        string fingerprint = TlsCertificates.Fingerprint(Authority);

        Assert.Matches("^([0-9A-F]{2}:){31}[0-9A-F]{2}$", fingerprint);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Authority.RawData)), fingerprint.Replace(":", string.Empty));
    }

    private static T Extension<T>(X509Certificate2 certificate)
        where T : X509Extension => certificate.Extensions.OfType<T>().Single();
}
