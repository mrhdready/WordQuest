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
        if (string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["displayName"] = ["Wie soll das Kind heissen? Ein Spitzname genuegt."],
            });
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
            PinHash = string.IsNullOrWhiteSpace(request.Pin) ? null : PasswordHasher.Hash(request.Pin),
        };

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
        CancellationToken ct)
    {
        LearnerProfile? profile = await db.LearnerProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == learnerId, ct);

        if (profile is null)
        {
            return Results.NotFound();
        }

        if (request.DailyNewLimit is { } limit)
        {
            // Gedeckelt, weil ein zu hoher Wert in den Folgetagen eine
            // Wiederholungslawine erzeugt (Konzept §6.3).
            profile.DailyNewLimit = Math.Clamp(limit, 3, 15);
        }

        if (request.Speed is not null && Enum.TryParse(request.Speed, true, out GameSpeed speed))
        {
            profile.Speed = speed;
        }

        if (request.SoundEnabled is { } sound)
        {
            profile.SoundEnabled = sound;
        }

        if (!string.IsNullOrWhiteSpace(request.Pin))
        {
            profile.PinHash = PasswordHasher.Hash(request.Pin);
            profile.FailedPinAttempts = 0;
            profile.PinLockedUntil = null;
        }

        await db.SaveChangesAsync(ct);

        return Results.Ok(new LearnerDto(
            profile.Id, profile.User!.DisplayName, profile.AvatarKey, profile.DailyNewLimit,
            profile.Speed.ToString(), profile.SoundEnabled, profile.PinHash != null));
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
            return Results.NotFound();
        }

        GamificationProfile gamification =
            await db.GamificationProfiles.FirstOrDefaultAsync(g => g.Id == learnerId, ct)
            ?? new GamificationProfile { Id = learnerId };

        DateTimeOffset now = clock.GetUtcNow();
        DateTimeOffset dayStart = scheduler.StartOfLocalDay(now);

        int dueToday = await db.ReviewStates.CountAsync(
            r => r.LearnerId == learnerId
                 && r.State != ReviewCardState.Suspended
                 && r.DueAt <= now, ct);

        int introducedToday = await db.ReviewStates.CountAsync(
            r => r.LearnerId == learnerId && r.FirstSeenAt >= dayStart, ct);

        int mastered = await db.ReviewStates.CountAsync(
            r => r.LearnerId == learnerId
                 && r.Repetitions >= 3
                 && r.EaseFactor >= 2.1
                 && r.Lapses <= 1, ct);

        int total = await db.Cards.CountAsync(ct);

        return Results.Ok(new LearnerOverviewDto(
            LearnerId: learnerId,
            DisplayName: profile.User!.DisplayName,
            Xp: gamification.Xp,
            Level: LevelCurve.LevelFor(gamification.Xp),
            LevelProgress: LevelCurve.ProgressInLevel(gamification.Xp),
            XpToNextLevel: LevelCurve.XpToNextLevel(gamification.Xp),
            Coins: gamification.Coins,
            Streak: gamification.CurrentStreak,
            DueToday: dueToday,
            NewRemainingToday: Math.Max(0, profile.DailyNewLimit - introducedToday),
            CardsMastered: mastered,
            CardsTotal: total));
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
        var rows = await db.Cards
            .Where(c => setId == null || c.Entry!.SetId == setId)
            .Select(c => new
            {
                c.EntryId,
                c.Entry!.SourceText,
                c.Entry.TargetText,
                State = db.ReviewStates
                    .Where(r => r.LearnerId == learnerId && r.CardId == c.Id)
                    .Select(r => new { r.Repetitions, r.EaseFactor, r.Lapses })
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        List<TrafficLightDto> result = rows
            .GroupBy(r => new { r.EntryId, r.SourceText, r.TargetText })
            .Select(g =>
            {
                bool anySeen = g.Any(x => x.State is not null);
                int lapses = g.Max(x => x.State?.Lapses ?? 0);
                double worstEase = g.Min(x => x.State?.EaseFactor ?? 2.5);
                bool allMastered = g.All(x =>
                    x.State is not null
                    && x.State.Repetitions >= 3
                    && x.State.EaseFactor >= 2.1
                    && x.State.Lapses <= 1);

                string status =
                    !anySeen ? "new"
                    : lapses >= 3 || worstEase < 1.8 ? "red"
                    : allMastered ? "green"
                    : "yellow";

                return new TrafficLightDto(
                    g.Key.EntryId, g.Key.SourceText, g.Key.TargetText, status, lapses, worstEase);
            })
            .OrderBy(r => r.Status switch { "red" => 0, "yellow" => 1, "new" => 2, _ => 3 })
            .ThenBy(r => r.SourceText)
            .ToList();

        return Results.Ok(result);
    }
}
