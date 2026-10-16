using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Infrastructure;

/// <summary>
/// Elternkonto der Instanz anlegen und zuruecksetzen. Aufgerufen aus der CLI
/// (setup.sh, reset-password) mit einem Kontext ohne Mandantenfilter; der
/// Service selbst umgeht den Filter nicht. E-Mail und Passwort werden nie
/// protokolliert.
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

        DateTimeOffset now = clock.GetUtcNow();
        List<RefreshToken> active = await db.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (RefreshToken token in active)
        {
            token.RevokedAt = now;
        }

        // Ein SaveChanges: Passwort und Widerruf gelten zusammen oder gar nicht.
        await db.SaveChangesAsync(ct);
        return password;
    }
}
