using WordQuest.Shared.Kernel;

namespace WordQuest.Modules.Learning.Entities;

public sealed class LearningSession : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }
    public Guid LearnerId { get; set; }
    public Guid? SetId { get; set; }

    public required string GameKey { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    public int XpAwarded { get; set; }
    public int CoinsAwarded { get; set; }

    public List<SessionItem> Items { get; set; } = [];

    public bool IsComplete => CompletedAt is not null;
}

public sealed class SessionItem : ITenantOwned
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TenantId { get; set; }
    public Guid SessionId { get; set; }
    public Guid CardId { get; set; }

    public int Position { get; set; }

    /// <summary>
    /// True fuer Karten, die in dieser Session bereits falsch beantwortet
    /// wurden und nachgereicht werden.
    /// </summary>
    public bool IsRetry { get; set; }

    public DateTimeOffset? AnsweredAt { get; set; }
    public Grade? Grade { get; set; }
    public string? GivenAnswer { get; set; }
    public int? AnswerMs { get; set; }

    /// <summary>
    /// Vom Client erzeugte Id der Antwort. Macht das Einspielen offline
    /// erfasster Antworten idempotent (Konzept §13).
    /// </summary>
    public Guid? ClientAnswerId { get; set; }

    public LearningSession? Session { get; set; }
}
