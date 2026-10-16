namespace WordQuest.Api.Tests;

/// <summary>Startpruefung der Secrets ausserhalb von Development (SETUP-05).</summary>
public sealed class SecretCheckTests
{
    // Zufaelliger Wert in der Form, die setup.sh erzeugt (48 Zeichen).
    private const string Random48 = "q7Vx2LmR9tKp4WzB8nHc3YdF6jGs5ZaE1uQo0iTr7XyNw2Mk";

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("devpassword")]
    [InlineData("wordquest")]
    [InlineData(" devpassword ")]
    public void Problem_reports_missing_or_known_db_password(string? value)
    {
        Assert.Equal(
            "Start abgebrochen: WQ_DB_PASSWORD fehlt oder ist ein bekannter Standardwert. Führe `setup.sh` aus oder trage einen eigenen Wert ein.",
            SecretCheck.Problem("WQ_DB_PASSWORD", value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("nur-zum-ausprobieren-bitte-nicht-im-echtbetrieb-verwenden")]
    [InlineData("entwicklungsschluessel-bitte-nur-lokal-verwenden-32+")]
    public void Problem_reports_missing_or_known_signing_key(string? value)
    {
        string? problem = SecretCheck.Problem("WQ_JWT_SIGNING_KEY", value);

        Assert.NotNull(problem);
        Assert.Contains("WQ_JWT_SIGNING_KEY", problem);
    }

    [Theory]
    [InlineData("WQ_DB_PASSWORD")]
    [InlineData("WQ_JWT_SIGNING_KEY")]
    public void Problem_accepts_own_random_value(string name)
    {
        Assert.Null(SecretCheck.Problem(name, Random48));
    }

    [Theory]
    [InlineData("Host=db;Username=wordquest;Password=devpassword")]
    [InlineData("Host=db;Username=wordquest;Password=wordquest")]
    [InlineData("Host=db;Username=wordquest")]
    public void ConnectionStringProblem_reports_missing_or_known_password(string connectionString)
    {
        string? problem = SecretCheck.ConnectionStringProblem(connectionString);

        Assert.NotNull(problem);
        Assert.StartsWith("Start abgebrochen: ConnectionStrings__Default ", problem);
    }

    [Fact]
    public void ConnectionStringProblem_accepts_own_random_password()
    {
        Assert.Null(SecretCheck.ConnectionStringProblem($"Host=db;Username=wordquest;Password={Random48}"));
    }
}
