using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Gamification.Entities;

/// <summary>
/// Belohnungsstand eines Kindes. Bewusst getrennt vom Identitaetsprofil:
/// Wer das Kind IST und was es GESAMMELT hat sind zwei Dinge, die sich
/// unterschiedlich schnell aendern und unterschiedlich schutzbeduerftig sind.
/// </summary>
public sealed class GamificationProfile : ITenantOwned
{
    /// <summary>Entspricht der LearnerId.</summary>
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public int Xp { get; set; }
    public int Coins { get; set; }

    /// <summary>Tage in Folge mit mindestens einer abgeschlossenen Session.</summary>
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }

    /// <summary>Letzter Tag (Ortszeit) mit abgeschlossener Session.</summary>
    public DateOnly? LastActiveDate { get; set; }

    /// <summary>
    /// Verbleibende Streak-Retter im laufenden Monat. Ein an Tag 40 gerissener
    /// Streak ist ein realer Abbruchgrund, und ein krankes oder verreistes Kind
    /// hat den Ausfall nicht verschuldet (Konzept §8). Nicht kaufbar.
    /// </summary>
    public int StreakSaversLeft { get; set; } = MonthlyStreakSavers;

    /// <summary>Monat, fuer den <see cref="StreakSaversLeft"/> gilt (Format yyyy-MM).</summary>
    public string? StreakSaverPeriod { get; set; }

    /// <summary>Gefestigte Karten seit der letzten vergebenen Sammelkarte.</summary>
    public int MasteredSinceLastCard { get; set; }

    public const int MonthlyStreakSavers = 2;

    public int Level => Services.LevelCurve.LevelFor(Xp);
}
