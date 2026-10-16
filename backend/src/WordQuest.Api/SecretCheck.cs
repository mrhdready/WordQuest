using Npgsql;

namespace WordQuest.Api;

/// <summary>
/// Startpruefung der Secrets ausserhalb von Development (SETUP-05): fehlt ein
/// Secret oder ist es ein Wert, der im Repository steht, startet die API nicht.
/// Ein bekannter JWT-Schluessel erlaubte gefaelschte Anmeldungen.
/// </summary>
public static class SecretCheck
{
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
    /// Prueft den Passwort-Teil eines explizit gesetzten Connection-Strings wie
    /// <see cref="Problem"/>; ohne Passwort-Teil gilt er als fehlend.
    /// </summary>
    public static string? ConnectionStringProblem(string connectionString)
    {
        ArgumentNullException.ThrowIfNull(connectionString);

        string? password = new NpgsqlConnectionStringBuilder(connectionString).Password;
        return Problem("ConnectionStrings__Default", password);
    }
}
