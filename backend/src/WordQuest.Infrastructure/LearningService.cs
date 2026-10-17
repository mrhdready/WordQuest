using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Gamification.Services;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Learning.Entities;
using WordQuest.Modules.Learning.Services;
using WordQuest.Shared.Kernel;

namespace WordQuest.Infrastructure;

/// <summary>
/// Orchestriert eine Lernsession: Auswahl, Bewertung, Terminierung,
/// Protokollierung und Belohnung.
///
/// Die eigentlichen Regeln liegen in den reinen Klassen des Learning- und
/// Gamification-Moduls. Hier steht nur, was dafuer aus der Datenbank kommt
/// und was zurueckgeschrieben wird.
/// </summary>
public sealed class LearningService(
    WordQuestDbContext db,
    Sm2Scheduler scheduler,
    SessionComposer composer,
    AnswerEvaluator evaluator,
    TimeProvider clock)
{
    private const int MaxChoices = 4;

    /// <summary>Startet eine Runde; <c>null</c>, wenn es das Lernprofil nicht (mehr) gibt.</summary>
    public async Task<SessionView?> StartSessionAsync(
        Guid learnerId,
        Guid? setId,
        string gameKey,
        int? size,
        CancellationToken ct = default)
    {
        DateTimeOffset now = clock.GetUtcNow();
        GameDefinition game = GameCatalog.Get(gameKey);

        LearnerProfile? profile = await db.LearnerProfiles
            .FirstOrDefaultAsync(p => p.Id == learnerId, ct);
        if (profile is null)
        {
            return null;
        }

        IQueryable<Card> cardsInScope = CardsInScope(setId);

        // 1. Fehler aus vorherigen Sessions, die noch in Relearning stehen.
        List<SessionCandidate> relearning = await db.ReviewStates
            .Where(r => r.LearnerId == learnerId
                        && r.State == ReviewCardState.Relearning
                        && r.DueAt <= now)
            .OrderBy(r => r.DueAt)
            .Select(r => new SessionCandidate(r.CardId, r.State, r.DueAt))
            .Take(50)
            .ToListAsync(ct);

        // 2. Faellige Wiederholungen.
        List<SessionCandidate> due = await db.ReviewStates
            .Where(r => r.LearnerId == learnerId
                        && r.State == ReviewCardState.Review
                        && r.DueAt <= now)
            .OrderBy(r => r.DueAt)
            .Select(r => new SessionCandidate(r.CardId, r.State, r.DueAt))
            .Take(scheduler.Options.MaxDuePerSession * 2)
            .ToListAsync(ct);

        // 3. Neue Karten, begrenzt durch das Tagesbudget. Eingefuehrt ist eine
        // Karte erst mit ihrer ersten Antwort (FIX-09, Konzept §6.3): Ansehen
        // ohne Antwort kostet nichts. Dieselbe Regel zaehlt die Uebersicht
        // (LearnerEndpoints.OverviewAsync).
        DateTimeOffset dayStart = scheduler.StartOfLocalDay(now);
        int introducedToday = await db.ReviewStates
            .CountAsync(r => r.LearnerId == learnerId
                             && r.LastReviewedAt != null
                             && r.FirstSeenAt >= dayStart, ct);

        int newBudget = Math.Max(0, profile.DailyNewLimit - introducedToday);

        List<SessionCandidate> fresh = [];
        if (newBudget > 0)
        {
            // Lernstaende im Zustand New sind nie regulaer beantwortet worden
            // (Altbestand aus dem frueheren Start oder nur im Cram-Modus
            // geuebt). Sie bleiben neue Karten und kommen wieder (FIX-03).
            IQueryable<Guid> alreadySeen = db.ReviewStates
                .Where(r => r.LearnerId == learnerId && r.State != ReviewCardState.New)
                .Select(r => r.CardId);

            fresh = await cardsInScope
                .Where(c => !alreadySeen.Contains(c.Id))
                // Rezeption zuerst: "dog → Hund" wird deutlich frueher
                // beherrscht als "Hund → dog" und ist der sanftere Einstieg
                // in ein neues Wort.
                .OrderBy(c => c.Direction == CardDirection.TargetToSource ? 0 : 1)
                .ThenBy(c => c.Entry!.Position)
                // Eindeutiger Gleichstandsbrecher: Ohne Set teilen sich Karten
                // verschiedener Sets dieselbe Position, und PostgreSQL garantiert
                // dann keine feste Reihenfolge. Die naechste Runde soll dieselben
                // neuen Karten anbieten (FIX-03).
                .ThenBy(c => c.Id)
                .Take(newBudget)
                .Select(c => new SessionCandidate(c.Id, ReviewCardState.New, now))
                .ToListAsync(ct);
        }

        IReadOnlyList<SessionCandidate> selected =
            composer.Compose(relearning, due, fresh, newBudget, now, size);

        var session = new LearningSession
        {
            LearnerId = learnerId,
            SetId = setId,
            GameKey = game.Key,
            StartedAt = now,
        };

        int position = 0;
        foreach (SessionCandidate candidate in selected)
        {
            session.Items.Add(new SessionItem
            {
                SessionId = session.Id,
                CardId = candidate.CardId,
                Position = position++,
                IsRetry = candidate.State == ReviewCardState.Relearning,
            });
        }

        db.LearningSessions.Add(session);
        await db.SaveChangesAsync(ct);

        List<SessionItemView> views = await BuildItemViewsAsync(session.Items, game, ct);
        return new SessionView(session.Id, game.Key, views.Count, views);
    }

    /// <summary>
    /// Wertet eine Antwort; <c>null</c>, wenn Runde, Aufgabe oder Karte nicht
    /// (mehr) existieren. Eine gleichzeitige zweite Antwort auf dieselbe
    /// Aufgabe endet in einer <see cref="DbUpdateException"/> (Concurrency-Token
    /// AnsweredAt bzw. Unique-Index), ohne dass etwas gespeichert wird.
    /// </summary>
    public async Task<AnswerResult?> SubmitAnswerAsync(
        Guid learnerId,
        Guid sessionId,
        Guid itemId,
        string? givenAnswer,
        int answerMs,
        Guid? clientAnswerId,
        bool hintUsed,
        CancellationToken ct = default)
    {
        DateTimeOffset now = clock.GetUtcNow();

        LearningSession? session = await db.LearningSessions
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.LearnerId == learnerId, ct);
        SessionItem? item = session?.Items.FirstOrDefault(i => i.Id == itemId);
        if (session is null || item is null)
        {
            return null;
        }

        GameDefinition game = GameCatalog.Get(session.GameKey);

        // Die Karte kann waehrend der Runde geloescht worden sein (Eintrag entfernt).
        Card? card = await db.Cards
            .Include(c => c.Entry)
            .FirstOrDefaultAsync(c => c.Id == item.CardId, ct);
        if (card is null)
        {
            return null;
        }

        ExpectedAnswer expected = BuildExpectedAnswer(card);

        // Bereits beantwortet? Dann ist das ein Wiedereinspielen derselben
        // Offline-Antwort - Ergebnis unveraendert zurueckgeben, nichts doppelt
        // werten (Konzept §13).
        if (item.AnsweredAt is not null)
        {
            return new AnswerResult(
                Correct: item.Grade != Grade.Again,
                Grade: item.Grade ?? Grade.Again,
                CorrectAnswer: expected.Primary,
                Message: null,
                HadTypo: false,
                XpAwarded: 0,
                CoinsAwarded: 0,
                RetryItem: null);
        }

        AnswerEvaluation evaluation = evaluator.Evaluate(givenAnswer, expected, answerMs, hintUsed);
        Grade grade = GameCatalog.Cap(game.Key, evaluation.Grade);

        item.AnsweredAt = now;
        item.Grade = grade;
        item.GivenAnswer = Truncate(givenAnswer, 300);
        item.AnswerMs = answerMs;
        item.ClientAnswerId = clientAnswerId;

        // Die erste Antwort legt den Lernstand an; beim Start entsteht keiner mehr (FIX-03).
        ReviewState? state = await db.ReviewStates
            .FirstOrDefaultAsync(r => r.LearnerId == learnerId && r.CardId == card.Id, ct);
        if (state is null)
        {
            state = CreateInitialState(learnerId, card.Id, now);
            db.ReviewStates.Add(state);
        }

        // Die erste Antwort ist der Zeitpunkt der Einfuehrung, auch fuer
        // Altbestaende, die beim frueheren Start angelegt wurden (FIX-09).
        if (state.LastReviewedAt is null)
        {
            state.FirstSeenAt = now;
        }

        double resultingInterval = state.IntervalDays;
        if (game.AffectsScheduling)
        {
            ReviewOutcome outcome = scheduler.Apply(state, grade, now);
            resultingInterval = outcome.IntervalDays;
        }
        else
        {
            state.LastReviewedAt = now;
        }

        db.ReviewLogs.Add(new ReviewLog
        {
            LearnerId = learnerId,
            CardId = card.Id,
            SessionId = session.Id,
            GameKey = game.Key,
            Grade = grade,
            AnswerMs = answerMs,
            GivenAnswer = Truncate(givenAnswer, 300),
            ResultingIntervalDays = resultingInterval,
            ReviewedAt = now,
        });

        (int xp, int coins) = XpRules.ForAnswer(grade, game.XpWeight);
        await GetOrCreateProfileAsync(learnerId, ct);

        // Falsch beantwortete Karte in derselben Session nachreichen.
        SessionItemView? retryView = null;
        if (grade == Grade.Again && game.AffectsScheduling)
        {
            var retry = new SessionItem
            {
                SessionId = session.Id,
                CardId = card.Id,
                Position = session.Items.Count == 0 ? 0 : session.Items.Max(i => i.Position) + 1,
                IsRetry = true,
            };
            // Ausdruecklich als neu registrieren: Die Id ist schon gesetzt,
            // ueber die Navigation allein haelt EF die Zeile fuer bestehend
            // und schickt ein UPDATE statt eines INSERT.
            db.SessionItems.Add(retry);

            retryView = BuildItemView(retry, card, game, await BuildChoicesAsync(card, game, ct));
        }

        // Aufgabe, Lernstand, Protokoll und Gutschrift gehoeren zusammen: Ein
        // Konflikt beim Speichern bricht vor der Gutschrift ab und rollt alles zurueck.
        await InTransactionAsync(async () =>
        {
            await db.SaveChangesAsync(acceptAllChangesOnSuccess: false, ct);
            await CreditAsync(sessionId, learnerId, xp, coins, ct);
        }, ct);

        return new AnswerResult(
            Correct: evaluation.IsCorrect,
            Grade: grade,
            CorrectAnswer: expected.Primary,
            Message: evaluation.Hint,
            HadTypo: evaluation.HadTypo,
            XpAwarded: xp,
            CoinsAwarded: coins,
            RetryItem: retryView);
    }

    /// <summary>Schliesst eine Runde ab; <c>null</c>, wenn es die Runde nicht (mehr) gibt.</summary>
    public async Task<SessionSummary?> CompleteSessionAsync(
        Guid learnerId, Guid sessionId, CancellationToken ct = default)
    {
        DateTimeOffset now = clock.GetUtcNow();

        LearningSession? session = await db.LearningSessions
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.LearnerId == learnerId, ct);
        if (session is null)
        {
            return null;
        }

        GamificationProfile profile = await GetOrCreateProfileAsync(learnerId, ct);
        int levelBefore = LevelCurve.LevelFor(profile.Xp);

        int answered = session.Items.Count(i => i.AnsweredAt is not null);
        int correct = session.Items.Count(i => i.Grade is not null and not Grade.Again);

        var streak = new StreakResult(profile.CurrentStreak, false, false, false);
        (int bonusXp, int bonusCoins) = XpRules.ForSessionCompletion(answered, correct);

        // Den Abschluss atomar beanspruchen: Von zwei gleichzeitigen
        // Abschluessen findet nur einer die Runde noch offen; nur er vergibt
        // Bonus und Serie (Review Runde 1).
        await InTransactionAsync(async () =>
        {
            int claimed = await db.LearningSessions
                .Where(s => s.Id == sessionId && s.CompletedAt == null)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.CompletedAt, now), ct);

            if (claimed == 1)
            {
                if (answered > 0)
                {
                    // RegisterActivity ist am selben Tag idempotent, ein Wiederholungslauf
                    // der Ausfuehrungsstrategie zaehlt die Serie also nicht doppelt.
                    streak = StreakRules.RegisterActivity(profile, scheduler.LocalDate(now));
                }

                await db.SaveChangesAsync(acceptAllChangesOnSuccess: false, ct);
                await CreditAsync(sessionId, learnerId, bonusXp, bonusCoins, ct);
            }
        }, ct);

        // Zaehler stehen nach der Gutschrift nur in der Datenbank richtig.
        await db.Entry(session).ReloadAsync(ct);
        await db.Entry(profile).ReloadAsync(ct);

        int level = LevelCurve.LevelFor(profile.Xp);

        return new SessionSummary(
            SessionId: session.Id,
            Answered: answered,
            Correct: correct,
            XpAwarded: session.XpAwarded,
            CoinsAwarded: session.CoinsAwarded,
            TotalXp: profile.Xp,
            Level: level,
            LevelProgress: LevelCurve.ProgressInLevel(profile.Xp),
            XpToNextLevel: LevelCurve.XpToNextLevel(profile.Xp),
            Coins: profile.Coins,
            Streak: profile.CurrentStreak,
            StreakSaverUsed: streak.SaverUsed,
            LeveledUp: level > levelBefore);
    }

    // ------------------------------------------------------------------ Hilfen

    private IQueryable<Card> CardsInScope(Guid? setId)
    {
        IQueryable<Card> query = db.Cards;
        return setId is null ? query : query.Where(c => c.Entry!.SetId == setId);
    }

    private ReviewState CreateInitialState(Guid learnerId, Guid cardId, DateTimeOffset now) =>
        new()
        {
            LearnerId = learnerId,
            CardId = cardId,
            EaseFactor = scheduler.Options.InitialEaseFactor,
            DueAt = now,
            FirstSeenAt = now,
            State = ReviewCardState.New,
        };

    /// <summary>
    /// Fuehrt <paramref name="work"/> in einer Transaktion aus. Wegen
    /// EnableRetryOnFailure muss die Transaktion in der Ausfuehrungsstrategie
    /// laufen; SaveChanges darin mit acceptAllChangesOnSuccess: false, damit ein
    /// Wiederholungslauf dieselben Aenderungen noch einmal schreibt.
    /// </summary>
    private async Task InTransactionAsync(Func<Task> work, CancellationToken ct)
    {
        IExecutionStrategy strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using IDbContextTransaction transaction = await db.Database.BeginTransactionAsync(ct);
            await work();
            await transaction.CommitAsync(ct);
        });
        db.ChangeTracker.AcceptAllChanges();
    }

    /// <summary>
    /// Schreibt XP und Muenzen als wert = wert + n gut, nie als gelesener Wert
    /// plus n: Gleichzeitige Antworten auf verschiedene Aufgaben derselben Runde
    /// schreiben dieselben Zeilen, und Lesen-Addieren-Schreiben verliert dabei
    /// eine Gutschrift (Review Runde 1).
    /// </summary>
    private async Task CreditAsync(Guid sessionId, Guid learnerId, int xp, int coins, CancellationToken ct)
    {
        if (xp == 0 && coins == 0)
        {
            return;
        }

        await db.LearningSessions
            .Where(s => s.Id == sessionId)
            .ExecuteUpdateAsync(u => u
                .SetProperty(s => s.XpAwarded, s => s.XpAwarded + xp)
                .SetProperty(s => s.CoinsAwarded, s => s.CoinsAwarded + coins), ct);

        await db.GamificationProfiles
            .Where(p => p.Id == learnerId)
            .ExecuteUpdateAsync(u => u
                .SetProperty(p => p.Xp, p => p.Xp + xp)
                .SetProperty(p => p.Coins, p => p.Coins + coins), ct);
    }

    private async Task<GamificationProfile> GetOrCreateProfileAsync(Guid learnerId, CancellationToken ct)
    {
        GamificationProfile? profile = await db.GamificationProfiles
            .FirstOrDefaultAsync(p => p.Id == learnerId, ct);

        if (profile is null)
        {
            profile = new GamificationProfile { Id = learnerId };
            db.GamificationProfiles.Add(profile);
        }

        return profile;
    }

    private static ExpectedAnswer BuildExpectedAnswer(Card card)
    {
        VocabularyEntry entry = card.Entry
            ?? throw new InvalidOperationException("Karte ohne Vokabeleintrag.");

        return card.Direction switch
        {
            CardDirection.SourceToTarget => new ExpectedAnswer(entry.TargetText, entry.TargetAlternatives),
            _ => new ExpectedAnswer(entry.SourceText, entry.SourceAlternatives),
        };
    }

    private async Task<List<SessionItemView>> BuildItemViewsAsync(
        List<SessionItem> items, GameDefinition game, CancellationToken ct)
    {
        List<Guid> cardIds = items.Select(i => i.CardId).Distinct().ToList();

        Dictionary<Guid, Card> cards = await db.Cards
            .Include(c => c.Entry)
            .Where(c => cardIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        var views = new List<SessionItemView>(items.Count);
        foreach (SessionItem item in items.OrderBy(i => i.Position))
        {
            if (!cards.TryGetValue(item.CardId, out Card? card))
            {
                continue;
            }

            views.Add(BuildItemView(item, card, game, await BuildChoicesAsync(card, game, ct)));
        }

        return views;
    }

    private static SessionItemView BuildItemView(
        SessionItem item, Card card, GameDefinition game, IReadOnlyList<string>? choices)
    {
        VocabularyEntry entry = card.Entry!;

        bool asksForTarget = card.Direction == CardDirection.SourceToTarget;
        string prompt = asksForTarget ? entry.SourceText : entry.TargetText;
        string? example = asksForTarget ? entry.ExampleSource : entry.ExampleTarget;

        string answerType = choices is { Count: > 1 } ? "choice" : "text";

        return new SessionItemView(
            ItemId: item.Id,
            CardId: card.Id,
            Prompt: prompt,
            PromptType: card.Direction == CardDirection.AudioToSource ? "audio" : "text",
            ExpectedAnswerType: answerType,
            Choices: choices,
            Emoji: entry.Emoji,
            ExampleSentence: example,
            IsRetry: item.IsRetry);
    }

    /// <summary>
    /// Erzeugt Antwortoptionen fuer Auswahlspiele. Distraktoren kommen aus
    /// demselben Set und moeglichst derselben Wortart: "Apfel" gegen
    /// apple/orange/banana/pear ist eine Uebung, "Apfel" gegen
    /// apple/school/running/because ist geraten (Konzept §7.1).
    /// </summary>
    private async Task<IReadOnlyList<string>?> BuildChoicesAsync(
        Card card, GameDefinition game, CancellationToken ct)
    {
        if (game.Key == GameCatalog.Classic)
        {
            return null;
        }

        VocabularyEntry entry = card.Entry!;
        bool asksForTarget = card.Direction == CardDirection.SourceToTarget;
        string correct = asksForTarget ? entry.TargetText : entry.SourceText;

        List<string> pool = await db.VocabularyEntries
            .Where(e => e.SetId == entry.SetId
                        && e.Id != entry.Id
                        && e.PartOfSpeech == entry.PartOfSpeech)
            .Select(e => asksForTarget ? e.TargetText : e.SourceText)
            .Take(40)
            .ToListAsync(ct);

        if (pool.Count < MaxChoices - 1)
        {
            // Zu wenig gleichartige Woerter - mit dem Rest des Sets auffuellen.
            List<string> fallback = await db.VocabularyEntries
                .Where(e => e.SetId == entry.SetId && e.Id != entry.Id)
                .Select(e => asksForTarget ? e.TargetText : e.SourceText)
                .Take(40)
                .ToListAsync(ct);

            foreach (string word in fallback.Where(w => !pool.Contains(w)))
            {
                pool.Add(word);
            }
        }

        var choices = new List<string> { correct };
        foreach (string word in pool.OrderBy(_ => Random.Shared.Next()))
        {
            if (choices.Count >= MaxChoices)
            {
                break;
            }

            if (!choices.Contains(word, StringComparer.OrdinalIgnoreCase))
            {
                choices.Add(word);
            }
        }

        return choices.Count < 2 ? null : [.. choices.OrderBy(_ => Random.Shared.Next())];
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
