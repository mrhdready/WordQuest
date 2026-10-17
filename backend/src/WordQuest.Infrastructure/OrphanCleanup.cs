using Microsoft.EntityFrameworkCore;

namespace WordQuest.Infrastructure;

/// <summary>
/// Raeumt verwaiste Lerndaten auf, bevor die Migration die Fremdschluessel
/// anlegt (D-06, D-18). Altinstallationen koennen Zeilen haben, die auf
/// geloeschte Karten, Kinder, Runden, Sets oder Konten zeigen; an ihnen wuerde
/// das Anlegen der Fremdschluessel scheitern und die API nicht starten. Die
/// Migrationsdatei bleibt so, wie dotnet ef sie erzeugt (AGENTS.md), deshalb
/// laeuft die Bereinigung beim Start direkt vor MigrateAsync.
/// </summary>
public static class OrphanCleanup
{
    // Nur Anti-Joins auf fehlende Bezugszeilen, konstant und ohne Eingabe von
    // aussen. Idempotent: Mit den Fremdschluesseln gibt es keine Waisen mehr,
    // dann aendert das SQL nichts. Reihenfolge: zuerst Runden ohne Kind, damit
    // deren Aufgaben per bestehender Kaskade mitgehen und Protokolle danach
    // ihren Rundenbezug verlieren.
    private const string Sql = """
        DELETE FROM learning_session s WHERE NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = s.learner_id);
        UPDATE learning_session s SET set_id = NULL
            WHERE s.set_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vocabulary_set v WHERE v.id = s.set_id);
        DELETE FROM session_item i WHERE NOT EXISTS (SELECT 1 FROM card c WHERE c.id = i.card_id);
        DELETE FROM review_state r WHERE NOT EXISTS (SELECT 1 FROM card c WHERE c.id = r.card_id)
            OR NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = r.learner_id);
        DELETE FROM review_log l WHERE NOT EXISTS (SELECT 1 FROM card c WHERE c.id = l.card_id)
            OR NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = l.learner_id);
        UPDATE review_log l SET session_id = NULL
            WHERE l.session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_session s WHERE s.id = l.session_id);
        DELETE FROM gamification_profile g WHERE NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = g.id);
        DELETE FROM refresh_token t WHERE NOT EXISTS (SELECT 1 FROM app_user u WHERE u.id = t.user_id);
        """;

    /// <summary>
    /// Fuehrt die Bereinigung aus. Ohne angewandte Migration (frische
    /// Installation, Datenbank fehlt noch) gibt es die Tabellen nicht, dann
    /// endet die Methode ohne Wirkung.
    /// </summary>
    public static async Task RunAsync(WordQuestDbContext db, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(db);

        if (!(await db.Database.GetAppliedMigrationsAsync(ct)).Any())
        {
            return;
        }

        await db.Database.ExecuteSqlRawAsync(Sql, ct);
    }
}
