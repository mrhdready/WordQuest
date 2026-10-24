namespace WordQuest.Modules.Content.Services;

/// <summary>
/// Regel fuer Set-Titel und Woerter einer Vokabel. Sie steht an genau einer
/// Stelle, damit API und Oberflaeche dieselbe Grenze anwenden; Oberflaechen
/// spiegeln sie nur fuer die sofortige Rueckmeldung. Die Texte vergibt der Aufrufer.
/// </summary>
public static class ContentRules
{
    /// <summary>
    /// Hoechstlaenge nach dem Trimmen; entspricht <c>HasMaxLength(200)</c> der
    /// Spalten Titel, <c>SourceText</c> und <c>TargetText</c>. Laenger endete
    /// sonst als Datenbankfehler (500).
    /// </summary>
    public const int MaxTextLength = 200;

    /// <summary>Hoechstlaenge eines Emojis; entspricht <c>HasMaxLength(16)</c> der Spalte.</summary>
    public const int MaxEmojiLength = 16;

    /// <summary>Hoechstlaenge eines Beispielsatzes; entspricht <c>HasMaxLength(500)</c> der Spalten.</summary>
    public const int MaxExampleLength = 500;

    /// <summary>Hoechstlaenge einer Set-Beschreibung; entspricht <c>HasMaxLength(2000)</c> der Spalte.</summary>
    public const int MaxDescriptionLength = 2000;

    /// <summary>Hoechstlaenge eines Sprachkuerzels (z. B. <c>de-DE</c>); entspricht <c>HasMaxLength(5)</c> der Spalten.</summary>
    public const int MaxLanguageLength = 5;

    /// <summary>Prueft nach dem Trimmen: leer fehlt, laenger als <see cref="MaxTextLength"/> ist zu lang, sonst <c>null</c>.</summary>
    public static ContentTextProblem? CheckText(string? text)
    {
        string trimmed = text?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            return ContentTextProblem.Missing;
        }

        return trimmed.Length > MaxTextLength ? ContentTextProblem.TooLong : null;
    }
}
