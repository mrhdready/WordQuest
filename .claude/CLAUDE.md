<!-- GSD:project-start source:PROJECT.md -->

## Project

**WordQuest**

WordQuest is a simple vocabulary learning app for children that parents without special know-how can set up in their home network. A parent manages vocabulary sets (manual or CSV import) and child profiles; children log in via profile picker + PIN and learn with SM-2 spaced repetition, XP, streaks and levels. It runs as a Docker Compose stack on a home server such as a Raspberry Pi 5 or NAS. This cycle delivers a working, safe base (v1.0) that other families can install from one install page.

**Core Value:** Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.

### Constraints

- **Simplicity**: every addition must keep install/operation doable for parents without special know-how; when in doubt, leave it out
- **Tech stack**: keep .NET 10 / EF Core / React / PostgreSQL / Docker Compose
- **Architecture**: domain modules stay dependency-free, endpoints stay thin, business logic in services/modules (house rule)
- **Hosting**: ARM64 home hardware, single API replica
- **Accessibility**: WCAG 2.2 AA minimum on all UI changes

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- C# (`LangVersion` = `latest`, nullable + implicit usings enabled) - Backend, all projects under `backend/src/` and `backend/tests/` (settings in `backend/Directory.Build.props`)
- TypeScript 5.9.3 - Frontend SPA under `frontend/src/` (`frontend/tsconfig.json`)
- Bash - `setup.sh` (first-time setup: secrets, `.env`, stack start)
- YAML - Docker Compose files (`docker-compose*.yml`) and CI (`.github/workflows/ci.yml`)
- Nginx config - `frontend/nginx.conf`

## Runtime

- .NET 10 (`<TargetFramework>net10.0</TargetFramework>` in `backend/Directory.Build.props`; CI uses `dotnet-version: 10.0.x`)
- Container images: `mcr.microsoft.com/dotnet/sdk:10.0-alpine` (build) and `mcr.microsoft.com/dotnet/aspnet:10.0-alpine` (runtime) in `backend/Dockerfile`
- `InvariantGlobalization=false` on purpose: German texts and IANA time zones; runtime image installs `icu-libs` and `tzdata`, `TZ=Europe/Berlin`
- Node.js 22 (build only: `node:22-alpine` in `frontend/Dockerfile`, `NODE_VERSION: "22"` in CI)
- Frontend served by `nginxinc/nginx-unprivileged:alpine` on port 8080
- NuGet - versions live directly in each `.csproj`. Central Package Management is explicitly disabled in `backend/Directory.Packages.props` (`ManagePackageVersionsCentrally=false`) - do NOT add versions there
- npm - Lockfile: `frontend/package-lock.json` present (install via `npm ci`)
- Solution file: `backend/WordQuest.slnx` (new XML solution format)

## Frameworks

- ASP.NET Core 10 Minimal APIs - HTTP API (`backend/src/WordQuest.Api/Program.cs`, endpoint groups in `backend/src/WordQuest.Api/Endpoints/*.cs`)
- Entity Framework Core 10.0.12 - ORM, migrations in `backend/src/WordQuest.Infrastructure/Migrations/`
- React 19.3.0 + React DOM - UI (`frontend/src/main.tsx`, `frontend/src/App.tsx`)
- React Router DOM 7.18.4 - client routing
- TanStack React Query 5.102.8 - server state / data fetching
- Tailwind CSS 4.3.3 (via `@tailwindcss/vite`) - styling (`frontend/src/index.css`)
- xUnit 2.9.3 + `xunit.runner.visualstudio` 4.0.0 - backend unit tests (`backend/tests/WordQuest.Learning.Tests/`). Note in csproj: runner 4.x targets xunit v3; if no tests are discovered, align both (downgrade runner to 2.8.2 or move to xunit v3 together)
- `Microsoft.NET.Test.Sdk` 18.10.1
- `coverlet.collector` 10.0.1 - coverage (`--collect:"XPlat Code Coverage"` in CI)
- Frontend: no test framework configured
- Vite 8.3.0 + `@vitejs/plugin-react` 6.1.1 - dev server (port 5173, proxies `/api` to `http://localhost:5080`) and bundler (`frontend/vite.config.ts`)
- `vite-plugin-pwa` 1.3.0 - PWA manifest + Workbox service worker (autoUpdate, `NetworkFirst` cache `wq-api` for GET `/api/*`)
- ESLint 10 + `typescript-eslint` 8.70 + `eslint-plugin-react-hooks` 7.1 (`frontend/eslint.config.js`)
- `.editorconfig` - LF, UTF-8, 4 spaces (C#), 2 spaces (TS/JSON/YAML/MD/SH); C# style rules enforced in build (`EnforceCodeStyleInBuild=true`)
- Docker multi-stage builds: `backend/Dockerfile`, `frontend/Dockerfile` (build context = repo root)

## Key Dependencies

- `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 - PostgreSQL provider (`backend/src/WordQuest.Infrastructure/WordQuest.Infrastructure.csproj`)
- `Microsoft.EntityFrameworkCore` / `.Relational` / `.Design` 10.0.12 - ORM + design-time (`DesignTimeDbContextFactory.cs` needs `.Design` WITHOUT PrivateAssets in Infrastructure)
- `Microsoft.AspNetCore.Authentication.JwtBearer` 10.0.12 + `System.IdentityModel.Tokens.Jwt` 8.22.0 - JWT auth (`backend/src/WordQuest.Api/WordQuest.Api.csproj`)
- `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 10.0.12 - DB health check
- `Microsoft.AspNetCore.OpenApi` 10.0.12 - OpenAPI doc, Development only
- `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot` - accessible primitives for shadcn-style components in `frontend/src/components/ui/`
- `class-variance-authority`, `clsx`, `tailwind-merge` - class composition (`frontend/src/lib/utils.ts`)
- `lucide-react` - icons
- Module projects (`WordQuest.Modules.Identity`, `.Content`, `.Learning`, `.Gamification`, `WordQuest.Shared.Kernel`) have NO NuGet dependencies - keep domain modules dependency-free
- Crypto uses BCL only: PBKDF2-HMAC-SHA256 (`backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs`), SHA256 token hashing (`TokenHasher.cs`)
- Rate limiting: built-in `Microsoft.AspNetCore.RateLimiting` (fixed window, 10/min per IP, policy `auth`)

## Configuration

- Backend reads env vars directly in `backend/src/WordQuest.Api/Program.cs`: `WQ_DB_HOST`, `WQ_DB_PORT`, `WQ_DB_NAME`, `WQ_DB_USER`, `WQ_DB_PASSWORD`, `WQ_JWT_SIGNING_KEY` (min. 32 chars, startup fails otherwise), `WQ_TIMEZONE` (default `Europe/Berlin`), `WQ_SEED_DEMO_DATA`
- Secrets support `<NAME>_FILE` variants (Docker secrets) via `ReadSecret()` in `Program.cs` - prefer files over env vars
- `ConnectionStrings:Default` overrides the `WQ_DB_*` assembly (set in `appsettings.Development.json`)
- `Auth` section in `backend/src/WordQuest.Api/appsettings.json` bound to `AuthOptions` (`backend/src/WordQuest.Api/Auth/AuthOptions.cs`): Issuer, Audience, AccessTokenMinutes=15, RefreshTokenDays=30, MaxPinAttempts=10, PinLockoutMinutes=15
- Dev signing key in `backend/src/WordQuest.Api/Properties/launchSettings.json` (API on `http://localhost:5080`)
- Deployment `.env` template: `.env.example` (keys: `WQ_IMAGE_PREFIX`, `WQ_VERSION`, `WQ_HOST`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`, `WQ_ACME_EMAIL`, `WQ_ACME_DNS_PROVIDER`, `CF_DNS_API_TOKEN`)
- JSON: camelCase + string enums (`ConfigureHttpJsonOptions` in `Program.cs`)
- `backend/Directory.Build.props` - shared MSBuild settings (warnings not errors locally; CI builds with `/warnaserror`)
- `backend/Directory.Packages.props` - CPM disabled marker only
- `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/eslint.config.js`
- Path alias `@` -> `frontend/src`

## Platform Requirements

- .NET 10 SDK, Node 22, Docker (PostgreSQL via `docker-compose.dev.yml`, port 5432, password `devpassword`)
- `dotnet run` for API (port 5080), `npm run dev` for frontend (port 5173)
- EF migrations: `dotnet ef migrations add <Name> --project src/WordQuest.Infrastructure --startup-project src/WordQuest.Api` (run from `backend/`)
- API applies migrations automatically on startup (`db.Database.MigrateAsync()` in `Program.cs`)
- Self-hosted Docker Compose (`docker-compose.yml`): postgres 17, api, web (nginx), Traefik v3 with Let's Encrypt, daily DB backups
- Multi-arch images `linux/amd64,linux/arm64` (Raspberry Pi 5 / ARM NAS targeted) published to GHCR
- HTTPS required for PWA install / service worker

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- C#: one primary type per file, PascalCase, file name = type name (`backend/src/WordQuest.Modules.Learning/Services/AnswerEvaluator.cs`). Grouped types allowed where cohesive (`backend/src/WordQuest.Api/Contracts/Contracts.cs`, `.../Configurations/LearningConfigurations.cs`).
- C# endpoint files: `<Area>Endpoints.cs` in `backend/src/WordQuest.Api/Endpoints/`.
- React pages/components: PascalCase `.tsx`, suffix `Page` for routes (`frontend/src/features/learn/LearnHomePage.tsx`, `ManageLayout.tsx`).
- shadcn-style UI primitives: lowercase (`frontend/src/components/ui/button.tsx`, `card.tsx`, `misc.tsx`).
- TS libs: lowercase (`frontend/src/lib/api.ts`, `auth.tsx`, `utils.ts`).
- C#: PascalCase; async methods end in `Async` (`ListAsync`, `CreateAsync`, `LoginAsync`).
- TS: camelCase functions (`safeRead`, `refreshAccessToken`, `avatarFor`); React components as named `export function LearnHomePage()`.
- C#: private fields `_camelCase` (`_evaluator`, `_options`); constants PascalCase (`private const int MinLengthForTypoTolerance = 5;`).
- TS: camelCase; module constants UPPER_SNAKE (`BASE`, `ACCESS_KEY` in `frontend/src/lib/api.ts`). Unused vars/args must be prefixed `_` (eslint rule).
- C#: classes `sealed` by default (`public sealed class AnswerEvaluator`, `public sealed class Card`); DTOs/values as `sealed record` (`ExpectedAnswer`, `AnswerEvaluation`, `AuthTokens`). Interfaces `I`-prefix (`ITenantOwned`, `ITenantContext` in `backend/src/WordQuest.Shared.Kernel/`).
- Enums with explicit numeric values and XML doc per member (`CardDirection` in `backend/src/WordQuest.Modules.Content/Entities/Card.cs`).
- Entity IDs: `Guid Id { get; set; } = Guid.CreateVersion7();`.
- TS: shared API types in `frontend/src/types.ts`, imported with `import type`.

## Code Style

- `.editorconfig`: UTF-8, LF, final newline, trim whitespace; 4 spaces for C#, 2 spaces for TS/JSON/CSS/YAML/MD/csproj.
- No Prettier config. Observed TS style: no semicolons, single quotes, trailing commas, 2-space indent — match it.
- No `dotnet format` step in CI; formatting enforced via analyzers (`EnforceCodeStyleInBuild=true`).
- C# (`.editorconfig`): file-scoped namespaces (warning), accessibility modifiers required (warning), braces preferred, `System` usings first, explicit types for built-ins (`string given = ...`), `var` only when type is apparent (`var set = new VocabularySet { ... }`). CA2007 disabled (no `ConfigureAwait`).
- `backend/Directory.Build.props`: `Nullable=enable`, `ImplicitUsings=enable`, `LangVersion=latest`, `net10.0`. Warnings are errors only in CI (`dotnet build ... /warnaserror` in `.github/workflows/ci.yml`) — keep the build warning-free.
- Migrations (`**/Migrations/*.cs`) are generated code, style rules off — never hand-edit.
- TS: `frontend/eslint.config.js` — `@eslint/js` recommended + `typescript-eslint` recommended + `react-hooks` recommended. `tsconfig.json` strict with `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax` (type imports must use `import type`).

## Import Organization

- Namespace mirrors folder: `namespace WordQuest.Modules.Learning.Services;`
- `@/*` → `frontend/src/*` (`tsconfig.json`, `vite.config.ts`). Always use `@/`, not relative `../`.

## Error Handling

- Minimal API endpoints return `IResult`; validation failures via `Results.ValidationProblem(new Dictionary<string, string[]> { ["title"] = ["Ein Set braucht einen Titel."] })`; missing rows via `Results.NotFound()`; created via `Results.Created(location, dto)` (`backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs`).
- Domain auth errors: throw `AuthFailedException` (`backend/src/WordQuest.Api/Auth/AuthService.cs`), caught in endpoint and mapped to `Results.Problem(title, detail, 401)` (`AuthEndpoints.cs`).
- Invariant violations: `?? throw new InvalidOperationException("...")` (`backend/src/WordQuest.Infrastructure/LearningService.cs`, `Program.cs` for missing config).
- Guard clauses: `ArgumentNullException.ThrowIfNull(x)` at public entry of domain services.
- User-facing messages are German, full sentences.
- Frontend: `ApiError(message, status)` thrown from `api<T>()` in `frontend/src/lib/api.ts`; storage access wrapped in try/catch with empty-catch comment (`safeRead`/`safeWrite`). 401 triggers single-flight token refresh (`refreshInFlight`).

## Logging

- Log only in Api/Infrastructure; domain modules (`WordQuest.Modules.*`) do not log.
- Frontend: no logging framework, no `console` usage convention.

## Comments

- Comments explain *why* (trade-offs, child-UX constraints, security reasoning), in German, umlauts transliterated (`ae/oe/ue`), e.g. token storage rationale in `frontend/src/lib/api.ts`, 44 px button minimum in `button.tsx`.
- Reference concept doc sections as `(Konzept §6.4)`.
- C#: `/// <summary>` on public domain types and enum members; `GenerateDocumentationFile=false`, so not mandatory everywhere.
- TS: block comments `/* ... */` for rationale; no JSDoc.

## Function Design

## Module Design

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Domain modules hold entities and pure/static rules; they have no EF or HTTP dependency. Only `Modules.Learning` references `Modules.Content`.
- `WordQuest.Infrastructure` references all modules and owns persistence plus the one application service (`LearningService`).
- Endpoints are static classes with `Map*Endpoints(this IEndpointRouteBuilder)` extension methods; handlers are private static methods with DI-injected parameters.
- Multi-tenancy enforced centrally by EF global query filters on every `ITenantOwned` entity.
- Answer grading and scheduling are server-authoritative (concept ADR-006).

## Layers

- Purpose: HTTP surface, auth, composition root
- Depends on: Infrastructure, all modules, Shared.Kernel
- Used by: frontend via `/api/v1`
- Purpose: EF Core DbContext, `IEntityTypeConfiguration` classes in `Configurations/`, migrations, demo seed, `LearningService`
- Depends on: all modules, Shared.Kernel
- Purpose: Entities (`Entities/`) and domain services (`Services/`)
- Depends on: Shared.Kernel (Learning also on Content)
- Purpose: `ITenantContext`, `ITenantOwned`, `Grade`
- `features/*` pages → `lib/api.ts` → `/api/v1`; UI primitives in `components/ui/`.

## Data Flow

### Primary Request Path (learning session)

### Auth Flow

- Backend stateless; all state in PostgreSQL.
- Frontend: TanStack Query cache (`networkMode: 'offlineFirst'`, `frontend/src/App.tsx`), auth in React context (`frontend/src/lib/auth.tsx`), Workbox runtime caching via `vite-plugin-pwa` (`frontend/vite.config.ts`).

## Key Abstractions

- Purpose: tenant isolation
- Examples: `backend/src/WordQuest.Shared.Kernel/ITenantContext.cs`, `backend/src/WordQuest.Api/Auth/HttpTenantContext.cs`, `backend/src/WordQuest.Infrastructure/SystemTenantContext.cs` (bypass for migration/seed only)
- Pattern: global query filter + `StampTenant()` in `SaveChanges` override (`WordQuestDbContext.cs`)

## Entry Points

## Architectural Constraints

- **Threading:** ASP.NET request pipeline; domain services registered as singletons (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`) — keep them stateless.
- **Global state:** static rule classes `XpRules`, `StreakRules`, `LevelCurve`, `GameCatalog`.
- **Circular imports:** none; project refs are acyclic (see `*.csproj`).
- **Secrets:** read from `*_FILE` (Docker secrets) first, env var fallback (`Program.cs` `ReadSecret`). JWT key must be >= 32 chars.
- **Migrations:** applied automatically at startup; CI checks for missing migrations.

## Deviations From Concept Doc

- §10.2 lists `WordQuest.Modules.Reporting` — not present; reporting queries live in `LearnerEndpoints.cs` (`overview`, `traffic-light`).
- §10.2 says modules communicate via in-process domain events (`CardReviewed`) and Shared.Kernel holds `Result<T>`/domain events — neither exists. `LearningService` calls Gamification statics directly.
- §7.3 frontend `games/registry.ts` — not present; `frontend/src/features/learn/SessionPage.tsx` renders sessions directly.
- §13 IndexedDB/Dexie outbox — not present; offline relies on Workbox cache + React Query. `/sessions/sync` endpoint exists server-side.
- §10.1 optional seq/log container — not in `docker-compose.yml`.

## Anti-Patterns

### Data access in endpoints

### Bypassing the tenant filter

## Error Handling

- Domain/service failures throw `InvalidOperationException` (e.g. unknown learner in `LearningService`).
- Frontend throws `ApiError(message, status)` from `frontend/src/lib/api.ts`.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
