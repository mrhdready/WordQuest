using System.Security.Claims;
using WordQuest.Shared.Kernel;

namespace WordQuest.Api.Auth;

/// <summary>
/// Liest den Mandanten aus dem Token des aktuellen Requests.
/// </summary>
public sealed class HttpTenantContext(IHttpContextAccessor accessor) : ITenantContext
{
    public const string TenantClaim = "tid";

    public Guid TenantId
    {
        get
        {
            string? value = accessor.HttpContext?.User.FindFirstValue(TenantClaim);
            return Guid.TryParse(value, out Guid id) ? id : Guid.Empty;
        }
    }

    // Im Request-Pfad wird der Filter nie umgangen. Guid.Empty trifft keine
    // Zeile, ein nicht authentifizierter Request sieht also nichts — und nicht
    // versehentlich alles.
    public bool IgnoreTenantFilter => false;
}
