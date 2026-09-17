using WordQuest.Modules.Learning.Services;

namespace WordQuest.Learning.Tests;

public sealed class LevenshteinTests
{
    [Theory]
    [InlineData("because", "because", 0)]
    [InlineData("beautifull", "beautiful", 1)]   // ein Zeichen zu viel
    [InlineData("kitchn", "kitchen", 1)]         // ein Zeichen zu wenig
    [InlineData("cat", "car", 1)]                // ein Zeichen falsch
    [InlineData("becuase", "because", 1)]        // Dreher — der haeufigste Tippfehler
    [InlineData("teh", "the", 1)]
    [InlineData("form", "from", 1)]
    [InlineData("gadren", "garden", 1)]
    [InlineData("beatifl", "beautiful", 2)]      // zwei Fehler bleiben zwei
    [InlineData("dog", "god", 2)]                // kein Dreher: d und g sind nicht benachbart
    [InlineData("", "abc", 3)]
    [InlineData("abc", "", 3)]
    public void ComputesTheExpectedDistance(string a, string b, int expected)
    {
        Assert.Equal(expected, Levenshtein.Distance(a.AsSpan(), b.AsSpan()));
    }

    [Fact]
    public void IsSymmetric()
    {
        Assert.Equal(
            Levenshtein.Distance("becuase".AsSpan(), "because".AsSpan()),
            Levenshtein.Distance("because".AsSpan(), "becuase".AsSpan()));
    }

    [Theory]
    [InlineData("becuase", "because", true)]
    [InlineData("beatifl", "beautiful", false)]
    [InlineData("dog", "god", false)]
    public void RespectsTheUpperBound(string a, string b, bool within)
    {
        Assert.Equal(within, Levenshtein.IsWithin(a, b, 1));
    }

    [Fact]
    public void StopsEarlyInsteadOfComputingTheFullMatrix()
    {
        // Bei Abbruch wird max + 1 zurueckgegeben, nicht die echte Distanz.
        // Das ist gewollt: gebraucht wird nur die Antwort "mehr als max".
        int distance = Levenshtein.Distance(
            "unzusammenhaengend".AsSpan(), "kurz".AsSpan(), max: 1);

        Assert.True(distance > 1);
    }

    [Fact]
    public void HandlesStringsLongerThanTheStackBuffer()
    {
        // Ueber 128 Zeichen faellt die Implementierung auf den Heap zurueck.
        string a = new('a', 200);
        string b = new('a', 200);

        Assert.Equal(0, Levenshtein.Distance(a.AsSpan(), b.AsSpan()));
        Assert.Equal(1, Levenshtein.Distance(a.AsSpan(), (b + "b").AsSpan()));
    }
}
