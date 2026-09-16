namespace WordQuest.Shared.Kernel;

/// <summary>
/// Der Mandant des aktuellen Requests. Wird vom EF-Core-Global-Query-Filter
/// ausgewertet, damit Mandantentrennung nicht von handgeschriebenen
/// WHERE-Klauseln abhaengt (Konzept §1, §15).
/// </summary>
public interface ITenantContext
{
    /// <summary>
    /// Mandanten-Id des angemeldeten Nutzers, oder <see cref="Guid.Empty"/>
    /// bei nicht authentifizierten Requests. <see cref="Guid.Empty"/> trifft
    /// keine Zeile — ein fehlender Mandant liefert also ein leeres Ergebnis
    /// und nicht versehentlich alle Daten.
    /// </summary>
    Guid TenantId { get; }

    /// <summary>
    /// Deaktiviert den Mandantenfilter fuer Wartungsvorgaenge
    /// (Migration, Seed, Backup). Nur ausserhalb von Requests verwenden.
    /// </summary>
    bool IgnoreTenantFilter { get; }
}
