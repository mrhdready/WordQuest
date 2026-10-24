---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
<!-- refreshed: 2026-10-24 -->

# Architektur

**Analysis Date:** 2026-10-24

## Systemüberblick

```text
┌──────── Docker-Host (docker-compose.quick.yml = Standard, HTTP im Heimnetz) ────────┐
│  web (nginx + React-SPA/PWA) `frontend/Dockerfile`, `frontend/nginx.conf`            │
│     └─ /api ─► api (ASP.NET Core Minimal API, net10.0) `backend/Dockerfile`          │
│  db (postgres:17-alpine)      backup (prodrigestivill/postgres-backup-local:17)      │
│  Variante: `docker-compose.yml` zusätzlich proxy (Traefik v3, Let's Encrypt)         │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ WordQuest.Api — Komposition, Auth, Endpoints, CLI-Kommandos                           │
│ `backend/src/WordQuest.Api/Program.cs`, `Endpoints/*.cs`, `Auth/*.cs`                 │
└──────────────┬──────────────────────────────────────────────┬────────────────────────┘
               ▼                                              ▼
┌───────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│ WordQuest.Infrastructure              │──►│ Domänenmodule (rein, ohne EF/HTTP/NuGet) │
│ WordQuestDbContext, LearningService,  │   │ Identity · Content · Learning ·          │
│ PictureService, AccountService, EF-   │   │ Gamification                             │
│ Konfigurationen, Migrationen, Seed    │   │ `backend/src/WordQuest.Modules.*`        │
└──────────────┬────────────────────────┘   └──────────────────┬───────────────────────┘
               ▼                                               ▼
        PostgreSQL 17                         WordQuest.Shared.Kernel
                                              (`ITenantContext`, `ITenantOwned`, `Grade`)
```

## Verantwortlichkeiten der Komponenten

| Komponente | Verantwortung | Datei |
|-----------|----------------|------|
| API-Host | Secret-Prüfung, DI, JWT-Auth, Policies, Rate-Limiter, ProblemDetails, Health, Migration + Seed beim Start | `backend/src/WordQuest.Api/Program.cs` |
| CLI-Kommandos | `has-owner`, `create-owner <E-Mail>`, `reset-password <E-Mail>` statt Webserver-Start | `backend/src/WordQuest.Api/AccountCommands.cs` |
| Start-Prüfungen | Signing-Key/DB-Passwort, Demo-Konto-Sperre | `backend/src/WordQuest.Api/SecretCheck.cs`, `DemoAccountCheck.cs` |
| Endpoints | Routen unter `/api/v1/*`: parsen, autorisieren, Service aufrufen, mappen | `backend/src/WordQuest.Api/Endpoints/{Auth,Account,Learner,Set,Picture,Session}Endpoints.cs` |
| DTOs | Request-/Response-Records | `backend/src/WordQuest.Api/Contracts/Contracts.cs` |
| Auth | Login, PIN-Login, Refresh-Rotation, JWT, Mandant aus Claim | `backend/src/WordQuest.Api/Auth/AuthService.cs`, `JwtTokenService.cs`, `HttpTenantContext.cs`, `ClaimsPrincipalExtensions.cs` |
| DbContext | DbSets, Global Query Filters je `ITenantOwned`, TenantId-Stempel beim Speichern | `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs` |
| LearningService | Runde starten / Antwort / Abschluss, Fälligkeiten, Wortfortschritt (Learning + Gamification + DB) | `backend/src/WordQuest.Infrastructure/LearningService.cs` |
| PictureService | Vokabelbilder speichern/laden/entfernen (als `byte[]` in der DB) | `backend/src/WordQuest.Infrastructure/PictureService.cs` |
| AccountService | Eltern-Konto anlegen, Passwort ändern/zurücksetzen, Refresh-Token widerrufen | `backend/src/WordQuest.Infrastructure/AccountService.cs` |
| Start-Aufräumen | Verwaiste Daten vor der Migration bereinigen | `backend/src/WordQuest.Infrastructure/OrphanCleanup.cs` |
| SM-2 / Komposition / Bewertung | Intervalle, Kartenauswahl, Antwortbewertung (Levenshtein, Normalisierung) | `backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs`, `SessionComposer.cs`, `AnswerEvaluator.cs` |
| Spielkatalog / Ampel / Beherrschung | Spiel-Keys, Fortschrittsampel, Mastery-Regeln | `backend/src/WordQuest.Modules.Learning/Services/GameCatalog.cs`, `TrafficLight.cs`, `MasteryRules.cs` |
| Gamification | XP, Streak, Levelkurve (statische Regeln) | `backend/src/WordQuest.Modules.Gamification/Services/*.cs` |
| Inhalte | CSV-Parser, Text- und Bildregeln | `backend/src/WordQuest.Modules.Content/Services/*.cs` |
| Frontend-Shell | Routing, Query-Client, Auth-Provider | `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/lib/auth.tsx` |
| API-Client | `api<T>()`, `ApiError`, Token im localStorage, Refresh, `retryQuery` | `frontend/src/lib/api.ts` |

## Musterüberblick

**Gesamt:** Modularer Monolith (DDD-light) im Backend + SPA/PWA im Frontend, ausgeliefert als ein Compose-Stack mit genau einer API-Instanz.

**Kernmerkmale:**
- Domänenmodule enthalten Entitäten und reine Regeln; ihre `.csproj` referenzieren nur `WordQuest.Shared.Kernel`, `Modules.Learning` zusätzlich `Modules.Content`. Keine NuGet-Pakete.
- Nur `WordQuest.Infrastructure` kennt EF Core/Npgsql; nur `WordQuest.Api` kennt HTTP/JWT.
- Keine Repositories, keine Domain Events, kein `Result<T>`. Fehlerfälle von Services: `null`/`bool` oder Ergebnis-Records (`OwnerCreation.cs`, `PasswordChange.cs`), Sonderfall `SessionCompletedException.cs`.
- Mandantentrennung zentral über EF Global Query Filters.
- Bewertung und Terminierung entscheidet der Server; das Frontend zeigt an.

## Schichten

**Api:**
- Zweck: HTTP, Auth, Komposition
- Ort: `backend/src/WordQuest.Api/`
- Enthält: `Program.cs`, `Endpoints/`, `Auth/`, `Contracts/`
- Hängt ab von: Infrastructure, allen Modulen, Shared.Kernel
- Genutzt von: nginx (`/api`), Tests in `backend/tests/WordQuest.Api.Tests/`

**Infrastructure:**
- Zweck: Persistenz und modulübergreifende Orchestrierung
- Ort: `backend/src/WordQuest.Infrastructure/`
- Enthält: DbContext, `Configurations/`, `Migrations/`, `Seed/DemoDataSeeder.cs`, Services
- Hängt ab von: Modulen, Shared.Kernel, EF Core/Npgsql
- Genutzt von: Api

**Module (Identity, Content, Learning, Gamification):**
- Zweck: Fachbegriffe und Fachregeln
- Ort: `backend/src/WordQuest.Modules.<Name>/{Entities,Services}/`
- Hängt ab von: Shared.Kernel (Learning zusätzlich Content)
- Genutzt von: Infrastructure, Api, `backend/tests/WordQuest.Learning.Tests/`

**Shared.Kernel:**
- Ort: `backend/src/WordQuest.Shared.Kernel/` — `Grade.cs`, `ITenantContext.cs`, `ITenantOwned.cs`

**Frontend:**
- Ort: `frontend/src/` — `features/{auth,learn,manage}/` (Seiten), `components/ui/` (Primitives), `lib/` (API, Auth, Bilder), `types.ts`

## Datenfluss

### Lernrunde (Hauptpfad)

1. `SessionPage` (`frontend/src/features/learn/SessionPage.tsx`) ruft über `api<T>()` (`frontend/src/lib/api.ts:238`) `POST /api/v1/sessions` auf.
2. `SessionEndpoints.StartAsync` (`backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:30`) prüft Größe (1–50) und Rolle, ruft `LearningService.StartSessionAsync` (`backend/src/WordQuest.Infrastructure/LearningService.cs:35`).
3. `SessionComposer` wählt Karten; Antworten laufen über `POST /{sessionId}/answers` → `SubmitAnswerAsync` (`LearningService.cs:176`) → `AnswerEvaluator` + `Sm2Scheduler`.
4. `POST /{sessionId}/complete` → `CompleteSessionAsync` (`LearningService.cs:341`) verbucht XP/Streak/Level über `XpRules`, `StreakRules`, `LevelCurve`.
5. Zusätzlich `POST /api/v1/sessions/sync` und `GET /api/v1/sessions/games`.

### Anmeldung

1. Eltern: `GuardianLoginPage` → `POST /api/v1/auth/login`; Kinder: `ProfilePickerPage` → `GET /auth/profiles`, `POST /auth/learner-login` (PIN).
2. `AuthService` (`backend/src/WordQuest.Api/Auth/AuthService.cs`) prüft mit `PasswordHasher`, stellt JWT (`JwtTokenService`) und Refresh-Token (gehasht über `TokenHasher`) aus.
3. Frontend speichert Token im localStorage (`frontend/src/lib/api.ts`), `POST /auth/refresh` rotiert; Login/PIN sind über die Policy `auth` rate-limitiert (`Program.cs:147`), Refresh/Logout nicht.

### Verwaltung

- Sets/Einträge/CSV-Import: `SetEndpoints.cs` (`/api/v1/sets`, Import in zwei Schritten `import/preview` → `{setId}/import`), Parser `CsvVocabularyParser.cs`.
- Bilder: `PictureEndpoints.cs` (`PUT/DELETE /sets/{setId}/entries/{entryId}/picture`, `GET /pictures/{version}`); Frontend verkleinert vor Upload (`shrinkPicture` in `frontend/src/lib/picture.tsx`).
- Kinder: `LearnerEndpoints.cs` (`/api/v1/learners`, inkl. `overview`, `traffic-light`); Konto: `AccountEndpoints.cs` (`/api/v1/account/password`).

**State Management:**
- Server-State im Frontend: TanStack Query; Auth-State in `AuthProvider` (`frontend/src/lib/auth.tsx`); gelöschte Ressourcen über `useGone` (`frontend/src/lib/gone.ts`).
- Backend zustandslos bis auf In-Memory-Rate-Limiter (deshalb genau eine API-Instanz).

## Zentrale Abstraktionen

**ITenantOwned / ITenantContext:**
- Zweck: Mandant je Entität; aktueller Mandant aus dem Request
- Beispiele: `backend/src/WordQuest.Shared.Kernel/ITenantOwned.cs`, `backend/src/WordQuest.Api/Auth/HttpTenantContext.cs`, `backend/src/WordQuest.Infrastructure/SystemTenantContext.cs`
- Muster: Query Filter in `WordQuestDbContext.cs:129-132`, TenantId-Stempel in `SaveChanges` (`WordQuestDbContext.cs:139-159`)

**Statische Domänenregeln:**
- Beispiele: `ContentRules.cs`, `PictureRules.cs`, `AccountRules.cs`, `XpRules.cs`, `StreakRules.cs`, `MasteryRules.cs`
- Muster: zustandslose Klassen; konfigurierbare Algorithmen (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`) als Singletons mit `SchedulerOptions` (`Program.cs:78-84`)

**Problem-Typen:**
- `ContentTextProblem.cs`, `LearnerProfileProblem.cs` liefern Validierungsfehler aus Modulen, Endpoints mappen auf `Results.ValidationProblem`.

## Einstiegspunkte

**API-Server:**
- Ort: `backend/src/WordQuest.Api/Program.cs`
- Auslöser: Container-Start / `dotnet run`
- Aufgaben: Prüfungen, DI, Middleware (`UseExceptionHandler` → `UseForwardedHeaders` → `UseRateLimiter` → `UseAuthentication` → `UseAuthorization`), `/health/live`, `/health/ready`, `OrphanCleanup` + `MigrateAsync` + optional `DemoDataSeeder`

**Konto-CLI:**
- Ort: `backend/src/WordQuest.Api/AccountCommands.cs` (`Program.cs:204`), genutzt von `setup.sh`

**Frontend:**
- Ort: `frontend/src/main.tsx` → `frontend/src/App.tsx` (Routen `/login`, `/`, `/lernen`, `/verwalten/*`)

**Betriebsskripte:** `setup.sh`, `upgrade.sh`, `restore.sh`; Release: `.github/release-package.sh`

## Architektonische Rahmenbedingungen

- **Threading:** ASP.NET-Request-Modell, async durchgehend; keine Hintergrund-Worker.
- **Globaler Zustand:** Singletons `JwtTokenService`, `SchedulerOptions`, `Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`, `TimeProvider.System`; In-Memory-Rate-Limiter (`Program.cs:147`).
- **Zirkuläre Abhängigkeiten:** keine; Projektreferenzen sind gerichtet (Api → Infrastructure → Module → Shared.Kernel).
- **Eine Instanz:** Migration beim Start und Rate-Limiter setzen genau eine API-Instanz voraus.
- **Ohne HTTPS kein Service Worker:** Die App muss als reine Browser-App funktionieren (`vite-plugin-pwa` in `frontend/vite.config.ts`).

## Anti-Patterns

### Geschäftslogik im Endpoint

**Was passiert:** Endpoints wie `SetEndpoints.cs` (390 Zeilen) sind groß und laufen Gefahr, Logik zu sammeln.
**Warum falsch:** Widerspricht „Endpoints parsen, autorisieren, rufen auf, mappen“ (`AGENTS.md`).
**Stattdessen:** Regeln in Modul-Services (`ContentRules.cs`) oder Infrastructure-Service (Muster `LearningService.cs`).

### Filter umgehen

**Was passiert:** `IgnoreQueryFilters()` / `SystemTenantContext` außerhalb von Auth/Start.
**Warum falsch:** Bricht Mandantentrennung.
**Stattdessen:** Nur wie im Bestand: `Auth/AuthService.cs`, `Endpoints/AuthEndpoints.cs`, `AccountCommands.cs`, `Program.cs`, `Seed/DemoDataSeeder.cs`, `DesignTimeDbContextFactory.cs`; neue Entitäten über `ITenantOwned` im `WordQuestDbContext` registrieren.

### Integrität per Hand

**Was passiert:** Handgeschriebene Löschlisten.
**Stattdessen:** Fremdschlüssel/Constraints in `Configurations/*Configurations.cs` (siehe Migration `ReferentialIntegrity`).

## Fehlerbehandlung

**Strategie:** Endpoints liefern `IResult` (`Results.ValidationProblem`, `Results.NotFound`, `Results.Problem`); globale `AddProblemDetails` + `UseExceptionHandler` + `UseStatusCodePages`.

**Muster:**
- Deutsche Nutzertexte als Konstanten im Endpoint (z. B. `SessionEndpoints.cs`).
- Services signalisieren „nicht gefunden“ über `null`; Frontend wirft `ApiError(message, status)` (`frontend/src/lib/api.ts:24`).

## Querschnittsthemen

**Logging:** `ILogger` nur in Api/Infrastructure, keine personenbezogenen Daten; Module loggen nicht.
**Validierung:** an der API-Grenze über Modulregeln (`ContentRules`, `AccountRules`, `PictureRules`).
**Authentifizierung:** JWT-Bearer, Policies `Guardian` (Owner/Guardian) und `Learner` (`Program.cs:120-122`); Secrets über `ReadSecret()` (`<NAME>_FILE`, dann Env).

---

*Architecture analysis: 2026-10-24*
