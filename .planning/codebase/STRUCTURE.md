---
last_mapped_commit: 00d6615b8a97d9dc54b7a0451f777fbfa6e91621
last_mapped_at: 2026-10-26
---
# Codebase-Struktur

**Analysis Date:** 2026-10-26

## Verzeichnislayout

```
WordQuest/
├── backend/                     # .NET 10 Solution (`WordQuest.slnx`, `Dockerfile`, `Directory.Build.props`, `Directory.Packages.props`)
│   ├── src/
│   │   ├── WordQuest.Api/            # Host, Endpoints, Auth, DTOs, CLI (Konto + `tls`)
│   │   ├── WordQuest.Infrastructure/ # EF Core, Services, Migrationen, Seed
│   │   ├── WordQuest.Modules.Identity/
│   │   ├── WordQuest.Modules.Content/
│   │   ├── WordQuest.Modules.Learning/
│   │   ├── WordQuest.Modules.Gamification/
│   │   └── WordQuest.Shared.Kernel/
│   └── tests/
│       ├── WordQuest.Api.Tests/      # Integrationstests (WebApplicationFactory + PostgreSQL), TLS-Tests
│       └── WordQuest.Learning.Tests/ # Unit-Tests Domänenlogik
├── frontend/                    # React 19 + Vite SPA/PWA, nginx-Image (TLS-Terminierung)
│   ├── src/{features,components/ui,lib,test}/
│   ├── e2e/                     # Playwright + axe gegen gebauten Stack (eigene Compose-Datei)
│   ├── scripts/design-classes.mjs
│   ├── public/                  # Icons
│   ├── nginx.conf               # Template (envsubst nur WQ_*), HTTP 8080 / HTTPS 8443
│   ├── nginx-security-headers.conf
│   └── Dockerfile
├── Documentation/               # Maßgebliche Doku (Konzept, Installation, Fragen, archiv/)
├── .github/                     # CI (`workflows/ci.yml`), `release-package.sh`
├── .claude/skills/vokabel-csv/  # Projekt-Skill
├── .planning/                   # GSD-Planung
├── Claude outputs/              # Lose Ablage (`ci.yml`, `ci-1.yml`)
├── DESIGN.md                    # Design-Tokens (normativ)
├── docker-compose.quick.yml     # Betriebs-Stack: db, api, certs, web, backup
├── docker-compose.build.yml     # Overlay: api/certs/web aus Quellcode bauen
├── docker-compose.dev.yml       # Nur PostgreSQL für lokale Entwicklung/Tests
├── setup.sh · upgrade.sh · restore.sh
└── AGENTS.md · README.md · .env.example · LICENSE
```

## Verzeichniszwecke

**`backend/src/WordQuest.Api/`:**
- Zweck: HTTP-Schicht, Komposition, CLI-Verben
- Enthält: `Endpoints/<Bereich>Endpoints.cs`, `Auth/` (`AuthService`, `JwtTokenService`, `HttpTenantContext`, `ClaimsPrincipalExtensions`, `AuthOptions`), `Contracts/Contracts.cs`
- Schlüsseldateien: `Program.cs`, `TlsCommand.cs`, `TlsCertificates.cs`, `AccountCommands.cs`, `SecretCheck.cs`, `DemoAccountCheck.cs`, `Properties/launchSettings.json`, `appsettings*.json`

**`backend/src/WordQuest.Infrastructure/`:**
- Zweck: Persistenz + modulübergreifende Services
- Enthält: `WordQuestDbContext.cs`, `Configurations/<Modul>Configurations.cs`, `Migrations/` (generiert), `Seed/DemoDataSeeder.cs`
- Schlüsseldateien: `LearningService.cs`, `PictureService.cs`, `AccountService.cs`, `OrphanCleanup.cs`, `TransactionExtensions.cs`, `SystemTenantContext.cs`, `DesignTimeDbContextFactory.cs`, Ergebnis-Records `OwnerCreation.cs`, `PasswordChange.cs`, `WordProgress.cs`

**`backend/src/WordQuest.Modules.<Name>/`:**
- Zweck: Bounded Context ohne EF/HTTP
- Enthält: `Entities/` (z. B. `VocabularyEntry.cs`, `VocabularyPicture.cs`, `ReviewState.cs`, `LearnerProfile.cs`, `RefreshToken.cs`, `GamificationProfile.cs`), `Services/` (Regeln, Algorithmen)

**`backend/src/WordQuest.Shared.Kernel/`:**
- Zweck: Gemeinsame Typen — `Grade.cs`, `ITenantContext.cs`, `ITenantOwned.cs`

**`backend/tests/`:**
- `WordQuest.Api.Tests/`: `ApiFactory.cs` (Factory je Test-DB aus `WQ_TEST_DB`), `TestData.cs`, `FixedClock.cs`, `ManualTimeProvider.cs`, `<Thema>Tests.cs` (u. a. `TlsCommandTests.cs`, `TlsCertificatesTests.cs`, `SiblingIsolationTests.cs`, `RateLimitTests.cs`)
- `WordQuest.Learning.Tests/`: `<Regel>Tests.cs` (u. a. `Sm2SchedulerTests.cs`, `YearLongSimulationTests.cs`)

**`frontend/src/`:**
- `features/auth/` (`GuardianLoginPage`, `ProfilePickerPage`), `features/learn/` (`LearnHomePage`, `SessionPage`), `features/manage/` (`ManageLayout`, `SetsPage`, `SetDetailPage`, `ProgressPage`, `ChildrenPage`, `ChildFormPage`, `AccountPage`)
- `components/ui/`: `button`, `card`, `dialog`, `field`, `input`, `list`, `misc`
- `lib/`: `api.ts`, `auth.tsx`, `picture.tsx`, `gone.ts`, `avatars.ts`, `utils.ts`
- `test/`: `render.tsx`, `setup.ts`
- `types.ts`, `index.css`, `design-tokens.css`, `App.tsx`, `main.tsx`

**`frontend/e2e/`:**
- `docker-compose.e2e.yml` (db, api, certs, web), `global-setup.ts`, `axe.ts`, `pictures.ts`, Specs `<bereich>.spec.ts` (u. a. `tls.spec.ts`, `headers.spec.ts`, `keyboard-zoom.spec.ts`, `first-run.spec.ts`)

## Wichtige Dateien

**Einstiegspunkte:**
- `backend/src/WordQuest.Api/Program.cs`: API-Host, verzweigt in `tls`- und Konto-Verben
- `backend/src/WordQuest.Api/TlsCommand.cs`: Dienst `certs`
- `backend/src/WordQuest.Api/AccountCommands.cs`: Konto-CLI
- `frontend/src/main.tsx`, `frontend/src/App.tsx`: SPA und Routen
- `setup.sh`: Ersteinrichtung beim Betreiber

**Konfiguration:**
- `backend/src/WordQuest.Api/appsettings.json`, `appsettings.Development.json`, `Properties/launchSettings.json`
- `backend/Directory.Build.props`, `backend/Directory.Packages.props` (CPM aus)
- `frontend/vite.config.ts`, `frontend/eslint.config.js`, `frontend/tsconfig.json`, `frontend/playwright.config.ts`
- `frontend/nginx.conf`, `frontend/nginx-security-headers.conf`
- `docker-compose.quick.yml` (Variablen `WQ_VERSION`, `WQ_IMAGE_PREFIX`, `WQ_HTTP_PORT`, `WQ_HTTPS_PORT`, `WQ_TLS_NAMES`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`)
- `.env.example` (Vorlage; `.env` und `secrets/` nicht lesen)
- `.github/workflows/ci.yml`, `.editorconfig`, `.dockerignore`

**Kernlogik:**
- `backend/src/WordQuest.Infrastructure/LearningService.cs`
- `backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs`, `SessionComposer.cs`, `AnswerEvaluator.cs`
- `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs`
- `backend/src/WordQuest.Api/TlsCertificates.cs`

**Tests:**
- `backend/tests/WordQuest.Api.Tests/`, `backend/tests/WordQuest.Learning.Tests/`
- `frontend/src/**/*.test.ts(x)` (co-located), `frontend/e2e/*.spec.ts`

## Namenskonventionen

**Dateien:**
- C#: Dateiname = Typname (`LearningService.cs`); Endpoints `<Bereich>Endpoints.cs`; EF-Konfiguration `<Modul>Configurations.cs`; CLI-Verben `<Verb>Command(s).cs`; Tests `<Thema>Tests.cs`
- React-Seiten: PascalCase + `Page` (`SetDetailPage.tsx`); UI-Primitives/Libs klein (`button.tsx`, `api.ts`)
- Tests: `<Datei>.test.tsx` neben der Quelle; E2E `<bereich>.spec.ts`
- Compose: `docker-compose.<variante>.yml`

**Verzeichnisse:**
- Backend-Projekte `WordQuest.<Schicht>` bzw. `WordQuest.Modules.<Kontext>`; Frontend-Features klein (`auth`, `learn`, `manage`)

## Wo neuer Code hinkommt

**Neue Fachregel:**
- Code: `backend/src/WordQuest.Modules.<Kontext>/Services/`
- Tests: `backend/tests/WordQuest.Learning.Tests/`

**Neuer Endpoint:**
- Route: bestehende `backend/src/WordQuest.Api/Endpoints/<Bereich>Endpoints.cs` bzw. neue Datei + Aufruf in `Program.cs` (nach `MapSessionEndpoints`, `Program.cs:250`)
- DTOs: `backend/src/WordQuest.Api/Contracts/Contracts.cs`
- Orchestrierung über mehrere Module/DB: Service in `backend/src/WordQuest.Infrastructure/`, DI in `Program.cs`
- Tests: `backend/tests/WordQuest.Api.Tests/`

**Neue Entität:**
- Klasse: `backend/src/WordQuest.Modules.<Kontext>/Entities/`, mandantengebunden über `ITenantOwned`
- DbSet + Filter: `WordQuestDbContext.cs`; Mapping: `Configurations/<Modul>Configurations.cs`
- Migration per `dotnet ef migrations add` (nie von Hand ändern)

**TLS / Zertifikate:**
- Logik: `backend/src/WordQuest.Api/TlsCertificates.cs` (rein, testbar), Ablauf/Dateien: `TlsCommand.cs`
- Tests: `backend/tests/WordQuest.Api.Tests/TlsCertificatesTests.cs`, `TlsCommandTests.cs`, E2E `frontend/e2e/tls.spec.ts`
- Namensregel auch in `setup.sh` (`tls_names()`) synchron halten

**Neuer Compose-Dienst / Betriebsänderung:**
- `docker-compose.quick.yml`, bei Images aus Quellcode `docker-compose.build.yml`, für E2E `frontend/e2e/docker-compose.e2e.yml`; Skripte `setup.sh`/`upgrade.sh`/`restore.sh`; Paketinhalt `.github/release-package.sh`; Doku `Documentation/Installation.md`

**Neue Seite / Komponente:**
- Seite: `frontend/src/features/<bereich>/<Name>Page.tsx` + Route in `frontend/src/App.tsx`
- UI-Baustein: `frontend/src/components/ui/` (erst `DESIGN.md` prüfen)
- API-Typen: `frontend/src/types.ts`; Hilfen: `frontend/src/lib/`
- E2E/axe: `frontend/e2e/`

## Besondere Verzeichnisse

**`backend/src/WordQuest.Infrastructure/Migrations/`:**
- Zweck: EF-Migrationen · Generiert: ja · Committet: ja

**`frontend/dist/`, `frontend/node_modules/`, `frontend/test-results/`, `frontend/playwright/`, `backend/**/bin|obj`:**
- Zweck: Build-/Testartefakte · Generiert: ja · Committet: nein

**`secrets/`, `backups/`, `.env` (beim Betreiber, von `setup.sh` erzeugt):**
- Zweck: Docker-Secrets, DB-Sicherungen, Compose-Variablen · Generiert: ja · Committet: nein (nicht lesen)

**Docker-Volumes `pgdata`, `tls-ca`, `tls`:**
- Zweck: DB-Daten, CA (nur `certs`), Serverzertifikat + CA-Download (`web` read-only) · Generiert: ja · Committet: nein

**`Claude outputs/`:**
- Zweck: Lose CI-Entwürfe, nicht von der CI genutzt · Generiert: nein · Committet: ja

**`.planning/`:**
- Zweck: GSD-Stand · Generiert: teils · Committet: ja

---

*Structure analysis: 2026-10-26*
