using WordQuest.Modules.Learning.Services;
using WordQuest.Shared.Kernel;

namespace WordQuest.Learning.Tests;

public sealed class AnswerEvaluatorTests
{
    private readonly AnswerEvaluator _evaluator = new();

    [Theory]
    [InlineData("dog")]
    [InlineData("Dog")]
    [InlineData("  DOG  ")]
    [InlineData("dog.")]
    public void AcceptsTheSameWordRegardlessOfCaseAndPadding(string given)
    {
        AnswerEvaluation result = _evaluator.Evaluate(given, ExpectedAnswer.Of("dog"), 3000);

        Assert.True(result.IsCorrect);
        Assert.False(result.HadTypo);
    }

    [Theory]
    [InlineData("to go", "go")]
    [InlineData("go", "to go")]
    [InlineData("the house", "house")]
    [InlineData("house", "the house")]
    [InlineData("der Hund", "Hund")]
    public void TreatsLeadingArticlesAndParticlesAsOptional(string given, string expected)
    {
        AnswerEvaluation result = _evaluator.Evaluate(given, ExpectedAnswer.Of(expected), 3000);

        Assert.True(result.IsCorrect);
    }

    [Fact]
    public void AcceptsAlternativeTranslations()
    {
        AnswerEvaluation result = _evaluator.Evaluate(
            "hound", ExpectedAnswer.Of("dog", "hound"), 3000);

        Assert.True(result.IsCorrect);
        Assert.Equal("dog", result.CorrectAnswer);
    }

    [Fact]
    public void AcceptsAnyVariantFromAMultiValueField()
    {
        // "gehen, laufen" ist eine typische Eingabe aus einem Vokabelheft.
        AnswerEvaluation result = _evaluator.Evaluate(
            "laufen", ExpectedAnswer.Of("gehen, laufen"), 3000);

        Assert.True(result.IsCorrect);
    }

    [Theory]
    [InlineData("becuase", "because")]
    [InlineData("beautifull", "beautiful")]
    [InlineData("kitchn", "kitchen")]
    public void TreatsASingleTypoAsCorrectButNotEasy(string given, string expected)
    {
        AnswerEvaluation result = _evaluator.Evaluate(given, ExpectedAnswer.Of(expected), 1000);

        Assert.True(result.IsCorrect);
        Assert.True(result.HadTypo);
        Assert.Equal(Grade.Hard, result.Grade);
        Assert.Contains(expected, result.Hint);
    }

    [Theory]
    [InlineData("cat", "car")]   // zu kurz fuer Tippfehlertoleranz
    [InlineData("dig", "dog")]
    public void DoesNotApplyTypoToleranceToShortWords(string given, string expected)
    {
        AnswerEvaluation result = _evaluator.Evaluate(given, ExpectedAnswer.Of(expected), 1000);

        Assert.False(result.IsCorrect);
    }

    [Fact]
    public void RejectsTwoTypos()
    {
        AnswerEvaluation result = _evaluator.Evaluate(
            "beatifl", ExpectedAnswer.Of("beautiful"), 1000);

        Assert.False(result.IsCorrect);
    }

    [Theory]
    [InlineData(800, Grade.Easy)]
    [InlineData(4000, Grade.Good)]
    [InlineData(12000, Grade.Hard)]
    public void DerivesTheGradeFromAnswerTime(int answerMs, Grade expected)
    {
        AnswerEvaluation result = _evaluator.Evaluate("dog", ExpectedAnswer.Of("dog"), answerMs);

        Assert.Equal(expected, result.Grade);
    }

    [Fact]
    public void AHintCapsTheGradeAtHard()
    {
        AnswerEvaluation result = _evaluator.Evaluate(
            "dog", ExpectedAnswer.Of("dog"), 500, hintUsed: true);

        Assert.Equal(Grade.Hard, result.Grade);
    }

    [Fact]
    public void AWrongAnswerNeverSaysWrong()
    {
        AnswerEvaluation result = _evaluator.Evaluate("horse", ExpectedAnswer.Of("dog"), 3000);

        Assert.False(result.IsCorrect);
        Assert.Equal(Grade.Again, result.Grade);
        Assert.Equal("dog", result.CorrectAnswer);
        Assert.NotNull(result.Hint);
        Assert.DoesNotContain("falsch", result.Hint, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void AnEmptyAnswerIsWrongAndDoesNotThrow(string? given)
    {
        AnswerEvaluation result = _evaluator.Evaluate(given, ExpectedAnswer.Of("dog"), 3000);

        Assert.False(result.IsCorrect);
    }

    [Fact]
    public void NormalisesTypographicApostrophes()
    {
        AnswerEvaluation result = _evaluator.Evaluate(
            "don’t", ExpectedAnswer.Of("don't"), 3000);

        Assert.True(result.IsCorrect);
    }
}
