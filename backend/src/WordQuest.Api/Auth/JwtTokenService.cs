using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using WordQuest.Modules.Identity.Entities;

namespace WordQuest.Api.Auth;

public sealed class JwtTokenService(IOptions<AuthOptions> options, TimeProvider clock)
{
    private readonly AuthOptions _options = options.Value;

    public SymmetricSecurityKey SigningKey =>
        new(Encoding.UTF8.GetBytes(_options.SigningKey));

    public int AccessTokenLifetimeSeconds => _options.AccessTokenMinutes * 60;

    public string CreateAccessToken(User user)
    {
        ArgumentNullException.ThrowIfNull(user);

        DateTime now = clock.GetUtcNow().UtcDateTime;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.CreateVersion7().ToString()),
            new(HttpTenantContext.TenantClaim, user.TenantId.ToString()),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("name", user.DisplayName),
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_options.AccessTokenMinutes),
            signingCredentials: new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public TokenValidationParameters ValidationParameters => new()
    {
        ValidateIssuer = true,
        ValidIssuer = _options.Issuer,
        ValidateAudience = true,
        ValidAudience = _options.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = SigningKey,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = "name",
    };
}
