using WordQuest.Shared.Kernel;

namespace WordQuest.Infrastructure;

/// <summary>
/// Mandantenkontext fuer Vorgaenge ausserhalb eines Requests: Migration,
/// Seed, Wartung. Sieht alle Mandanten — deshalb nirgends in den
/// Request-Pfad haengen.
/// </summary>
public sealed class SystemTenantContext : ITenantContext
{
    public Guid TenantId => Guid.Empty;
    public bool IgnoreTenantFilter => true;
}
