using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WordQuest.Infrastructure;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Learning.Entities;
using static WordQuest.Api.Tests.TestData;

namespace WordQuest.Api.Tests;

/// <summary>
/// Startpfad aus Program.cs auf Altinstallationen (FIX-02, D-06, D-18): Vor der
/// Migration mit den Fremdschluesseln raeumt die API verwaiste Zeilen auf.
/// Eigene Factory je Fall ohne InitializeAsync, damit erst der Start der API
/// migriert (Isolationsregel ApiFactory). Der erste Zugriff auf Services
/// startet Program samt Startblock.
/// </summary>
public sealed class MigrationTests : IAsyncLifetime
{
    private const string Initial = "20260917045557_Initial";

    private readonly ApiFactory _factory = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    /// <summary>Zeilen je Tabelle plus geleerte Bezuege.</summary>
    private sealed record Counts(
        int States, int Logs, int LogsWithoutSession, int Sessions, int SessionsWithoutSet,
        int Items, int Games, int Tokens);

    /// <summary>Gueltige Zeilen, die jede Bereinigung ueberleben muessen.</summary>
    private sealed record Valid(Guid ChildId, Guid CardId, Guid SessionId, long LogId, Guid ItemId, Guid TokenId);

    private void StartApi() => _ = _factory.Services;

    private async Task<Counts> CountsAsync()
    {
        await using var db = _factory.CreateSystemDbContext();
        return new Counts(
            await db.ReviewStates.CountAsync(),
            await db.ReviewLogs.CountAsync(),
            await db.ReviewLogs.CountAsync(l => l.SessionId == null),
            await db.LearningSessions.CountAsync(),
            await db.LearningSessions.CountAsync(s => s.SetId == null),
            await db.SessionItems.CountAsync(),
            await db.GamificationProfiles.CountAsync(),
            await db.RefreshTokens.CountAsync());
    }

    /// <summary>
    /// Datenbank auf dem Stand vor den Fremdschluesseln: eine gueltige Familie
    /// mit Lernstand und Runde plus Waisen jeder Art.
    /// </summary>
    private async Task<Valid> SeedLegacyDatabaseAsync()
    {
        await using (var migrate = _factory.CreateSystemDbContext())
        {
            await migrate.GetService<IMigrator>().MigrateAsync(Initial);
        }

        SeededFamily family = await SeedFamilyAsync(_factory);
        SeededSet set = await SeedSetAsync(_factory, family, entries: 1);
        Guid tenant = family.Tenant.Id;
        Guid child = family.Child.Id;
        Guid card = set.Cards[0].Id;
        DateTimeOffset now = DateTimeOffset.UtcNow;

        var session = new LearningSession { TenantId = tenant, LearnerId = child, SetId = set.Set.Id, GameKey = "classic" };
        var item = new SessionItem { TenantId = tenant, SessionId = session.Id, CardId = card };
        var log = new ReviewLog { TenantId = tenant, LearnerId = child, CardId = card, SessionId = session.Id, GameKey = "classic" };
        var token = new RefreshToken { TenantId = tenant, UserId = child, TokenHash = new string('a', 64), ExpiresAt = now.AddDays(1) };

        // Vor den Fremdschluesseln nimmt die Datenbank auch Zeilen ohne Bezug an.
        var orphanSession = new LearningSession { TenantId = tenant, LearnerId = Guid.NewGuid(), GameKey = "classic" };
        var setlessSession = new LearningSession { TenantId = tenant, LearnerId = child, SetId = Guid.NewGuid(), GameKey = "classic" };

        // ponytail: Inserts ueber das aktuelle EF-Modell, das heute genau dem
        // Initial-Schema entspricht (ReferentialIntegrity aendert keine Spalte).
        // Bekommt eine dieser Tabellen spaeter eine neue Spalte, scheitert der
        // Seed hier laut; dann auf Roh-SQL mit den Spalten aus Initial.cs umstellen.
        await using var db = _factory.CreateSystemDbContext();
        db.ReviewStates.AddRange(
            new ReviewState { TenantId = tenant, LearnerId = child, CardId = card, DueAt = now },
            new ReviewState { TenantId = tenant, LearnerId = child, CardId = Guid.NewGuid(), DueAt = now },
            new ReviewState { TenantId = tenant, LearnerId = Guid.NewGuid(), CardId = card, DueAt = now });
        db.LearningSessions.AddRange(session, orphanSession, setlessSession);
        db.SessionItems.AddRange(
            item,
            new SessionItem { TenantId = tenant, SessionId = session.Id, CardId = Guid.NewGuid(), Position = 1 });
        db.ReviewLogs.AddRange(
            log,
            new ReviewLog { TenantId = tenant, LearnerId = child, CardId = Guid.NewGuid(), GameKey = "classic" },
            new ReviewLog { TenantId = tenant, LearnerId = Guid.NewGuid(), CardId = card, GameKey = "classic" },
            new ReviewLog { TenantId = tenant, LearnerId = child, CardId = card, SessionId = Guid.NewGuid(), GameKey = "classic" });
        db.GamificationProfiles.Add(new GamificationProfile { Id = Guid.NewGuid(), TenantId = tenant });
        db.RefreshTokens.AddRange(
            token,
            new RefreshToken { TenantId = tenant, UserId = Guid.NewGuid(), TokenHash = new string('b', 64), ExpiresAt = now.AddDays(1) });
        await db.SaveChangesAsync();

        return new Valid(child, card, session.Id, log.Id, item.Id, token.Id);
    }

    [Fact]
    public async Task Altinstallation_mit_Waisen_startet_und_behaelt_gueltige_Zeilen()
    {
        Valid valid = await SeedLegacyDatabaseAsync();

        StartApi();

        // Je Tabelle bleibt die gueltige Zeile; der Log ohne Runde und die Runde
        // ohne Set bleiben mit geleertem Bezug.
        Assert.Equal(new Counts(
            States: 1, Logs: 2, LogsWithoutSession: 1, Sessions: 2, SessionsWithoutSet: 1,
            Items: 1, Games: 1, Tokens: 1), await CountsAsync());

        await using var db = _factory.CreateSystemDbContext();
        Assert.True(await db.ReviewStates.AnyAsync(r => r.LearnerId == valid.ChildId && r.CardId == valid.CardId));
        Assert.True(await db.LearningSessions.AnyAsync(s => s.Id == valid.SessionId && s.SetId != null));
        Assert.True(await db.ReviewLogs.AnyAsync(l => l.Id == valid.LogId && l.SessionId == valid.SessionId));
        Assert.True(await db.SessionItems.AnyAsync(i => i.Id == valid.ItemId));
        Assert.True(await db.RefreshTokens.AnyAsync(t => t.Id == valid.TokenId));
        Assert.True(await db.GamificationProfiles.AnyAsync(g => g.Id == valid.ChildId));

        int foreignKeys = await db.Database.SqlQuery<int>($"""
            SELECT count(*)::int AS "Value" FROM information_schema.table_constraints
            WHERE table_name = 'review_state' AND constraint_type = 'FOREIGN KEY'
            """).SingleAsync();
        Assert.Equal(2, foreignKeys);
    }

    [Fact]
    public async Task Wiederholte_Bereinigung_aendert_nichts_weder_vor_noch_nach_der_Migration()
    {
        await SeedLegacyDatabaseAsync();
        await using var db = _factory.CreateSystemDbContext();
        await OrphanCleanup.RunAsync(db);
        Counts cleaned = await CountsAsync();

        // Zweiter Lauf vor der Migration (Retry, Neustart nach Abbruch).
        await OrphanCleanup.RunAsync(db);
        Assert.Equal(cleaned, await CountsAsync());

        StartApi();
        Assert.Equal(cleaned, await CountsAsync());

        await OrphanCleanup.RunAsync(db);
        Assert.Equal(cleaned, await CountsAsync());
    }

    [Fact]
    public async Task Start_ohne_Datenbank_legt_sie_an_und_migriert()
    {
        StartApi();

        await using var db = _factory.CreateSystemDbContext();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Contains(Initial, await db.Database.GetAppliedMigrationsAsync());
    }
}
