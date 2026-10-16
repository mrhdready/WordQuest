namespace WordQuest.Modules.Identity.Services;

/// <summary>
/// Regeln fuer Elternkonten (E-Mail, Passwort). Sie stehen an genau einer
/// Stelle, damit UI, direkter API-Aufruf und CLI (setup.sh) dieselbe Regel
/// anwenden; Oberflaechen spiegeln sie nur fuer die sofortige Rueckmeldung.
/// </summary>
public static class AccountRules
{
    /// <summary>Mindestlaenge eines Passworts (entschieden 2026-10-15, D-05).</summary>
    public const int MinPasswordLength = 8;

    /// <summary>Normalisiert eine E-Mail-Adresse wie der Login (Trim, Kleinschreibung).</summary>
    public static string NormalizeEmail(string email)
    {
        ArgumentNullException.ThrowIfNull(email);
        return email.Trim().ToLowerInvariant();
    }
}
