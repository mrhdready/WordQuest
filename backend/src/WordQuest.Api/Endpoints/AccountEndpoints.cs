using WordQuest.Api.Auth;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;

namespace WordQuest.Api.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        // Rate-Limit "auth": mit gestohlenem Token laesst sich das aktuelle
        // Passwort nicht unbegrenzt raten.
        RouteGroupBuilder group = app.MapGroup("/api/v1/account")
            .WithTags("Account")
            .RequireAuthorization("Guardian")
            .RequireRateLimiting("auth");

        group.MapPost("/password", ChangePasswordAsync);
    }

    /// <summary>
    /// Falsches aktuelles Passwort ist ein Feldfehler (400), nie 401: ein 401
    /// loest im Frontend einen Refresh-Versuch aus (api.ts).
    /// </summary>
    private static async Task<IResult> ChangePasswordAsync(
        ChangePasswordRequest request, AccountService accounts, HttpContext http, CancellationToken ct)
    {
        PasswordChange result = await accounts.ChangePasswordAsync(
            http.User.UserId(), request.CurrentPassword ?? string.Empty, request.NewPassword ?? string.Empty, ct);

        return result switch
        {
            PasswordChange.Changed => Results.NoContent(),
            PasswordChange.WrongCurrentPassword => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentPassword"] = ["Das aktuelle Passwort stimmt nicht."],
            }),
            PasswordChange.NewPasswordBlank => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["newPassword"] = ["Bitte gib ein neues Passwort ein."],
            }),
            PasswordChange.NewPasswordTooShort => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["newPassword"] = ["Das neue Passwort muss mindestens 8 Zeichen lang sein."],
            }),
            _ => Results.NotFound(),
        };
    }
}
