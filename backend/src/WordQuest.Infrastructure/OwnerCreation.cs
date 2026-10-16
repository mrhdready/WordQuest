namespace WordQuest.Infrastructure;

/// <summary>Ergebnis von <see cref="AccountService.CreateOwnerAsync"/>.</summary>
public enum OwnerCreation
{
    /// <summary>Elternkonto und Familie wurden angelegt.</summary>
    Created = 0,

    /// <summary>Die E-Mail-Adresse ist ungueltig; nichts wurde angelegt.</summary>
    InvalidEmail = 1,

    /// <summary>Das Passwort ist kuerzer als die Mindestlaenge; nichts wurde angelegt.</summary>
    PasswordTooShort = 2,

    /// <summary>Es gibt schon ein Elternkonto; nichts wurde angelegt.</summary>
    AlreadyExists = 3,

    /// <summary>Das Passwort besteht nur aus Leerzeichen; nichts wurde angelegt.</summary>
    PasswordBlank = 4,
}
