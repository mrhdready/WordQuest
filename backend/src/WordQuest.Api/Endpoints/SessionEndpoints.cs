using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Auth;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Learning.Services;

namespace WordQuest.Api.Endpoints;

public static class SessionEndpoints
{
    public static void MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/v1/sessions")
            .WithTags("Sessions")
            .RequireAuthorization();

        group.MapPost("/", StartAsync);
        group.MapPost("/{sessionId:guid}/answers", AnswerAsync);
        group.MapPost("/{sessionId:guid}/complete", CompleteAsync);
        group.MapPost("/sync", SyncAsync);
        group.MapGet("/games", () => Results.Ok(
            GameCatalog.All.Select(g => new { g.Key, g.Title, g.XpWeight })));
    }

    private static async Task<IResult> StartAsync(
        StartSessionRequest request,
        LearningService learning,
        HttpContext http,
        CancellationToken ct)
    {
        if (!MayActFor(http, request.LearnerId, out IResult denied))
        {
            return denied;
        }

        SessionView view = await learning.StartSessionAsync(
            request.LearnerId, request.SetId, request.GameKey ?? GameCatalog.Classic, request.Size, ct);

        // Eine leere Liste ist kein Fehler: dann ist heute nichts faellig,
        // und das Frontend zeigt "alles erledigt" statt einer Fehlermeldung.
        return Results.Ok(view);
    }

    private static async Task<IResult> AnswerAsync(
        Guid sessionId,
        SubmitAnswerRequest request,
        LearningService learning,
        WordQuestDbContext db,
        HttpContext http,
        CancellationToken ct)
    {
        Guid learnerId = await ResolveLearnerAsync(db, sessionId, ct);
        if (learnerId == Guid.Empty)
        {
            return Results.NotFound();
        }

        if (!MayActFor(http, learnerId, out IResult denied))
        {
            return denied;
        }

        AnswerResult result = await learning.SubmitAnswerAsync(
            learnerId, sessionId, request.ItemId, request.GivenAnswer,
            request.AnswerMs, request.ClientAnswerId, request.HintUsed, ct);

        return Results.Ok(result);
    }

    private static async Task<IResult> CompleteAsync(
        Guid sessionId,
        LearningService learning,
        WordQuestDbContext db,
        HttpContext http,
        CancellationToken ct)
    {
        Guid learnerId = await ResolveLearnerAsync(db, sessionId, ct);
        if (learnerId == Guid.Empty)
        {
            return Results.NotFound();
        }

        if (!MayActFor(http, learnerId, out IResult denied))
        {
            return denied;
        }

        SessionSummary summary = await learning.CompleteSessionAsync(learnerId, sessionId, ct);
        return Results.Ok(summary);
    }

    /// <summary>
    /// Spielt offline erfasste Antworten nach. Der Server rechnet den Lernstand
    /// autoritativ neu — was der Client lokal bewertet hat, ist nur Anzeige
    /// (Konzept §13). Doppelte Antworten werden idempotent verworfen.
    /// </summary>
    private static async Task<IResult> SyncAsync(
        SyncRequest request,
        LearningService learning,
        WordQuestDbContext db,
        HttpContext http,
        CancellationToken ct)
    {
        Guid learnerId = await ResolveLearnerAsync(db, request.SessionId, ct);
        if (learnerId == Guid.Empty)
        {
            return Results.NotFound();
        }

        if (!MayActFor(http, learnerId, out IResult denied))
        {
            return denied;
        }

        var results = new List<AnswerResult>(request.Answers.Count);
        foreach (SubmitAnswerRequest answer in request.Answers)
        {
            results.Add(await learning.SubmitAnswerAsync(
                learnerId, request.SessionId, answer.ItemId, answer.GivenAnswer,
                answer.AnswerMs, answer.ClientAnswerId, answer.HintUsed, ct));
        }

        SessionSummary summary = await learning.CompleteSessionAsync(learnerId, request.SessionId, ct);
        return Results.Ok(new { accepted = results.Count, summary });
    }

    private static async Task<Guid> ResolveLearnerAsync(
        WordQuestDbContext db, Guid sessionId, CancellationToken ct)
    {
        return await db.LearningSessions
            .Where(s => s.Id == sessionId)
            .Select(s => s.LearnerId)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Ein Kind darf ausschliesslich fuer sich selbst lernen. Der
    /// Mandantenfilter allein reicht dafuer nicht — Geschwister sitzen im
    /// selben Mandanten.
    /// </summary>
    private static bool MayActFor(HttpContext http, Guid learnerId, out IResult denied)
    {
        if (http.User.IsLearner() && http.User.UserId() != learnerId)
        {
            denied = Results.Problem(
                title: "Nicht erlaubt",
                detail: "Dieses Profil gehoert jemand anderem.",
                statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        denied = Results.Empty;
        return true;
    }
}
