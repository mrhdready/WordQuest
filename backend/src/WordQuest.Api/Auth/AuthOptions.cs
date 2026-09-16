namespace WordQuest.Api.Auth;

public sealed class AuthOptions
{
    public const string Section = "Auth";

    // Bewusst nicht "required": IOptions<T> verlangt einen parameterlosen
    // Konstruktor, und ein required-Member schliesst den aus.
    // Program.cs prueft den Wert beim Start und bricht ab, wenn er fehlt.
    public string SigningKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = "wordquest";
    public string Audience { get; set; } = "wordquest";

    /// <summary>Kurzlebig — die Sitzung haelt ueber das Refresh-Token.</summary>
    public int AccessTokenMinutes { get; set; } = 15;

    /// <summary>
    /// 30 Tage: Auf einem Familientablet soll das Kind die PIN nur bei
    /// Profilwechsel eingeben muessen (Konzept §3).
    /// </summary>
    public int RefreshTokenDays { get; set; } = 30;

    /// <summary>PIN-Fehlversuche, bevor das Profil kurz gesperrt wird.</summary>
    public int MaxPinAttempts { get; set; } = 10;

    public int PinLockoutMinutes { get; set; } = 15;
}
