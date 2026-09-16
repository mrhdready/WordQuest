using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Identity.Entities;

public enum UserRole
{
    /// <summary>Verwaltet die Instanz (Backup, Updates, Ersteinrichtung).</summary>
    Owner = 0,

    /// <summary>Elternteil bzw. Lehrkraft: Inhalte pflegen, Dashboard sehen.</summary>
    Guardian = 1,

    /// <summary>Kind bzw. Schueler: lernen und spielen.</summary>
    Learner = 2,
}

public sealed class User : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }

    public UserRole Role { get; set; }

    /// <summary>
    /// Anzeigename. Bei Kindern genuegt ein Spitzname — es gibt bewusst kein
    /// Pflichtfeld fuer Klarnamen, Geburtsdatum oder Klasse (Konzept §15).
    /// </summary>
    public required string DisplayName { get; set; }

    /// <summary>Nur fuer Owner und Guardian gesetzt.</summary>
    public string? Email { get; set; }

    /// <summary>Nur fuer Owner und Guardian gesetzt. Kinder melden sich per PIN an.</summary>
    public string? PasswordHash { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }

    public LearnerProfile? LearnerProfile { get; set; }
}
