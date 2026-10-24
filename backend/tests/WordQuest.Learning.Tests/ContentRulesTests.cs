using WordQuest.Modules.Content.Services;

namespace WordQuest.Learning.Tests;

/// <summary>Eine Regel fuer Set-Titel und Woerter: Pflicht, hoechstens 200 Zeichen nach Trimmen (PAR-04).</summary>
public sealed class ContentRulesTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Leerer_Text_fehlt(string? text) =>
        Assert.Equal(ContentTextProblem.Missing, ContentRules.CheckText(text));

    [Fact]
    public void Genau_200_Zeichen_sind_erlaubt() =>
        Assert.Null(ContentRules.CheckText(new string('a', 200)));

    [Fact]
    public void Mehr_als_200_Zeichen_sind_zu_lang() =>
        Assert.Equal(ContentTextProblem.TooLong, ContentRules.CheckText(new string('a', 201)));

    [Fact]
    public void Geprueft_wird_nach_dem_Trimmen()
    {
        Assert.Null(ContentRules.CheckText("  Hund  "));
        Assert.Null(ContentRules.CheckText($"  {new string('a', 200)}  "));
    }
}
