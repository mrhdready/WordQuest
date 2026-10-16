using System.Net;
using System.Net.Http.Json;
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
}
