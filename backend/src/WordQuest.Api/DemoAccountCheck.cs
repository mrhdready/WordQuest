using Microsoft.EntityFrameworkCore;
using WordQuest.Infrastructure;
using WordQuest.Infrastructure.Seed;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api;

/// <summary>
/// Startpruefung der Demo-Daten ausserhalb von Development (CR-01): Fruehere
/// Vorlagen hatten den Demo-Seed an, Altinstallationen haben deshalb ein
/// Elternkonto mit oeffentlich bekanntem Passwort. Abschalten des Seeds
/// entfernt es nicht.
/// </summary>
public static class DemoAccountCheck
{
    /// <summary>Fehlertext, wenn der Demo-Seed eingeschaltet ist, sonst null.</summary>
    public static string? SeedProblem(bool seedDemoData) =>
        seedDemoData
            ? "Start abgebrochen: WQ_SEED_DEMO_DATA ist eingeschaltet. Demo-Daten haben ein bekanntes Passwort und sind nur für die Entwicklung gedacht. "
                + "Setze WQ_SEED_DEMO_DATA=false in .env und starte WordQuest mit `docker compose up -d` neu."
            : null;

    /// <summary>
    /// Fehlertext, wenn das Demo-Elternkonto noch das bekannte Passwort hat, sonst null.
    /// Der Ausweg ist <c>docker compose run</c>, nicht <c>exec</c>: nach dem Abbruch
    /// laeuft kein api-Container, in dem man etwas ausfuehren koennte. Das CLI-Verb
    /// laeuft in Program.cs vor dieser Pruefung.
    /// </summary>
    public static async Task<string?> AccountProblemAsync(WordQuestDbContext db, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(db);

        // Alle Treffer: die Adresse ist nur je Mandant eindeutig.
        List<string?> hashes = await db.Users
            .Where(u => u.Email == DemoDataSeeder.DemoEmail && u.Role != UserRole.Learner)
            .Select(u => u.PasswordHash)
            .ToListAsync(ct);

        return hashes.Any(hash => PasswordHasher.Verify(DemoDataSeeder.DemoPassword, hash))
            ? $"Start abgebrochen: Das Demo-Elternkonto {DemoDataSeeder.DemoEmail} hat noch sein bekanntes Passwort. "
                + $"Setze es zurück mit `docker compose run --rm api reset-password {DemoDataSeeder.DemoEmail}` "
                + "und starte WordQuest danach mit `docker compose up -d`."
            : null;
    }
}
