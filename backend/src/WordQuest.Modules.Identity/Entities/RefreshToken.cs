using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Identity.Entities;

/// <summary>
/// Rotierendes Refresh-Token. Gespeichert wird nur der Hash — wer die
/// Datenbank liest, kann damit keine Sitzung uebernehmen.
/// </summary>
public sealed class RefreshToken : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>SHA-256 des Tokens, Base64.</summary>
    public required string TokenHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>
    /// Gesetzt, wenn dieses Token regulaer rotiert wurde. Taucht ein bereits
    /// rotiertes Token erneut auf, ist das ein Diebstahlindiz — dann wird die
    /// gesamte Token-Kette des Nutzers verworfen.
    /// </summary>
    public string? ReplacedByTokenHash { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
