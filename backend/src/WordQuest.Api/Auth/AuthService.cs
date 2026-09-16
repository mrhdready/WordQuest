using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WordQuest.Infrastructure;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Auth;

public sealed record AuthTokens(string AccessToken, string RefreshToken, int ExpiresInSeconds, User User);

public sealed class AuthFailedException(string message) : Exception(message);

/// <summary>
/// Anmeldung und Token-Rotation.
///
/// Alle Abfragen hier laufen mit <c>IgnoreQueryFilters()</c>: Beim Login ist
/// noch kein Mandant bekannt, der Mandantenfilter wuerde also jede Zeile
/// ausschliessen. Das ist die einzige Stelle im Request-Pfad, an der der
/// Filter umgangen wird — jede Abfrage hier gibt deshalb genau einen
/// Datensatz zurueck und wird nie fuer Listen benutzt.
/// </summary>
public sealed class AuthService(
    WordQuestDbContext db,
    JwtTokenService tokens,
    IOptions<AuthOptions> options,
    TimeProvider clock,
    ILogger<AuthService> logger)
{
    private readonly AuthOptions _options = options.Value;

    public async Task<AuthTokens> LoginAsync(string email, string password, CancellationToken ct)
    {
        string normalized = email.Trim().ToLowerInvariant();

        User? user = await db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == normalized, ct);

        // Auch ohne Treffer einen Hash pruefen, damit die Antwortzeit nicht
        // verraet, ob die Adresse existiert.
        bool ok = PasswordHasher.Verify(
            password,
            user?.PasswordHash ?? "v1.210000.AAAAAAAAAAAAAAAAAAAAAA==.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

        if (user is null || !ok || !user.IsActive || user.Role == UserRole.Learner)
        {
            logger.LogWarning("Fehlgeschlagener Login fuer {Email}.", normalized);
            throw new AuthFailedException("E-Mail-Adresse oder Passwort stimmt nicht.");
        }

        if (PasswordHasher.NeedsRehash(user.PasswordHash))
        {
            user.PasswordHash = PasswordHasher.Hash(password);
        }

        return await IssueAsync(user, ct);
    }

    public async Task<AuthTokens> LearnerLoginAsync(Guid learnerId, string pin, CancellationToken ct)
    {
        DateTimeOffset now = clock.GetUtcNow();

        LearnerProfile? profile = await db.LearnerProfiles
            .IgnoreQueryFilters()
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == learnerId, ct);

        if (profile?.User is null || !profile.User.IsActive)
        {
            throw new AuthFailedException("Dieses Profil gibt es nicht.");
        }

        if (profile.PinLockedUntil is { } until && until > now)
        {
            int minutes = (int)Math.Ceiling((until - now).TotalMinutes);
            throw new AuthFailedException($"Zu viele Versuche. Bitte in {minutes} Minuten nochmal probieren.");
        }

        if (!PasswordHasher.Verify(pin, profile.PinHash))
        {
            profile.FailedPinAttempts++;
            if (profile.FailedPinAttempts >= _options.MaxPinAttempts)
            {
                profile.PinLockedUntil = now.AddMinutes(_options.PinLockoutMinutes);
                profile.FailedPinAttempts = 0;
            }

            await db.SaveChangesAsync(ct);
            throw new AuthFailedException("Die PIN stimmt nicht.");
        }

        profile.FailedPinAttempts = 0;
        profile.PinLockedUntil = null;

        return await IssueAsync(profile.User, ct);
    }

    public async Task<AuthTokens> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        DateTimeOffset now = clock.GetUtcNow();
        string hash = TokenHasher.Hash(refreshToken);

        RefreshToken? stored = await db.RefreshTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (stored is null)
        {
            throw new AuthFailedException("Sitzung abgelaufen. Bitte neu anmelden.");
        }

        // Ein bereits rotiertes Token taucht erneut auf: entweder ein
        // verschlepptes Offline-Geraet oder ein gestohlenes Token. Beides
        // beantworten wir gleich — die ganze Kette dieses Nutzers verwerfen.
        if (stored.ReplacedByTokenHash is not null || stored.RevokedAt is not null)
        {
            logger.LogWarning("Wiederverwendetes Refresh-Token fuer Nutzer {UserId}.", stored.UserId);
            await RevokeAllAsync(stored.UserId, now, ct);
            throw new AuthFailedException("Sitzung abgelaufen. Bitte neu anmelden.");
        }

        if (!stored.IsActive(now))
        {
            throw new AuthFailedException("Sitzung abgelaufen. Bitte neu anmelden.");
        }

        User user = await db.Users
            .IgnoreQueryFilters()
            .FirstAsync(u => u.Id == stored.UserId, ct);

        if (!user.IsActive)
        {
            throw new AuthFailedException("Dieses Konto ist deaktiviert.");
        }

        AuthTokens issued = await IssueAsync(user, ct, rotating: stored);
        return issued;
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct)
    {
        string hash = TokenHasher.Hash(refreshToken);
        RefreshToken? stored = await db.RefreshTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (stored is not null)
        {
            stored.RevokedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(ct);
        }
    }

    private async Task<AuthTokens> IssueAsync(User user, CancellationToken ct, RefreshToken? rotating = null)
    {
        DateTimeOffset now = clock.GetUtcNow();

        string refresh = TokenHasher.NewToken();
        string refreshHash = TokenHasher.Hash(refresh);

        db.RefreshTokens.Add(new RefreshToken
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            TokenHash = refreshHash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenDays),
        });

        if (rotating is not null)
        {
            rotating.ReplacedByTokenHash = refreshHash;
            rotating.RevokedAt = now;
        }

        user.LastLoginAt = now;
        await db.SaveChangesAsync(ct);

        return new AuthTokens(
            tokens.CreateAccessToken(user),
            refresh,
            tokens.AccessTokenLifetimeSeconds,
            user);
    }

    private async Task RevokeAllAsync(Guid userId, DateTimeOffset now, CancellationToken ct)
    {
        await db.RefreshTokens
            .IgnoreQueryFilters()
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }
}
