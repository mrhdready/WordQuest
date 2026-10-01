---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
<!-- refreshed: 2026-09-24 -->

# Architecture

**Analysis Date:** 2026-09-24

## System Overview

```text
┌──────────────── Docker host (docker-compose.yml) ─────────────────────────┐
│  proxy (Traefik v3, TLS) ──► web (nginx, React PWA)  `frontend/`          │
│                          └─► api (ASP.NET Core, net10.0) `backend/src/`   │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ WordQuest.Api — Minimal API endpoints, auth, DI root                      │
│ `backend/src/WordQuest.Api/Endpoints/*.cs`, `Auth/*.cs`, `Program.cs`     │
└───────────────┬──────────────────────────────────────┬────────────────────┘
                ▼                                      ▼
┌───────────────────────────────────┐   ┌──────────────────────────────────┐
│ WordQuest.Infrastructure          │   │ Domain modules (pure logic)      │
│ WordQuestDbContext, LearningService│──►│ Identity / Content / Learning /  │
│ EF configs, migrations, seed      │   │ Gamification                     │
└───────────────┬───────────────────┘   │ `backend/src/WordQuest.Modules.*`│
                ▼                       └───────────────┬──────────────────┘
┌───────────────────────────────────┐                   ▼
│ PostgreSQL 17 (db) + backup       │   WordQuest.Shared.Kernel
└───────────────────────────────────┘   (ITenantContext, ITenantOwned, Grade)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API host | Config, secrets, DI, auth, rate limiting, migrate-on-start, seed | `backend/src/WordQuest.Api/Program.cs` |
| Endpoints | HTTP routes under `/api/v1/*`, authorization checks | `backend/src/WordQuest.Api/Endpoints/{Auth,Learner,Set,Session}Endpoints.cs` |
| DTOs | Request/response records | `backend/src/WordQuest.Api/Contracts/Contracts.cs` |
| Auth | Login, PIN login, refresh tokens, JWT issuing, tenant from claim `tid` | `backend/src/WordQuest.Api/Auth/AuthService.cs`, `JwtTokenService.cs`, `HttpTenantContext.cs` |
| DbContext | All DbSets, tenant query filters, tenant stamping, snake_case names | `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs` |
| LearningService | Orchestrates session start / answer / complete across Learning + Gamification + DB | `backend/src/WordQuest.Infrastructure/LearningService.cs` |
| SM-2 scheduler | Interval/ease computation | `backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs` |
| Session composer | Picks relearning/due/new cards | `backend/src/WordQuest.Modules.Learning/Services/SessionComposer.cs` |
| Answer evaluator | Normalization + Damerau-Levenshtein grading | `backend/src/WordQuest.Modules.Learning/Services/AnswerEvaluator.cs`, `Levenshtein.cs`, `TextNormalizer.cs` |
| Game catalog | Server-side list of game keys + XP weights | `backend/src/WordQuest.Modules.Learning/Services/GameCatalog.cs` |
| Gamification rules | XP, streak, level curve (static) | `backend/src/WordQuest.Modules.Gamification/Services/*.cs` |
| CSV import | Parses vocabulary CSV | `backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs` |
| Frontend shell | Routing, React Query client, auth provider | `frontend/src/App.tsx`, `frontend/src/lib/auth.tsx` |
| API client | fetch wrapper, token store in localStorage | `frontend/src/lib/api.ts` |

## Pattern Overview

**Overall:** Modular monolith (backend, concept ADR-001) + SPA/PWA frontend, deployed as one compose stack.

**Key Characteristics:**

- Domain modules hold entities and pure/static rules; they have no EF or HTTP dependency. Only `Modules.Learning` references `Modules.Content`.
- `WordQuest.Infrastructure` references all modules and owns persistence plus the one application service (`LearningService`).
- Endpoints are static classes with `Map*Endpoints(this IEndpointRouteBuilder)` extension methods; handlers are private static methods with DI-injected parameters.
- Multi-tenancy enforced centrally by EF global query filters on every `ITenantOwned` entity.
- Answer grading and scheduling are server-authoritative (concept ADR-006).

## Layers

**API (`backend/src/WordQuest.Api/`):**

- Purpose: HTTP surface, auth, composition root
- Depends on: Infrastructure, all modules, Shared.Kernel
- Used by: frontend via `/api/v1`

**Infrastructure (`backend/src/WordQuest.Infrastructure/`):**

- Purpose: EF Core DbContext, `IEntityTypeConfiguration` classes in `Configurations/`, migrations, demo seed, `LearningService`
- Depends on: all modules, Shared.Kernel

**Modules (`backend/src/WordQuest.Modules.{Identity,Content,Learning,Gamification}/`):**

- Purpose: Entities (`Entities/`) and domain services (`Services/`)
- Depends on: Shared.Kernel (Learning also on Content)

**Shared.Kernel (`backend/src/WordQuest.Shared.Kernel/`):**

- Purpose: `ITenantContext`, `ITenantOwned`, `Grade`

**Frontend (`frontend/src/`):**

- `features/*` pages → `lib/api.ts` → `/api/v1`; UI primitives in `components/ui/`.

## Data Flow

### Primary Request Path (learning session)

1. `POST /api/v1/sessions` → `SessionEndpoints.StartAsync` checks `MayActFor` (`backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:25`)
2. `LearningService.StartSessionAsync` loads relearning/due/new candidates, composes via `SessionComposer`, builds choices (`backend/src/WordQuest.Infrastructure/LearningService.cs:29`)
3. `POST /sessions/{id}/answers` → `LearningService.SubmitAnswerAsync`: `AnswerEvaluator` grades, `Sm2Scheduler` updates `ReviewState`, `XpRules.ForAnswer` awards XP (`LearningService.cs:138`, `:219`)
4. `POST /sessions/{id}/complete` → `CompleteSessionAsync`: completion bonus, `StreakRules`, `LevelCurve` (`LearningService.cs:256`)
5. `POST /sessions/sync` replays answers through the same service methods (`SessionEndpoints.cs:118`)

### Auth Flow

1. Guardian `POST /api/v1/auth/login` or learner `POST /auth/learner-login` (PIN), rate-limited policy `auth` (`Program.cs`)
2. `AuthService` issues JWT (claim `tid` = tenant) + hashed refresh token (`Modules.Identity/Services/TokenHasher.cs`)
3. Frontend stores tokens in localStorage (`frontend/src/lib/api.ts`), `HttpTenantContext` reads `tid` per request

**State Management:**

- Backend stateless; all state in PostgreSQL.
- Frontend: TanStack Query cache (`networkMode: 'offlineFirst'`, `frontend/src/App.tsx`), auth in React context (`frontend/src/lib/auth.tsx`), Workbox runtime caching via `vite-plugin-pwa` (`frontend/vite.config.ts`).

## Key Abstractions

**ITenantContext / ITenantOwned:**

- Purpose: tenant isolation
- Examples: `backend/src/WordQuest.Shared.Kernel/ITenantContext.cs`, `backend/src/WordQuest.Api/Auth/HttpTenantContext.cs`, `backend/src/WordQuest.Infrastructure/SystemTenantContext.cs` (bypass for migration/seed only)
- Pattern: global query filter + `StampTenant()` in `SaveChanges` override (`WordQuestDbContext.cs`)

**VocabularyEntry vs Card:** entry = word pair, card = one direction to learn (concept §5.1); `backend/src/WordQuest.Modules.Content/Entities/`.

**ReviewState / ReviewLog / LearningSession / SessionItem:** SM-2 state per learner+card; `backend/src/WordQuest.Modules.Learning/Entities/`.

**GameDefinition (GameCatalog):** key, title, XP weight; games know no learning logic (concept §7.1).

## Entry Points

**API:** `backend/src/WordQuest.Api/Program.cs` — migrates DB on start, optional seed via `WQ_SEED_DEMO_DATA`.
**Frontend:** `frontend/src/main.tsx` → `frontend/src/App.tsx`.
**EF tooling:** `backend/src/WordQuest.Infrastructure/DesignTimeDbContextFactory.cs`.
**Ops:** `setup.sh` (secrets), `docker-compose*.yml`, `.github/workflows/ci.yml`.

## Architectural Constraints

- **Threading:** ASP.NET request pipeline; domain services registered as singletons (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`) — keep them stateless.
- **Global state:** static rule classes `XpRules`, `StreakRules`, `LevelCurve`, `GameCatalog`.
- **Circular imports:** none; project refs are acyclic (see `*.csproj`).
- **Secrets:** read from `*_FILE` (Docker secrets) first, env var fallback (`Program.cs` `ReadSecret`). JWT key must be >= 32 chars.
- **Migrations:** applied automatically at startup; CI checks for missing migrations.

## Deviations From Concept Doc

Cross-check with `Documentation/WordQuest_Konzept_und_Architektur.md`:

- §10.2 lists `WordQuest.Modules.Reporting` — not present; reporting queries live in `LearnerEndpoints.cs` (`overview`, `traffic-light`).
- §10.2 says modules communicate via in-process domain events (`CardReviewed`) and Shared.Kernel holds `Result<T>`/domain events — neither exists. `LearningService` calls Gamification statics directly.
- §7.3 frontend `games/registry.ts` — not present; `frontend/src/features/learn/SessionPage.tsx` renders sessions directly.
- §13 IndexedDB/Dexie outbox — not present; offline relies on Workbox cache + React Query. `/sessions/sync` endpoint exists server-side.
- §10.1 optional seq/log container — not in `docker-compose.yml`.

## Anti-Patterns

### Data access in endpoints

**What happens:** `SetEndpoints.cs`, `LearnerEndpoints.cs` inject `WordQuestDbContext` and query/save directly.
**Why it's wrong:** business logic in entry points (house rule: thin controllers); only session logic is in a service.
**Do this instead:** for non-trivial logic, add a service like `backend/src/WordQuest.Infrastructure/LearningService.cs` and register it scoped in `Program.cs`.

### Bypassing the tenant filter

**What happens:** `SystemTenantContext` disables filters.
**Why it's wrong:** outside startup it leaks across tenants.
**Do this instead:** use it only in `Program.cs` startup / seed; request code always uses `HttpTenantContext`.

## Error Handling

**Strategy:** ProblemDetails + `UseExceptionHandler()`; endpoints return `Results.NotFound/Forbid/BadRequest`.

**Patterns:**

- Domain/service failures throw `InvalidOperationException` (e.g. unknown learner in `LearningService`).
- Frontend throws `ApiError(message, status)` from `frontend/src/lib/api.ts`.

## Cross-Cutting Concerns

**Logging:** built-in `ILogger` (startup logger in `Program.cs`).
**Validation:** inline checks in endpoint handlers; CSV validation in `CsvVocabularyParser`.
**Authentication:** JWT bearer; policies `Guardian` (roles Owner/Guardian) and `Learner`; per-learner check `MayActFor` in `SessionEndpoints.cs`; rate limiter `auth` (10/min/IP).
**Health:** `/health/live`, `/health/ready` (DB check).

---

*Architecture analysis: 2026-09-24*
