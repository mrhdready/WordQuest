using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Services;

public sealed record GameDefinition(
    string Key,
    string Title,
    double XpWeight,
    Grade? MaxGrade,
    bool AffectsScheduling);

/// <summary>
/// Serverseitige Eigenschaften der Spielmodule. Die Darstellung liegt im
/// Frontend; hier steht nur, was die Lernlogik ueber ein Spiel wissen muss.
/// </summary>
public static class GameCatalog
{
    public const string Classic = "classic";
    public const string WordCatcher = "wordcatcher";
    public const string Memory = "memory";

    /// <summary>Pauken vor der Klassenarbeit — beeinflusst die Terminierung nicht.</summary>
    public const string Cram = "cram";

    private static readonly Dictionary<string, GameDefinition> Games = new(StringComparer.OrdinalIgnoreCase)
    {
        [Classic] = new(Classic, "Karteikarte", 1.0, null, true),
        [WordCatcher] = new(WordCatcher, "Wort-Fänger", 1.0, null, true),

        // Memory trainiert primaer visuelles Gedaechtnis, nicht Vokabelabruf.
        // Deshalb halbes XP-Gewicht und hoechstens "Good": es ist ein
        // Belohnungsspiel, kein Pruefspiel (Konzept §7.2).
        [Memory] = new(Memory, "Memory", 0.5, Grade.Good, true),

        // Pauken vor der Arbeit darf die langfristige Terminierung nicht
        // zerstoeren - deshalb wird nur protokolliert, nicht neu terminiert.
        [Cram] = new(Cram, "Klassenarbeit-Modus", 0.5, Grade.Good, false),
    };

    public static GameDefinition Get(string? key) =>
        key is not null && Games.TryGetValue(key, out GameDefinition? game)
            ? game
            : Games[Classic];

    public static bool IsKnown(string? key) => key is not null && Games.ContainsKey(key);

    public static IReadOnlyCollection<GameDefinition> All => Games.Values;

    /// <summary>Deckelt die Bewertung auf das, was das Spiel aussagen kann.</summary>
    public static Grade Cap(string? key, Grade grade)
    {
        GameDefinition game = Get(key);
        return game.MaxGrade is { } max && grade > max ? max : grade;
    }
}
