namespace WordQuest.Modules.Learning.Services;

/// <summary>
/// Ampelstufe eines Wortes ueber beide Abfragerichtungen (Konzept §9). Die Werte
/// stehen in der Reihenfolge, in der das Dashboard sortiert: Sorgenkinder zuerst.
/// </summary>
public enum TrafficLight
{
    /// <summary>Oft vergessen oder schwer: mindestens eine Richtung hakt deutlich.</summary>
    Red = 0,

    /// <summary>Begonnen, aber noch nicht in allen Richtungen sicher.</summary>
    Yellow = 1,

    /// <summary>Noch keine Richtung beantwortet.</summary>
    New = 2,

    /// <summary>Alle Richtungen sitzen sicher.</summary>
    Green = 3,
}
