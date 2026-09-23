---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
# Codebase Structure

**Analysis Date:** 2026-09-24

## Directory Layout

```
WordQuest/
├── .github/workflows/ci.yml     # CI (build, tests, migration check)
├── Claude outputs/              # Stray AI-generated CI drafts (ci.yml, ci-1.yml), not used
├── Documentation/               # Concept doc (authoritative) + .docx
├── backend/
│   ├── WordQuest.slnx           # Solution
│   ├── Directory.Build.props    # Shared MSBuild settings
│   ├── Directory.Packages.props # Central package versions
│   ├── Dockerfile
│   ├── src/
│   │   ├── WordQuest.Api/                 # Host, endpoints, auth, DTOs
│   │   ├── WordQuest.Infrastructure/      # EF Core, migrations, seed, LearningService
│   │   ├── WordQuest.Modules.Identity/    # Tenant, User, LearnerProfile, RefreshToken, hashing
│   │   ├── WordQuest.Modules.Content/     # VocabularySet/Entry, Card, CSV parser
│   │   ├── WordQuest.Modules.Learning/    # SM-2, composer, evaluator, game catalog
│   │   ├── WordQuest.Modules.Gamification/# XP, streak, level rules, profile
│   │   └── WordQuest.Shared.Kernel/       # Tenant interfaces, Grade
│   └── tests/WordQuest.Learning.Tests/    # Unit + year-long simulation tests
├── frontend/
│   ├── src/
│   │   ├── features/{auth,learn,manage}/  # Pages per feature
│   │   ├── components/ui/                 # button, card, input, misc primitives
│   │   ├── lib/                           # api client, auth context, avatars, utils
│   │   ├── types.ts                       # API types
│   │   ├── App.tsx, main.tsx, index.css
│   ├── public/                  # favicon, PWA icons
│   ├── vite.config.ts           # Vite + Tailwind + PWA/Workbox
│   ├── nginx.conf, Dockerfile
├── docker-compose.yml           # Prod: proxy, web, api, db, backup
├── docker-compose.{dev,build,quick}.yml
├── setup.sh                     # Generates secrets / bootstraps
└── .env.example
```

## Directory Purposes

**`backend/src/WordQuest.Api/`:**

- Purpose: HTTP layer and composition root
- Contains: `Endpoints/*Endpoints.cs`, `Auth/*`, `Contracts/Contracts.cs`
- Key files: `Program.cs`

**`backend/src/WordQuest.Infrastructure/`:**

- Purpose: persistence and orchestration
- Contains: `Configurations/<Module>Configurations.cs`, `Migrations/`, `Seed/DemoDataSeeder.cs`
- Key files: `WordQuestDbContext.cs`, `LearningService.cs`

**`backend/src/WordQuest.Modules.<Name>/`:**

- Purpose: one bounded domain each
- Contains: `Entities/` (EF-agnostic classes), `Services/` (pure logic, often static)

**`backend/tests/WordQuest.Learning.Tests/`:**

- Purpose: tests for Learning, Content parser, Gamification
- Key files: `Sm2SchedulerTests.cs`, `YearLongSimulationTests.cs`

**`frontend/src/features/`:**

- `auth/`: `GuardianLoginPage.tsx`, `ProfilePickerPage.tsx`
- `learn/`: `LearnHomePage.tsx`, `SessionPage.tsx`
- `manage/`: `ManageLayout.tsx`, `SetsPage.tsx`, `SetDetailPage.tsx`, `ProgressPage.tsx`

## Key File Locations

**Entry Points:**

- `backend/src/WordQuest.Api/Program.cs`: API host
- `frontend/src/main.tsx`: React mount; `frontend/src/App.tsx`: routes

**Configuration:**

- `backend/src/WordQuest.Api/appsettings*.json`, `backend/Directory.Packages.props`
- `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/eslint.config.js`, `.editorconfig`
- `docker-compose*.yml`, `.env.example` (`.env` not tracked)

**Core Logic:**

- `backend/src/WordQuest.Infrastructure/LearningService.cs`
- `backend/src/WordQuest.Modules.Learning/Services/`

**Testing:**

- `backend/tests/WordQuest.Learning.Tests/`

## Naming Conventions

**Files:**

- C#: one type per file, PascalCase = type name (`Sm2Scheduler.cs`); endpoint groups `<Resource>Endpoints.cs`; EF configs grouped per module `<Module>Configurations.cs`; tests `<Class>Tests.cs`.
- React: PascalCase components with `Page`/`Layout` suffix (`SetDetailPage.tsx`); lowercase for `components/ui/*.tsx` and `lib/*.ts`.

**Directories:**

- Backend projects `WordQuest.<Layer>` / `WordQuest.Modules.<Domain>`; inside: `Entities/`, `Services/`.
- Frontend features lowercase (`features/manage`). Route paths German (`/lernen`, `/verwalten`, `/fortschritt`).

**Namespaces:** mirror folder (`WordQuest.Modules.Learning.Services`). Frontend imports via `@/` alias.

## Where to Add New Code

**New API endpoint:**

- Route: new or existing `backend/src/WordQuest.Api/Endpoints/<Resource>Endpoints.cs` under `/api/v1/...`, register `app.Map<Resource>Endpoints()` in `Program.cs`
- DTOs: `backend/src/WordQuest.Api/Contracts/Contracts.cs`
- Logic beyond CRUD: a scoped service in `backend/src/WordQuest.Infrastructure/`

**New entity:**

- Class: `backend/src/WordQuest.Modules.<Domain>/Entities/`; implement `ITenantOwned` if user data
- EF config: `backend/src/WordQuest.Infrastructure/Configurations/<Domain>Configurations.cs`
- DbSet + `ApplyTenantFilter<T>` in `WordQuestDbContext.cs`
- Migration: `dotnet ef migrations add <Name>` into `backend/src/WordQuest.Infrastructure/Migrations/` (CI fails on missing migration)

**New domain rule:**

- `backend/src/WordQuest.Modules.<Domain>/Services/`; tests in `backend/tests/WordQuest.Learning.Tests/`

**New game:**

- Server: entry in `backend/src/WordQuest.Modules.Learning/Services/GameCatalog.cs`
- Client: currently in `frontend/src/features/learn/SessionPage.tsx` (no registry yet)

**New frontend page:**

- `frontend/src/features/<area>/<Name>Page.tsx`, route in `frontend/src/App.tsx`, API calls via `frontend/src/lib/api.ts`, types in `frontend/src/types.ts`

**Utilities:**

- Frontend: `frontend/src/lib/utils.ts`; UI primitives `frontend/src/components/ui/`
- Backend cross-module: `backend/src/WordQuest.Shared.Kernel/`

## Special Directories

**`backend/src/WordQuest.Infrastructure/Migrations/`:**

- Purpose: EF Core migrations + snapshot
- Generated: Yes
- Committed: Yes

**`Claude outputs/`:**

- Purpose: leftover CI drafts
- Generated: Yes (AI)
- Committed: Yes (candidate for removal)

**`bin/`, `obj/`, `node_modules/`, `dist/`:**

- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-09-24*
