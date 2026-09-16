namespace WordQuest.Api.Contracts;

// --- Auth -------------------------------------------------------------------

public sealed record LoginRequest(string Email, string Password);

public sealed record LearnerLoginRequest(Guid LearnerId, string Pin);

public sealed record RefreshRequest(string RefreshToken);

public sealed record AuthUserDto(Guid Id, string DisplayName, string Role, Guid TenantId);

public sealed record AuthResponse(
    string AccessToken,
    string RefreshToken,
    int ExpiresInSeconds,
    AuthUserDto User);

/// <summary>Was der Profil-Waehler vor der Anmeldung zeigt. Bewusst ohne alles Weitere.</summary>
public sealed record LearnerTileDto(Guid Id, string DisplayName, string AvatarKey);

// --- Lernende ---------------------------------------------------------------

public sealed record LearnerDto(
    Guid Id,
    string DisplayName,
    string AvatarKey,
    int DailyNewLimit,
    string Speed,
    bool SoundEnabled,
    bool HasPin);

public sealed record CreateLearnerRequest(string DisplayName, string? AvatarKey, string? Pin);

public sealed record UpdateLearnerSettingsRequest(
    int? DailyNewLimit,
    string? Speed,
    bool? SoundEnabled,
    string? Pin);

// --- Inhalte ----------------------------------------------------------------

public sealed record VocabularySetDto(
    Guid Id,
    string Title,
    string? Description,
    string SourceLanguage,
    string TargetLanguage,
    int EntryCount);

public sealed record CreateSetRequest(
    string Title,
    string? Description,
    string? SourceLanguage,
    string? TargetLanguage);

public sealed record VocabularyEntryDto(
    Guid Id,
    string SourceText,
    string TargetText,
    string[] TargetAlternatives,
    string[] SourceAlternatives,
    string PartOfSpeech,
    string? Emoji,
    string? ExampleSource,
    string? ExampleTarget,
    int Position);

public sealed record CreateEntryRequest(
    string SourceText,
    string TargetText,
    string[]? TargetAlternatives,
    string[]? SourceAlternatives,
    string? PartOfSpeech,
    string? Emoji,
    string? ExampleSource,
    string? ExampleTarget);

public sealed record ImportRowDto(int LineNumber, string Source, string Target, string? Emoji, string? Problem);

public sealed record ImportPreviewRequest(string Content);

public sealed record ImportPreviewResponse(
    string Delimiter,
    bool HadHeader,
    int ValidCount,
    int ProblemCount,
    IReadOnlyList<ImportRowDto> Rows);

public sealed record ImportConfirmRequest(IReadOnlyList<CreateEntryRequest> Entries);

// --- Lernen -----------------------------------------------------------------

public sealed record StartSessionRequest(Guid LearnerId, Guid? SetId, string? GameKey, int? Size);

public sealed record SubmitAnswerRequest(
    Guid ItemId,
    string? GivenAnswer,
    int AnswerMs,
    Guid? ClientAnswerId,
    bool HintUsed);

/// <summary>Batch-Upload offline erfasster Antworten (Konzept §13).</summary>
public sealed record SyncRequest(Guid SessionId, IReadOnlyList<SubmitAnswerRequest> Answers);

// --- Auswertung -------------------------------------------------------------

public sealed record LearnerOverviewDto(
    Guid LearnerId,
    string DisplayName,
    int Xp,
    int Level,
    double LevelProgress,
    int XpToNextLevel,
    int Coins,
    int Streak,
    int DueToday,
    int NewRemainingToday,
    int CardsMastered,
    int CardsTotal);

public sealed record TrafficLightDto(
    Guid EntryId,
    string SourceText,
    string TargetText,
    string Status,
    int Lapses,
    double WorstEase);
