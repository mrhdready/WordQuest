---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
# Codebase-Struktur

**Analysis Date:** 2026-10-24

## Verzeichnislayout

```
WordQuest/
├── backend/                     # .NET 10 Solution (`WordQuest.slnx`, `Dockerfile`, `Directory.Build.props`)
│   ├── src/
│   │   ├── WordQuest.Api/            # Host, Endpoints, Auth, DTOs, CLI
│   │   ├── WordQuest.Infrastructure/ # EF Core, Services, Migrationen, Seed
│   │   ├── WordQuest.Modules.Identity/
│   │   ├── WordQuest.Modules.Content/
│   │   ├── WordQuest.Modules.Learning/
│   │   ├── WordQuest.Modules.Gamification/
│   │   └── WordQuest.Shared.Kernel/
│   └── tests/
│       ├── WordQuest.Api.Tests/      # Integrationstests (WebApplicationFactory + PostgreSQL)
│       └── WordQuest.Learning.Tests/ # Unit-Tests Domänenlogik
├── frontend/                    # React 19 + Vite SPA/PWA, nginx-Image
│   ├── src/{features,components/ui,lib,test}/
│   ├── e2e/                     # Playwright + axe gegen gebauten Stack
│   ├── scripts/design-classes.mjs
│   └── public/                  # Icons
├── Documentation/               # Maßgebliche Doku (Konzept, Installation, Fragen, archiv/)
├── .github/                     # CI (`workflows/ci.yml`), `release-package.sh`
├── .claude/skills/vokabel-csv/  # Projekt-Skill
├── .planning/                   # GSD-Planung
├── Claude outputs/              # Lose Ablage (`ci.yml`, `ci-1.yml`)
├── DESIGN.md                    # Design-Tokens (normativ)
├── docker-compose{,.quick,.dev,.build}.yml
├── setup.sh · upgrade.sh · restore.sh
└── AGENTS.md · README.md · .env.example
```

## Verzeichniszwecke

**`backend/src/WordQuest.Api/`:**
- Zweck: HTTP-Schicht und Komposition
- Enthält: `Endpoints/<Bereich>Endpoints.cs`, `Auth/`, `Contracts/Contracts.cs`
- Schlüsseldateien: `Program.cs`, `AccountCommands.cs`, `SecretCheck.cs`, `DemoAccountCheck.cs`, `Properties/launchSettings.json`

**`backend/src/WordQuest.Infrastructure/`:**
- Zweck: Persistenz + modulübergreifende Services
- Enthält: `WordQuestDbContext.cs`, `Configurations/<Modul>Configurations.cs`, `Migrations/` (generiert), `Seed/DemoDataSeeder.cs`
- Schlüsseldateien: `LearningService.cs`, `PictureService.cs`, `AccountService.cs`, `OrphanCleanup.cs`, `TransactionExtensions.cs`, `SystemTenantContext.cs`, `DesignTimeDbContextFactory.cs`

**`backend/src/WordQuest.Modules.<Name>/`:**
- Zweck: Bounded Context ohne EF/HTTP
- Enthält: `Entities/` (z. B. `VocabularyEntry.cs`, `ReviewState.cs`, `LearnerProfile.cs`, `GamificationProfile.cs`), `Services/` (Regeln, Algorithmen)

**`backend/src/WordQuest.Shared.Kernel/`:**
- Zweck: Gemeinsame Typen — `Grade.cs`, `ITenantContext.cs`, `ITenantOwned.cs`

**`frontend/src/`:**
- `features/auth/` (`GuardianLoginPage`, `ProfilePickerPage`), `features/learn/` (`LearnHomePage`, `SessionPage`), `features/manage/` (`ManageLayout`, `SetsPage`, `SetDetailPage`, `ProgressPage`, `ChildrenPage`, `ChildFormPage`, `AccountPage`)
- `components/ui/`: `button`, `card`, `dialog`, `field`, `input`, `list`, `misc`
- `lib/`: `api.ts`, `auth.tsx`, `picture.tsx`, `gone.ts`, `avatars.ts`, `utils.ts`
- `test/`: `render.tsx`, `setup.ts`
- `types.ts`, `index.css`, `design-tokens.css`, `App.tsx`, `main.tsx`

## Wichtige Dateien

**Einstiegspunkte:**
- `backend/src/WordQuest.Api/Program.cs`: API-Host
- `backend/src/WordQuest.Api/AccountCommands.cs`: Konto-CLI
- `frontend/src/main.tsx`, `frontend/src/App.tsx`: SPA und Routen

**Konfiguration:**
- `backend/src/WordQuest.Api/appsettings.json`, `appsettings.Development.json`
- `backend/Directory.Build.props`, `backend/Directory.Packages.props` (CPM aus)
- `frontend/vite.config.ts`, `frontend/eslint.config.js`, `frontend/tsconfig.json`, `frontend/playwright.config.ts`
- `frontend/nginx.conf`, `nginx-security-headers.conf`, `nginx-traefik-realip.conf`
- `.env.example` (Vorlage; `.env` nicht lesen)
- `.github/workflows/ci.yml`

**Kernlogik:**
- `backend/src/WordQuest.Infrastructure/LearningService.cs`
- `backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs`, `SessionComposer.cs`, `AnswerEvaluator.cs`
- `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs`

**Tests:**
- `backend/tests/WordQuest.Api.Tests/`, `backend/tests/WordQuest.Learning.Tests/`
- `frontend/src/**/*.test.ts(x)` (co-located), `frontend/e2e/*.spec.ts`

## Namenskonventionen

**Dateien:**
- C#: Dateiname = Typname (`LearningService.cs`); Endpoints `<Bereich>Endpoints.cs`; EF-Konfiguration `<Modul>Configurations.cs`
- React-Seiten: PascalCase + `Page` (`SetDetailPage.tsx`); UI-Primitives/Libs klein (`button.tsx`, `api.ts`)
- Tests: `<Datei>.test.tsx` neben der Quelle; E2E `<bereich>.spec.ts`

**Verzeichnisse:**
- Backend-Projekte `WordQuest.<Schicht>` bzw. `WordQuest.Modules.<Kontext>`; Frontend-Features klein (`auth`, `learn`, `manage`)

## Wo neuer Code hinkommt

**Neue Fachregel:**
- Code: `backend/src/WordQuest.Modules.<Kontext>/Services/`
- Tests: `backend/tests/WordQuest.Learning.Tests/`

**Neuer Endpoint:**
- Route: bestehende `backend/src/WordQuest.Api/Endpoints/<Bereich>Endpoints.cs` bzw. neue Datei + Aufruf in `Program.cs` (nach `MapSessionEndpoints`)
- DTOs: `backend/src/WordQuest.Api/Contracts/Contracts.cs`
- Orchestrierung über mehrere Module/DB: Service in `backend/src/WordQuest.Infrastructure/`, DI in `Program.cs`
- Tests: `backend/tests/WordQuest.Api.Tests/`

**Neue Entität:**
- Klasse: `backend/src/WordQuest.Modules.<Kontext>/Entities/`, mandantengebunden über `ITenantOwned`
- DbSet + Filter: `WordQuestDbContext.cs`; Mapping: `Configurations/<Modul>Configurations.cs`
- Migration per `dotnet ef migrations add` (nie von Hand ändern)

**Neue Seite / Komponente:**
- Seite: `frontend/src/features/<bereich>/<Name>Page.tsx` + Route in `frontend/src/App.tsx`
- UI-Baustein: `frontend/src/components/ui/` (erst `DESIGN.md` prüfen)
- API-Typen: `frontend/src/types.ts`; Hilfen: `frontend/src/lib/`
- E2E/axe: `frontend/e2e/`

## Besondere Verzeichnisse

**`backend/src/WordQuest.Infrastructure/Migrations/`:**
- Zweck: EF-Migrationen · Generiert: ja · Committet: ja

**`frontend/dist/`, `frontend/node_modules/`, `frontend/test-results/`, `frontend/playwright/`:**
- Zweck: Build-/Testartefakte · Generiert: ja · Committet: nein

**`Claude outputs/`:**
- Zweck: Lose CI-Entwürfe, nicht von der CI genutzt · Generiert: nein · Committet: ja

**`.planning/`:**
- Zweck: GSD-Stand · Generiert: teils · Committet: ja

---

*Structure analysis: 2026-10-24*
