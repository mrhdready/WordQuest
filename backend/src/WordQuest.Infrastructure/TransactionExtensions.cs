using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace WordQuest.Infrastructure;

/// <summary>
/// Transaktion in der Ausfuehrungsstrategie und Zeilensperre je Konto.
/// </summary>
public static class TransactionExtensions
{
    /// <summary>
    /// Fuehrt <paramref name="work"/> in einer Transaktion aus. Wegen
    /// EnableRetryOnFailure muss die Transaktion in der Ausfuehrungsstrategie
    /// laufen; SaveChanges darin mit acceptAllChangesOnSuccess: false, damit ein
    /// Wiederholungslauf dieselben Aenderungen noch einmal schreibt.
    /// </summary>
    public static async Task InTransactionAsync(this WordQuestDbContext db, Func<Task> work, CancellationToken ct)
    {
        IExecutionStrategy strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync(ct);
            await work();
            await transaction.CommitAsync(ct);
        });
        db.ChangeTracker.AcceptAllChanges();
    }

    /// <summary>
    /// Riegel je Konto fuer Refresh, Abmelden und Widerruf: sperrt die Zeile in
    /// app_user (bei Kindern dieselbe Id wie das Profil) bis zum Commit. Nur
    /// innerhalb von <see cref="InTransactionAsync"/> wirksam; ohne Transaktion
    /// endet die Sperre mit dem Statement. Jeder Pfad mit diesem Riegel sperrt
    /// zuerst app_user und schreibt erst danach (D-04).
    /// </summary>
    public static Task LockUserAsync(this WordQuestDbContext db, Guid userId, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"SELECT 1 FROM app_user WHERE id = {userId} FOR UPDATE", ct);
}
