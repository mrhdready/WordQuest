using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WordQuest.Infrastructure;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Auth;

public sealed record AuthTokens(string AccessToken, string RefreshToken, int ExpiresInSeconds, User User);

public sealed class AuthFailedException(string message) : Exception(message);

public sealed class RefreshConflictException(string message) : Exception(message);

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
    // Zwei Fenster teilen den Speicher und erneuern gleichzeitig mit demselben
    // Token. Der unmittelbare Vorgaenger ergibt bis 10 Sekunden nach seiner
    // Rotation 409 ohne neue Tokens, solange sein Nachfolger aktiv ist, statt
    // als Diebstahl alle Sitzungen zu widerrufen (D-06, akzeptiert per D-17).
    // Restrisiko im Konzept (Sicherheitstabelle, Token).
    private static readonly TimeSpan RotationGrace = TimeSpan.FromSeconds(10);

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
            logger.LogWarning("Fehlgeschlagener Login fuer ein Elternkonto.");
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
            // Ein Statement statt Lesen-Erhoehen-Schreiben: Das verlor parallele
            // Fehlversuche (Codex-Befund 9, D-11). Beide Ausdruecke sehen dieselbe
            // Ausgangszeile, die Datenbank serialisiert die Erhoehungen (Muster
            // CreditAsync). Ohne IgnoreQueryFilters traefe der Mandantenfilter
            // bei der Anmeldung keine Zeile.
            int max = _options.MaxPinAttempts;
            DateTimeOffset? lockUntil = now.AddMinutes(_options.PinLockoutMinutes);
            await db.LearnerProfiles
                .IgnoreQueryFilters()
                .Where(p => p.Id == learnerId)
                .ExecuteUpdateAsync(u => u
                    .SetProperty(p => p.FailedPinAttempts, p => p.FailedPinAttempts + 1 >= max ? 0 : p.FailedPinAttempts + 1)
                    .SetProperty(p => p.PinLockedUntil, p => p.FailedPinAttempts + 1 >= max ? lockUntil : p.PinLockedUntil), ct);
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

        // Vor der Sperre nur Konto und Mandant ermitteln; entschieden wird erst
        // unter der Sperre mit frisch gelesenem Stand.
        RefreshToken? found = await db.RefreshTokens
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (found is null)
        {
            throw new AuthFailedException("Sitzung abgelaufen. Bitte neu anmelden.");
        }

        // Die Ausfuehrungsstrategie kann den Callback nach einem transienten
        // Fehler wiederholen. Deshalb entsteht der Nachfolger genau einmal hier
        // und nicht im Callback; sonst stuenden nach einer Wiederholung zwei
        // Nachfolger im Change Tracker.
        string next = TokenHasher.NewToken();
        string nextHash = TokenHasher.Hash(next);
        var successor = new RefreshToken
        {
            TenantId = found.TenantId,
            UserId = found.UserId,
            TokenHash = nextHash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenDays),
        };

        RefreshOutcome outcome = RefreshOutcome.Expired;
        User? user = null;

        // Refresh, Abmelden und Widerruf laufen je Konto unter derselben Sperre:
        // Ein Widerruf (neue PIN, Passwort-Reset) sieht den Nachfolger oder der
        // Refresh sieht den widerrufenen Token, nie ein Dazwischen (D-04).
        await db.InTransactionAsync(async () =>
        {
            outcome = RefreshOutcome.Expired;
            user = null;
            db.Entry(successor).State = EntityState.Detached;

            await db.LockUserAsync(found.UserId, ct);
            RefreshToken? stored = await db.RefreshTokens
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == found.Id, ct);

            if (stored is null)
            {
                return;
            }

            if (stored.ReplacedByTokenHash is { } replacedBy
                && stored.RevokedAt > now - RotationGrace
                && await db.RefreshTokens
                    .IgnoreQueryFilters()
                    .AnyAsync(t => t.TokenHash == replacedBy && t.RevokedAt == null && t.ExpiresAt > now, ct))
            {
                logger.LogInformation("Refresh mit eben rotiertem Token fuer Nutzer {UserId}: 409.", stored.UserId);
                outcome = RefreshOutcome.Conflict;
                return;
            }

            // Ein bereits rotiertes Token taucht erneut auf: entweder ein
            // verschlepptes Offline-Geraet oder ein gestohlenes Token. Beides
            // beantworten wir gleich — die ganze Kette dieses Nutzers verwerfen.
            if (stored.ReplacedByTokenHash is not null || stored.RevokedAt is not null)
            {
                logger.LogWarning("Wiederverwendetes Refresh-Token fuer Nutzer {UserId}.", stored.UserId);
                await RevokeAllAsync(stored.UserId, now, ct);
                return;
            }

            if (!stored.IsActive(now))
            {
                return;
            }

            User account = await db.Users
                .IgnoreQueryFilters()
                .FirstAsync(u => u.Id == stored.UserId, ct);

            if (!account.IsActive)
            {
                outcome = RefreshOutcome.Inactive;
                return;
            }

            // Den alten Token bedingt beanspruchen; die Sperre ordnet schon,
            // die Bedingung bleibt als zweite Sicherung (D-04).
            int claimed = await db.RefreshTokens
                .IgnoreQueryFilters()
                .Where(t => t.Id == stored.Id && t.RevokedAt == null)
                .ExecuteUpdateAsync(u => u
                    .SetProperty(t => t.RevokedAt, now)
                    .SetProperty(t => t.ReplacedByTokenHash, nextHash), ct);
            if (claimed != 1)
            {
                return;
            }

            db.RefreshTokens.Add(successor);
            account.LastLoginAt = now;
            await db.SaveChangesAsync(acceptAllChangesOnSuccess: false, ct);
            user = account;
            outcome = RefreshOutcome.Issued;
        }, ct);

        // Ausnahmen erst nach dem Commit, damit ein Widerruf festgeschrieben ist.
        return outcome switch
        {
            RefreshOutcome.Issued => new AuthTokens(
                tokens.CreateAccessToken(user!),
                next,
                tokens.AccessTokenLifetimeSeconds,
                user!),
            RefreshOutcome.Inactive => throw new AuthFailedException("Dieses Konto ist deaktiviert."),
            RefreshOutcome.Conflict => throw new RefreshConflictException("Die Anmeldung wurde gerade in einem anderen Fenster erneuert."),
            _ => throw new AuthFailedException("Sitzung abgelaufen. Bitte neu anmelden."),
        };
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct)
    {
        DateTimeOffset now = clock.GetUtcNow();
        string hash = TokenHasher.Hash(refreshToken);
        Guid? userId = await db.RefreshTokens
            .IgnoreQueryFilters()
            .Where(t => t.TokenHash == hash)
            .Select(t => (Guid?)t.UserId)
            .FirstOrDefaultAsync(ct);

        if (userId is null)
        {
            return;
        }

        // Abmelden beendet die ganze Kette ab dem vorgelegten Token, auch
        // Nachfolger, die der Server schon ausgestellt oder weitergedreht hat
        // (D-05; Codex-Review 2026-10-23). Erst unter der Sperre ist der Stand
        // verlaesslich; deshalb hier lesen. Eine Abfrage fuer alle Tokens des
        // Kontos statt einer je Glied, weil alte Tokens nicht geloescht werden.
        await db.InTransactionAsync(async () =>
        {
            await db.LockUserAsync(userId.Value, ct);
            Dictionary<string, string?> successors = await db.RefreshTokens
                .IgnoreQueryFilters()
                .Where(t => t.UserId == userId.Value)
                .Select(t => new { t.TokenHash, t.ReplacedByTokenHash })
                .ToDictionaryAsync(t => t.TokenHash, t => t.ReplacedByTokenHash, ct);
            List<string> hashes = [];
            for (string? current = hash; current is not null && successors.TryGetValue(current, out string? next); current = next)
            {
                hashes.Add(current);
            }

            await db.RefreshTokens
                .IgnoreQueryFilters()
                .Where(t => hashes.Contains(t.TokenHash) && t.RevokedAt == null)
                .ExecuteUpdateAsync(u => u.SetProperty(t => t.RevokedAt, now), ct);
        }, ct);
    }

    private async Task<AuthTokens> IssueAsync(User user, CancellationToken ct)
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

    private enum RefreshOutcome
    {
        /// <summary>Unbekannt, abgelaufen, widerrufen oder nicht beansprucht: 401.</summary>
        Expired = 0,

        /// <summary>Konto deaktiviert: 401.</summary>
        Inactive = 1,

        /// <summary>Nachfolger ausgestellt.</summary>
        Issued = 2,

        /// <summary>Eben rotierter Vorgaenger mit aktivem Nachfolger: 409 ohne Tokens.</summary>
        Conflict = 3,
    }
}
