using System.Net.Mail;

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

    /// <summary>
    /// Einfache Adresse der Form <c>name@domain.tld</c>, ohne Anzeigenamen,
    /// hoechstens 320 Zeichen.
    /// </summary>
    public static bool IsValidEmail(string? email)
    {
        string trimmed = email?.Trim() ?? string.Empty;
        return trimmed.Length is > 0 and <= 320
            && MailAddress.TryCreate(trimmed, out MailAddress? parsed)
            && parsed.Address == trimmed
            && parsed.Host.Contains('.', StringComparison.Ordinal);
    }

    /// <summary>
    /// Gueltig ab <see cref="MinPasswordLength"/> Zeichen und nicht nur aus
    /// Leerraum. Kein Trimmen: das Passwort gilt genau so, wie es eingegeben
    /// wurde. Die Leerraum-Regel entspricht der Vorbedingung von
    /// <see cref="PasswordHasher.Hash"/>, sonst endete die Eingabe dort in einer
    /// Ausnahme (500 bzw. Absturz des CLI-Verbs).
    /// </summary>
    public static bool IsValidPassword(string? password) =>
        !string.IsNullOrWhiteSpace(password) && password.Length >= MinPasswordLength;
}
