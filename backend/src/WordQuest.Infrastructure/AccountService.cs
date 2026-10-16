using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Infrastructure;

/// <summary>
/// Elternkonto der Instanz anlegen. Aufgerufen aus der CLI (setup.sh) mit
/// einem Kontext ohne Mandantenfilter; der Service selbst umgeht den Filter
/// nicht. E-Mail und Passwort werden nie protokolliert.
/// </summary>
public sealed class AccountService(WordQuestDbContext db)
{
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
}
