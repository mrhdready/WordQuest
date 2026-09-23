# Architecture Research

**Domain:** Self-hosted family vocabulary-learning PWA (WordQuest v1.0, brownfield milestone)
**Researched:** 2026-09-24
**Confidence:** HIGH for the integration design, because it comes from reading the code at `4ce32da` + working tree. The framework facts come from official docs, which the research seam rates LOW because they were fetched with webfetch/websearch. Each one is marked where it matters.

## Standard Architecture

### System Overview (target state for v1.0, new parts marked `+`)

```
┌──────────────────────── WordQuest.Api (composition root, thin HTTP) ─────────────────────────┐
│ Pipeline: +ForwardedHeaders → ExceptionHandler(+StatusCodeSelector) → RateLimiter(+split)    │
│           → AuthN/AuthZ(+Owner policy) → endpoints; +/health/live (no checks) +/health/ready │
│                                                                                               │
│ Endpoints: Auth  Learner  Set  Session  +Setup  +Account(password, invites)                   │
│            +Reports  +Privacy(export, delete learner, delete tenant)                          │
│ Auth/:     AuthService (login, PIN, refresh)  +AccountService (setup, password, invite, reset)│
│ +Cli/:     reset-password verb (same binary, exits before Kestrel starts)                     │
└───────────────┬──────────────────────────────────────────────────┬───────────────────────────┘
                ▼                                                  ▼
┌──────────── WordQuest.Infrastructure ─────────────┐   ┌──────── Domain modules (no NuGet) ───────┐
│ WordQuestDbContext (tenant filters, stamping,     │   │ Identity: +GuardianInvite entity         │
│   +cross-module FKs ON DELETE CASCADE,            │──►│ Content:  +VocabularySet.TestDate        │
│   +xmin concurrency tokens)                       │   │ Learning: +Mastery (Expression + fn),     │
│ LearningService (sessions)                        │   │           +TrafficLight, +Readiness      │
│ +ReportingService (history, problem words,        │   │ Gamification: unchanged                  │
│   readiness, notices; read-only)                  │   └───────────────────┬──────────────────────┘
│ +PrivacyService (export JSON, delete learner,     │                       ▼
│   delete tenant)                                  │            WordQuest.Shared.Kernel
│ Migrations (+FK/orphan-cleanup, +xmin, +invite,   │   (+NotFoundException / +DomainRuleException)
│   +test_date)                                     │
└───────────────┬───────────────────────────────────┘
                ▼
         PostgreSQL 17 (single instance, single API replica)

Frontend (React PWA)
  App router ── +/einrichtung (setup wizard, shown when GET /setup/status says needsSetup)
             ── +/einladung#<token> (invite accept)
             ── /lernen/session ─► SessionPage (+session engine) ─► +games/registry.ts ─► Classic | +WordCatcher | +Cram(=Classic UI)
             ── /verwalten/... ─► +Reports pages, +Settings (password, invite, export, delete)
```

### Component Responsibilities

| Component | Owns | Implementation (decision) |
|-----------|------|---------------------------|
| `Api/Endpoints/SetupEndpoints.cs` (new) | `GET /api/v1/setup/status`, `POST /api/v1/setup` | Thin. Delegates to `AccountService.SetupAsync`. Unauthenticated, rate-limited (`auth`). |
| `Api/Auth/AccountService.cs` (new) | First-run setup, password change, invite create/accept, CLI reset | Lives next to `AuthService` because it has to issue tokens (`AuthService.IssueAsync` becomes `internal`), and `JwtTokenService` lives in Api. |
| `Api/Cli/` (new, one file) | `reset-password <email>` verb | Branch in `Program.cs` after migration and before seed/`RunAsync`. Uses the `SystemTenantContext` DbContext that already exists there. |
| `Modules.Identity/Entities/GuardianInvite.cs` (new) | Invite token hash, expiry, accepted-at, role | `ITenantOwned`. Registered in `ApplyTenantFilter`. Token via `TokenHasher.NewToken()/Hash()`. |
| `Modules.Learning/Services/Mastery.cs` (new) | **The** mastery predicate (reps ≥ 3, ease ≥ 2.1, lapses ≤ 1) | Exposes an `Expression<Func<ReviewState,bool>>` for EF, plus a scalar `bool IsMastered(int reps, double ease, int lapses)` for in-memory use. Only BCL types, so the no-NuGet rule holds. |
| `Modules.Learning/Services/TrafficLight.cs`, `Readiness.cs` (new) | Classifying entries red/yellow/green/new, set readiness before a test date | Pure static functions over small snapshot records. Unit-tested in `WordQuest.Learning.Tests`. |
| `Infrastructure/Reporting/ReportingService.cs` (new) | All parent-report queries (overview, traffic light moved out of endpoints, history, problem words, readiness, notices) | Scoped service like `LearningService`. Read-only, `AsNoTracking`. **No new `Modules.Reporting` project** (see Pattern 3). |
| `Infrastructure/Privacy/PrivacyService.cs` (new) | Export JSON, delete learner, delete tenant | Relies on DB-level FK cascades plus `ExecuteDeleteAsync`. |
| `Api/Program.cs` exception mapping | Domain exceptions → 4xx | `ExceptionHandlerOptions.StatusCodeSelector` (ASP.NET Core 9+), mapping **specific** types only. |
| `frontend/src/games/registry.ts` (new) | Rendering-only game modules | `{ key, supports, Component }`. XP weight and grade caps stay server-side (`GameCatalog`, `GET /sessions/games`). |
| `frontend/src/features/learn/SessionPage.tsx` | Session engine: start, queue, retry items, answer mutation, complete | Keeps all API traffic. Game components get `item` + `onAnswer` and nothing else. |
| `backend/tests/WordQuest.Api.Tests/` (new) | HTTP-level integration tests | `WebApplicationFactory<Program>` + Testcontainers PostgreSQL, one container per run. |

## Recommended Project Structure (delta only)

```
backend/src/
├── WordQuest.Api/
│   ├── Auth/AccountService.cs          # setup, password change, invites, reset (token issuing via AuthService)
│   ├── Cli/ResetPasswordCommand.cs     # invoked from Program.cs arg branch
│   └── Endpoints/
│       ├── SetupEndpoints.cs
│       ├── AccountEndpoints.cs         # /api/v1/account/password, /api/v1/invites
│       ├── ReportEndpoints.cs          # /api/v1/learners/{id}/reports/*
│       └── PrivacyEndpoints.cs         # /api/v1/export, DELETE learners/{id}, DELETE /api/v1/tenant
├── WordQuest.Infrastructure/
│   ├── Reporting/ReportingService.cs
│   ├── Privacy/PrivacyService.cs
│   └── Configurations/*                # + FKs, + xmin, + GuardianInvite, + TestDate
├── WordQuest.Modules.Identity/Entities/GuardianInvite.cs
├── WordQuest.Modules.Learning/Services/{Mastery,TrafficLight,Readiness}.cs
└── WordQuest.Shared.Kernel/Errors.cs   # NotFoundException, DomainRuleException (2 tiny types)
backend/tests/
└── WordQuest.Api.Tests/                # new: WAF + Testcontainers
frontend/src/
├── games/{registry.ts, ClassicGame.tsx, WordCatcherGame.tsx}
└── features/{setup, account, reports}/
```

### Structure Rationale

- **Services that touch the DB go in Infrastructure, rules go in modules.** This is the pattern `LearningService` already set. Reporting and Privacy are DB orchestration, so they belong in Infrastructure. Thresholds and classifications are domain rules, so they belong in `Modules.Learning`.
- **Account logic goes in Api/Auth, not Infrastructure**, because it has to mint JWTs and `JwtTokenService` lives in Api. Moving the JWT code only to satisfy layering would be churn with no user-visible effect.
- **No `Modules.Reporting` project.** The concept (§10.2) lists one, but it would hold no entities (the test date belongs to Content) and 2–3 functions that are really Learning semantics. Record this as a deliberate deviation from the concept. Add the project later if reporting grows its own rules, for example weekly-mission analytics.

## Architectural Patterns

### Pattern 1: Race-safe first-run setup with an advisory lock plus a re-check

**What:** `POST /api/v1/setup` creates Tenant + Owner (`User` with `Role=Owner`) only if no tenant exists. It runs inside one transaction that first takes `pg_advisory_xact_lock(<const>)` and then re-checks `Tenants.IgnoreQueryFilters().AnyAsync()`. If a tenant already exists it returns 409.
**Why not a unique "singleton" index on `tenant`:** it would enforce one tenant per DB, and the tenant-isolation integration tests need two tenants in one DB. The advisory lock enforces nothing permanent in the schema.
**Mandatory wrapper:** `Program.cs` uses `EnableRetryOnFailure(3)`. A user-initiated `BeginTransactionAsync` then throws `InvalidOperationException` ("execution strategy does not support user-initiated transactions"). Wrap the call in `db.Database.CreateExecutionStrategy().ExecuteAsync(...)`. [MS Learn, connection resiliency; seam tier LOW, official doc]
**Setup hijack guard:** a fresh instance reachable from the internet can be claimed by whoever arrives first. Recommendation: when no tenant exists at startup, generate a random setup code, keep it in memory (the single-replica constraint makes this valid), log it once, and have the wizard ask for it (`docker compose logs api | grep Setup`). No new secret file and no SMTP.
**Also:** `GET /auth/profiles` currently returns 400 "Mandant nicht eindeutig" when **zero** tenants exist. The frontend has to call `/setup/status` first and route to the wizard, otherwise a fresh install greets the user with an error.

```csharp
var strategy = db.Database.CreateExecutionStrategy();
return await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(727001)", ct);
    if (await db.Tenants.IgnoreQueryFilters().AnyAsync(ct)) throw new DomainRuleException("already set up"); // → 409
    // add Tenant + Owner User (TenantId set explicitly: StampTenant is a no-op without a request tenant)
    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
    ...
});
```

### Pattern 2: Account lifecycle reusing the existing primitives

- **Password change** (`POST /api/v1/account/password`, `Guardian` policy): verify the current password with `PasswordHasher.Verify`, hash the new one, then revoke all of the user's refresh tokens (`RevokeAllAsync` already exists). The client then re-logs in or keeps its current token. Access JWTs stay valid for at most 15 min, which is accepted.
- **CLI reset:** `docker compose exec api dotnet WordQuest.Api.dll reset-password you@example.com`. It prints a generated password to stdout and revokes refresh tokens.
  - It must return **before** `app.RunAsync()`. The exec'd process shares the container's network namespace, so Kestrel would fail to bind :8080.
  - Positional args without `--`/`=` are ignored by the command-line config provider, so they do not pollute `IConfiguration`.
  - Look the user up by email with the `SystemTenantContext` context that `Program.cs` already builds for migration.
- **Guardian invite:**
  - Only the Owner can invite, through a new `Owner` policy (today's `Guardian` policy admits Owner **and** Guardian).
  - `POST /api/v1/invites` stores `TokenHasher.Hash(token)` with a 7-day expiry and returns the link `${WQ_PUBLIC_URL}/einladung#<token>` once. The token sits in the **fragment**, so it never appears in nginx/Traefik access logs.
  - `POST /api/v1/invites/accept` is unauthenticated and rate-limited. It looks the invite up by hash with `IgnoreQueryFilters()` (single row, the same shape as refresh-token lookup) and creates the `User` with the invite's `TenantId`.
  - Single use comes from a conditional update: `ExecuteUpdateAsync(... Where(i => i.Id == id && i.AcceptedAt == null))`, where 0 rows means 409.

### Pattern 3: The mastery predicate as an expression in Learning, and reporting as an Infrastructure service

**What:** The rule `Repetitions >= 3 && EaseFactor >= 2.1 && Lapses <= 1` is currently duplicated at `LearnerEndpoints.cs:168-172` (SQL count) and `:223-227` (in-memory). A plain C# method cannot go into an EF `Where` without client evaluation, so the module exposes both forms from **one** definition:

```csharp
public static class Mastery
{
    public const int MinRepetitions = 3; public const double MinEase = 2.1; public const int MaxLapses = 1;
    public static bool IsMastered(int reps, double ease, int lapses) =>
        reps >= MinRepetitions && ease >= MinEase && lapses <= MaxLapses;
    public static readonly Expression<Func<ReviewState, bool>> Expr =
        r => r.Repetitions >= MinRepetitions && r.EaseFactor >= MinEase && r.Lapses <= MaxLapses;
}
```

Add a unit test asserting that `Expr.Compile()` and `IsMastered` agree on a grid of values. `TrafficLight.Classify(...)` (red when lapses ≥ 3 or ease < 1.8, green when all directions are mastered, and so on) moves out of `LearnerEndpoints.TrafficLightAsync` into Learning in the same way.

**Concept drift to resolve:** concept §8 defines "gefestigt" for collectible cards as `ease ≥ 2.0`, while §9 uses 2.1. `GamificationProfile.MasteredSinceLastCard` exists but nothing uses it. Pick one constant (`Mastery`) and make §8 reference it.

**Reporting queries: compute them on the fly, with no daily aggregate tables.** At family scale (about 3 learners × ~50 answers/day ≈ 55k `review_log` rows/year), a grouped query on the existing `(learner_id, reviewed_at)` index is trivial even on a Pi 5. Aggregates would need a writer (a hosted job or a hook in `LearningService`), backfill and invalidation, which is all cost with no benefit here. Revisit only if a report exceeds ~200 ms on the Pi.

| Report | Source | Notes |
|--------|--------|-------|
| History (answers, minutes per day/week) | `review_log` in a window (e.g. 8 weeks) → group in C# by `scheduler.LocalDate(ReviewedAt)` | Reuses the existing `SchedulerOptions.TimeZoneId`, so no timezone logic is duplicated in SQL. **Clamp `AnswerMs` per answer** (e.g. ≤ 60 s): it is client-supplied and includes idle time. Round minutes, because concept §9 forbids minute-precise usage times. |
| Streak history | `learning_session.CompletedAt` local dates → "active days" calendar | The actual streak values cannot be reconstructed, because streak savers are not logged. Show active days plus the current and longest streak, not a streak-over-time line. |
| Problem words | `review_state` (Lapses desc, EaseFactor asc) join card/entry, top 10 per learner, optional set filter | Optionally add an "errors in last 30 days" count from `review_log` where `Grade = Again`. |
| Pre-test readiness | `VocabularySet.TestDate` (new nullable `DateOnly`, Content) + per-learner traffic light for that set + count of cards due before the date | `Readiness.Evaluate(snapshots, testDate, today)` is pure. **No pass/fail prediction** (concept §9). Offer a "Klassenarbeit-Modus" button that starts `gameKey=cram` for that set. Per-set rather than per-learner-per-set date: YAGNI for v1, upgrade to a `(learner_id, set_id, test_date)` table if siblings share sets with different dates. |
| Notices ("hat seit N Tagen nicht geübt", weekly summary) | **Computed on read** from `GamificationProfile.LastActiveDate` and the last 7 days of `review_log` | There is no worker container and no scheduler, and computed notices are deterministic and testable. Store dismissals client-side in localStorage with a key like `inactive:{learnerId}:{lastActiveDate}`. The known limit is that dismissal is per device. Add a server table only if parents complain. |

### Pattern 4: Frontend game registry with the server as the only grader

**What:** `SessionPage` becomes the session engine, and games become pure renderers.

```ts
// frontend/src/games/registry.ts
export type AnswerType = 'text' | 'choice'
export interface GameProps {
  item: SessionItem
  disabled: boolean
  speed: 'Relaxed' | 'Normal' | 'Fast'
  onAnswer: (givenAnswer: string, meta?: { hintUsed?: boolean }) => void
}
export interface GameModule { key: string; supports: AnswerType[]; Component: React.FC<GameProps> }
export const games: Record<string, GameModule> = { classic: {...}, wordcatcher: {...}, cram: { ...classic, key: 'cram' } }
```

- **Grading stays on the server.** The client never receives the expected answer before it submits. `choices` come from `LearningService.BuildChoicesAsync` (for every non-classic key), and `correctAnswer` comes back in `AnswerResult`. A new mode therefore needs no backend change as long as it fits `(itemId, givenAnswer, answerMs, hintUsed)`.
- **Do not copy `xpWeight`/`maxGrade` into the frontend registry** as concept §7.3 sketches. That duplicates `GameCatalog` and will drift. Titles and weights come from `GET /api/v1/sessions/games`.
- **Mode fit with the current contract:**
  - `wordcatcher` is `choice`: done server-side already. A timeout submits `givenAnswer=""`, which the server grades as `Again`, as concept §7.2 requires.
  - `cram` reuses the Classic UI. The server already skips rescheduling and retries (`AffectsScheduling=false`).
  - `memory` does **not** fit. It needs a session-level unlinked answer pool (`expectedAnswerType: "match"`), and the one-submission-per-item idempotency in `SubmitAnswerAsync` means the first wrong pairing decides the grade. Treat it as a contract extension and defer it past the first new mode.
- **Timing:** `answerMs` is measured by the engine (`shownAt`), not by each game, so all modes grade speed the same way.

### Pattern 5: GDPR delete through DB-level cascades, not hand-written delete lists

**Finding (verified in `Migrations/*_Initial.cs`):** only four FKs exist:

- `app_user → learner_profile`
- `learning_session → session_item`
- `vocabulary_set → vocabulary_entry → card`

`review_state`, `review_log`, `learning_session`, `gamification_profile` and `refresh_token` reference learner, user and card by bare GUID. **No table has an FK to `tenant`.** Consequences:

- Deleting a learner today would orphan all learning history.
- **Existing bug:** deleting a set or entry (`SetEndpoints.cs:82,143`) cascades cards but orphans `review_state`/`review_log`. Orphaned `review_state` rows are still picked as relearning/due candidates and counted in `dueToday`. `StartSessionAsync` then creates `SessionItem`s for cards that `BuildItemViewsAsync` silently skips, which leaves invisible, never-answerable items. This is derived from the code and has not been reproduced.

**Design:** add FKs without navigation properties in the Infrastructure configurations, so no module gains a reference:

```csharp
builder.HasOne<User>().WithMany().HasForeignKey(r => r.LearnerId).OnDelete(DeleteBehavior.Cascade); // review_state, review_log, learning_session
builder.HasOne<Card>().WithMany().HasForeignKey(r => r.CardId).OnDelete(DeleteBehavior.Cascade);    // review_state, review_log
builder.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).OnDelete(DeleteBehavior.Cascade); // every ITenantOwned table
```

Plus `gamification_profile.id → app_user`, `refresh_token.user_id → app_user` and `guardian_invite.tenant_id → tenant`. Leave out `vocabulary_set.created_by_user_id`: deleting a second guardian must not delete family content. PostgreSQL allows multiple cascade paths, unlike SQL Server.

- **Delete learner:** `db.Users.Where(u => u.Id == id && u.Role == UserRole.Learner).ExecuteDeleteAsync()`. The tenant query filter applies to `ExecuteDelete`, so it is automatically scoped to the caller's tenant.
- **Delete tenant (Owner only, password re-confirmation):** `db.Tenants.Where(t => t.Id == tid).ExecuteDeleteAsync()` cascades everything. The instance then returns to first-run state. Generate the setup code lazily whenever no tenant exists, not only at startup, so it is available again without a restart.
- **Migration order:** the migration **must delete orphan rows before adding the FKs** (raw SQL `DELETE ... WHERE NOT EXISTS (...)`), otherwise it fails on existing installs at startup and the API never comes up.
- **Export** (`GET /api/v1/export`, Guardian): `PrivacyService` builds a versioned DTO `{ formatVersion: 1, exportedAt, tenant, guardians, learners: [{ profile, gamification, reviewStates, reviewLogs, sessions }], sets: [{ entries }] }` with `AsNoTracking`, scoped by the tenant filter. **Exclude** `PasswordHash`, `PinHash`, refresh tokens and invite hashes. It is a few MB per year at family scale, so `Results.Json` is enough and no streaming is needed.
- **Backups:** daily `pg_dump` files are kept for 14 days and still contain deleted data. Document this as the retention period instead of trying to purge backups.

### Pattern 6: Hardening at the pipeline edges

- **Forwarded headers.** The chain is client → Traefik → nginx → API.
  - Traefik strips untrusted `X-Forwarded-*` and sets them from the socket peer.
  - nginx then appends with `$proxy_add_x_forwarded_for`, so the API receives `X-Forwarded-For: <client>, <traefik-ip>`.
  - nginx's `X-Real-IP` is Traefik's IP, not the client's, so do not use it.
  - Configure `ForwardedHeaders = XForwardedFor | XForwardedProto`, `ForwardLimit = 2`, and `KnownIPNetworks` = the subnets of the API container's own interfaces, discovered at startup via `NetworkInterface.GetAllNetworkInterfaces()`. That means "trust the compose network I'm attached to", with zero config. The API publishes no port, so only our containers are on that network.
  - In ASP.NET Core 10, `KnownNetworks`/`IPNetwork` are obsolete (ASPDEPR005). Use `KnownIPNetworks` with `System.Net.IPNetwork`, because `/warnaserror` would break the build otherwise. [MS Learn breaking-change doc; seam tier LOW, official doc]
  - `UseForwardedHeaders()` must run first, before `UseExceptionHandler`/`UseHsts`/`UseRateLimiter`.
- **Rate limiter split.** Keep `auth` (per client IP, 10/min) on `login`, `learner-login`, `setup`, `invites/accept` and `account/password`. Move `refresh` to its own, looser policy. Refresh tokens are 256-bit random with reuse detection, so they do not need a brute-force budget.
- **Concurrency.** Add a `uint` row-version mapped to PostgreSQL `xmin` (`.IsRowVersion()`) on `ReviewState`, `SessionItem` and `GamificationProfile`. Configure it as a **shadow property in Infrastructure** so the domain entities stay clean. [npgsql.org concurrency doc; seam tier LOW, official doc]
  - Map `DbUpdateConcurrencyException` to 409, and `PostgresException { SqlState: "23505" }` (the `(learner_id, card_id)` PK race on `ReviewState` insert) to 409.
  - The client's retry then hits the existing idempotent path (`item.AnsweredAt is not null`).
- **Error mapping.** Replace the `InvalidOperationException` throws in `LearningService` (unknown learner, session or item) with `NotFoundException` (→ 404) and `DomainRuleException` (→ 409/400) from Shared.Kernel. Map them with `UseExceptionHandler(new ExceptionHandlerOptions { StatusCodeSelector = ex => ex switch { ... } })`, which is built in since ASP.NET Core 9.
  - **Never map `InvalidOperationException` globally.** EF throws it for real bugs, such as the execution-strategy transaction error above and "sequence contains no elements", and those would be hidden as 4xx.
- **Sync skip-and-report.** In `SyncAsync`, catch `NotFoundException` per answer and return `{ accepted, rejected: [{ clientAnswerId, reason }] }` instead of aborting the batch. Also cap `Answers.Count`.
- **Health split.**
  - `AddDbContextCheck<WordQuestDbContext>("database", tags: ["ready"])`.
  - `/health/live` uses `Predicate = _ => false`, `/health/ready` filters on the tag.
  - Delete the `location /health/` block from `nginx.conf`. The compose and Dockerfile healthchecks call the API directly inside the container. [MS Learn health checks; seam tier LOW, official doc]
- **Secrets fail fast:** `ReadSecret` throws outside Development when `*_FILE` is set but missing, or when no secret is present. This follows the pattern the JWT key already uses.

### Pattern 7: Integration-test harness with real PostgreSQL

**What:** add `backend/tests/WordQuest.Api.Tests` with `Microsoft.AspNetCore.Mvc.Testing` + `Testcontainers.PostgreSql` + xUnit (same major as the existing project).
**Why real Postgres, not SQLite or InMemory:** the features under test are Postgres-specific: `xmin`, `text[]`, `pg_advisory_xact_lock`, FK cascades, the `ExecuteDelete` + query-filter interplay and snake_case naming. Startup `MigrateAsync` runs against the container, so every test run also proves the migrations apply.

- **Fixtures:** one container per test run (collection fixture). Each test creates **its own tenant** through a seeding helper, so no DB reset library is needed and the tenant-isolation tests get two tenants for free. Tests that need "zero tenants" or "exactly one tenant" (setup wizard, `/auth/profiles`) use a factory instance with **a separate database name** in the same container.
- **Config injection:** pass the connection string and signing key with `builder.UseSetting("ConnectionStrings:Default", ...)` and `UseSetting("Auth:SigningKey", ...)`. `Program.cs` reads both **before** `Build()`, so do not rely on late `ConfigureAppConfiguration` (MEDIUM: verify on first test).
- **Rate-limiter trap:** under `TestServer`, `RemoteIpAddress` is null, so every test lands in the single "unknown" bucket and gets 429 after 10 auth calls. Add a **test-only `IStartupFilter`** that sets `Connection.RemoteIpAddress` from a test header, giving each client a distinct IP. It needs no production config knob and also makes per-IP limiting testable.
- **Isolation matrix (minimum):**
  - A guardian of T1 reading a T2 learner's overview, traffic light, reports or export gets 404 or empty.
  - Learner A starting a session for sibling B gets 403 (`MayActFor`).
  - Learner A answering in B's session gets 403.
  - A learner token on Guardian-only routes gets 403.
  - A Guardian (non-Owner) on invite or tenant-delete gets 403.
  - Refresh-token reuse revokes the chain.
  - Delete learner leaves zero rows for that learner in every table. Assert this through a `SystemTenantContext` DbContext.

## Data Flow

### Request flow (unchanged shape, new edges)

```
Browser ─► Traefik ─► nginx ─► API pipeline:
  ForwardedHeaders (client IP) → ExceptionHandler (StatusCodeSelector) → RateLimiter (per real IP)
  → JWT auth (claim tid) → policy (Guardian | Owner | Learner) → endpoint (MayActFor)
  → service (Account | Learning | Reporting | Privacy) → WordQuestDbContext (tenant filter from tid)
  → PostgreSQL (FK cascades, xmin checks)
Errors flow back: NotFoundException→404, DomainRuleException→409/400,
DbUpdateConcurrencyException/23505→409, everything else→500 ProblemDetails.
```

### Key data flows

1. **First run:** the SPA loads and calls `GET /setup/status`. If `needsSetup` is true it shows the wizard. The wizard submits `POST /setup {setupCode, familyName, displayName, email, password}`. Under an advisory lock the server re-checks, inserts Tenant + Owner and issues tokens. The SPA then lands in `/verwalten`.
2. **Answer:** the game component calls `onAnswer`, and the engine sends `POST /sessions/{id}/answers`. `LearningService` grades, reschedules and writes the `ReviewLog` insert plus updates to `SessionItem`/`ReviewState`/`GamificationProfile`, with xmin checked on update. A concurrent duplicate gets 409, the client refetches, and the idempotent path returns the stored result.
3. **Reports (read-only):** `GET /learners/{id}/reports/...` calls `ReportingService`, which runs `AsNoTracking` queries and uses the pure functions `Mastery`/`TrafficLight`/`Readiness` in Learning to build the DTO. Nothing is written, and notices are derived at read time.
4. **Delete learner:** `DELETE /learners/{id}` → `PrivacyService` → `ExecuteDeleteAsync` on `app_user` (tenant-filtered). PostgreSQL then cascades to `learner_profile`, `gamification_profile`, `review_state`, `review_log`, `learning_session` → `session_item` and `refresh_token`.
5. **Password reset (offline):** the operator runs `docker compose exec api dotnet WordQuest.Api.dll reset-password x@y`. The process migrates (a no-op), finds the user across tenants, sets the new hash, revokes refresh tokens, prints the password and exits 0 without starting Kestrel.

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| One family (target: 1–5 learners, ~55k review_log rows/year) | Everything on-the-fly: no aggregates, no background jobs, in-memory rate limiter and setup code, one API replica. |
| Large family or many years (~500k review_log rows) | Still fine with the `(learner_id, reviewed_at)` index. Bound history windows (≤ 12 weeks) and never scan all history per request. |
| Multi-family / school (out of scope) | Would need tenant hint for profiles, distributed rate limiter, migration out of API start, possibly aggregates. Not v1.0. |

### Scaling priorities

1. **First bottleneck:** the traffic-light correlated subquery plus in-memory grouping over **all tenant cards** when `setId` is null. Rewrite it as a single left join during the move to `ReportingService`.
2. **Second bottleneck:** `SyncAsync` saves per answer. Load the session once and save once, which fits with skip-and-report.

## Anti-Patterns

### Anti-Pattern 1: Mapping `InvalidOperationException` to 400/404 globally
**What people do:** make a one-line catch-all to get rid of the 500s.
**Why it's wrong:** EF Core and the BCL throw `InvalidOperationException` for programming errors. Real bugs, including the "user-initiated transactions" error that Pattern 1 guards against, would show up as client errors and never alert anyone.
**Do this instead:** throw specific exception types from services and map only those.

### Anti-Pattern 2: Hand-written cascade-delete lists in a service
**What people do:** `RemoveRange` for each table in `DeleteLearnerAsync`.
**Why it's wrong:** every future learner-owned table has to be remembered. The first one forgotten is a GDPR leak, and this is the same failure mode that already orphans `review_state` on entry delete.
**Do this instead:** add DB FKs with `ON DELETE CASCADE`, delete the principal with `ExecuteDeleteAsync`, and keep an integration test that asserts zero rows remain.

### Anti-Pattern 3: Daily aggregate tables at family scale
**What people do:** pre-compute `daily_stats` "for performance".
**Why it's wrong:** it needs a writer (a job or a hook), backfill and timezone-correct day boundaries, all to save milliseconds on 55k rows.
**Do this instead:** run on-the-fly grouped queries in a bounded window, and add aggregates only after a measured problem.

### Anti-Pattern 4: Game components talking to the API or grading locally
**What people do:** each game calls `/answers` itself, or checks the answer client-side for instant feedback.
**Why it's wrong:** timing, retries and offline sync diverge per game, and client-side grading breaks concept ADR-006 (server-authoritative) and the offline replay semantics.
**Do this instead:** the engine owns the API and timing, and games render and call `onAnswer`.

### Anti-Pattern 5: New `IgnoreQueryFilters()` call sites outside Auth
**What people do:** reach for `IgnoreQueryFilters()` in setup, invites or export "because there's no tenant yet".
**Why it's wrong:** the tenant filter is the only isolation mechanism.
**Do this instead:** keep bypasses in `Api/Auth` (setup check, invite lookup by hash: single-row, never lists) and in the CLI. Export and delete run **with** the filter. Add a grep check (`IgnoreQueryFilters` only under `Api/Auth`, `Api/Cli` and `AuthEndpoints.GetProfilesAsync`) to CI or to the isolation tests.

### Anti-Pattern 6: Invite or setup tokens in URL paths or query strings
**Why it's wrong:** they end up in Traefik/nginx access logs and browser history.
**Do this instead:** put them in the URL fragment (`#token`) and have the SPA POST them in the body.

## Integration Points

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| Traefik (proxy) | Strips untrusted X-Forwarded-*, sets its own | The API trusts the compose-network subnet with `ForwardLimit=2`. |
| nginx (web) | Appends X-Forwarded-For; currently also proxies `/health/` | Remove `/health/`. Do not use `X-Real-IP` (it holds Traefik's IP). |
| PostgreSQL 17 | EF Core + Npgsql, `EnableRetryOnFailure(3)` | Every explicit transaction goes through `CreateExecutionStrategy()`. |
| Docker CLI (operator) | `docker compose exec api dotnet WordQuest.Api.dll reset-password <email>` | Document it in the install guide. The image is `aspnet:10.0-alpine` with `ENTRYPOINT dotnet WordQuest.Api.dll`, so `dotnet` is available. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Api endpoints ↔ services | Direct DI calls; endpoints do authz (`MayActFor`, policies) and mapping only | Move the traffic-light and overview query logic out of `LearnerEndpoints` into `ReportingService`. |
| Infrastructure services ↔ modules | Direct calls to static/pure functions | Keep it this way. Domain events (concept §10.2) are **not** needed for v1.0, because nothing in scope needs async fan-out. |
| Learning ↔ Gamification | `LearningService` calls `XpRules`/`StreakRules` directly | Unchanged. |
| Cross-module data integrity | DB FKs configured in Infrastructure, no navigation properties | Modules stay reference-free (only Learning → Content, as today). |
| Frontend engine ↔ games | `GameProps` (`item`, `onAnswer`, `speed`, `disabled`) | Metadata from `GET /sessions/games`. |

## Suggested Build Order

```
P1 Test harness ─┬─► P2 Hardening ─┬─► P3 Accounts ─► P4 Data integrity + GDPR
 (backend WAF +  │   (errors, xmin, │   (setup, pw,     (FK migration, delete,
  frontend runner)│   fwd headers,  │    CLI, invites)   export, tenant delete)
                 │   health, mastery)│
                 │                  └─► P5 Reporting (needs Mastery from P2, FK-clean data from P4)
                 └─► P6 Game registry refactor (needs frontend runner) ─► P7 New modes (cram entry from P5 readiness)
                                                                        └─► P8 Release (pinning, backup/restore, docs, fresh-install test)
```

| # | Phase | Depends on | Why this position |
|---|-------|-----------|-------------------|
| 1 | **Test harness**: `WordQuest.Api.Tests` (WAF + Testcontainers, per-test tenant, startup-filter IP), characterization tests for the existing auth, refresh and isolation behaviour; Vitest + Testing Library in the frontend; CI `has-pending-model-changes` | none | Every later phase changes auth, schema or error codes. Without the harness, regressions in tenant isolation ship unseen (CONCERNS: priority high). The pending-model check catches the xmin/snake_case column pitfall in P2. |
| 2 | **Hardening**: exception types + `StatusCodeSelector`, xmin tokens + 409, sync skip-and-report + caps, forwarded headers + limiter split, health split, secrets fail-fast, PIN format, no PII logs, **`Mastery`/`TrafficLight` extraction** | P1 | The error mapping comes before any new endpoint so that setup, invites and privacy can throw 404/409 through the same mechanism. The mastery extraction is a pure refactor that P1 characterization tests protect. |
| 3 | **Accounts**: seed off by default, setup status/wizard (advisory lock, setup code), password change, CLI reset, `Owner` policy, `GuardianInvite` | P2 (409 mapping, limiter policies) | This is the core value (no default credentials). It blocks any third-party install, so it comes as early as possible after the safety net. |
| 4 | **Data integrity + GDPR**: orphan-cleanup + FK migration (fixes the existing entry-delete orphan bug), delete learner, export, delete tenant (returns to first-run) | P3 (tenant delete needs a working setup path; Owner policy) | Schema change with a data-migration risk, done before reporting builds queries on those tables. |
| 5 | **Reporting**: `ReportingService`, history, problem words, `TestDate` + readiness, computed notices, parent UI | P2 (Mastery), P4 (no orphans skewing counts) | Read-only, so it is low risk and easy to test against seeded tenants. |
| 6 | **Game registry refactor**: extract `ClassicGame` + engine and ship it with classic only, no behaviour change | P1 (frontend runner + session-flow tests) | The refactor is verified by unchanged tests before any new mode is added. |
| 7 | **New modes**: `cram` (Classic UI, entry point from readiness), then `wordcatcher` (choice + speed); `memory` needs a "match" contract extension, so defer or give it its own research | P6, P5 (cram entry) | Frontend-only for cram and wordcatcher. |
| 8 | **Release**: pinned images, off-host backup + tested restore, docs, fresh third-party install | all | The release gate. |

P5 and P6/P7 are independent of each other and can run in parallel after P4 and P1.

**Research flags:**
- **P3:** confirm the setup-code UX with the owner (log line vs `setup.sh` output).
- **P4:** write and test the orphan-cleanup SQL against a production-like dump before shipping.
- **P7:** needs a UI/UX pass for wordcatcher (motion, WCAG 2.2 AA: `prefers-reduced-motion` and no time pressure by default).
- **P1, P2, P5:** standard patterns.

**Open questions for requirements:**
- There is **no learner↔set assignment**. `CardsInScope(null)` means every card in the tenant, so siblings see each other's sets, and "cards total" and "all sets" reports mix siblings' vocabulary. Decide whether v1.0 reports are per set only, or whether an assignment is in scope.
- Should the test date be per set (recommended for v1) or per learner and set?

## Sources

- Codebase at `4ce32da` + working tree (observed directly, HIGH): `Program.cs`, `WordQuestDbContext.cs`, `Configurations/*.cs`, `Migrations/20260917045557_Initial.cs` (FK list), `LearningService.cs`, `LearnerEndpoints.cs`, `SessionEndpoints.cs`, `AuthService.cs`, `GameCatalog.cs`, `SessionPage.tsx`, `nginx.conf`, `docker-compose.yml`, `backend/Dockerfile`; `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONCERNS}.md`; concept doc §7, §8, §9, §10.2, §15.
- [Breaking change: IPNetwork and ForwardedHeadersOptions.KnownNetworks are obsolete (ASP.NET Core 10)](https://learn.microsoft.com/en-us/aspnet/core/breaking-changes/10/ipnetwork-knownnetworks-obsolete?view=aspnetcore-10.0). Seam tier LOW, official doc.
- [dotnet/aspnetcore#63627: KnownIPNetworks.Clear() regression (RC1, fixed for RC2)](https://github.com/dotnet/aspnetcore/issues/63627). Seam tier LOW.
- [EF Core connection resiliency: execution strategies and transactions](https://learn.microsoft.com/en-us/ef/core/miscellaneous/connection-resiliency). Seam tier LOW, official doc.
- [Npgsql EF Core: concurrency tokens (xmin)](https://www.npgsql.org/efcore/modeling/concurrency.html). Seam tier LOW, official doc.
- [ASP.NET Core health checks (liveness/readiness via tags and predicates)](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-10.0). Seam tier LOW, official doc.
- [ExceptionHandlerOptions.StatusCodeSelector (PR #56616, ASP.NET Core 9)](https://github.com/dotnet/aspnetcore/pull/56616) and [Handle errors in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling?view=aspnetcore-9.0). Seam tier LOW.
- [Traefik ForwardAuth docs: entrypoint forwardedHeaders strips X-Forwarded-* from untrusted peers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/forwardauth/). Seam tier LOW (search summary, not read in full).
- [Testcontainers best practices for .NET integration testing](https://milanjovanovic.tech/blog/testcontainers-best-practices-dotnet-integration-testing). Seam tier LOW, community.

---
*Architecture research for: self-hosted family vocabulary PWA (WordQuest v1.0)*
*Researched: 2026-09-24*
