using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

/// <summary>
/// POST /api/v1/account/password (SETUP-03, D-05). Jeder Testfall bekommt eine
/// eigene Factory und damit eine eigene Datenbank und einen eigenen
/// Rate-Limiter (Isolationsregel ApiFactory); kein Fall ruft die Policy "auth"
/// oefter als dreimal auf. Testdaten entstehen direkt in der Datenbank, Clients
/// bekommen ihr Token ohne Login.
/// </summary>
public sealed class AccountEndpointTests : IAsyncLifetime
{
    private const string Path = "/api/v1/account/password";
    private const string OldPassword = "altes-passwort-1";

    private readonly ApiFactory _factory = new ApiFactory();

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    // Familie mit Elternkonto (bekanntes Passwort) und einem Kind.
    private async Task<(User Owner, User Child)> SeedFamilyAsync(string email = "eltern@example.de")
    {
        var tenant = new Tenant { Name = "Familie", Type = TenantType.Family };
        var owner = new User
        {
            TenantId = tenant.Id,
            Role = UserRole.Owner,
            DisplayName = "Eltern",
            Email = email,
            PasswordHash = PasswordHasher.Hash(OldPassword),
        };
        var child = new User { TenantId = tenant.Id, Role = UserRole.Learner, DisplayName = "Max" };

        await using var db = _factory.CreateSystemDbContext();
        db.Tenants.Add(tenant);
        db.Users.AddRange(owner, child);
        db.LearnerProfiles.Add(new LearnerProfile { Id = child.Id, TenantId = tenant.Id });
        await db.SaveChangesAsync();
        return (owner, child);
    }

    // Zweites Elternteil (Rolle Guardian, nicht Owner) in derselben Familie wie der Owner.
    private async Task<User> SeedGuardianAsync()
    {
        (User owner, _) = await SeedFamilyAsync();
        var guardian = new User
        {
            TenantId = owner.TenantId,
            Role = UserRole.Guardian,
            DisplayName = "Zweites Elternteil",
            Email = "zweites@example.de",
            PasswordHash = PasswordHasher.Hash(OldPassword),
        };
        await using var db = _factory.CreateSystemDbContext();
        db.Users.Add(guardian);
        await db.SaveChangesAsync();
        return guardian;
    }

    private async Task<string> PasswordHashAsync(Guid userId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return (await db.Users.SingleAsync(u => u.Id == userId)).PasswordHash!;
    }

    private static Task<HttpResponseMessage> ChangeAsync(HttpClient client, string current, string next) =>
        client.PostAsJsonAsync(Path, new { currentPassword = current, newPassword = next });

    private async Task<HttpStatusCode> LoginStatusAsync(string email, string password)
    {
        using HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        return response.StatusCode;
    }

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string key)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem =
            await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.True(problem.Errors.ContainsKey(key), $"Schluessel {key} fehlt: {string.Join(", ", problem.Errors.Keys)}");
        return problem.Errors[key][0];
    }

    [Fact]
    public async Task Without_token_returns_401()
    {
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "neues-passwort-1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Child_token_returns_403()
    {
        (_, User child) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(child);

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "neues-passwort-1");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Wrong_current_password_returns_400_on_currentPassword_never_401()
    {
        (User owner, _) = await SeedFamilyAsync();
        string before = await PasswordHashAsync(owner.Id);
        using HttpClient client = _factory.CreateClientFor(owner);

        HttpResponseMessage response = await ChangeAsync(client, "falsches-passwort", "neues-passwort-1");

        Assert.Equal("Das aktuelle Passwort stimmt nicht.", await FieldErrorAsync(response, "currentPassword"));
        Assert.Equal(before, await PasswordHashAsync(owner.Id));
    }

    [Fact]
    public async Task New_password_with_7_characters_returns_400_on_newPassword()
    {
        (User owner, _) = await SeedFamilyAsync();
        string before = await PasswordHashAsync(owner.Id);
        using HttpClient client = _factory.CreateClientFor(owner);

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "1234567");

        Assert.Equal(
            "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
            await FieldErrorAsync(response, "newPassword"));
        Assert.Equal(before, await PasswordHashAsync(owner.Id));
    }

    [Fact]
    public async Task New_password_of_eight_spaces_returns_400_not_500()
    {
        (User owner, _) = await SeedFamilyAsync();
        string before = await PasswordHashAsync(owner.Id);
        using HttpClient client = _factory.CreateClientFor(owner);

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "        ");

        Assert.Equal("Bitte gib ein neues Passwort ein.", await FieldErrorAsync(response, "newPassword"));
        Assert.Equal(before, await PasswordHashAsync(owner.Id));
    }

    [Fact]
    public async Task New_password_with_exactly_8_characters_replaces_the_old_one()
    {
        (User owner, _) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(owner);

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "12345678");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(owner.Email!, "12345678"));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(owner.Email!, OldPassword));
    }

    [Fact]
    public async Task Spaces_around_a_valid_password_are_kept()
    {
        (User owner, _) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(owner);
        const string withSpaces = " abcdefgh ";

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, withSpaces);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(owner.Email!, withSpaces));
    }

    [Fact]
    public async Task Guardian_account_can_change_its_password()
    {
        User guardian = await SeedGuardianAsync();
        using HttpClient client = _factory.CreateClientFor(guardian);

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "neues-passwort-1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(PasswordHasher.Verify("neues-passwort-1", await PasswordHashAsync(guardian.Id)));
    }

    [Fact]
    public async Task Token_of_a_deleted_account_returns_404()
    {
        User guardian = await SeedGuardianAsync();
        using HttpClient client = _factory.CreateClientFor(guardian);

        // Das Token bleibt bis zu seinem Ablauf gueltig, auch wenn das Konto inzwischen geloescht ist.
        await using (var db = _factory.CreateSystemDbContext())
        {
            db.Users.Remove(await db.Users.SingleAsync(u => u.Id == guardian.Id));
            await db.SaveChangesAsync();
        }

        HttpResponseMessage response = await ChangeAsync(client, OldPassword, "neues-passwort-1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Only_the_account_from_the_token_changes()
    {
        (User owner, _) = await SeedFamilyAsync("eltern@example.de");
        (User other, _) = await SeedFamilyAsync("andere@example.de");
        string otherBefore = await PasswordHashAsync(other.Id);
        using HttpClient client = _factory.CreateClientFor(owner);

        // Eine fremde Id im Koerper wird ignoriert, massgeblich ist nur das Token.
        HttpResponseMessage response = await client.PostAsJsonAsync(
            Path, new { userId = other.Id, currentPassword = OldPassword, newPassword = "neues-passwort-1" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(otherBefore, await PasswordHashAsync(other.Id));
        Assert.True(PasswordHasher.Verify("neues-passwort-1", await PasswordHashAsync(owner.Id)));
    }
}
