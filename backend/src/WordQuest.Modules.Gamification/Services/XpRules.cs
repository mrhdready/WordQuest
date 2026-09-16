using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Gamification.Services;

/// <summary>
/// Belohnung fuer eine einzelne Antwort und fuer den Sessionabschluss
/// (Konzept §8).
/// </summary>
public static class XpRules
{
    public const int XpPerCorrectAnswer = 10;
    public const int XpEasyBonus = 5;
    public const int XpSessionCompleted = 25;
    public const int XpPerfectSessionBonus = 50;
    public const int XpDailyMission = 100;

    public const int CoinsPerCorrectAnswer = 1;
    public const int CoinsSessionCompleted = 20;

    /// <summary>
    /// Eine falsche Antwort kostet nichts. Kein Punktabzug, keine Leben,
    /// kein Streakverlust — Leitplanke 2 des Konzepts, hier algorithmisch
    /// verankert statt nur in der Formulierung der Fehlermeldung.
    /// </summary>
    public static (int Xp, int Coins) ForAnswer(Grade grade, double gameXpWeight)
    {
        if (grade == Grade.Again)
        {
            return (0, 0);
        }

        int baseXp = XpPerCorrectAnswer + (grade == Grade.Easy ? XpEasyBonus : 0);
        int xp = (int)Math.Round(baseXp * Math.Clamp(gameXpWeight, 0.0, 2.0), MidpointRounding.AwayFromZero);

        return (xp, CoinsPerCorrectAnswer);
    }

    public static (int Xp, int Coins) ForSessionCompletion(int answeredCount, int correctCount)
    {
        if (answeredCount <= 0)
        {
            return (0, 0);
        }

        int xp = XpSessionCompleted;
        if (correctCount == answeredCount)
        {
            xp += XpPerfectSessionBonus;
        }

        return (xp, CoinsSessionCompleted);
    }
}
