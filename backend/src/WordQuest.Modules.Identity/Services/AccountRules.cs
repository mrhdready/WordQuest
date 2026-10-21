using System.Net.Mail;

namespace WordQuest.Modules.Identity.Services;

/// <summary>
/// Regeln fuer Elternkonten (E-Mail, Passwort) und Kinderprofile (Name, PIN,
/// Tageslimit). Sie stehen an genau einer
/// Stelle, damit UI, direkter API-Aufruf und CLI (setup.sh) dieselbe Regel
/// anwenden; Oberflaechen spiegeln sie nur fuer die sofortige Rueckmeldung.
/// </summary>
public static class AccountRules
{
    /// <summary>Mindestlaenge eines Passworts (entschieden 2026-10-15, D-05).</summary>
    public const int MinPasswordLength = 8;

    /// <summary>Hoechstlaenge eines Anzeigenamens, wie die Spalte in der Datenbank (D-15).</summary>
    public const int MaxDisplayNameLength = 100;

    /// <summary>Hoechstlaenge eines Avatar-Schluessels, wie die Spalte in der Datenbank.</summary>
    public const int MaxAvatarKeyLength = 50;

    /// <summary>Untergrenze fuer neue Karten pro Tag.</summary>
    public const int MinDailyNewLimit = 3;

    /// <summary>Obergrenze fuer neue Karten pro Tag.</summary>
    public const int MaxDailyNewLimit = 15;

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

    /// <summary>
    /// Genau 4 Zeichen, jedes aus '0' bis '9' (PAR-02). Bewusst kein
    /// <c>char.IsDigit</c> bzw. <c>\d</c>: die treffen auch andere
    /// Unicode-Ziffern, die das Kind auf dem Ziffernfeld nicht eingeben kann.
    /// Kein Trimmen.
    /// </summary>
    public static bool IsValidPin(string? pin) =>
        pin is { Length: 4 } && pin.All(c => c is >= '0' and <= '9');

    /// <summary>
    /// Alle Befunde zu Name, PIN und Avatar-Schluessel eines Kinderprofils auf
    /// einmal, damit das Formular jeden Fehler am Feld zeigen kann. <c>null</c>
    /// (und bei der PIN auch die leere Zeichenkette) heisst "nicht angegeben"
    /// und ist nur dann ein Befund, wenn das Feld Pflicht ist; ein angegebener
    /// Name aus Leerraum fehlt immer. Der Avatar-Schluessel ist nie Pflicht.
    /// </summary>
    public static IReadOnlyList<LearnerProfileProblem> ValidateLearnerProfile(
        string? displayName, bool nameRequired, string? pin, bool pinRequired, string? avatarKey = null)
    {
        var problems = new List<LearnerProfileProblem>();

        if (displayName is null ? nameRequired : string.IsNullOrWhiteSpace(displayName))
        {
            problems.Add(LearnerProfileProblem.NameMissing);
        }
        else if (displayName is not null && displayName.Trim().Length > MaxDisplayNameLength)
        {
            problems.Add(LearnerProfileProblem.NameTooLong);
        }

        if (string.IsNullOrEmpty(pin))
        {
            if (pinRequired)
            {
                problems.Add(LearnerProfileProblem.PinMissing);
            }
        }
        else if (!IsValidPin(pin))
        {
            problems.Add(LearnerProfileProblem.PinInvalid);
        }

        if (avatarKey is not null && avatarKey.Trim().Length > MaxAvatarKeyLength)
        {
            problems.Add(LearnerProfileProblem.AvatarKeyTooLong);
        }

        return problems;
    }

    /// <summary>
    /// Gedeckelt, weil ein zu hoher Wert in den Folgetagen eine
    /// Wiederholungslawine erzeugt (Konzept §6.3).
    /// </summary>
    public static int ClampDailyNewLimit(int limit) =>
        Math.Clamp(limit, MinDailyNewLimit, MaxDailyNewLimit);
}
