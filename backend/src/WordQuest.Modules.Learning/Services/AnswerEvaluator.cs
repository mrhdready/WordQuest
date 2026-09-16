using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Services;

/// <summary>Was die Karte an Antworten akzeptiert.</summary>
public sealed record ExpectedAnswer(string Primary, IReadOnlyList<string> Alternatives)
{
    public static ExpectedAnswer Of(string primary, params string[] alternatives) =>
        new(primary, alternatives);
}

public sealed record AnswerEvaluation(
    bool IsCorrect,
    Grade Grade,
    bool HadTypo,
    string CorrectAnswer,
    string? Hint);

/// <summary>
/// Bewertet eine Antwort und leitet daraus die Lernstufe ab (Konzept §6.4).
///
/// Laeuft ausschliesslich serverseitig: Wenn der Client die Loesung kennt,
/// steht sie im Netzwerk-Tab — und bei einem Spiel mit Belohnungen finden
/// Kinder solche Luecken.
/// </summary>
public sealed class AnswerEvaluator(SchedulerOptions? options = null)
{
    private const int MinLengthForTypoTolerance = 5;

    private readonly SchedulerOptions _options = options ?? new SchedulerOptions();

    public AnswerEvaluation Evaluate(
        string? givenAnswer,
        ExpectedAnswer expected,
        int answerMs,
        bool hintUsed = false)
    {
        ArgumentNullException.ThrowIfNull(expected);

        string given = TextNormalizer.Normalize(givenAnswer);
        string givenStripped = TextNormalizer.StripOptionalLeadingWord(given);

        string[] candidates = BuildCandidates(expected);

        if (given.Length == 0)
        {
            return Wrong(expected);
        }

        // 1. Exakter Treffer (nach Normalisierung, mit und ohne Artikel).
        foreach (string candidate in candidates)
        {
            string stripped = TextNormalizer.StripOptionalLeadingWord(candidate);
            if (given == candidate || givenStripped == stripped)
            {
                return new AnswerEvaluation(
                    IsCorrect: true,
                    Grade: GradeFor(answerMs, hintUsed, hadTypo: false),
                    HadTypo: false,
                    CorrectAnswer: expected.Primary,
                    Hint: null);
            }
        }

        // 2. Ein Tippfehler bei ausreichend langen Woertern.
        //    Ein Kind, das "becuase" tippt, kennt die Vokabel — es tippt nur
        //    auf einem Tablet. Das als falsch zu werten verfaelscht zusaetzlich
        //    die Terminierung.
        foreach (string candidate in candidates)
        {
            if (candidate.Length < MinLengthForTypoTolerance)
            {
                continue;
            }

            if (Levenshtein.IsWithin(givenStripped, TextNormalizer.StripOptionalLeadingWord(candidate), 1))
            {
                return new AnswerEvaluation(
                    IsCorrect: true,
                    Grade: Grade.Hard,
                    HadTypo: true,
                    CorrectAnswer: expected.Primary,
                    Hint: $"Richtig — achte auf die Schreibweise: {expected.Primary}");
            }
        }

        return Wrong(expected);
    }

    private static AnswerEvaluation Wrong(ExpectedAnswer expected) =>
        new(IsCorrect: false,
            Grade: Grade.Again,
            HadTypo: false,
            CorrectAnswer: expected.Primary,
            // Nie "Falsch". Leitplanke 2 des Konzepts.
            Hint: "Fast! Das üben wir gleich nochmal.");

    private Grade GradeFor(int answerMs, bool hintUsed, bool hadTypo)
    {
        if (hintUsed || hadTypo)
        {
            return Grade.Hard;
        }

        if (answerMs <= 0)
        {
            // Keine verlaessliche Messung (Offline-Nachtrag, Uhrensprung).
            return Grade.Good;
        }

        return answerMs < _options.EasyThresholdMs ? Grade.Easy
            : answerMs <= _options.HardThresholdMs ? Grade.Good
            : Grade.Hard;
    }

    private static string[] BuildCandidates(ExpectedAnswer expected)
    {
        var result = new List<string>(1 + expected.Alternatives.Count);

        foreach (string variant in TextNormalizer.SplitVariants(expected.Primary))
        {
            string normalized = TextNormalizer.Normalize(variant);
            if (normalized.Length > 0)
            {
                result.Add(normalized);
            }
        }

        foreach (string alternative in expected.Alternatives)
        {
            foreach (string variant in TextNormalizer.SplitVariants(alternative))
            {
                string normalized = TextNormalizer.Normalize(variant);
                if (normalized.Length > 0 && !result.Contains(normalized))
                {
                    result.Add(normalized);
                }
            }
        }

        return [.. result];
    }
}
