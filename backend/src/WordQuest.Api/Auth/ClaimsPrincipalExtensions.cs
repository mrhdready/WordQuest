using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace WordQuest.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static Guid UserId(this ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);

        string? value = principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
                        ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(value, out Guid id) ? id : Guid.Empty;
    }

    public static Guid TenantId(this ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);
        return Guid.TryParse(principal.FindFirstValue(HttpTenantContext.TenantClaim), out Guid id)
            ? id
            : Guid.Empty;
    }

    public static bool IsLearner(this ClaimsPrincipal principal) =>
        principal.IsInRole("Learner");
}
