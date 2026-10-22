using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using WordQuest.Infrastructure;

namespace WordQuest.Api.Tests;

/// <summary>
/// Erster Start wie im Compose-Stack: PostgreSQL hat die Datenbank angelegt,
/// sie ist aber leer. Dabei darf keine fail:-Zeile im Log stehen, weil sie fuer
/// Eltern wie ein Fehler aussieht, und keine warn:-Zeile von DataProtection,
/// das WordQuest nicht nutzt. Echte SQL-Fehler im Betrieb bleiben fail:.
/// Eigene Factory ohne InitializeAsync (Isolationsregel ApiFactory).
/// </summary>
public sealed class StartupLogTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new();
    private readonly CapturingLoggerProvider _logs = new();

    public async Task InitializeAsync()
    {
        await using WordQuestDbContext db = _factory.CreateSystemDbContext();
        // Nur die Datenbank, keine Tabellen, keine Migrationshistorie.
        await db.GetService<IRelationalDatabaseCreator>().CreateAsync();
        _factory.TestServices = services => services.AddSingleton<ILoggerProvider>(_logs);
    }

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    [Fact]
    public void Erster_Start_gegen_leere_Datenbank_loggt_keinen_Fehler()
    {
        _ = _factory.Services;

        Assert.Empty(_logs.Errors);
    }

    [Fact]
    public void Erster_Start_loggt_keine_Warnung_von_DataProtection()
    {
        _ = _factory.Services;

        Assert.DoesNotContain(_logs.Entries, entry =>
            entry.Category.StartsWith("Microsoft.AspNetCore.DataProtection", StringComparison.Ordinal));
        // Die Warnungen erscheinen nur im Container bzw. bei einem neuen Schluessel.
        // Der Dienst selbst darf deshalb auch ausserhalb davon nicht laufen; das
        // faellt zudem auf, wenn sich sein interner Typname aendert.
        Assert.DoesNotContain(_factory.Services.GetServices<IHostedService>(), service =>
            service.GetType().Namespace?.StartsWith("Microsoft.AspNetCore.DataProtection", StringComparison.Ordinal) == true);
    }

    [Fact]
    public async Task Fehlerhaftes_SQL_im_Betrieb_wird_weiter_als_Fehler_geloggt()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DbContextOptions<WordQuestDbContext> options =
            scope.ServiceProvider.GetRequiredService<DbContextOptions<WordQuestDbContext>>();
        await using var db = new WordQuestDbContext(options, new SystemTenantContext());

        await Assert.ThrowsAsync<PostgresException>(
            () => db.Database.ExecuteSqlRawAsync("SELECT * FROM gibt_es_nicht"));

        Assert.Contains(_logs.Errors, entry =>
            entry.Category == "Microsoft.EntityFrameworkCore.Database.Command"
            && entry.Message.Contains("gibt_es_nicht", StringComparison.Ordinal));
    }

    private sealed record LogEntry(LogLevel Level, string Category, string Message);

    /// <summary>Sammelt alle Eintraege ab Warning (in der Konsole: warn:, fail: und crit:).</summary>
    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        private readonly ConcurrentQueue<LogEntry> _entries = new();

        public IReadOnlyCollection<LogEntry> Entries => _entries;

        public IReadOnlyCollection<LogEntry> Errors => [.. _entries.Where(entry => entry.Level >= LogLevel.Error)];

        public ILogger CreateLogger(string categoryName) => new Logger(categoryName, _entries);

        public void Dispose()
        {
        }

        private sealed class Logger(string category, ConcurrentQueue<LogEntry> entries) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Warning;

            public void Log<TState>(
                LogLevel logLevel, EventId eventId, TState state, Exception? exception,
                Func<TState, Exception?, string> formatter)
            {
                if (IsEnabled(logLevel))
                {
                    entries.Enqueue(new LogEntry(logLevel, category, formatter(state, exception)));
                }
            }
        }
    }
}
