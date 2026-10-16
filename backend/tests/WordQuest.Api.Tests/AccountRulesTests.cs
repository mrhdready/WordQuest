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
}
