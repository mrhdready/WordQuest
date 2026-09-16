using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Services;

/// <summary>
/// Eine Aufgabe, wie das Spiel sie bekommt. Enthaelt bewusst NICHT die
/// Loesung: Wer sie mitliefert, liefert sie in den Netzwerk-Tab
/// (Konzept ADR-006).
/// </summary>
public sealed record SessionItemView(
    Guid ItemId,
    Guid CardId,
    string Prompt,
    string PromptType,
    string ExpectedAnswerType,
    IReadOnlyList<string>? Choices,
    string? Emoji,
    string? ExampleSentence,
    bool IsRetry);

public sealed record SessionView(
    Guid SessionId,
    string GameKey,
    int TotalItems,
    IReadOnlyList<SessionItemView> Items);

public sealed record AnswerResult(
    bool Correct,
    Grade Grade,
    string CorrectAnswer,
    string? Message,
    bool HadTypo,
    int XpAwarded,
    int CoinsAwarded,
    // RetryItem ist gesetzt, wenn die Karte in dieser Session erneut drankommt.
    SessionItemView? RetryItem);

public sealed record SessionSummary(
    Guid SessionId,
    int Answered,
    int Correct,
    int XpAwarded,
    int CoinsAwarded,
    int TotalXp,
    int Level,
    double LevelProgress,
    int XpToNextLevel,
    int Coins,
    int Streak,
    bool StreakSaverUsed,
    bool LeveledUp);
