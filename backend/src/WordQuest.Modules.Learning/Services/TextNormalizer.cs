using System.Globalization;
using System.Text;

namespace WordQuest.Modules.Learning.Services;

/// <summary>
/// Vereinheitlicht Antworttexte vor dem Vergleich (Konzept §6.4).
/// </summary>
public static class TextNormalizer
{
    /// <summary>
    /// Partikel und Artikel, die vorne stehen duerfen, aber nicht muessen.
    /// "to go" und "go" sind dieselbe Antwort; "the house" und "house" auch.
    /// </summary>
    private static readonly string[] OptionalLeadingWords =
    [
        "to ", "a ", "an ", "the ",
        "der ", "die ", "das ", "den ", "dem ", "des ",
        "ein ", "eine ", "einen ", "einem ", "einer ", "eines ",
        "sich ", "zu ",
    ];

    /// <summary>
    /// Trimmen, Unicode-Normalform, Kleinschreibung, typografische Zeichen
    /// vereinheitlichen, Mehrfachleerzeichen zusammenziehen.
    /// </summary>
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        string text = input.Normalize(NormalizationForm.FormKC).Trim();

        var sb = new StringBuilder(text.Length);
        bool lastWasSpace = false;

        foreach (char raw in text)
        {
            char c = raw switch
            {
                '‘' or '’' or 'ʼ' or '´' or '`' => '\'',
                '“' or '”' => '"',
                '‐' or '‑' or '‒' or '–' or '—' => '-',
                _ => raw,
            };

            if (char.IsWhiteSpace(c))
            {
                if (!lastWasSpace && sb.Length > 0)
                {
                    sb.Append(' ');
                }

                lastWasSpace = true;
                continue;
            }

            lastWasSpace = false;
            sb.Append(char.ToLowerInvariant(c));
        }

        // Ein Schlusspunkt oder Ausrufezeichen ist keine inhaltliche Abweichung.
        while (sb.Length > 0 && (sb[^1] == '.' || sb[^1] == '!' || sb[^1] == ' '))
        {
            sb.Length--;
        }

        return sb.ToString();
    }

    /// <summary>
    /// Entfernt ein fuehrendes optionales Wort. Erwartet bereits
    /// normalisierten Text.
    /// </summary>
    public static string StripOptionalLeadingWord(string normalized)
    {
        foreach (string prefix in OptionalLeadingWords)
        {
            if (normalized.StartsWith(prefix, StringComparison.Ordinal)
                && normalized.Length > prefix.Length)
            {
                return normalized[prefix.Length..];
            }
        }

        return normalized;
    }

    /// <summary>
    /// Zerlegt eine Antwort mit mehreren zulaessigen Varianten,
    /// z. B. "gehen, laufen" oder "gehen / laufen".
    /// </summary>
    public static IEnumerable<string> SplitVariants(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            yield break;
        }

        foreach (string part in raw.Split([',', ';', '/', '|'], StringSplitOptions.RemoveEmptyEntries))
        {
            string trimmed = part.Trim();
            if (trimmed.Length > 0)
            {
                yield return trimmed;
            }
        }
    }

    /// <summary>Nur fuer Anzeigezwecke: erster Buchstabe gross.</summary>
    public static string ToDisplay(string value) =>
        value.Length == 0 ? value : char.ToUpper(value[0], CultureInfo.InvariantCulture) + value[1..];
}
