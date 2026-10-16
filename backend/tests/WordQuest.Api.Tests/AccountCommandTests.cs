using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

/// <summary>
/// CLI-Verben has-owner/create-owner. Jeder Testfall bekommt eine eigene
/// Factory und damit eine eigene leere Datenbank (Isolationsregel ApiFactory).
/// </summary>
public sealed class AccountCommandTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new ApiFactory();

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    private async Task<(int Code, string Output)> RunAsync(string stdin, params string[] args)
    {
        var output = new StringWriter();
        int code = await AccountCommands.RunAsync(_factory.Services, args, new StringReader(stdin), output);
        return (code, output.ToString());
    }

    private Task<(int Code, string Output)> CreateOwnerAsync(string email, string password) =>
        RunAsync(password + "\n", "create-owner", email);

    private async Task<int> CountTenantsAsync()
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.Tenants.CountAsync();
    }

    [Fact]
    public async Task HasOwner_is_10_on_empty_database_and_0_after_create_owner()
    {
        Assert.Equal(10, (await RunAsync(string.Empty, "has-owner")).Code);

        Assert.Equal(0, (await CreateOwnerAsync("eltern@example.de", "geheim-123")).Code);

        Assert.Equal(0, (await RunAsync(string.Empty, "has-owner")).Code);
    }

    [Fact]
    public async Task CreateOwner_valid_allows_login_with_exactly_these_credentials()
    {
        (int code, string output) = await CreateOwnerAsync("eltern@example.de", "geheim-123");

        Assert.Equal(0, code);
        Assert.Contains("Elternkonto für eltern@example.de angelegt.", output);
        Assert.DoesNotContain("geheim-123", output);

        using HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/v1/auth/login", new { email = "eltern@example.de", password = "geheim-123" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CreateOwner_second_time_is_rejected_with_exit_3()
    {
        Assert.Equal(0, (await CreateOwnerAsync("eltern@example.de", "geheim-123")).Code);

        (int code, string output) = await CreateOwnerAsync("zweite@example.de", "anderes-456");

        Assert.Equal(3, code);
        Assert.Contains("Es gibt schon ein Elternkonto.", output);
        Assert.DoesNotContain("anderes-456", output);
        Assert.Equal(1, await CountTenantsAsync());
    }

    [Theory]
    [InlineData("keine-mail", "geheim-123", "Das sieht nicht nach einer E-Mail-Adresse aus. Bitte noch einmal.")]
    [InlineData("eltern@example.de", "geheim1", "Das Passwort muss mindestens 8 Zeichen lang sein.")]
    [InlineData("eltern@example.de", "        ", "Das Passwort darf nicht nur aus Leerzeichen bestehen.")]
    public async Task CreateOwner_invalid_input_is_rejected_with_exit_2(string email, string password, string message)
    {
        (int code, string output) = await CreateOwnerAsync(email, password);

        Assert.Equal(2, code);
        Assert.Contains(message, output);
        if (!string.IsNullOrWhiteSpace(password))
        {
            Assert.DoesNotContain(password, output);
        }

        Assert.Equal(0, await CountTenantsAsync());
    }

    [Fact]
    public async Task CreateOwner_keeps_surrounding_spaces_in_password()
    {
        Assert.Equal(0, (await CreateOwnerAsync("eltern@example.de", "  geheim-123 ")).Code);

        await using var db = _factory.CreateSystemDbContext();
        User owner = await db.Users.SingleAsync();
        Assert.True(PasswordHasher.Verify("  geheim-123 ", owner.PasswordHash));
        Assert.False(PasswordHasher.Verify("geheim-123", owner.PasswordHash));
    }
}
