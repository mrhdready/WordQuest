using Microsoft.EntityFrameworkCore;
using WordQuest.Infrastructure;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api;

/// <summary>
/// Wartungsverben im API-Binary, aufgerufen von setup.sh per
/// <c>docker compose exec -T api dotnet WordQuest.Api.dll &lt;verb&gt;</c>.
/// Das Passwort kommt ueber stdin, damit es weder in der Prozessliste noch in
/// der Shell-History steht, und wird nie ausgegeben.
/// </summary>
public static class AccountCommands
{
    private const int UsageError = 64;

    public static bool IsCommand(string[] args) =>
        args is ["has-owner", ..] or ["create-owner", ..];

    public static async Task<int> RunAsync(
        IServiceProvider services, string[] args, TextReader input, TextWriter output)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(output);

        await using AsyncServiceScope scope = services.CreateAsyncScope();
        DbContextOptions<WordQuestDbContext> options =
            scope.ServiceProvider.GetRequiredService<DbContextOptions<WordQuestDbContext>>();

        // Wartungscode wie der Start-Block: ohne Mandantenfilter, nie im Request-Pfad.
        await using var db = new WordQuestDbContext(options, new SystemTenantContext());
        var accounts = new AccountService(db);

        switch (args)
        {
            case ["has-owner"]:
                return await accounts.HasOwnerAsync() ? 0 : 1;

            case ["create-owner", string email]:
                string password = await input.ReadLineAsync() ?? string.Empty;
                OwnerCreation result = await accounts.CreateOwnerAsync(email, password);
                return await ReportAsync(result, email, output);

            default:
                await output.WriteLineAsync(
                    "Aufruf: has-owner | create-owner <E-Mail-Adresse> (Passwort als eine Zeile über stdin)");
                return UsageError;
        }
    }

    // Exit 2 = Eingabe falsch (setup.sh fragt erneut), Exit 3 = Konto existiert schon.
    private static async Task<int> ReportAsync(OwnerCreation result, string email, TextWriter output)
    {
        (int code, string message) = result switch
        {
            OwnerCreation.Created => (0, $"Elternkonto für {AccountRules.NormalizeEmail(email)} angelegt."),
            OwnerCreation.InvalidEmail => (2, "Das sieht nicht nach einer E-Mail-Adresse aus. Bitte noch einmal."),
            OwnerCreation.PasswordTooShort => (2, $"Das Passwort muss mindestens {AccountRules.MinPasswordLength} Zeichen lang sein."),
            OwnerCreation.PasswordBlank => (2, "Das Passwort darf nicht nur aus Leerzeichen bestehen."),
            OwnerCreation.AlreadyExists => (3, "Es gibt schon ein Elternkonto."),
            _ => throw new InvalidOperationException($"Unbekanntes Ergebnis {result}."),
        };

        await output.WriteLineAsync(message);
        return code;
    }
}
