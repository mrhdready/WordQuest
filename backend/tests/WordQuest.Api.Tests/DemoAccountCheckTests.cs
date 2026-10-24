using Microsoft.Extensions.Logging.Abstractions;
using WordQuest.Infrastructure.Seed;

namespace WordQuest.Api.Tests;

/// <summary>
/// Startpruefung der Demo-Daten (CR-01): Altinstallationen haben das
/// Demo-Elternkonto mit oeffentlich bekanntem Passwort noch in der Datenbank.
/// Eigene Factory je Testfall, weil der Seeder nur auf leerer Datenbank laeuft.
/// </summary>
public sealed class DemoAccountCheckTests : IAsyncLifetime
{
    private const string AccountProblem =
        "Start abgebrochen: Das Demo-Elternkonto demo@wordquest.local hat noch sein bekanntes Passwort. "
        + "Setze es zurück mit `docker compose run --rm api reset-password demo@wordquest.local` "
        + "und starte WordQuest danach mit `docker compose up -d`.";

    private readonly ApiFactory _factory = new ApiFactory();

    public Task InitializeAsync() => _factory.InitializeAsync();

    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();

    private async Task<string?> ProblemAsync()
    {
        await using var db = _factory.CreateSystemDbContext();
        return await DemoAccountCheck.AccountProblemAsync(db);
    }

    private async Task SeedDemoAsync()
    {
        await using var db = _factory.CreateSystemDbContext();
        await DemoDataSeeder.SeedAsync(db, NullLogger.Instance);
    }

    [Fact]
    public void Seed_switch_on_stops_the_start()
    {
        Assert.Equal(
            "Start abgebrochen: WQ_SEED_DEMO_DATA ist eingeschaltet. Demo-Daten haben ein bekanntes Passwort und sind nur für die Entwicklung gedacht. "
            + "Setze WQ_SEED_DEMO_DATA=false in .env und starte WordQuest mit `docker compose up -d` neu.",
            DemoAccountCheck.SeedProblem(true));
        Assert.Null(DemoAccountCheck.SeedProblem(false));
    }

    [Fact]
    public async Task Demo_account_with_known_password_stops_the_start()
    {
        await SeedDemoAsync();

        Assert.Equal(AccountProblem, await ProblemAsync());
    }

    // Der Ausweg aus der Meldung: das CLI-Verb laeuft vor dem Start-Block und setzt das Passwort neu.
    [Fact]
    public async Task Reset_password_clears_the_problem()
    {
        await SeedDemoAsync();

        var output = new StringWriter();
        int code = await AccountCommands.RunAsync(
            _factory.Services, ["reset-password", DemoDataSeeder.DemoEmail], new StringReader(string.Empty), output);

        Assert.Equal(0, code);
        Assert.Null(await ProblemAsync());
    }

    [Fact]
    public async Task Database_without_demo_account_passes() => Assert.Null(await ProblemAsync());
}
