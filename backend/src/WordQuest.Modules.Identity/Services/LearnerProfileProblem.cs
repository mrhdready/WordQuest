namespace WordQuest.Modules.Identity.Services;

/// <summary>Befund von <see cref="AccountRules.ValidateLearnerProfile"/>; die Texte vergibt der Aufrufer.</summary>
public enum LearnerProfileProblem
{
    /// <summary>Der Name fehlt oder besteht nur aus Leerraum.</summary>
    NameMissing = 0,

    /// <summary>Der Name ist nach dem Trimmen laenger als <see cref="AccountRules.MaxDisplayNameLength"/>.</summary>
    NameTooLong = 1,

    /// <summary>Die PIN fehlt, obwohl sie Pflicht ist.</summary>
    PinMissing = 2,

    /// <summary>Die PIN besteht nicht aus 4 bis 6 Ziffern 0 bis 9.</summary>
    PinInvalid = 3,

    /// <summary>Der Avatar-Schluessel ist nach dem Trimmen laenger als <see cref="AccountRules.MaxAvatarKeyLength"/>.</summary>
    AvatarKeyTooLong = 4,
}
