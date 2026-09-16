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
