namespace WordQuest.Modules.Identity.Entities;

public enum TenantType
{
    Family = 0,
    School = 1,
}

/// <summary>
/// Oberste Trennlinie aller Daten. Eine Familie ist ein Mandant mit
/// <see cref="TenantType.Family"/> — im UI heisst sie nur nicht so.
/// Siehe Konzept §1.
/// </summary>
public sealed class Tenant
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Name { get; set; }
    public TenantType Type { get; set; } = TenantType.Family;

    /// <summary>
    /// Auf Schul-Tablets wird die PIN bei jeder Session verlangt,
    /// auf dem Familientablet nicht (Konzept §3).
    /// </summary>
    public bool RequirePinEverySession { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
