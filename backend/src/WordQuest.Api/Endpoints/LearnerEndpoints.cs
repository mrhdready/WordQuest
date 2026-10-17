using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Auth;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Gamification.Services;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;
using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;

namespace WordQuest.Api.Endpoints;

public static class LearnerEndpoints
{
    public static void MapLearnerEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/v1/learners")
            .WithTags("Learners")
            .RequireAuthorization();

        group.MapGet("/", ListAsync).RequireAuthorization("Guardian");
        group.MapPost("/", CreateAsync).RequireAuthorization("Guardian");
        group.MapPatch("/{learnerId:guid}/settings", UpdateSettingsAsync).RequireAuthorization("Guardian");
        group.MapDelete("/{learnerId:guid}", DeleteAsync).RequireAuthorization("Guardian");

        group.MapGet("/{learnerId:guid}/overview", OverviewAsync);
        group.MapGet("/{learnerId:guid}/traffic-light", TrafficLightAsync).RequireAuthorization("Guardian");
    }

    private static async Task<IResult> ListAsync(WordQuestDbContext db, CancellationToken ct)
    {
        List<LearnerDto> learners = await db.LearnerProfiles
            .OrderBy(p => p.User!.DisplayName)
            .Select(p => new LearnerDto(
                p.Id, p.User!.DisplayName, p.AvatarKey, p.DailyNewLimit,
                p.Speed.ToString(), p.SoundEnabled, p.PinHash != null))
            .ToListAsync(ct);

        return Results.Ok(learners);
    }

    private static async Task<IResult> CreateAsync(
        CreateLearnerRequest request,
        WordQuestDbContext db,
        HttpContext http,
        CancellationToken ct)
    {
        IReadOnlyList<LearnerProfileProblem> problems = AccountRules.ValidateLearnerProfile(
            request.DisplayName, nameRequired: true, request.Pin, pinRequired: true, request.AvatarKey);
        if (problems.Count > 0)
        {
            return ValidationProblem(problems);
        }

        Guid tenantId = http.User.TenantId();

        var user = new User
        {
            TenantId = tenantId,
            Role = UserRole.Learner,
            DisplayName = request.DisplayName.Trim(),
        };

        var profile = new LearnerProfile
        {
            Id = user.Id,
            TenantId = tenantId,
            AvatarKey = string.IsNullOrWhiteSpace(request.AvatarKey) ? "fox" : request.AvatarKey.Trim(),
            PinHash = PasswordHasher.Hash(request.Pin!),
        };
        if (request.DailyNewLimit is { } limit)
        {
            profile.DailyNewLimit = AccountRules.ClampDailyNewLimit(limit);
        }

        db.Users.Add(user);
        db.LearnerProfiles.Add(profile);
        db.GamificationProfiles.Add(new GamificationProfile { Id = user.Id, TenantId = tenantId });

        await db.SaveChangesAsync(ct);

        return Results.Created(
            $"/api/v1/learners/{user.Id}",
            new LearnerDto(user.Id, user.DisplayName, profile.AvatarKey, profile.DailyNewLimit,
                profile.Speed.ToString(), profile.SoundEnabled, profile.PinHash != null));
    }

    private static async Task<IResult> UpdateSettingsAsync(
        Guid learnerId,
        UpdateLearnerSettingsRequest request,
        WordQuestDbContext db,
        AccountService accounts,
        CancellationToken ct)
    {
        LearnerProfile? profile = await db.LearnerProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == learnerId, ct);

        if (profile is null)
        {
            // Mit Text: die Bearbeiten-Seite eines in einem anderen Tab geloeschten Kindes zeigt ihn an.
            return Results.Problem(
                title: "Nicht gefunden",
                detail: "Dieses Kind gibt es nicht (mehr).",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Alles pruefen, bevor etwas zugewiesen wird: eine abgelehnte Anfrage aendert nichts.
        IReadOnlyList<LearnerProfileProblem> problems = AccountRules.ValidateLearnerProfile(
            request.DisplayName, nameRequired: false, request.Pin, pinRequired: profile.PinHash is null);
        if (problems.Count > 0)
        {
            return ValidationProblem(problems);
        }

        if (request.DisplayName is not null)
        {
            profile.User!.DisplayName = request.DisplayName.Trim();
        }

        if (request.DailyNewLimit is { } limit)
        {
            profile.DailyNewLimit = AccountRules.ClampDailyNewLimit(limit);
        }

        if (request.Speed is not null && Enum.TryParse(request.Speed, true, out GameSpeed speed))
        {
            profile.Speed = speed;
        }

        if (request.SoundEnabled is { } sound)
        {
            profile.SoundEnabled = sound;
        }

        // Leer heisst "PIN unveraendert"; eine neue PIN hebt eine Sperre sofort auf
        // und meldet alle Geraete ab, die sich mit der alten angemeldet haben (WR-01).
        if (!string.IsNullOrEmpty(request.Pin))
        {
            profile.PinHash = PasswordHasher.Hash(request.Pin);
            profile.FailedPinAttempts = 0;
            profile.PinLockedUntil = null;
            await accounts.MarkRefreshTokensRevokedAsync(profile.Id, ct);
        }

        await db.SaveChangesAsync(ct);

        return Results.Ok(new LearnerDto(
            profile.Id, profile.User!.DisplayName, profile.AvatarKey, profile.DailyNewLimit,
            profile.Speed.ToString(), profile.SoundEnabled, profile.PinHash != null));
    }

    // Feldtexte fuer POST und PATCH; die Regeln selbst stehen allein in AccountRules.
    // Je Feld hoechstens ein Befund: Fehlen und Ungueltigkeit schliessen sich aus.
    private static IResult ValidationProblem(IReadOnlyList<LearnerProfileProblem> problems) =>
        Results.ValidationProblem(problems
            .Select(problem => problem switch
            {
                LearnerProfileProblem.NameMissing => (Field: "displayName", Message: "Wie soll das Kind heißen? Ein Spitzname genügt."),
                LearnerProfileProblem.NameTooLong => (Field: "displayName", Message: $"Der Name darf höchstens {AccountRules.MaxDisplayNameLength} Zeichen lang sein."),
                LearnerProfileProblem.PinMissing => (Field: "pin", Message: "Bitte gib eine PIN mit 4 bis 6 Ziffern ein."),
                LearnerProfileProblem.PinInvalid => (Field: "pin", Message: "Die PIN muss aus 4 bis 6 Ziffern bestehen."),
                LearnerProfileProblem.AvatarKeyTooLong => (Field: "avatarKey", Message: $"Das Bild darf höchstens {AccountRules.MaxAvatarKeyLength} Zeichen lang sein."),
                _ => throw new UnreachableException($"Unbekannter Befund {problem}."),
            })
            .ToDictionary(error => error.Field, error => new[] { error.Message }));

    /// <summary>
    /// Loescht ein Kind endgueltig (PAR-03, D-07). Der Code loescht nur das
    /// Konto; Profil, Lernstand, Protokoll, Runden, XP/Serie und Anmeldungen
    /// entfernt die Datenbank ueber die Fremdschluessel (AGENTS.md, D-06).
    /// Der Mandantenfilter macht Kinder anderer Familien unsichtbar, die
    /// Rollenbedingung schuetzt Elternkonten.
    /// </summary>
    private static async Task<IResult> DeleteAsync(Guid learnerId, WordQuestDbContext db, CancellationToken ct)
    {
        int deleted = await db.Users
            .Where(u => u.Id == learnerId && u.Role == UserRole.Learner)
            .ExecuteDeleteAsync(ct);

        return deleted == 0
            ? Results.Problem(
                title: "Nicht gefunden",
                detail: "Dieses Kind gibt es nicht (mehr).",
                statusCode: StatusCodes.Status404NotFound)
            : Results.NoContent();
    }

    private static async Task<IResult> OverviewAsync(
        Guid learnerId,
        WordQuestDbContext db,
        Sm2Scheduler scheduler,
        TimeProvider clock,
        HttpContext http,
        CancellationToken ct)
    {
        if (http.User.IsLearner() && http.User.UserId() != learnerId)
        {
            return Results.Forbid();
        }

        LearnerProfile? profile = await db.LearnerProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == learnerId, ct);

        if (profile is null)
        {
            // Das Kind wurde geloescht, das Geraet ist noch angemeldet (FIX-04, D-11).
            return Results.Problem(
                title: "Nicht gefunden",
                detail: "Dieses Profil gibt es nicht mehr. Bitte melde dich ab.",
                statusCode: StatusCodes.Status404NotFound);
        }

        GamificationProfile gamification =
            await db.GamificationProfiles.FirstOrDefaultAsync(g => g.Id == learnerId, ct)
            ?? new GamificationProfile { Id = learnerId };

        DateTimeOffset now = clock.GetUtcNow();
        DateTimeOffset dayStart = scheduler.StartOfLocalDay(now);

        // Dieselben Mengen und dieselbe Budgetregel wie LearningService.StartSessionAsync:
        // faellig sind nur Wiederholung und Neulernen, eingefuehrt ist eine
        // neue Karte erst mit ihrer ersten Antwort (FIX-09).
        int dueToday = await db.ReviewStates.CountAsync(
            r => r.LearnerId == learnerId
                 && (r.State == ReviewCardState.Review || r.State == ReviewCardState.Relearning)
                 && r.DueAt <= now, ct);

        int introducedToday = await db.ReviewStates.CountAsync(
            r => r.LearnerId == learnerId
                 && r.LastReviewedAt != null
                 && r.FirstSeenAt >= dayStart, ct);

        // Woerter, nicht Karten, mit derselben Regel wie die Ampel (FIX-06, D-16).
        List<WordStates> words = await WordStatesAsync(db, learnerId, setId: null, ct);

        return Results.Ok(new LearnerOverviewDto(
            LearnerId: learnerId,
            DisplayName: profile.User!.DisplayName,
            Xp: gamification.Xp,
            Level: LevelCurve.LevelFor(gamification.Xp),
            LevelProgress: LevelCurve.ProgressInLevel(gamification.Xp),
            XpToNextLevel: LevelCurve.XpToNextLevel(gamification.Xp),
            Coins: gamification.Coins,
            Streak: StreakRules.CurrentStreak(gamification, scheduler.LocalDate(now)),
            DueToday: dueToday,
            NewRemainingToday: Math.Max(0, profile.DailyNewLimit - introducedToday),
            // Die Feldnamen bleiben (U7), gezaehlt werden Woerter.
            CardsMastered: words.Count(w => MasteryRules.IsWordMastered(w.States)),
            CardsTotal: words.Count));
    }

    /// <summary>
    /// Ampel je Vokabelpaar, aggregiert ueber beide Abfragerichtungen
    /// (Konzept §9). Gruen erfordert, dass BEIDE Richtungen sitzen — sonst
    /// meldet das Dashboard Sicherheit, die es nicht gibt.
    /// </summary>
    private static async Task<IResult> TrafficLightAsync(
        Guid learnerId,
        Guid? setId,
        WordQuestDbContext db,
        CancellationToken ct)
    {
        List<TrafficLightDto> result = (await WordStatesAsync(db, learnerId, setId, ct))
            .Select(w =>
            {
                bool anySeen = w.States.Any(state => state is not null);
                int lapses = w.States.Max(state => state?.Lapses ?? 0);
                double worstEase = w.States.Min(state => state?.EaseFactor ?? 2.5);

                string status =
                    !anySeen ? "new"
                    : lapses >= 3 || worstEase < 1.8 ? "red"
                    : MasteryRules.IsWordMastered(w.States) ? "green"
                    : "yellow";

                return new TrafficLightDto(w.EntryId, w.SourceText, w.TargetText, status, lapses, worstEase);
            })
            .OrderBy(r => r.Status switch { "red" => 0, "yellow" => 1, "new" => 2, _ => 3 })
            .ThenBy(r => r.SourceText)
            .ToList();

        return Results.Ok(result);
    }

    /// <summary>
    /// Je Wort die Lernstaende seiner Karten (beide Richtungen), ohne Lernstand
    /// <c>null</c>. Nie beantwortete Lernstaende (Altbestand aus dem frueheren
    /// Rundenstart) gelten als neu, wie beim Tagesbudget (FIX-09).
    /// </summary>
    private static async Task<List<WordStates>> WordStatesAsync(
        WordQuestDbContext db, Guid learnerId, Guid? setId, CancellationToken ct)
    {
        var cards = await db.Cards
            .Where(c => setId == null || c.Entry!.SetId == setId)
            .Select(c => new { c.Id, c.EntryId, c.Entry!.SourceText, c.Entry.TargetText })
            .ToListAsync(ct);

        Dictionary<Guid, ReviewState> states = await db.ReviewStates
            .AsNoTracking()
            .Where(r => r.LearnerId == learnerId && r.LastReviewedAt != null)
            .ToDictionaryAsync(r => r.CardId, ct);

        return cards
            .GroupBy(c => new { c.EntryId, c.SourceText, c.TargetText })
            .Select(g => new WordStates(
                g.Key.EntryId, g.Key.SourceText, g.Key.TargetText,
                g.Select(c => states.GetValueOrDefault(c.Id)).ToList()))
            .ToList();
    }

    private sealed record WordStates(Guid EntryId, string SourceText, string TargetText, IReadOnlyList<ReviewState?> States);
}
