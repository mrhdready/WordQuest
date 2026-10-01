---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
# Coding Conventions

**Analysis Date:** 2026-09-24

Two stacks: .NET 10 backend (`backend/`) and React 19 + TypeScript frontend (`frontend/`). Style is enforced by `.editorconfig` (root), `backend/Directory.Build.props`, `frontend/eslint.config.js`, `frontend/tsconfig.json`.

## Naming Patterns

**Files:**

- C#: one primary type per file, PascalCase, file name = type name (`backend/src/WordQuest.Modules.Learning/Services/AnswerEvaluator.cs`). Grouped types allowed where cohesive (`backend/src/WordQuest.Api/Contracts/Contracts.cs`, `.../Configurations/LearningConfigurations.cs`).
- C# endpoint files: `<Area>Endpoints.cs` in `backend/src/WordQuest.Api/Endpoints/`.
- React pages/components: PascalCase `.tsx`, suffix `Page` for routes (`frontend/src/features/learn/LearnHomePage.tsx`, `ManageLayout.tsx`).
- shadcn-style UI primitives: lowercase (`frontend/src/components/ui/button.tsx`, `card.tsx`, `misc.tsx`).
- TS libs: lowercase (`frontend/src/lib/api.ts`, `auth.tsx`, `utils.ts`).

**Functions:**

- C#: PascalCase; async methods end in `Async` (`ListAsync`, `CreateAsync`, `LoginAsync`).
- TS: camelCase functions (`safeRead`, `refreshAccessToken`, `avatarFor`); React components as named `export function LearnHomePage()`.

**Variables:**

- C#: private fields `_camelCase` (`_evaluator`, `_options`); constants PascalCase (`private const int MinLengthForTypoTolerance = 5;`).
- TS: camelCase; module constants UPPER_SNAKE (`BASE`, `ACCESS_KEY` in `frontend/src/lib/api.ts`). Unused vars/args must be prefixed `_` (eslint rule).

**Types:**

- C#: classes `sealed` by default (`public sealed class AnswerEvaluator`, `public sealed class Card`); DTOs/values as `sealed record` (`ExpectedAnswer`, `AnswerEvaluation`, `AuthTokens`). Interfaces `I`-prefix (`ITenantOwned`, `ITenantContext` in `backend/src/WordQuest.Shared.Kernel/`).
- Enums with explicit numeric values and XML doc per member (`CardDirection` in `backend/src/WordQuest.Modules.Content/Entities/Card.cs`).
- Entity IDs: `Guid Id { get; set; } = Guid.CreateVersion7();`.
- TS: shared API types in `frontend/src/types.ts`, imported with `import type`.

## Code Style

**Formatting:**

- `.editorconfig`: UTF-8, LF, final newline, trim whitespace; 4 spaces for C#, 2 spaces for TS/JSON/CSS/YAML/MD/csproj.
- No Prettier config. Observed TS style: no semicolons, single quotes, trailing commas, 2-space indent — match it.
- No `dotnet format` step in CI; formatting enforced via analyzers (`EnforceCodeStyleInBuild=true`).

**Linting:**

- C# (`.editorconfig`): file-scoped namespaces (warning), accessibility modifiers required (warning), braces preferred, `System` usings first, explicit types for built-ins (`string given = ...`), `var` only when type is apparent (`var set = new VocabularySet { ... }`). CA2007 disabled (no `ConfigureAwait`).
- `backend/Directory.Build.props`: `Nullable=enable`, `ImplicitUsings=enable`, `LangVersion=latest`, `net10.0`. Warnings are errors only in CI (`dotnet build ... /warnaserror` in `.github/workflows/ci.yml`) — keep the build warning-free.
- Migrations (`**/Migrations/*.cs`) are generated code, style rules off — never hand-edit.
- TS: `frontend/eslint.config.js` — `@eslint/js` recommended + `typescript-eslint` recommended + `react-hooks` recommended. `tsconfig.json` strict with `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax` (type imports must use `import type`).

## Import Organization

**C#:**

1. `System*`/`Microsoft*` usings first (sorted)
2. `WordQuest.*` project usings
- Namespace mirrors folder: `namespace WordQuest.Modules.Learning.Services;`

**TS (see `frontend/src/features/learn/LearnHomePage.tsx`):**

1. External packages (`@tanstack/react-query`, `lucide-react`, `react`, `react-router-dom`), alphabetical
2. `@/components/...`
3. `@/lib/...`
4. `import type { ... } from '@/types'` last

**Path Aliases:**

- `@/*` → `frontend/src/*` (`tsconfig.json`, `vite.config.ts`). Always use `@/`, not relative `../`.

## Error Handling

**Patterns:**

- Minimal API endpoints return `IResult`; validation failures via `Results.ValidationProblem(new Dictionary<string, string[]> { ["title"] = ["Ein Set braucht einen Titel."] })`; missing rows via `Results.NotFound()`; created via `Results.Created(location, dto)` (`backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs`).
- Domain auth errors: throw `AuthFailedException` (`backend/src/WordQuest.Api/Auth/AuthService.cs`), caught in endpoint and mapped to `Results.Problem(title, detail, 401)` (`AuthEndpoints.cs`).
- Invariant violations: `?? throw new InvalidOperationException("...")` (`backend/src/WordQuest.Infrastructure/LearningService.cs`, `Program.cs` for missing config).
- Guard clauses: `ArgumentNullException.ThrowIfNull(x)` at public entry of domain services.
- User-facing messages are German, full sentences.
- Frontend: `ApiError(message, status)` thrown from `api<T>()` in `frontend/src/lib/api.ts`; storage access wrapped in try/catch with empty-catch comment (`safeRead`/`safeWrite`). 401 triggers single-flight token refresh (`refreshInFlight`).

## Logging

**Framework:** `Microsoft.Extensions.Logging` (`ILogger<T>` injected via primary constructor, e.g. `AuthService`; `ILogger` passed into `DemoDataSeeder`).

**Patterns:**

- Log only in Api/Infrastructure; domain modules (`WordQuest.Modules.*`) do not log.
- Frontend: no logging framework, no `console` usage convention.

## Comments

**When to Comment:**

- Comments explain *why* (trade-offs, child-UX constraints, security reasoning), in German, umlauts transliterated (`ae/oe/ue`), e.g. token storage rationale in `frontend/src/lib/api.ts`, 44 px button minimum in `button.tsx`.
- Reference concept doc sections as `(Konzept §6.4)`.

**JSDoc/TSDoc:**

- C#: `/// <summary>` on public domain types and enum members; `GenerateDocumentationFile=false`, so not mandatory everywhere.
- TS: block comments `/* ... */` for rationale; no JSDoc.

## Function Design

**Size:** Small pure services in modules (`Levenshtein`, `TextNormalizer`, `XpRules`, `StreakRules`); orchestration in `backend/src/WordQuest.Infrastructure/LearningService.cs`.

**Parameters:** Primary constructors for DI (`public sealed class AuthService(WordQuestDbContext db, ...)`); optional options with defaults (`AnswerEvaluator(SchedulerOptions? options = null)`). Always pass `CancellationToken ct` last in async methods. Inject `TimeProvider` / pass `DateTimeOffset now` instead of `DateTime.Now`.

**Return Values:** Records for results (`AnswerEvaluation`, `CsvParseResult`); `IReadOnlyList<T>` for collections; nullable reference types honoured (`VocabularySet?` + `is null` check).

## Module Design

**Exports:** Backend modules (`WordQuest.Modules.Content|Learning|Gamification|Identity`) each have `Entities/` and `Services/`; public types, no DI extension methods. Endpoints are `static class XEndpoints` with `MapXEndpoints(this IEndpointRouteBuilder app)` extension and private static handlers. Routes grouped under `/api/v1/...` with `.WithTags(...)` and `.RequireAuthorization("Guardian")` per write route.

**Barrel Files:** None. Frontend imports files directly (`@/components/ui/button`).

---

*Convention analysis: 2026-09-24*
