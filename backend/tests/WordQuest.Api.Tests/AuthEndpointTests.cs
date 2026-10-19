using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using WordQuest.Infrastructure;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;
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
    private const string Renewed = "Die Anmeldung wurde gerade in einem anderen Fenster erneuert.";

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

    private static Task<HttpResponseMessage> LogoutAsync(HttpClient client, string refreshToken) =>
        client.PostAsJsonAsync($"{Auth}/logout", new { refreshToken });

    private async Task<int> ActiveRefreshTokensAsync(Guid userId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.RefreshTokens.CountAsync(t => t.UserId == userId && t.RevokedAt == null);
    }

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

    // Lesbarer Body ohne Pflichtfeld: System.Text.Json bindet null ohne Fehler, das
    // zentrale 400 greift nicht. Ebenfalls 400 mit deutschem Text statt 500 (W-1).
    [Theory]
    [InlineData("refresh", "{}", "refreshToken", "Es fehlt das Anmelde-Token.")]
    [InlineData("refresh", "{\"refreshToken\":null}", "refreshToken", "Es fehlt das Anmelde-Token.")]
    [InlineData("logout", "{}", "refreshToken", "Es fehlt das Anmelde-Token.")]
    [InlineData("logout", "{\"refreshToken\":null}", "refreshToken", "Es fehlt das Anmelde-Token.")]
    [InlineData("login", "{}", "email", "Bitte gib E-Mail-Adresse und Passwort ein.")]
    public async Task Anfrage_ohne_Pflichtfeld_ergibt_400_mit_deutschem_Text(
        string endpoint, string body, string key, string message)
    {
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsync(
            $"{Auth}/{endpoint}", new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(message, problem.Errors[key][0]);
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
    // 401, und alle Tokens des Kontos sind danach widerrufen. Ausserhalb der
    // Gnadenfrist von 10 Sekunden (D-06), deshalb liegt die Rotation 11 Sekunden zurueck.
    [Fact]
    public async Task Wiederverwendetes_Refresh_Token_ergibt_401_und_widerruft_alle_Tokens()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LearnerLoginAsync(client, family.Child.Id, ChildPin));
        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));
        await using (var db = _factory.CreateSystemDbContext())
        {
            string firstHash = TokenHasher.Hash(first.RefreshToken);
            await db.RefreshTokens
                .Where(t => t.TokenHash == firstHash)
                .ExecuteUpdateAsync(u => u.SetProperty(t => t.RevokedAt, t => t.RevokedAt - TimeSpan.FromSeconds(11)));
        }

        HttpResponseMessage reused = await RefreshAsync(client, first.RefreshToken);
        Assert.Equal(Expired, await DetailAsync(reused, HttpStatusCode.Unauthorized));

        HttpResponseMessage revoked = await RefreshAsync(client, second.RefreshToken);
        Assert.Equal(Expired, await DetailAsync(revoked, HttpStatusCode.Unauthorized));
    }

    // Codex-Befund 1 (D-04): Ein Refresh laeuft, waehrend ein Elternteil die PIN
    // aendert. Danach darf kein Token der Kette gueltig sein. Pruefreihenfolge
    // ist Absicht: R1 zuerst vorzulegen widerriefe als Wiederverwendung alles und
    // verdeckte einen ueberlebenden Nachfolger (Review 01 HIGH).
    [Fact]
    public async Task Refresh_waehrend_neuer_PIN_hinterlaesst_keinen_gueltigen_Token()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        using HttpClient owner = _factory.CreateClientFor(family.Owner);
        AuthResponse first = await TokensAsync(await LearnerLoginAsync(client, family.Child.Id, ChildPin));

        var held = await _factory.LockRowsAsync(("app_user", family.Child.Id));
        Task<HttpResponseMessage> refresh = RefreshAsync(client, first.RefreshToken);
        await _factory.WaitForBlockedAsync(1);
        Task<HttpResponseMessage> patch = owner.PatchAsJsonAsync(
            $"/api/v1/learners/{family.Child.Id}/settings", new { pin = "2580" });
        await Task.WhenAny(patch, _factory.WaitForBlockedAsync(2));
        await ApiFactory.ReleaseAsync(held);
        HttpResponseMessage refreshed = await refresh;
        Assert.Equal(HttpStatusCode.OK, (await patch).StatusCode);

        Assert.Equal(0, await ActiveRefreshTokensAsync(family.Child.Id));
        if (refreshed.StatusCode == HttpStatusCode.OK)
        {
            AuthResponse successor = await TokensAsync(refreshed);
            Assert.Equal(Expired, await DetailAsync(await RefreshAsync(client, successor.RefreshToken), HttpStatusCode.Unauthorized));
        }

        Assert.Equal(Expired, await DetailAsync(await RefreshAsync(client, first.RefreshToken), HttpStatusCode.Unauthorized));
        await TokensAsync(await LearnerLoginAsync(client, family.Child.Id, "2580"));
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

    // ------------------------------------------------------------ Zwei Fenster, Abmelden (D-05, D-06)

    // Codex-Befund 4: Zwei Fenster erneuern gleichzeitig mit demselben Token. Genau
    // ein Nachfolger, das andere Fenster bekommt 409 ohne Tokens, nichts widerrufen.
    [Fact]
    public async Task Gleichzeitiger_Refresh_ergibt_200_und_409_und_der_Nachfolger_bleibt_gueltig()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));

        var held = await _factory.LockRowsAsync(("app_user", family.Owner.Id));
        Task<HttpResponseMessage> one = RefreshAsync(client, first.RefreshToken);
        Task<HttpResponseMessage> two = RefreshAsync(client, first.RefreshToken);
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
        HttpResponseMessage[] responses = await Task.WhenAll(one, two);

        AuthResponse second = await TokensAsync(Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(Renewed, await DetailAsync(
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict), HttpStatusCode.Conflict));
        await TokensAsync(await RefreshAsync(client, second.RefreshToken));
    }

    [Fact]
    public async Task Eben_rotiertes_Token_ergibt_409_und_der_Nachfolger_bleibt_gueltig()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));
        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));

        Assert.Equal(Renewed, await DetailAsync(await RefreshAsync(client, first.RefreshToken), HttpStatusCode.Conflict));

        await TokensAsync(await RefreshAsync(client, second.RefreshToken));
    }

    // Die Gnadenfrist gilt nur, solange der Nachfolger aktiv ist.
    [Fact]
    public async Task Eben_rotiertes_Token_mit_abgemeldetem_Nachfolger_ergibt_401()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));
        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));
        Assert.Equal(HttpStatusCode.NoContent, (await LogoutAsync(client, second.RefreshToken)).StatusCode);

        Assert.Equal(Expired, await DetailAsync(await RefreshAsync(client, first.RefreshToken), HttpStatusCode.Unauthorized));
    }

    // Codex-Befund 2 (Serverteil): Abmelden mit einem Token, dessen Refresh der
    // Server schon ausgefuehrt hat, beendet auch den Nachfolger.
    [Fact]
    public async Task Abmelden_mit_eben_rotiertem_Token_widerruft_den_Nachfolger()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));
        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));

        Assert.Equal(HttpStatusCode.NoContent, (await LogoutAsync(client, first.RefreshToken)).StatusCode);

        Assert.Equal(Expired, await DetailAsync(await RefreshAsync(client, second.RefreshToken), HttpStatusCode.Unauthorized));
    }

    // Abmelden laeuft, waehrend der Refresh mit demselben Token schreibt
    // (Review 01 HIGH). Die Testsperre liegt auf der Token-Zeile: Der Refresh
    // haelt dann schon die Kontosperre und wartet beim Beanspruchen, das
    // Abmelden hat den Token schon gelesen. Danach darf kein Token aktiv sein.
    [Fact]
    public async Task Abmelden_waehrend_Refresh_hinterlaesst_keinen_gueltigen_Token()
    {
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));
        Guid firstId;
        await using (var db = _factory.CreateSystemDbContext())
        {
            firstId = await db.RefreshTokens.Where(t => t.UserId == family.Owner.Id).Select(t => t.Id).SingleAsync();
        }

        var held = await _factory.LockRowsAsync(("refresh_token", firstId));
        Task<HttpResponseMessage> refresh = RefreshAsync(client, first.RefreshToken);
        await _factory.WaitForBlockedAsync(1);
        Task<HttpResponseMessage> logout = LogoutAsync(client, first.RefreshToken);
        await _factory.WaitForBlockedAsync(2);
        await ApiFactory.ReleaseAsync(held);
        HttpResponseMessage refreshed = await refresh;
        Assert.Equal(HttpStatusCode.NoContent, (await logout).StatusCode);

        Assert.Equal(0, await ActiveRefreshTokensAsync(family.Owner.Id));
        if (refreshed.StatusCode == HttpStatusCode.OK)
        {
            AuthResponse successor = await TokensAsync(refreshed);
            Assert.Equal(Expired, await DetailAsync(await RefreshAsync(client, successor.RefreshToken), HttpStatusCode.Unauthorized));
        }
    }

    // Review 01 MEDIUM, Plan-Checker 40P01: Die Ausfuehrungsstrategie wiederholt den
    // Refresh nach einem Deadlock hinter dem Anlegen des Nachfolgers. Es entsteht
    // genau ein Nachfolger, und die Antwort traegt genau diesen.
    [Fact]
    public async Task Refresh_nach_Deadlock_wiederholt_und_legt_genau_einen_Nachfolger_an()
    {
        var deadlock = new DeadlockOnceInterceptor();
        _factory.TestServices = services =>
            services.ConfigureDbContext<WordQuestDbContext>(options => options.AddInterceptors(deadlock));
        SeededFamily family = await SeedFamilyAsync(_factory);
        using HttpClient client = _factory.CreateClient();
        AuthResponse first = await TokensAsync(await LoginAsync(client, family.Owner, "geheim-123"));

        deadlock.Arm();
        AuthResponse second = await TokensAsync(await RefreshAsync(client, first.RefreshToken));

        Assert.Equal(1, deadlock.Thrown);
        await using (var db = _factory.CreateSystemDbContext())
        {
            List<RefreshToken> stored = await db.RefreshTokens.Where(t => t.UserId == family.Owner.Id).ToListAsync();
            Assert.Equal(2, stored.Count);
            RefreshToken old = Assert.Single(stored, t => t.TokenHash == TokenHasher.Hash(first.RefreshToken));
            Assert.NotNull(old.RevokedAt);
            Assert.Equal(TokenHasher.Hash(second.RefreshToken), old.ReplacedByTokenHash);
            RefreshToken next = Assert.Single(stored, t => t.TokenHash == TokenHasher.Hash(second.RefreshToken));
            Assert.Null(next.RevokedAt);
        }

        await TokensAsync(await RefreshAsync(client, second.RefreshToken));
    }

    /// <summary>
    /// Wirft genau einmal nach Arm() beim Einfuegen eines Refresh-Tokens einen
    /// Deadlock (40P01), wie ihn PostgreSQL bei einem echten Sperrzyklus meldet.
    /// </summary>
    private sealed class DeadlockOnceInterceptor : DbCommandInterceptor
    {
        private int _armed;
        private int _thrown;

        public int Thrown => Volatile.Read(ref _thrown);

        public void Arm() => Volatile.Write(ref _armed, 1);

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            ThrowOnce(command);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            ThrowOnce(command);
            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }

        private void ThrowOnce(DbCommand command)
        {
            if (command.CommandText.Contains("INSERT INTO refresh_token", StringComparison.Ordinal)
                && Interlocked.CompareExchange(ref _armed, 0, 1) == 1)
            {
                Interlocked.Increment(ref _thrown);
                throw new PostgresException("erzwungener Deadlock (Test)", "ERROR", "ERROR", PostgresErrorCodes.DeadlockDetected);
            }
        }
    }
}
