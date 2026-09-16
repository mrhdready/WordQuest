using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Identity.Entities;

public enum GameSpeed
{
    /// <summary>Default. Zeitdruck erzeugt bei manchen Kindern Stress statt Spass (Konzept §7.2).</summary>
    Relaxed = 0,
    Normal = 1,
    Fast = 2,
}

/// <summary>
/// Lernprofil eines Kindes. 1:1 zu <see cref="User"/> mit Rolle
/// <see cref="UserRole.Learner"/>; die Id ist die UserId.
/// Fortschritts- und Belohnungsdaten liegen bewusst NICHT hier,
/// sondern im Gamification-Modul.
/// </summary>
public sealed class LearnerProfile : ITenantOwned
{
    /// <summary>Entspricht der <see cref="User.Id"/>.</summary>
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>Schluessel des Avatarbildes, z. B. "fox". Das Kind waehlt selbst.</summary>
    public string AvatarKey { get; set; } = "fox";

    /// <summary>Vierstellige PIN, gehasht. Schuetzt gegen Geschwister, nicht gegen Angreifer.</summary>
    public string? PinHash { get; set; }

    /// <summary>
    /// Maximal neue Karten pro Tag. Der wichtigste Parameter des Systems:
    /// zu hoch eingestellt erzeugt er in den Folgetagen eine
    /// Wiederholungslawine (Konzept §6.3).
    /// </summary>
    public int DailyNewLimit { get; set; } = 5;

    public GameSpeed Speed { get; set; } = GameSpeed.Relaxed;
    public bool SoundEnabled { get; set; } = true;

    /// <summary>Fehlversuche seit dem letzten Erfolg — Basis der PIN-Sperre.</summary>
    public int FailedPinAttempts { get; set; }
    public DateTimeOffset? PinLockedUntil { get; set; }

    public User? User { get; set; }
}
