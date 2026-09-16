using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WordQuest.Infrastructure;

/// <summary>
/// Wird nur von den EF-Core-Werkzeugen benutzt
/// (<c>dotnet ef migrations add …</c>). Die Verbindungszeichenfolge kommt aus
/// der Umgebungsvariablen <c>WQ_DESIGN_CONNECTION</c>; ohne sie wird der
/// Entwicklungs-Stack aus docker-compose.dev.yml angenommen.
/// Zur Laufzeit spielt diese Klasse keine Rolle.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<WordQuestDbContext>
{
    public WordQuestDbContext CreateDbContext(string[] args)
    {
        string connection =
            Environment.GetEnvironmentVariable("WQ_DESIGN_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=wordquest;Username=wordquest;Password=devpassword";

        DbContextOptions<WordQuestDbContext> options =
            new DbContextOptionsBuilder<WordQuestDbContext>()
                .UseNpgsql(connection)
                .Options;

        return new WordQuestDbContext(options, new SystemTenantContext());
    }
}
