using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

/// <summary>
/// Standard der Policy "auth": 10 Aufrufe pro Minute (Konzept §12). Nur der
/// e2e-Teststack hebt den Wert ueber Auth:RequestsPerMinute an; hier gilt die
/// Konfiguration aus appsettings.json. Eigene Factory je Testfall und damit
/// ein eigener Limiter (Isolationsregel ApiFactory).
/// </summary>
public sealed class RateLimitTests : IAsyncLifetime
{
    private const int Limit = 10;

    private readonly ApiFactory _factory = new ApiFactory();

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    private async Task<User> SeedOwnerAsync()
    {
        var tenant = new Tenant { Name = "Familie", Type = TenantType.Family };
        var owner = new User
        {
            TenantId = tenant.Id,
            Role = UserRole.Owner,
            DisplayName = "Eltern",
            Email = "eltern@example.de",
            PasswordHash = PasswordHasher.Hash("richtiges-passwort"),
        };

        await using var db = _factory.CreateSystemDbContext();
        db.Tenants.Add(tenant);
        db.Users.Add(owner);
        await db.SaveChangesAsync();
        return owner;
    }

    /// <summary>
    /// POST mit gesetzter Verbindungs-IP: TestServer setzt sonst keine
    /// RemoteIpAddress, und alle Anfragen landen im selben Topf.
    /// </summary>
    private async Task<int> PostFromAsync(string path, object body, string remoteIp, string? forwardedFor = null)
    {
        byte[] json = JsonSerializer.SerializeToUtf8Bytes(body);
        HttpContext context = await _factory.Server.SendAsync(c =>
        {
            c.Request.Method = HttpMethods.Post;
            c.Request.Path = path;
            c.Request.ContentType = "application/json";
            c.Request.ContentLength = json.Length;
            c.Request.Body = new MemoryStream(json);
            // TestServer meldet hier sonst "kein Body", und die Endpunkte antworten 500.
            c.Features.Set<IHttpRequestBodyDetectionFeature>(new HasBody());
            c.Connection.RemoteIpAddress = IPAddress.Parse(remoteIp);
            if (forwardedFor is not null)
            {
                c.Request.Headers["X-Forwarded-For"] = forwardedFor;
            }
        });
        return context.Response.StatusCode;
    }

    private Task<int> WrongLoginAsync(User owner, string remoteIp, string? forwardedFor) =>
        PostFromAsync("/api/v1/auth/login", new { email = owner.Email, password = "falsches-passwort" }, remoteIp, forwardedFor);

    [Fact]
    public async Task Eleventh_login_within_a_minute_returns_429()
    {
        User owner = await SeedOwnerAsync();
        using HttpClient client = _factory.CreateClient();

        for (int attempt = 1; attempt <= Limit; attempt++)
        {
            HttpResponseMessage response = await client.PostAsJsonAsync(
                "/api/v1/auth/login", new { email = owner.Email, password = "falsches-passwort" });
            Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"Versuch {attempt}: {response.StatusCode}");
        }

        HttpResponseMessage eleventh = await client.PostAsJsonAsync(
            "/api/v1/auth/login", new { email = owner.Email, password = "falsches-passwort" });
        Assert.Equal(HttpStatusCode.TooManyRequests, eleventh.StatusCode);
    }

    // T-01-23: mit gestohlenem Token laesst sich das aktuelle Passwort nicht unbegrenzt raten.
    [Fact]
    public async Task Eleventh_password_change_within_a_minute_returns_429()
    {
        User owner = await SeedOwnerAsync();
        using HttpClient client = _factory.CreateClientFor(owner);
        object body = new { currentPassword = "falsches-passwort", newPassword = "neues-passwort-1" };

        for (int attempt = 1; attempt <= Limit; attempt++)
        {
            HttpResponseMessage response = await client.PostAsJsonAsync("/api/v1/account/password", body);
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"Versuch {attempt}: {response.StatusCode}");
        }

        HttpResponseMessage eleventh = await client.PostAsJsonAsync("/api/v1/account/password", body);
        Assert.Equal(HttpStatusCode.TooManyRequests, eleventh.StatusCode);
    }

    // FIX-01: Ein Geraet sperrt nur sich selbst aus, nicht die Familie hinter demselben nginx.
    // 172.18.0.3 bzw. 192.168.240.3: nginx im Compose-Netz (Docker-Pools weichen je nach Host ab).
    [Theory]
    [InlineData("172.18.0.3")]
    [InlineData("192.168.240.3")]
    public async Task Locked_device_does_not_lock_another_device_behind_the_proxy(string proxyIp)
    {
        User owner = await SeedOwnerAsync();

        for (int attempt = 1; attempt <= Limit; attempt++)
        {
            int status = await WrongLoginAsync(owner, proxyIp, "192.168.178.20");
            Assert.True(status == StatusCodes.Status401Unauthorized, $"Versuch {attempt}: {status}");
        }

        Assert.Equal(StatusCodes.Status429TooManyRequests, await WrongLoginAsync(owner, proxyIp, "192.168.178.20"));
        Assert.Equal(StatusCodes.Status401Unauthorized, await WrongLoginAsync(owner, proxyIp, "192.168.178.21"));
    }

    // T-02-22: Ein Absender, der kein vertrauter Proxy ist, waehlt seinen Topf nicht per Kopf.
    [Fact]
    public async Task Forwarded_header_from_untrusted_sender_does_not_open_a_new_bucket()
    {
        User owner = await SeedOwnerAsync();

        for (int attempt = 1; attempt <= Limit; attempt++)
        {
            int status = await WrongLoginAsync(owner, "203.0.113.30", $"10.0.0.{attempt}");
            Assert.True(status == StatusCodes.Status401Unauthorized, $"Versuch {attempt}: {status}");
        }

        Assert.Equal(StatusCodes.Status429TooManyRequests, await WrongLoginAsync(owner, "203.0.113.30", "10.0.0.11"));
    }

    // T-02-22: Nur der rechte Wert (von nginx gesetzt) zaehlt; ein vom Geraet
    // vorangestellter Wert waehlt keinen neuen Topf, auch aus 172.16.0.0/12.
    [Fact]
    public async Task Prepended_forwarded_value_does_not_open_a_new_bucket()
    {
        User owner = await SeedOwnerAsync();

        for (int attempt = 1; attempt <= Limit; attempt++)
        {
            int status = await WrongLoginAsync(owner, "172.18.0.3", "203.0.113.9, 172.20.1.5");
            Assert.True(status == StatusCodes.Status401Unauthorized, $"Versuch {attempt}: {status}");
        }

        Assert.Equal(StatusCodes.Status429TooManyRequests, await WrongLoginAsync(owner, "172.18.0.3", "203.0.113.10, 172.20.1.5"));
    }

    // D-10: Refresh und Abmelden erneuern bzw. beenden nur eine Anmeldung und
    // verbrauchen das Login-Budget nicht.
    [Fact]
    public async Task Refresh_and_logout_are_never_rate_limited()
    {
        for (int attempt = 1; attempt <= 2 * Limit; attempt++)
        {
            int refresh = await PostFromAsync("/api/v1/auth/refresh", new { refreshToken = "ungueltig" }, "172.18.0.3", "192.168.178.20");
            Assert.True(refresh == StatusCodes.Status401Unauthorized, $"Refresh {attempt}: {refresh}");
            int logout = await PostFromAsync("/api/v1/auth/logout", new { refreshToken = "ungueltig" }, "172.18.0.3", "192.168.178.20");
            Assert.True(logout != StatusCodes.Status429TooManyRequests, $"Abmelden {attempt}: {logout}");
        }
    }

    [Fact]
    public async Task Device_with_exhausted_login_budget_can_still_refresh()
    {
        User owner = await SeedOwnerAsync();
        for (int attempt = 1; attempt <= Limit + 1; attempt++)
        {
            await WrongLoginAsync(owner, "172.18.0.3", "192.168.178.20");
        }

        Assert.Equal(StatusCodes.Status429TooManyRequests, await WrongLoginAsync(owner, "172.18.0.3", "192.168.178.20"));
        Assert.Equal(
            StatusCodes.Status401Unauthorized,
            await PostFromAsync("/api/v1/auth/refresh", new { refreshToken = "ungueltig" }, "172.18.0.3", "192.168.178.20"));
    }

    private sealed class HasBody : IHttpRequestBodyDetectionFeature
    {
        public bool CanHaveBody => true;
    }
}
