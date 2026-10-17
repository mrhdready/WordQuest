using WordQuest.Modules.Learning.Services;

namespace WordQuest.Infrastructure;

/// <summary>
/// Lernstand eines Wortes ueber beide Abfragerichtungen, wie Uebersicht und
/// Ampel ihn zeigen (FIX-06, D-16). <see cref="Lapses"/> und
/// <see cref="WorstEase"/> sind die schlechtesten Werte der Richtungen.
/// </summary>
public sealed record WordProgress(
    Guid EntryId,
    string SourceText,
    string TargetText,
    TrafficLight Light,
    bool Mastered,
    int Lapses,
    double WorstEase);
