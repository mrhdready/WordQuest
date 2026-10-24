using WordQuest.Modules.Content.Services;

namespace WordQuest.Learning.Tests;

public sealed class CsvVocabularyParserTests
{
    [Fact]
    public void ReadsSemicolonSeparatedRows()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("Hund;dog\nHaus;house\n");

        Assert.Equal(';', result.Delimiter);
        Assert.Equal(2, result.ValidCount);
        Assert.Equal("dog", result.Rows[0].Target);
    }

    [Fact]
    public void DetectsCommaAndTabAsWell()
    {
        Assert.Equal(',', CsvVocabularyParser.Parse("Hund,dog\nHaus,house").Delimiter);
        Assert.Equal('\t', CsvVocabularyParser.Parse("Hund\tdog\nHaus\thouse").Delimiter);
    }

    [Fact]
    public void SkipsAHeaderRow()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("Deutsch;Englisch\nHund;dog");

        Assert.True(result.HadHeader);
        Assert.Single(result.Rows);
        Assert.Equal("Hund", result.Rows[0].Source);
    }

    // Ein einzelnes Kopfwort macht noch keine Kopfzeile (Codex-Befund 10, D-13, D-20).
    [Theory]
    [InlineData("Quelle;source")]
    [InlineData("Ziel;target")]
    [InlineData("Bild;picture")]
    [InlineData("Deutsch;German")]
    public void KeepsAFirstVocabularyRowMadeOfHeaderWords(string firstLine)
    {
        CsvParseResult result = CsvVocabularyParser.Parse($"{firstLine}\nHund;dog");
        string[] fields = firstLine.Split(';');

        Assert.False(result.HadHeader);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal(fields[0], result.Rows[0].Source);
        Assert.Equal(fields[1], result.Rows[0].Target);
    }

    [Theory]
    [InlineData("source;target\nHund;dog")]
    [InlineData("Quelle;Ziel;Emoji\nHund;dog;🐶")]
    [InlineData("\"Deutsch\";\"Englisch\";\nHund;dog")]
    public void SkipsAnUnambiguousHeaderRow(string content)
    {
        CsvParseResult result = CsvVocabularyParser.Parse(content);

        Assert.True(result.HadHeader);
        Assert.Single(result.Rows);
        Assert.Equal("Hund", result.Rows[0].Source);
    }

    [Fact]
    public void KeepsQuotedFieldsTogether()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("\"gehen, laufen\";go");

        Assert.Equal("gehen, laufen", result.Rows[0].Source);
        Assert.Equal("go", result.Rows[0].Target);
    }

    [Fact]
    public void ReadsTheOptionalEmojiColumn()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("Hund;dog;🐶");

        Assert.Equal("🐶", result.Rows[0].Emoji);
    }

    [Fact]
    public void ReportsIncompleteRowsInsteadOfDroppingThem()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("Hund;dog\nHaus;\n;house");

        Assert.Equal(1, result.ValidCount);
        Assert.Equal(2, result.ProblemCount);
        // Die Zeilennummer muss stimmen, sonst ist die Korrekturansicht wertlos.
        Assert.Equal(2, result.Rows[1].LineNumber);
    }

    [Fact]
    public void FlagsDuplicatesWithinTheSameFile()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("Hund;dog\nHund;dog");

        Assert.Equal(1, result.ValidCount);
        Assert.NotNull(result.Rows[1].Problem);
    }

    // Dieselben Grenzen wie beim Hinzufuegen einer Vokabel; laenger endete beim Bestaetigen als 500.
    public static TheoryData<string, string> TooLongRows => new()
    {
        { $"{new string('a', 201)};dog", "Ein Wort darf höchstens 200 Zeichen lang sein." },
        { $"Hund;{new string('b', 201)}", "Ein Wort darf höchstens 200 Zeichen lang sein." },
        { $"Hund;dog;{new string('x', 17)}", "Das Emoji darf höchstens 16 Zeichen lang sein." },
    };

    [Theory]
    [MemberData(nameof(TooLongRows))]
    public void FlagsRowsBeyondTheEntryLimits(string line, string problem)
    {
        CsvParseResult result = CsvVocabularyParser.Parse($"Haus;house\n{line}");

        Assert.Equal(1, result.ValidCount);
        Assert.Equal(problem, result.Rows[1].Problem);
    }

    [Fact]
    public void AcceptsRowsExactlyAtTheEntryLimits()
    {
        CsvParseResult result = CsvVocabularyParser.Parse(
            $"{new string('a', 200)};{new string('b', 200)};{new string('x', 16)}");

        Assert.Null(result.Rows[0].Problem);
    }

    [Fact]
    public void SurvivesTheExcelByteOrderMark()
    {
        CsvParseResult result = CsvVocabularyParser.Parse("﻿Hund;dog");

        Assert.Equal("Hund", result.Rows[0].Source);
    }

    [Fact]
    public void HandlesEmptyInputWithoutThrowing()
    {
        Assert.Empty(CsvVocabularyParser.Parse(string.Empty).Rows);
        Assert.Empty(CsvVocabularyParser.Parse("\n\n\n").Rows);
    }
}
