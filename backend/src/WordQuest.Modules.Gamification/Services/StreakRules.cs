using WordQuest.Modules.Gamification.Entities;

namespace WordQuest.Modules.Gamification.Services;

public sealed record StreakResult(int Streak, bool Increased, bool SaverUsed, bool Reset);

/// <summary>
/// Tagesserie (Konzept §8). Ein Tag zaehlt, sobald mindestens eine Session
/// abgeschlossen wurde.
/// </summary>
public static class StreakRules
{
    /// <summary>
    /// Traegt einen aktiven Tag ein. <paramref name="today"/> ist das Datum in
    /// Ortszeit, nicht UTC — sonst reisst die Serie bei jemandem, der abends
    /// um 23 Uhr lernt.
    /// </summary>
    public static StreakResult RegisterActivity(GamificationProfile profile, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(profile);

        RefillSaversIfNewMonth(profile, today);

        DateOnly? last = profile.LastActiveDate;

        if (last == today)
        {
            return new StreakResult(profile.CurrentStreak, false, false, false);
        }

        bool saverUsed = false;
        bool reset = false;

        if (last is null)
        {
            profile.CurrentStreak = 1;
        }
        else
        {
            int gap = today.DayNumber - last.Value.DayNumber;

            if (gap <= 0)
            {
                // Datum lief rueckwaerts (Zeitumstellung, Offline-Nachtrag).
                // Kein Grund, die Serie anzutasten.
                return new StreakResult(profile.CurrentStreak, false, false, false);
            }

            if (gap == 1)
            {
                profile.CurrentStreak++;
            }
            else if (gap == 2 && profile.StreakSaversLeft > 0)
            {
                // Genau ein verpasster Tag wird automatisch ueberbrueckt —
                // ohne Rueckfrage und ohne Kaufmoeglichkeit.
                profile.StreakSaversLeft--;
                profile.CurrentStreak += 2;
                saverUsed = true;
            }
            else
            {
                profile.CurrentStreak = 1;
                reset = true;
            }
        }

        profile.LastActiveDate = today;
        profile.LongestStreak = Math.Max(profile.LongestStreak, profile.CurrentStreak);

        return new StreakResult(profile.CurrentStreak, true, saverUsed, reset);
    }

    private static void RefillSaversIfNewMonth(GamificationProfile profile, DateOnly today)
    {
        string period = $"{today.Year:D4}-{today.Month:D2}";
        if (profile.StreakSaverPeriod != period)
        {
            profile.StreakSaverPeriod = period;
            profile.StreakSaversLeft = GamificationProfile.MonthlyStreakSavers;
        }
    }
}
