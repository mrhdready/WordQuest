namespace WordQuest.Shared.Kernel;

/// <summary>
/// Jede Entitaet mit Nutzerbezug traegt eine Mandanten-Id.
/// Der DbContext haengt an jede solche Entitaet automatisch einen
/// Global Query Filter.
/// </summary>
public interface ITenantOwned
{
    Guid TenantId { get; set; }
}
