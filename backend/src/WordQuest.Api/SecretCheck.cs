using Npgsql;

namespace WordQuest.Api;

/// <summary>
/// Startpruefung der Secrets ausserhalb von Development (SETUP-05): fehlt ein
/// Secret oder ist es ein Wert, der im Repository steht, startet die API nicht.
/// Ein bekannter JWT-Schluessel erlaubte gefaelschte Anmeldungen.
/// </summary>
public static class SecretCheck
{
    private const int MinimumSigningKeyLength = 32;

    // Werte, die im Repository stehen oder standen und deshalb oeffentlich bekannt sind.
    private static readonly HashSet<string> KnownDefaults = new(StringComparer.Ordinal)
    {
        // DB-Passwort: Fallback in Program.cs (BuildConnectionString) und appsettings.Development.json.
        "devpassword",
        // DB-Passwort: frueherer Schnelltest (docker-compose.quick.yml, ${WQ_DB_PASSWORD:-wordquest}).
        "wordquest",
        // JWT-Schluessel: frueherer Schnelltest (docker-compose.quick.yml).
        "nur-zum-ausprobieren-bitte-nicht-im-echtbetrieb-verwenden",
        // JWT-Schluessel: Properties/launchSettings.json (lokale Entwicklung).
        "entwicklungsschluessel-bitte-nur-lokal-verwenden-32+",
    };

    /// <summary>
    /// Fehlertext fuer das Secret <paramref name="name"/>, wenn der Wert leer
    /// ist oder einem bekannten Standardwert entspricht, sonst null.
    /// </summary>
    public static string? Problem(string name, string? value)
    {
        ArgumentNullException.ThrowIfNull(name);

        string trimmed = value?.Trim() ?? string.Empty;
        return trimmed.Length == 0 || KnownDefaults.Contains(trimmed)
            ? $"Start abgebrochen: {name} fehlt oder ist ein bekannter Standardwert. Führe `setup.sh` aus oder trage einen eigenen Wert ein."
            : null;
    }

    /// <summary>
    /// Wie <see cref="Problem"/> fuer den JWT-Schluessel, dazu die Mindestlaenge,
    /// damit auch ein zu kurzer Schluessel mit lesbarer Meldung abbricht.
    /// </summary>
    public static string? SigningKeyProblem(string? value)
    {
        string? problem = Problem("WQ_JWT_SIGNING_KEY", value);
        if (problem is not null)
        {
            return problem;
        }

        return value!.Trim().Length < MinimumSigningKeyLength
            ? $"Start abgebrochen: WQ_JWT_SIGNING_KEY ist zu kurz (mindestens {MinimumSigningKeyLength} Zeichen). Führe `setup.sh` aus oder trage einen längeren Wert ein."
            : null;
    }

    /// <summary>
    /// Prueft den Passwort-Teil eines explizit gesetzten Connection-Strings wie
    /// <see cref="Problem"/>; ohne Passwort-Teil gilt er als fehlend.
    /// </summary>
    public static string? ConnectionStringProblem(string connectionString)
    {
        ArgumentNullException.ThrowIfNull(connectionString);

        string? password;
        try
        {
            password = new NpgsqlConnectionStringBuilder(connectionString).Password;
        }
        catch (ArgumentException)
        {
            // Npgsql wirft bei unlesbarem String; Laien sollen eine Meldung statt eines Stacktraces sehen.
            return "Start abgebrochen: ConnectionStrings__Default ist kein gültiger Connection-String.";
        }

        return Problem("ConnectionStrings__Default", password);
    }
}
