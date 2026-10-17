using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WordQuest.Api.Auth;
using WordQuest.Infrastructure;
using WordQuest.Modules.Identity.Entities;

// Hausregel: keine parallelen Suites gegen eine geteilte Datenbank. Dazu kommt,
// dass die Factory Umgebungsvariablen des Prozesses setzt.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace WordQuest.Api.Tests;

/// <summary>
/// Startet die API gegen eine eigene, frisch migrierte PostgreSQL-Datenbank
/// (<c>wordquest_test_&lt;guid&gt;</c>) auf dem Server aus <c>WQ_TEST_DB</c>.
///
/// Isolationsregel (gilt fuer alle Api.Tests, auch 01-05 bis 01-08):
/// Tests, deren Erwartung vom Datenbankstand abhaengt (has-owner,
/// create-owner, Anzahl Mandanten oder Elternkonten), nutzen kein
/// <c>IClassFixture&lt;ApiFactory&gt;</c>, sondern legen im Konstruktor der
/// Testklasse eine eigene <c>new ApiFactory()</c> an (xUnit erzeugt je
/// Testfall eine neue Instanz) und rufen sie ueber <c>IAsyncLifetime</c> auf
/// und ab. Jede Factory hat ihre eigene Datenbank, ihren eigenen Host und
/// damit ihren eigenen Rate-Limiter. Klassen mit gemeinsamer Factory legen
/// Testdaten mit eindeutigen Werten an (Guid in E-Mail und Namen) und pruefen
/// keine globalen Zaehlungen.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string DefaultServer = "Host=localhost;Port=5432;Username=wordquest;Password=devpassword";

    // Reiner Testwert, nie im Betrieb.
    private const string TestSigningKey = "nur-fuer-integrationstests-mindestens-32-zeichen";

    private readonly string _connectionString;

    public ApiFactory()
    {
        string server = Environment.GetEnvironmentVariable("WQ_TEST_DB") ?? DefaultServer;
        _connectionString = $"{server};Database=wordquest_test_{Guid.NewGuid():N}";

        // Program.cs liest Verbindung und Schluessel vor builder.Build();
        // Werte aus ConfigureWebHost kaemen zu spaet. Umgebungsvariablen
        // schlagen appsettings.Development.json.
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", _connectionString);
        Environment.SetEnvironmentVariable("WQ_JWT_SIGNING_KEY", TestSigningKey);
        Environment.SetEnvironmentVariable("WQ_SEED_DEMO_DATA", "false");
    }

    /// <summary>
    /// Kontext ohne Mandantenfilter fuer Testdaten und Pruefungen. Gebaut aus
    /// dem Verbindungsstring, nicht aus dem Host, damit er auch nach dessen
    /// Ende funktioniert.
    /// </summary>
    public WordQuestDbContext CreateSystemDbContext() =>
        new(new DbContextOptionsBuilder<WordQuestDbContext>().UseNpgsql(_connectionString).Options,
            new SystemTenantContext());

    /// <summary>
    /// Client mit Bearer-Token direkt aus dem Token-Dienst: Tests verbrauchen
    /// so nicht das Rate-Limit "auth" (10 Logins pro Minute).
    /// </summary>
    public HttpClient CreateClientFor(User user)
    {
        string token = Services.GetRequiredService<JwtTokenService>().CreateAccessToken(user);
        HttpClient client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// Migriert die Datenbank, damit Tests Daten anlegen koennen, bevor der
    /// Host laeuft. Der Start-Block in Program.cs (Bereinigung, Migration)
    /// laeuft zusaetzlich beim ersten Zugriff auf Services (MigrationTests).
    /// </summary>
    public async Task InitializeAsync()
    {
        await using WordQuestDbContext db = CreateSystemDbContext();
        await db.Database.MigrateAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await using WordQuestDbContext db = CreateSystemDbContext();
        await db.Database.EnsureDeletedAsync();
    }

    Task IAsyncLifetime.DisposeAsync() => DisposeAsync().AsTask();
}
