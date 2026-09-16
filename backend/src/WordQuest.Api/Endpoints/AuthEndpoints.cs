using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Auth;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Identity.Entities;

namespace WordQuest.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/v1/auth")
            .WithTags("Auth")
            .RequireRateLimiting("auth");

        group.MapGet("/profiles", GetProfilesAsync);
        group.MapPost("/login", LoginAsync);
        group.MapPost("/learner-login", LearnerLoginAsync);
        group.MapPost("/refresh", RefreshAsync);
        group.MapPost("/logout", LogoutAsync);
    }

    /// <summary>
    /// Profilkacheln fuer den Startbildschirm des Kindes — noch ohne
    /// Anmeldung, denn das Kind waehlt ja erst aus, wer es ist.
    ///
    /// Bewusste Einschraenkung: funktioniert nur, solange auf der Instanz
    /// genau ein Mandant existiert. Fuer den spaeteren Schulbetrieb braucht
    /// dieser Endpunkt einen Mandantenhinweis (Subdomain oder Code) —
    /// eine Liste aller Kinder aller Schulen darf es nie geben.
    /// </summary>
    private static async Task<IResult> GetProfilesAsync(
        WordQuestDbContext db, CancellationToken ct)
    {
        List<Guid> tenantIds = await db.Tenants
            .IgnoreQueryFilters()
            .Select(t => t.Id)
            .Take(2)
            .ToListAsync(ct);

        if (tenantIds.Count != 1)
        {
            return Results.Problem(
                title: "Mandant nicht eindeutig",
                detail: "Auf dieser Instanz existiert mehr als ein Mandant. "
                      + "Die Profilauswahl braucht dann einen Mandantenhinweis.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        List<LearnerTileDto> profiles = await db.LearnerProfiles
            .IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantIds[0] && p.User!.IsActive)
            .OrderBy(p => p.User!.DisplayName)
            .Select(p => new LearnerTileDto(p.Id, p.User!.DisplayName, p.AvatarKey))
            .ToListAsync(ct);

        return Results.Ok(profiles);
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request, AuthService auth, CancellationToken ct)
    {
        try
        {
            AuthTokens tokens = await auth.LoginAsync(request.Email, request.Password, ct);
            return Results.Ok(ToResponse(tokens));
        }
        catch (AuthFailedException ex)
        {
            return Unauthorized(ex);
        }
    }

    private static async Task<IResult> LearnerLoginAsync(
        LearnerLoginRequest request, AuthService auth, CancellationToken ct)
    {
        try
        {
            AuthTokens tokens = await auth.LearnerLoginAsync(request.LearnerId, request.Pin, ct);
            return Results.Ok(ToResponse(tokens));
        }
        catch (AuthFailedException ex)
        {
            return Unauthorized(ex);
        }
    }

    private static async Task<IResult> RefreshAsync(
        RefreshRequest request, AuthService auth, CancellationToken ct)
    {
        try
        {
            AuthTokens tokens = await auth.RefreshAsync(request.RefreshToken, ct);
            return Results.Ok(ToResponse(tokens));
        }
        catch (AuthFailedException ex)
        {
            return Unauthorized(ex);
        }
    }

    private static async Task<IResult> LogoutAsync(
        RefreshRequest request, AuthService auth, CancellationToken ct)
    {
        await auth.LogoutAsync(request.RefreshToken, ct);
        return Results.NoContent();
    }

    private static IResult Unauthorized(AuthFailedException ex) =>
        Results.Problem(
            title: "Anmeldung fehlgeschlagen",
            detail: ex.Message,
            statusCode: StatusCodes.Status401Unauthorized);

    private static AuthResponse ToResponse(AuthTokens tokens)
    {
        User user = tokens.User;
        return new AuthResponse(
            tokens.AccessToken,
            tokens.RefreshToken,
            tokens.ExpiresInSeconds,
            new AuthUserDto(user.Id, user.DisplayName, user.Role.ToString(), user.TenantId));
    }
}
