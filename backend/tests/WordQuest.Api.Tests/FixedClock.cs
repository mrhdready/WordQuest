namespace WordQuest.Api.Tests;

/// <summary>
/// Uhr, die immer denselben Zeitpunkt liefert: So schreiben zwei Antworten
/// denselben Wert, wie bei einer groben oder eingefrorenen Uhr (Review 03 MEDIUM).
/// </summary>
public sealed class FixedClock(DateTimeOffset now) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now;
}
