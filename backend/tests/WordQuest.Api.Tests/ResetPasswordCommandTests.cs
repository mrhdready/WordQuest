using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

/// <summary>
/// CLI-Verb reset-password (SETUP-04, D-06). Jeder Testfall bekommt eine
/// eigene Factory und damit eine eigene leere Datenbank (Isolationsregel
/// ApiFactory), weil create-owner vom Datenbankstand abhaengt.
/// </summary>
public sealed partial class ResetPasswordCommandTests : IAsyncLifetime
{
    private const string Email = "eltern@example.de";
    private const string OldPassword = "geheim-123";

    private readonly ApiFactory _factory = new ApiFactory();

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    // 16 Zeichen aus dem Alphabet ohne verwechselbare Zeichen (0, O, 1, l, I).
    [GeneratedRegex("^Neues Passwort für eltern@example\\.de: ([A-HJ-NP-Za-km-z2-9]{16}) — Es wird nur dieses eine Mal angezeigt\\. Melde dich damit an und ändere es unter \"Konto\"\\.$")]
    private static partial Regex SuccessLine();

    private async Task<(int Code, string Output)> RunAsync(string stdin, params string[] args)
    {
        var output = new StringWriter();
        int code = await AccountCommands.RunAsync(_factory.Services, args, new StringReader(stdin), output);
        return (code, output.ToString());
    }

    private async Task CreateOwnerAsync() =>
        Assert.Equal(0, (await RunAsync(OldPassword + "\n", "create-owner", Email)).Code);

    private async Task<HttpResponseMessage> LoginAsync(HttpClient client, string password) =>
        await client.PostAsJsonAsync("/api/v1/auth/login", new { email = Email, password });

    private async Task<string> PasswordHashAsync()
    {
        await using var db = _factory.CreateSystemDbContext();
        return (await db.Users.SingleAsync(u => u.Email == Email)).PasswordHash!;
    }

    [Fact]
    public async Task Reset_prints_new_password_once_and_only_it_allows_login()
    {
        await CreateOwnerAsync();
        using HttpClient client = _factory.CreateClient();

        // Vorher angemeldetes Geraet: sein Refresh-Token muss danach wertlos sein.
        HttpResponseMessage before = await LoginAsync(client, OldPassword);
        Assert.Equal(HttpStatusCode.OK, before.StatusCode);
        string refreshToken = (await before.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("refreshToken").GetString()!;

        (int code, string output) = await RunAsync(string.Empty, "reset-password", Email);

        Assert.Equal(0, code);
        string[] lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        Match match = SuccessLine().Match(Assert.Single(lines));
        Assert.True(match.Success, $"Unerwartete Ausgabe: {output}");
        string newPassword = match.Groups[1].Value;

        // In der DB steht nur der Hash.
        string hash = await PasswordHashAsync();
        Assert.DoesNotContain(newPassword, hash);
        Assert.True(PasswordHasher.Verify(newPassword, hash));

        HttpResponseMessage refresh = await client.PostAsJsonAsync(
            "/api/v1/auth/refresh", new { refreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(client, newPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(client, OldPassword)).StatusCode);
    }

    [Fact]
    public async Task Reset_finds_account_regardless_of_case_and_spaces()
    {
        await CreateOwnerAsync();

        (int code, string output) = await RunAsync(string.Empty, "reset-password", "  Eltern@Example.DE ");

        Assert.Equal(0, code);
        Assert.Contains("Neues Passwort für eltern@example.de:", output);
    }

    [Fact]
    public async Task Reset_unknown_email_exits_1_and_changes_nothing()
    {
        await CreateOwnerAsync();
        string hashBefore = await PasswordHashAsync();

        (int code, string output) = await RunAsync(string.Empty, "reset-password", "fremd@example.de");

        Assert.Equal(1, code);
        Assert.Equal("Es gibt kein Elternkonto mit dieser E-Mail-Adresse.", output.Trim());
        Assert.Equal(hashBefore, await PasswordHashAsync());
    }

    [Fact]
    public async Task Reset_does_not_touch_learner_accounts()
    {
        await CreateOwnerAsync();

        // Kinder haben keine E-Mail-Adresse; selbst wenn eine eingetragen waere,
        // setzt der Befehl nur Elternkonten zurueck.
        const string learnerEmail = "kind@example.de";
        await using (var db = _factory.CreateSystemDbContext())
        {
            Guid tenantId = (await db.Tenants.SingleAsync()).Id;
            db.Users.Add(new User
            {
                TenantId = tenantId,
                Role = UserRole.Learner,
                DisplayName = "Kind",
                Email = learnerEmail,
            });
            await db.SaveChangesAsync();
        }

        (int code, string output) = await RunAsync(string.Empty, "reset-password", learnerEmail);

        Assert.Equal(1, code);
        Assert.Equal("Es gibt kein Elternkonto mit dieser E-Mail-Adresse.", output.Trim());
        await using (var db = _factory.CreateSystemDbContext())
        {
            Assert.Null((await db.Users.SingleAsync(u => u.Email == learnerEmail)).PasswordHash);
        }
    }
}
