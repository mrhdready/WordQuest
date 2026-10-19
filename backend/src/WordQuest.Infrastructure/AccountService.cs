using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Infrastructure;

/// <summary>
/// Elternkonto der Instanz anlegen, zuruecksetzen und das Passwort aendern.
/// Anlegen und Zuruecksetzen ruft die CLI (setup.sh, reset-password) mit einem
/// Kontext ohne Mandantenfilter auf, das Aendern die API mit dem normalen,
/// mandantengefilterten Kontext; der Service selbst umgeht den Filter nicht.
/// E-Mail und Passwort werden nie protokolliert.
/// </summary>
public sealed class AccountService(WordQuestDbContext db, TimeProvider clock)
{
    // Ohne verwechselbare Zeichen (0/O, 1/l/I): das Passwort wird vom Terminal abgetippt.
    private const string ResetAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private const int ResetPasswordLength = 16;

    /// <summary>True, wenn es schon ein Elternkonto (Rolle Owner) gibt.</summary>
    public Task<bool> HasOwnerAsync(CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Role == UserRole.Owner, ct);

    /// <summary>
    /// Legt die Familie und ihr Elternkonto an. Das Passwort wird genau so
    /// gehasht, wie es eingegeben wurde (kein Trimmen).
    /// </summary>
    public async Task<OwnerCreation> CreateOwnerAsync(
        string email, string password, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentNullException.ThrowIfNull(password);

        if (await HasOwnerAsync(ct))
        {
            return OwnerCreation.AlreadyExists;
        }

        if (!AccountRules.IsValidEmail(email))
        {
            return OwnerCreation.InvalidEmail;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return OwnerCreation.PasswordBlank;
        }

        if (!AccountRules.IsValidPassword(password))
        {
            return OwnerCreation.PasswordTooShort;
        }

        var tenant = new Tenant { Name = "Familie", Type = TenantType.Family };
        var owner = new User
        {
            TenantId = tenant.Id,
            Role = UserRole.Owner,
            DisplayName = "Eltern",
            Email = AccountRules.NormalizeEmail(email),
            PasswordHash = PasswordHasher.Hash(password),
        };

        db.Tenants.Add(tenant);
        db.Users.Add(owner);
        await db.SaveChangesAsync(ct);
        return OwnerCreation.Created;
    }

    /// <summary>
    /// Setzt das Passwort eines Elternkontos (Owner oder Guardian) auf ein
    /// neu erzeugtes Zufallspasswort und widerruft alle Refresh-Tokens des
    /// Kontos. Liefert das neue Passwort oder null, wenn es kein Elternkonto
    /// mit dieser Adresse gibt. Bereits ausgegebene Access-Tokens laufen
    /// regulaer ab (Auth:AccessTokenMinutes); eine sofortige Sperre braeuchte
    /// eine DB-Pruefung je Anfrage.
    /// </summary>
    public async Task<string?> ResetPasswordAsync(string email, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(email);

        string normalized = AccountRules.NormalizeEmail(email);
        User? user = await db.Users.FirstOrDefaultAsync(
            u => u.Email != null && u.Email.ToLower() == normalized
                && (u.Role == UserRole.Owner || u.Role == UserRole.Guardian),
            ct);
        if (user is null)
        {
            return null;
        }

        string password = RandomNumberGenerator.GetString(ResetAlphabet, ResetPasswordLength);
        user.PasswordHash = PasswordHasher.Hash(password);
        await SaveAndRevokeRefreshTokensAsync(user.Id, ct);
        return password;
    }

    /// <summary>
    /// Speichert die vom Aufrufer gesetzten Zugangsdaten (Passwort oder
    /// Kinder-PIN) und widerruft alle aktiven Refresh-Tokens des Kontos in einer
    /// Transaktion unter der Kontosperre: Beides gilt zusammen oder gar nicht.
    /// Ein laufender Refresh schreibt seinen Nachfolger entweder vorher fest,
    /// dann wird er hier widerrufen, oder er sieht danach den widerrufenen Token
    /// (Codex-Befund 1, D-04).
    /// </summary>
    public async Task SaveAndRevokeRefreshTokensAsync(Guid userId, CancellationToken ct = default)
    {
        DateTimeOffset now = clock.GetUtcNow();
        await db.InTransactionAsync(async () =>
        {
            await db.LockUserAsync(userId, ct);
            await db.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
            await db.SaveChangesAsync(acceptAllChangesOnSuccess: false, ct);
        }, ct);
    }

    /// <summary>
    /// Aendert das Passwort des angemeldeten Elternkontos. Die Id kommt nur aus
    /// dem Token. Das neue Passwort wird genau so gehasht, wie es eingegeben
    /// wurde (kein Trimmen). Andere Sitzungen bleiben bestehen (UI-SPEC
    /// "Anmeldung bleibt bestehen").
    /// </summary>
    public async Task<PasswordChange> ChangePasswordAsync(
        Guid userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(currentPassword);
        ArgumentNullException.ThrowIfNull(newPassword);

        User? user = await db.Users.FirstOrDefaultAsync(
            u => u.Id == userId && (u.Role == UserRole.Owner || u.Role == UserRole.Guardian),
            ct);
        if (user is null)
        {
            return PasswordChange.UnknownUser;
        }

        // Vorbedingung von PasswordHasher.Hash; sonst endete die Eingabe in einer Ausnahme (500).
        if (string.IsNullOrWhiteSpace(newPassword))
        {
            return PasswordChange.NewPasswordBlank;
        }

        if (!AccountRules.IsValidPassword(newPassword))
        {
            return PasswordChange.NewPasswordTooShort;
        }

        if (!PasswordHasher.Verify(currentPassword, user.PasswordHash))
        {
            return PasswordChange.WrongCurrentPassword;
        }

        user.PasswordHash = PasswordHasher.Hash(newPassword);
        await db.SaveChangesAsync(ct);
        return PasswordChange.Changed;
    }
}
