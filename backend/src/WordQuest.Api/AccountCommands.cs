using Microsoft.EntityFrameworkCore;
using WordQuest.Infrastructure;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api;

/// <summary>
/// Wartungsverben im API-Binary, aufgerufen von setup.sh bzw. vom Betreiber per
/// <c>docker compose exec -T api dotnet WordQuest.Api.dll &lt;verb&gt;</c>.
/// Das Passwort fuer create-owner kommt ueber stdin, damit es weder in der
/// Prozessliste noch in der Shell-History steht, und wird nie ausgegeben;
/// reset-password gibt das erzeugte Passwort genau einmal aus.
/// </summary>
public static class AccountCommands
{
    private const int UsageError = 64;

    // Eigener Code statt 1: docker compose exec meldet eigene Fehler ebenfalls mit 1.
    private const int NoOwner = 10;

    public static bool IsCommand(string[] args) =>
        args is ["has-owner", ..] or ["create-owner", ..] or ["reset-password", ..];

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
        var accounts = new AccountService(db, scope.ServiceProvider.GetRequiredService<TimeProvider>());

        switch (args)
        {
            case ["has-owner"]:
                return await accounts.HasOwnerAsync() ? 0 : NoOwner;

            case ["create-owner", string email]:
                string password = await input.ReadLineAsync() ?? string.Empty;
                OwnerCreation result = await accounts.CreateOwnerAsync(email, password);
                return await ReportAsync(result, email, output);

            case ["reset-password", string email]:
                // Das Passwort steht genau einmal auf stdout und nirgends sonst (D-06).
                string? newPassword = await accounts.ResetPasswordAsync(email);
                if (newPassword is null)
                {
                    await output.WriteLineAsync("Es gibt kein Elternkonto mit dieser E-Mail-Adresse.");
                    return 1;
                }

                await output.WriteLineAsync(
                    $"Neues Passwort für {AccountRules.NormalizeEmail(email)}: {newPassword} — Es wird nur dieses eine Mal angezeigt. Melde dich damit an und ändere es unter \"Konto\".");
                return 0;

            default:
                await output.WriteLineAsync(
                    "Aufruf: has-owner | create-owner <E-Mail-Adresse> (Passwort als eine Zeile über stdin) | reset-password <E-Mail-Adresse>");
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
