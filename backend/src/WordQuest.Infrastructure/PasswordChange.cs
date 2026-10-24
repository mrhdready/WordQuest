namespace WordQuest.Infrastructure;

/// <summary>Ergebnis von <see cref="AccountService.ChangePasswordAsync"/>.</summary>
public enum PasswordChange
{
    /// <summary>Das neue Passwort ist gespeichert.</summary>
    Changed = 0,

    /// <summary>Das aktuelle Passwort stimmt nicht; nichts wurde geaendert.</summary>
    WrongCurrentPassword = 1,

    /// <summary>Das neue Passwort ist kuerzer als die Mindestlaenge; nichts wurde geaendert.</summary>
    NewPasswordTooShort = 2,

    /// <summary>Das Konto aus dem Token gibt es (im eigenen Mandanten) nicht.</summary>
    UnknownUser = 3,

    /// <summary>Das neue Passwort ist leer oder besteht nur aus Leerzeichen; nichts wurde geaendert.</summary>
    NewPasswordBlank = 4,
}
