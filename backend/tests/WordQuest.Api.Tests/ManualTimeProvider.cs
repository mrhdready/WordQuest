using System.Diagnostics;

namespace WordQuest.Api.Tests;

/// <summary>
/// Testuhr fuer den Takt von <c>tls watch</c> (Codex 7): Die Zeit wird von Hand gestellt,
/// ein Timer feuert nur auf <see cref="FireLatest"/>. Task.Delay legt je Takt einen
/// neuen Timer an, deshalb zaehlt die Anzahl der Timer die erreichten Takte.
/// </summary>
public sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
{
    private readonly Lock _gate = new();
    private readonly List<ManualTimer> _timers = [];
    private DateTimeOffset _now = now;

    public DateTimeOffset Now
    {
        get { lock (_gate) { return _now; } }
        set { lock (_gate) { _now = value; } }
    }

    public int TimerCount
    {
        get { lock (_gate) { return _timers.Count; } }
    }

    public override DateTimeOffset GetUtcNow() => Now;

    public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
    {
        var timer = new ManualTimer(callback, state);
        lock (_gate)
        {
            _timers.Add(timer);
        }

        return timer;
    }

    public async Task WaitForTimersAsync(int count)
    {
        var elapsed = Stopwatch.StartNew();
        while (TimerCount < count)
        {
            if (elapsed.Elapsed > TimeSpan.FromSeconds(10))
            {
                Assert.Fail($"Nach 10 Sekunden {TimerCount} statt {count} Timer.");
            }

            await Task.Delay(10);
        }
    }

    public void FireLatest()
    {
        ManualTimer timer;
        lock (_gate)
        {
            timer = _timers[^1];
        }

        timer.Fire();
    }

    private sealed class ManualTimer(TimerCallback callback, object? state) : ITimer
    {
        public void Fire() => callback(state);

        public bool Change(TimeSpan dueTime, TimeSpan period) => true;

        public void Dispose()
        {
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
