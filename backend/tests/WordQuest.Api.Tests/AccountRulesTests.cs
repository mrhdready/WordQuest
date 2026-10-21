using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

public sealed class AccountRulesTests
{
    [Theory]
    [InlineData("eltern@example.de", true)]
    [InlineData("keine-mail", false)]
    [InlineData("a@b", false)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("Name <x@y.de>", false)]
    public void IsValidEmail(string email, bool expected) =>
        Assert.Equal(expected, AccountRules.IsValidEmail(email));

    [Theory]
    [InlineData("geheim1", false)]
    [InlineData("geheim12", true)]
    [InlineData(null, false)]
    [InlineData("        ", false)]
    // Fuehrendes Leerzeichen gehoert zum Passwort, kein Trimmen.
    [InlineData(" geheim-1", true)]
    public void IsValidPassword(string? password, bool expected) =>
        Assert.Equal(expected, AccountRules.IsValidPassword(password));

    [Theory]
    [InlineData("1234", true)]
    [InlineData("0000", true)]
    [InlineData("123", false)]
    [InlineData("12345", false)]
    [InlineData("123456", false)]
    [InlineData("12a4", false)]
    [InlineData("12 34", false)]
    [InlineData(" 1234", false)]
    // Arabisch-indische Ziffern sind fuer char.IsDigit Ziffern, fuer die PIN-Regel nicht.
    [InlineData("١٢٣٤", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValidPin(string? pin, bool expected) =>
        Assert.Equal(expected, AccountRules.IsValidPin(pin));

    [Theory]
    [InlineData("Max", "1234")]
    [InlineData("Max", "   ", LearnerProfileProblem.PinInvalid)]
    [InlineData("", "1234", LearnerProfileProblem.NameMissing)]
    [InlineData("   ", "1234", LearnerProfileProblem.NameMissing)]
    [InlineData(null, "1234", LearnerProfileProblem.NameMissing)]
    [InlineData("Max", null, LearnerProfileProblem.PinMissing)]
    [InlineData("Max", "", LearnerProfileProblem.PinMissing)]
    [InlineData("Max", "123", LearnerProfileProblem.PinInvalid)]
    [InlineData("", "123", LearnerProfileProblem.NameMissing, LearnerProfileProblem.PinInvalid)]
    public void ValidateLearnerProfile_when_creating(
        string? name, string? pin, params LearnerProfileProblem[] expected) =>
        Assert.Equal(expected, AccountRules.ValidateLearnerProfile(name, nameRequired: true, pin, pinRequired: true));

    [Theory]
    [InlineData(null, null)]
    [InlineData(null, "")]
    [InlineData("Max", null)]
    [InlineData("   ", null, LearnerProfileProblem.NameMissing)]
    [InlineData(null, "123", LearnerProfileProblem.PinInvalid)]
    [InlineData(null, "   ", LearnerProfileProblem.PinInvalid)]
    public void ValidateLearnerProfile_when_editing(
        string? name, string? pin, params LearnerProfileProblem[] expected) =>
        Assert.Equal(expected, AccountRules.ValidateLearnerProfile(name, nameRequired: false, pin, pinRequired: false));

    [Fact]
    public void Name_length_counts_after_trim()
    {
        string hundred = new('a', AccountRules.MaxDisplayNameLength);

        Assert.Empty(AccountRules.ValidateLearnerProfile(hundred, true, "1234", true));
        Assert.Empty(AccountRules.ValidateLearnerProfile($"  {hundred}  ", true, "1234", true));
        Assert.Equal(
            [LearnerProfileProblem.NameTooLong],
            AccountRules.ValidateLearnerProfile(hundred + "a", true, "1234", true));
        Assert.Equal(
            [LearnerProfileProblem.NameTooLong],
            AccountRules.ValidateLearnerProfile(hundred + "a", false, null, false));
    }

    [Theory]
    [InlineData(2, 3)]
    [InlineData(3, 3)]
    [InlineData(15, 15)]
    [InlineData(16, 15)]
    public void ClampDailyNewLimit(int limit, int expected) =>
        Assert.Equal(expected, AccountRules.ClampDailyNewLimit(limit));

    [Theory]
    [InlineData(50, 0)]
    [InlineData(51, 1)]
    public void ValidateLearnerProfile_limits_avatar_key(int length, int expectedProblems)
    {
        IReadOnlyList<LearnerProfileProblem> problems =
            AccountRules.ValidateLearnerProfile("Max", true, "1234", true, new string('a', length));

        Assert.Equal(expectedProblems, problems.Count);
        Assert.All(problems, problem => Assert.Equal(LearnerProfileProblem.AvatarKeyTooLong, problem));
    }

    [Fact]
    public void ValidateLearnerProfile_trims_avatar_key_before_length_check() =>
        Assert.Empty(AccountRules.ValidateLearnerProfile("Max", true, "1234", true, "  " + new string('a', 50) + "  "));
}
