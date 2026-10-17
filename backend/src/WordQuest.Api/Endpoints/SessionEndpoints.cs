using Microsoft.EntityFrameworkCore;
using Npgsql;
using WordQuest.Api.Auth;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Learning.Services;

namespace WordQuest.Api.Endpoints;

public static class SessionEndpoints
{
    // Texte fuer Kinder (02-UI-SPEC "Lernrunde (FIX-04)"): was passiert ist und was jetzt hilft.
    private const string NotFoundTitle = "Nicht gefunden";
    private const string SessionGone = "Diese Runde gibt es nicht mehr. Starte eine neue Runde.";
    private const string CardGone = "Diese Karte gehört nicht zu dieser Runde. Starte eine neue Runde.";
    private const string ChildGone = "Dieses Kind gibt es nicht (mehr).";
    private const string SizeInvalid = "Eine Runde hat 1 bis 50 Karten.";
    private const string AnswersMissing = "Es fehlen die Antworten.";
    private const string AlreadyAnswered = "Diese Antwort ist schon angekommen. Starte eine neue Runde, um weiterzulernen.";
    private const int MaxSessionSize = 50;

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
        if (request.Size is < 1 or > MaxSessionSize)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["size"] = [SizeInvalid] });
        }

        if (!MayActFor(http, request.LearnerId, out IResult denied))
        {
            return denied;
        }

        SessionView? view = await learning.StartSessionAsync(
            request.LearnerId, request.SetId, request.GameKey ?? GameCatalog.Classic, request.Size, ct);
        if (view is null)
        {
            return NotFound(ChildGone);
        }

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
            return NotFound(SessionGone);
        }

        if (!MayActFor(http, learnerId, out IResult denied))
        {
            return denied;
        }

        try
        {
            AnswerResult? result = await learning.SubmitAnswerAsync(
                learnerId, sessionId, request.ItemId, request.GivenAnswer,
                request.AnswerMs, request.ClientAnswerId, request.HintUsed, ct);

            return result is null ? NotFound(CardGone) : Results.Ok(result);
        }
        catch (DbUpdateException conflict) when (IsDuplicateAnswer(conflict))
        {
            return Conflict();
        }
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
            return NotFound(SessionGone);
        }

        if (!MayActFor(http, learnerId, out IResult denied))
        {
            return denied;
        }

        SessionSummary? summary = await learning.CompleteSessionAsync(learnerId, sessionId, ct);
        return summary is null ? NotFound(SessionGone) : Results.Ok(summary);
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
        if (request.Answers is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["answers"] = [AnswersMissing] });
        }

        Guid learnerId = await ResolveLearnerAsync(db, request.SessionId, ct);
        if (learnerId == Guid.Empty)
        {
            return NotFound(SessionGone);
        }

        if (!MayActFor(http, learnerId, out IResult denied))
        {
            return denied;
        }

        // Vor dem ersten Schreiben pruefen, damit ein Batch mit fremder Aufgabe
        // nichts halb speichert.
        List<Guid> itemIds = request.Answers.Select(a => a.ItemId).Distinct().ToList();
        int known = await db.SessionItems
            .CountAsync(i => i.SessionId == request.SessionId && itemIds.Contains(i.Id), ct);
        if (known != itemIds.Count)
        {
            return NotFound(CardGone);
        }

        try
        {
            int accepted = 0;
            foreach (SubmitAnswerRequest answer in request.Answers)
            {
                AnswerResult? result = await learning.SubmitAnswerAsync(
                    learnerId, request.SessionId, answer.ItemId, answer.GivenAnswer,
                    answer.AnswerMs, answer.ClientAnswerId, answer.HintUsed, ct);
                if (result is null)
                {
                    return NotFound(CardGone);
                }

                accepted++;
            }

            SessionSummary? summary = await learning.CompleteSessionAsync(learnerId, request.SessionId, ct);
            return summary is null
                ? NotFound(SessionGone)
                : Results.Ok(new { accepted, summary });
        }
        catch (DbUpdateException conflict) when (IsDuplicateAnswer(conflict))
        {
            return Conflict();
        }
    }

    private static IResult NotFound(string detail) =>
        Results.Problem(title: NotFoundTitle, detail: detail, statusCode: StatusCodes.Status404NotFound);

    private static IResult Conflict() =>
        Results.Problem(title: "Schon beantwortet", detail: AlreadyAnswered, statusCode: StatusCodes.Status409Conflict);

    /// <summary>
    /// Doppel-Antwort: Eine gleichzeitige Antwort hat die Aufgabe schon gewertet
    /// (Concurrency-Token AnsweredAt), den Lernstand der neuen Karte schon
    /// angelegt (Primaerschluessel review_state) oder die Antwort-Id schon
    /// verbraucht (Unique-Index client_answer_id).
    /// </summary>
    private static bool IsDuplicateAnswer(DbUpdateException exception) =>
        exception is DbUpdateConcurrencyException
        || exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

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
                detail: "Dieses Profil gehört jemand anderem.",
                statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        denied = Results.Empty;
        return true;
    }
}
