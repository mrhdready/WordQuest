namespace WordQuest.Modules.Content.Services;

/// <summary>Befund von <see cref="ContentRules.CheckText"/>; die Texte vergibt der Aufrufer.</summary>
public enum ContentTextProblem
{
    /// <summary>Der Text fehlt oder besteht nur aus Leerraum.</summary>
    Missing = 0,

    /// <summary>Der Text ist nach dem Trimmen laenger als <see cref="ContentRules.MaxTextLength"/>.</summary>
    TooLong = 1,
}
