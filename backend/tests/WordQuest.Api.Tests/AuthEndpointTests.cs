using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Identity.Entities;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Anmeldung, Kinder-Anmeldung mit Sperre, Refresh-Rotation und Wiederverwendung
/// gegen echtes PostgreSQL (QUAL-01, D-13). Eigene Factory je Testfall und damit
/// ein eigener Limiter; jeder Fall bleibt unter 10 Aufrufen der Policy "auth"
/// (Refresh und Abmelden zaehlen seit FIX-01 nicht mit).
/// </summary>
public sealed class AuthEndpointTests : IAsyncLifetime
{
    private const string Auth = "/api/v1/auth";
    private const string Expired = "Sitzung abgelaufen. Bitte neu anmelden.";
    private const string BadBody = "Die Anfrage ist unvollständig oder nicht lesbar.";

    private readonly ApiFactory _factory = new ApiFactory();

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    // ------------------------------------------------------------ Hilfen

    private static async Task<string?> DetailAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        ProblemDetails? problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        return problem?.Detail;
    }

    private static async Task<AuthResponse> TokensAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AuthResponse? auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrEmpty(auth.AccessToken));
        Assert.False(string.IsNullOrEmpty(auth.RefreshToken));
        return auth;
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, User owner, string password) =>
        client.PostAsJsonAsync($"{Auth}/login", new { email = owner.Email, password });

    private static Task<HttpResponseMessage> LearnerLoginAsync(HttpClient client, Guid learnerId, string pin) =>
        client.PostAsJsonAsync($"{Auth}/learner-login", new { learnerId, pin });

    private static Task<HttpResponseMessage> RefreshAsync(HttpClient client, string refreshToken) =>
        client.PostAsJsonAsync($"{Auth}/refresh", new { refreshToken });

    // ------------------------------------------------------------ Anfrage ohne lesbaren Body

    // Direkter API-Aufruf ohne Body oder mit kaputtem JSON: 400 mit deutschem Text, nie 500
    // (FIX-04-Geist). Die Oberflaeche sendet so etwas nie.
    [Theory]
    [InlineData("login", null)]
    [InlineData("login", "")]
    [InlineData("login", "{x")]
    [InlineData("login", "null")]
    [InlineData("learner-login", null)]
    [InlineData("refresh", "{x")]
    public async Task Anfrage_ohne_lesbaren_Body_ergibt_400_mit_deutschem_Text(string endpoint, string? body)
    {
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsync(
            $"{Auth}/{endpoint}",
            body is null ? null : new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(BadBody, await DetailAsync(response, HttpStatusCode.BadRequest));
    }

    // ------------------------------------------------------------ Login

    [Fact]
    public async Task Login_mit_richtigem_Passwort_liefert_Tokens()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();

        AuthResponse auth = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));

        Assert.Equal(family.Owner.Id, auth.User.Id);
    }

    [Fact]
    public async Task Login_mit_falschem_Passwort_ergibt_401()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await LoginAsync(client, family.Owner, "falsches-passwort");

        Assert.Equal("E-Mail-Adresse oder Passwort stimmt nicht.", await DetailAsync(response, HttpStatusCode.Unauthorized));
    }

    // ------------------------------------------------------------ Kinder-Login

    [Fact]
    public async Task Kinder_Login_mit_richtiger_PIN_liefert_Tokens()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();

        AuthResponse auth = await TokensAsync(await LearnerLoginAsync(client, family.Child.Id, ChildPin));

        Assert.Equal(family.Child.Id, auth.User.Id);
    }

    [Fact]
    public async Task Kinder_Login_mit_falscher_PIN_ergibt_401()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await LearnerLoginAsync(client, family.Child.Id, "0000");

        Assert.Equal("Die PIN stimmt nicht.", await DetailAsync(response, HttpStatusCode.Unauthorized));
    }

    // Sperre nach 10 Fehlversuchen (AuthOptions.MaxPinAttempts): neun per Seed,
    // damit der Fall das Limit der Policy "auth" nicht beruehrt.
    [Fact]
    public async Task Kinder_Login_ist_nach_dem_zehnten_Fehlversuch_15_Minuten_gesperrt()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        await using (var db = _factory.CreateSystemDbContext())
        {
            LearnerProfile profile = await db.LearnerProfiles.FindAsync(family.Child.Id)
                ?? throw new InvalidOperationException("Profil fehlt.");
            profile.FailedPinAttempts = 9;
            await db.SaveChangesAsync();
        }

        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage tenth = await LearnerLoginAsync(client, family.Child.Id, "0000");
        Assert.Equal("Die PIN stimmt nicht.", await DetailAsync(tenth, HttpStatusCode.Unauthorized));

        HttpResponseMessage locked = await LearnerLoginAsync(client, family.Child.Id, ChildPin);
        Assert.Equal(
            "Zu viele Versuche. Bitte in 15 Minuten nochmal probieren.",
            await DetailAsync(locked, HttpStatusCode.Unauthorized));
    }

    [Fact]
    public async Task Kinder_Login_mit_unbekannter_Kind_Id_ergibt_401()
    {
        await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await LearnerLoginAsync(client, Guid.NewGuid(), ChildPin);

        Assert.Equal("Dieses Profil gibt es nicht.", await DetailAsync(response, HttpStatusCode.Unauthorized));
    }

    // ------------------------------------------------------------ Refresh

    [Fact]
    public async Task Refresh_rotiert_das_Token_und_das_neue_funktioniert()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));

        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);

        AuthResponse third = await TokensAsync(await RefreshAsync(client, second.RefreshToken));
        Assert.Equal(family.Owner.Id, third.User.Id);
    }

    // T-02-27: Ein rotiertes Token taucht erneut auf (gestohlen oder verschleppt):
    // 401, und alle Tokens des Kontos sind danach widerrufen.
    [Fact]
    public async Task Wiederverwendetes_Refresh_Token_ergibt_401_und_widerruft_alle_Tokens()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LearnerLoginAsync(client, family.Child.Id, ChildPin));
        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));

        HttpResponseMessage reused = await RefreshAsync(client, first.RefreshToken);
        Assert.Equal(Expired, await DetailAsync(reused, HttpStatusCode.Unauthorized));

        HttpResponseMessage revoked = await RefreshAsync(client, second.RefreshToken);
        Assert.Equal(Expired, await DetailAsync(revoked, HttpStatusCode.Unauthorized));
    }

    [Fact]
    public async Task Nach_dem_Abmelden_ist_das_Refresh_Token_ungueltig()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse auth = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));

        HttpResponseMessage logout = await client.PostAsJsonAsync($"{Auth}/logout", new { refreshToken = auth.RefreshToken });
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        HttpResponseMessage refresh = await RefreshAsync(client, auth.RefreshToken);
        Assert.Equal(Expired, await DetailAsync(refresh, HttpStatusCode.Unauthorized));
    }
}
