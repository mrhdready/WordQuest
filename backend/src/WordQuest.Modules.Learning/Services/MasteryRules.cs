using WordQuest.Modules.Learning.Entities;

namespace WordQuest.Modules.Learning.Services;

/// <summary>
/// Wann eine Karte und wann ein Wort sicher sitzt und welche Ampelstufe ein Wort
/// hat (Konzept §9). Die eine Stelle fuer Uebersicht und Ampel, damit beide
/// dieselben Woerter zaehlen (D-05, D-16).
/// </summary>
public static class MasteryRules
{
    /// <summary>
    /// Mindestens drei richtige Antworten in Folge; verhindert, dass eine neue
    /// Karte mit dem Start-Ease 2,5 als gemeistert zaehlt.
    /// </summary>
    public const int MinRepetitions = 3;

    public const double MinEaseFactor = 2.1;

    public const int MaxLapses = 1;

    /// <summary>Ab so vielen Fehlern in einer Richtung steht ein Wort auf Rot.</summary>
    public const int RedLapses = 3;

    /// <summary>Unter diesem Ease-Faktor in einer Richtung steht ein Wort auf Rot.</summary>
    public const double RedEaseFactor = 1.8;

    /// <summary>Eine Karte (eine Richtung) ist gemeistert; ohne Lernstand nie.</summary>
    public static bool IsMastered(ReviewState? state) =>
        state is not null
        && state.Repetitions >= MinRepetitions
        && state.EaseFactor >= MinEaseFactor
        && state.Lapses <= MaxLapses;

    /// <summary>Ein Wort ist gemeistert, wenn alle seine Richtungen es sind; ohne Karten nie.</summary>
    public static bool IsWordMastered(IEnumerable<ReviewState?> directions)
    {
        ArgumentNullException.ThrowIfNull(directions);

        List<ReviewState?> states = directions.ToList();
        return states.Count > 0 && states.All(IsMastered);
    }

    /// <summary>
    /// Ampelstufe eines Wortes: ohne Lernstand neu, bei vielen Fehlern oder
    /// niedrigem Ease rot, gruen erst, wenn BEIDE Richtungen sitzen, sonst gelb.
    /// Richtungen ohne Lernstand zaehlen fuer Rot nicht mit.
    /// </summary>
    public static TrafficLight Light(IEnumerable<ReviewState?> directions)
    {
        ArgumentNullException.ThrowIfNull(directions);

        List<ReviewState?> states = directions.ToList();
        List<ReviewState> seen = states.OfType<ReviewState>().ToList();
        if (seen.Count == 0)
        {
            return TrafficLight.New;
        }

        if (seen.Max(s => s.Lapses) >= RedLapses || seen.Min(s => s.EaseFactor) < RedEaseFactor)
        {
            return TrafficLight.Red;
        }

        return IsWordMastered(states) ? TrafficLight.Green : TrafficLight.Yellow;
    }
}
