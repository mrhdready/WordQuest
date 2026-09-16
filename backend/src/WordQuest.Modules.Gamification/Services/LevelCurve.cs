namespace WordQuest.Modules.Gamification.Services;

/// <summary>
/// Levelkurve (Konzept §8): kumulative Schwelle <c>XP(n) = 70 · n²</c>.
///
/// Level 2 faellt bewusst noch in den ersten Abend — der erste Levelaufstieg
/// muss passieren, bevor das Kind entscheidet, ob es die App nochmal oeffnet.
/// Level 100 ist ebenso bewusst unerreichbar: ein erreichtes Maximum beendet
/// die Motivation.
/// </summary>
public static class LevelCurve
{
    public const int MaxLevel = 100;
    private const int Coefficient = 70;

    /// <summary>Kumulative XP, ab der <paramref name="level"/> erreicht ist.</summary>
    public static int XpRequiredFor(int level)
    {
        if (level <= 1)
        {
            return 0;
        }

        int capped = Math.Min(level, MaxLevel);
        return Coefficient * capped * capped;
    }

    public static int LevelFor(int totalXp)
    {
        if (totalXp < XpRequiredFor(2))
        {
            return 1;
        }

        int level = (int)Math.Floor(Math.Sqrt(totalXp / (double)Coefficient));
        return Math.Clamp(level, 1, MaxLevel);
    }

    /// <summary>Fortschritt im aktuellen Level, 0.0 bis 1.0.</summary>
    public static double ProgressInLevel(int totalXp)
    {
        int level = LevelFor(totalXp);
        if (level >= MaxLevel)
        {
            return 1.0;
        }

        int floor = XpRequiredFor(level);
        int ceiling = XpRequiredFor(level + 1);
        if (ceiling <= floor)
        {
            return 1.0;
        }

        return Math.Clamp((totalXp - floor) / (double)(ceiling - floor), 0.0, 1.0);
    }

    public static int XpToNextLevel(int totalXp)
    {
        int level = LevelFor(totalXp);
        return level >= MaxLevel ? 0 : Math.Max(0, XpRequiredFor(level + 1) - totalXp);
    }
}
