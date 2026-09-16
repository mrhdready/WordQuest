namespace WordQuest.Modules.Learning.Services;

/// <summary>
/// Stellschrauben der Lernengine. Die Defaults entsprechen Konzept §6.2/§6.3;
/// jede Aenderung hier veraendert das Lernverhalten aller Nutzer und gehoert
/// deshalb durch die Simulationstests abgesichert.
/// </summary>
public sealed class SchedulerOptions
{
    /// <summary>Startwert des Leichtigkeitsfaktors einer neuen Karte.</summary>
    public double InitialEaseFactor { get; init; } = 2.5;

    public double MinEaseFactor { get; init; } = 1.3;
    public double MaxEaseFactor { get; init; } = 2.8;

    /// <summary>Abzug auf den Leichtigkeitsfaktor bei einer falschen Antwort.</summary>
    public double LapseEasePenalty { get; init; } = 0.20;

    /// <summary>Intervall nach der ersten richtigen Antwort, in Tagen.</summary>
    public double FirstIntervalDays { get; init; } = 1;

    /// <summary>Intervall nach der zweiten richtigen Antwort, in Tagen.</summary>
    public double SecondIntervalDays { get; init; } = 3;

    /// <summary>Daempfung fuer muehsam richtige Antworten.</summary>
    public double HardIntervalFactor { get; init; } = 0.6;

    /// <summary>Obergrenze des Intervalls in Tagen.</summary>
    public double MaxIntervalDays { get; init; } = 180;

    /// <summary>
    /// Streuung der Intervalle (±5 %). Verhindert, dass alle Vokabeln einer
    /// Unit am selben Tag faellig werden und das Kind vor einem Berg steht.
    /// </summary>
    public double FuzzFactor { get; init; } = 0.05;

    /// <summary>Wiedervorlage nach einer falschen Antwort, innerhalb der Session.</summary>
    public TimeSpan RelearnDelay { get; init; } = TimeSpan.FromMinutes(10);

    /// <summary>
    /// Ortszeit-Stunde, auf die Faelligkeiten normalisiert werden.
    /// 4 Uhr sorgt dafuer, dass "morgen" auch frueh am Morgen schon
    /// "morgen" ist und nicht erst 24 Stunden spaeter.
    /// </summary>
    public int DueHourLocal { get; init; } = 4;

    /// <summary>IANA-Zeitzone der Instanz.</summary>
    public string TimeZoneId { get; init; } = "Europe/Berlin";

    /// <summary>Hoechstzahl Items pro Session.</summary>
    public int SessionSize { get; init; } = 15;

    /// <summary>Hoechstzahl faelliger Wiederholungen pro Session.</summary>
    public int MaxDuePerSession { get; init; } = 10;

    /// <summary>
    /// Antwortzeit, unterhalb derer eine richtige Antwort als
    /// <see cref="Shared.Kernel.Grade.Easy"/> gilt.
    /// </summary>
    public int EasyThresholdMs { get; init; } = 2_000;

    /// <summary>
    /// Antwortzeit, oberhalb derer eine richtige Antwort nur noch als
    /// <see cref="Shared.Kernel.Grade.Hard"/> gilt.
    /// </summary>
    public int HardThresholdMs { get; init; } = 8_000;
}
