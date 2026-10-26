using System.Text;

namespace WordQuest.Modules.Content.Services;

public sealed record ParsedRow(int LineNumber, string Source, string Target, string? Emoji, string? Problem)
{
    public bool IsValid => Problem is null;
}

public sealed record CsvParseResult(
    char Delimiter,
    bool HadHeader,
    IReadOnlyList<ParsedRow> Rows)
{
    public int ValidCount => Rows.Count(r => r.IsValid);
    public int ProblemCount => Rows.Count - ValidCount;
}

/// <summary>
/// CSV-Import fuer Vokabellisten. Bewusst eigenhaendig statt per Bibliothek:
/// die erwarteten Dateien sind zwei- bis dreispaltig, und ein Import, dessen
/// Regeln man vollstaendig lesen kann, ist hier mehr wert als ein
/// vollstaendiger RFC-4180-Parser.
///
/// Erwartet werden Spalten in der Reihenfolge: Quelle; Ziel; [Emoji].
/// Trennzeichen wird erkannt (Semikolon, Komma, Tabulator).
/// </summary>
public static class CsvVocabularyParser
{
    private static readonly char[] Candidates = [';', ',', '\t'];

    // Kopfwoerter nach Bedeutung: Quelle, Ziel, Emoji.
    private static readonly string[][] HeaderGroups =
    [
        ["deutsch", "german", "quelle", "source"],
        ["englisch", "english", "ziel", "target"],
        ["emoji", "bild"],
    ];

    public static CsvParseResult Parse(string content)
    {
        ArgumentNullException.ThrowIfNull(content);

        // BOM entfernen — Excel schreibt ihn beim Export als "CSV UTF-8".
        content = content.TrimStart('﻿');

        string[] lines = content.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0)
        {
            return new CsvParseResult(';', false, []);
        }

        char delimiter = DetectDelimiter(lines);
        bool hasHeader = LooksLikeHeader(lines[0], delimiter);

        var rows = new List<ParsedRow>(lines.Length);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (int i = hasHeader ? 1 : 0; i < lines.Length; i++)
        {
            string line = lines[i];
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            string[] fields = SplitLine(line, delimiter);
            string source = fields.Length > 0 ? fields[0].Trim() : string.Empty;
            string target = fields.Length > 1 ? fields[1].Trim() : string.Empty;
            string? emoji = fields.Length > 2 && fields[2].Trim().Length > 0 ? fields[2].Trim() : null;

            string? problem =
                source.Length == 0 || target.Length == 0
                    ? "Zeile hat keine zwei befüllten Spalten."
                // Dieselben Grenzen wie beim Hinzufuegen; laenger endete beim Bestaetigen als Datenbankfehler (500).
                : ContentRules.CheckText(source) is ContentTextProblem.TooLong
                    || ContentRules.CheckText(target) is ContentTextProblem.TooLong
                    ? $"Ein Wort darf höchstens {ContentRules.MaxTextLength} Zeichen lang sein."
                : emoji?.Length > ContentRules.MaxEmojiLength
                    ? $"Das Emoji darf höchstens {ContentRules.MaxEmojiLength} Zeichen lang sein."
                : !seen.Add($"{source}\0{target}")
                    ? "Doppelter Eintrag in derselben Datei."
                : null;

            rows.Add(new ParsedRow(i + 1, source, target, emoji, problem));
        }

        return new CsvParseResult(delimiter, hasHeader, rows);
    }

    private static char DetectDelimiter(string[] lines)
    {
        // Das Trennzeichen, das ueber die ersten Zeilen hinweg am
        // gleichmaessigsten vorkommt, ist das richtige.
        string[] sample = lines.Take(10).ToArray();
        char best = ';';
        int bestScore = -1;

        foreach (char candidate in Candidates)
        {
            // Gezaehlt ueber SplitLine, damit Trennzeichen in Anfuehrungszeichen
            // ("gehen, laufen, spazieren";go) nicht mitzaehlen.
            int[] counts = sample.Select(l => SplitLine(l, candidate).Length - 1).ToArray();
            if (counts.Length == 0 || counts[0] == 0)
            {
                continue;
            }

            bool consistent = counts.All(c => c == counts[0]);
            int score = counts[0] * (consistent ? 10 : 1);
            if (score > bestScore)
            {
                bestScore = score;
                best = candidate;
            }
        }

        return best;
    }

    private static bool LooksLikeHeader(string firstLine, char delimiter)
    {
        // Ein einzelnes Kopfwort reicht nicht, weil "Quelle;source" oder "Bild;picture"
        // echte Vokabeln sind. Kopfzeile nur, wenn jedes belegte Feld ein Kopfwort aus
        // einer anderen Gruppe ist; im Zweifel wird die erste Zeile importiert und
        // erscheint in der Vorschau (D-13, D-20).
        int[] groups = SplitLine(firstLine, delimiter)
            .Select(f => f.Trim().ToLowerInvariant())
            .Where(f => f.Length > 0)
            .Select(f => Array.FindIndex(HeaderGroups, group => group.Contains(f)))
            .ToArray();
        return groups.Length > 0 && !groups.Contains(-1) && groups.Distinct().Count() == groups.Length;
    }

    /// <summary>
    /// Zerlegt eine Zeile und beachtet dabei Anfuehrungszeichen,
    /// damit "gehen, laufen";"go" nicht auseinanderfaellt.
    /// </summary>
    private static string[] SplitLine(string line, char delimiter)
    {
        var fields = new List<string>(3);
        var current = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == delimiter && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        fields.Add(current.ToString());
        return [.. fields];
    }
}
