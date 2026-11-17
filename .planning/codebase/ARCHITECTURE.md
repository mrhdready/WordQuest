---
last_mapped_commit: 00d6615b8a97d9dc54b7a0451f777fbfa6e91621
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Architektur

**Analysis Date:** 2026-10-26

## Systemüberblick

```text
┌──────── Docker-Host: docker-compose.quick.yml (einziger Betriebsweg, HTTPS mit eigener CA) ────────┐
│  web (nginx-unprivileged + React-SPA/PWA)  `frontend/Dockerfile`, `frontend/nginx.conf`             │
│     :8080 HTTP  → 301 auf HTTPS, plus Download /wordquest-ca.crt                                     │
│     :8443 HTTPS → SPA, /api/ und /health/ ─► api:8080                                                │
│  certs (API-Image, `tls watch`, network_mode: none) ─► Volumes tls-ca (nur certs), tls (web liest ro)│
│  api   (ASP.NET Core Minimal API, net10.0)  `backend/Dockerfile`                                     │
│  db    (postgres:17-alpine)      backup (prodrigestivill/postgres-backup-local:17 → ./backups)       │
│  Overlay `docker-compose.build.yml`: baut api/certs/web aus dem Quellcode                            │
└────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WordQuest.Api — Komposition, Auth, Endpoints, CLI-Verben (`tls …`, Konto-Kommandos)                   │
│ `backend/src/WordQuest.Api/Program.cs`, `Endpoints/*.cs`, `Auth/*.cs`, `TlsCommand.cs`                 │
└──────────────┬────────────────────────────────────────────────────┬──────────────────────────────────┘
               ▼                                                    ▼
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
| TLS-Verb | `tls watch` (einziger Schreiber von CA + Serverzertifikat, Takt mit `TimeProvider`), `tls show` (nur lesen, Fingerabdrücke für `setup.sh`) | `backend/src/WordQuest.Api/TlsCommand.cs` |
| TLS-Zertifikate | CA anlegen, Serverzertifikat ausstellen (800 Tage, 30 Tage vorher erneuern), Namensliste prüfen/parsen, SAN, Fingerprint | `backend/src/WordQuest.Api/TlsCertificates.cs` |
| Konto-CLI | `has-owner`, `create-owner <E-Mail>`, `reset-password <E-Mail>` statt Webserver-Start | `backend/src/WordQuest.Api/AccountCommands.cs` |
| Start-Prüfungen | Signing-Key/DB-Passwort, Demo-Konto-Sperre | `backend/src/WordQuest.Api/SecretCheck.cs`, `DemoAccountCheck.cs` |
| Endpoints | Routen unter `/api/v1/*`: parsen, autorisieren, Service aufrufen, mappen | `backend/src/WordQuest.Api/Endpoints/{Auth,Account,Learner,Set,Picture,Session}Endpoints.cs` |
| DTOs | Request-/Response-Records | `backend/src/WordQuest.Api/Contracts/Contracts.cs` |
| Auth | Login, PIN-Login, Refresh-Rotation, JWT, Mandant aus Claim | `backend/src/WordQuest.Api/Auth/AuthService.cs`, `JwtTokenService.cs`, `HttpTenantContext.cs`, `ClaimsPrincipalExtensions.cs`, `AuthOptions.cs` |
| DbContext | DbSets, Global Query Filters je `ITenantOwned`, TenantId-Stempel beim Speichern | `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs` |
| LearningService | Runde starten / Antwort / Abschluss, Fälligkeiten, Wortfortschritt (Learning + Gamification + DB) | `backend/src/WordQuest.Infrastructure/LearningService.cs` |
| PictureService | Vokabelbilder speichern/laden/entfernen (als `byte[]` in der DB) | `backend/src/WordQuest.Infrastructure/PictureService.cs` |
| AccountService | Eltern-Konto anlegen, Passwort ändern/zurücksetzen, Refresh-Token widerrufen | `backend/src/WordQuest.Infrastructure/AccountService.cs` |
| Start-Aufräumen | Verwaiste Daten vor der Migration bereinigen | `backend/src/WordQuest.Infrastructure/OrphanCleanup.cs` |
| SM-2 / Komposition / Bewertung | Intervalle, Kartenauswahl, Antwortbewertung (Levenshtein, Normalisierung) | `backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs`, `SessionComposer.cs`, `AnswerEvaluator.cs` |
| Spielkatalog / Ampel / Beherrschung | Spiel-Keys, Fortschrittsampel, Mastery-Regeln | `backend/src/WordQuest.Modules.Learning/Services/GameCatalog.cs`, `TrafficLight.cs`, `MasteryRules.cs` |
| Gamification | XP, Streak, Levelkurve (statische Regeln) | `backend/src/WordQuest.Modules.Gamification/Services/*.cs` |
| Inhalte | CSV-Parser, Text- und Bildregeln | `backend/src/WordQuest.Modules.Content/Services/*.cs` |
| Reverse Proxy / TLS-Terminierung | HTTP→HTTPS-Umleitung, CA-Download, Security-Header, Proxy auf `api:8080`, Zertifikat per Variable (je Handshake neu gelesen, kein Reload nötig) | `frontend/nginx.conf`, `frontend/nginx-security-headers.conf` |
| Frontend-Shell | Routing, Query-Client, Auth-Provider | `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/lib/auth.tsx` |
| API-Client | `api<T>()`, `ApiError`, Token im localStorage, Refresh, `retryQuery` | `frontend/src/lib/api.ts` |
| Betrieb | Einrichtung (Secrets, `.env`, `WQ_TLS_NAMES`, Elternkonto, CA-Fingerprint), Upgrade, Restore | `setup.sh`, `upgrade.sh`, `restore.sh` |

## Musterüberblick

**Gesamt:** Modularer Monolith (DDD-light) im Backend + SPA/PWA im Frontend, ausgeliefert als ein Compose-Stack mit genau einer API-Instanz; nginx terminiert TLS mit einer pro Installation erzeugten CA.

**Kernmerkmale:**
- Domänenmodule enthalten Entitäten und reine Regeln; ihre `.csproj` referenzieren nur `WordQuest.Shared.Kernel`, `Modules.Learning` zusätzlich `Modules.Content`. Keine NuGet-Pakete.
- Nur `WordQuest.Infrastructure` kennt EF Core/Npgsql; nur `WordQuest.Api` kennt HTTP/JWT/X.509.
- Ein Image, mehrere Rollen: Das API-Image läuft als `api` (Webserver) und als `certs` (`command: ["tls", "watch"]`); Verzweigung über `TlsCommand.IsCommand(args)` vor dem Webhost (`Program.cs:19`).
- Keine Repositories, keine Domain Events, kein `Result<T>`. Fehlerfälle von Services: `null`/`bool` oder Ergebnis-Records (`OwnerCreation.cs`, `PasswordChange.cs`), Sonderfall `SessionCompletedException.cs`.
- Mandantentrennung zentral über EF Global Query Filters.
- Bewertung und Terminierung entscheidet der Server; das Frontend zeigt an.

## Schichten

**Api:**
- Zweck: HTTP, Auth, Komposition, CLI-Verben
- Ort: `backend/src/WordQuest.Api/`
- Enthält: `Program.cs`, `Endpoints/`, `Auth/`, `Contracts/`, `TlsCommand.cs`, `TlsCertificates.cs`, `AccountCommands.cs`
- Hängt ab von: Infrastructure, allen Modulen, Shared.Kernel
- Genutzt von: nginx (`/api/`, `/health/`), Dienst `certs`, `setup.sh`, Tests in `backend/tests/WordQuest.Api.Tests/`

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

1. `SessionPage` (`frontend/src/features/learn/SessionPage.tsx`) ruft über `api<T>()` (`frontend/src/lib/api.ts:238`) `POST /api/v1/sessions` auf; nginx leitet `/api/` an `api:8080` weiter (`frontend/nginx.conf:83`).
2. `SessionEndpoints` (`backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs`) prüft Größe und Rolle, ruft `LearningService.StartSessionAsync` (`backend/src/WordQuest.Infrastructure/LearningService.cs:35`).
3. `SessionComposer` wählt Karten; Antworten laufen über `POST /{sessionId}/answers` → `SubmitAnswerAsync` (`LearningService.cs:176`) → `AnswerEvaluator` + `Sm2Scheduler`.
4. `POST /{sessionId}/complete` → `CompleteSessionAsync` (`LearningService.cs:341`) verbucht XP/Streak/Level über `XpRules`, `StreakRules`, `LevelCurve`.
5. Zusätzlich `POST /api/v1/sessions/sync` und `GET /api/v1/sessions/games`.

### Anmeldung

1. Eltern: `GuardianLoginPage` → `POST /api/v1/auth/login`; Kinder: `ProfilePickerPage` → `GET /auth/profiles`, `POST /auth/learner-login` (PIN).
2. `AuthService` (`backend/src/WordQuest.Api/Auth/AuthService.cs`) prüft mit `PasswordHasher`, stellt JWT (`JwtTokenService`) und Refresh-Token (gehasht über `TokenHasher`) aus.
3. Frontend speichert Token im localStorage (`frontend/src/lib/api.ts`), `POST /auth/refresh` rotiert. Policy `auth` (`Program.cs:161-164`) liegt auf Login/PIN (`AuthEndpoints.cs:17`) und Passwortänderung (`AccountEndpoints.cs:18`); Refresh/Logout sind ausgenommen (`AuthEndpoints.cs:25-26`). Partition nach Client-IP, die nginx als `X-Forwarded-For` setzt (`frontend/nginx.conf:83-95`).

### Zertifikat (TLS)

1. `certs` startet `tls watch` (`TlsCommand.cs`), Namen aus `WQ_TLS_NAMES` (von `setup.sh`, Funktion `tls_names()`, in `.env` geschrieben).
2. Erster Lauf: CA in Volume `tls-ca` (`ca/ca.key` 0600, `ca/ca.crt`), danach `tls/server.pem` (0640, Gruppe 101) und `tls/wordquest-ca.crt` (DER) in Volume `tls`; Schreiben über Temp-Datei + Umbenennen.
3. Periodischer Takt: `TlsCertificates.NeedsReissue` (Ablauf, Namensänderung) → neu ausstellen. Unklarer CA-Zustand → `AuthorityException`, nichts wird geschrieben.
4. `web` mountet `tls` read-only; `ssl_certificate $wq_tls_file` (`frontend/nginx.conf:6-8, 39-40`) liest bei jedem Handshake neu.
5. `setup.sh` wartet über `docker compose exec certs … tls show` auf das Zertifikat und zeigt den CA-Fingerprint an; Geräte laden die CA über `http://<host>/wordquest-ca.crt`.

### Verwaltung

- Sets/Einträge/CSV-Import: `SetEndpoints.cs` (`/api/v1/sets`, Import in zwei Schritten `import/preview` → `{setId}/import`), Parser `CsvVocabularyParser.cs`.
- Bilder: `PictureEndpoints.cs` (`PUT/DELETE /sets/{setId}/entries/{entryId}/picture`, `GET /pictures/{version}`); Frontend verkleinert vor Upload (`frontend/src/lib/picture.tsx`).
- Kinder: `LearnerEndpoints.cs` (`/api/v1/learners`, inkl. `overview`, `traffic-light`); Konto: `AccountEndpoints.cs` (`/api/v1/account/password`).

**State Management:**
- Server-State im Frontend: TanStack Query; Auth-State in `AuthProvider` (`frontend/src/lib/auth.tsx`); gelöschte Ressourcen über `useGone` (`frontend/src/lib/gone.ts`).
- Backend zustandslos bis auf In-Memory-Rate-Limiter (deshalb genau eine API-Instanz).
- Persistenter Zustand außerhalb der DB: Volumes `tls-ca`/`tls` (Zertifikate), `./backups`, `./secrets` (DB-Passwort, JWT-Schlüssel als Docker-Secrets). Die CA ist nicht Teil der Backups.

## Zentrale Abstraktionen

**ITenantOwned / ITenantContext:**
- Zweck: Mandant je Entität; aktueller Mandant aus dem Request
- Beispiele: `backend/src/WordQuest.Shared.Kernel/ITenantOwned.cs`, `backend/src/WordQuest.Api/Auth/HttpTenantContext.cs`, `backend/src/WordQuest.Infrastructure/SystemTenantContext.cs`
- Muster: Query Filter in `WordQuestDbContext.cs:44` (Tenant) und `:132` (alle `ITenantOwned`), TenantId-Stempel in `SaveChanges` (`WordQuestDbContext.cs:139-160`)

**Statische Domänenregeln:**
- Beispiele: `ContentRules.cs`, `PictureRules.cs`, `AccountRules.cs`, `XpRules.cs`, `StreakRules.cs`, `MasteryRules.cs`, `TlsCertificates.cs`
- Muster: zustandslose Klassen; konfigurierbare Algorithmen (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`) als Singletons mit `SchedulerOptions` (`Program.cs:92-98`)

**CLI-Verben im API-Image:**
- `TlsCommand.IsCommand` / `RunAsync` (vor dem Webhost, `Program.cs:19-22`), `AccountCommands.IsCommand` / `RunAsync` (nach Build, mit DI, `Program.cs:218-220`)
- Muster: `IsCommand(string[] args)` per List-Pattern, `RunAsync` gibt Exit-Code zurück.

**Problem-Typen:**
- `ContentTextProblem.cs`, `LearnerProfileProblem.cs` liefern Validierungsfehler aus Modulen, Endpoints mappen auf `Results.ValidationProblem`.

## Einstiegspunkte

**API-Server:**
- Ort: `backend/src/WordQuest.Api/Program.cs` (Image-`ENTRYPOINT ["dotnet", "WordQuest.Api.dll"]`, `backend/Dockerfile:49`)
- Aufgaben: Prüfungen, DI, Middleware (`UseExceptionHandler` → `UseStatusCodePages` → `UseForwardedHeaders` → (Dev: `UseCors`) → `UseRateLimiter` → `UseAuthentication` → `UseAuthorization`, `Program.cs:225-240`), `/health/live`, `/health/ready`, Endpoint-Mapping (`Program.cs:245-250`), `OrphanCleanup` + `MigrateAsync` + optional `DemoDataSeeder`

**Zertifikatsdienst:**
- Ort: `backend/src/WordQuest.Api/TlsCommand.cs`, gestartet als Dienst `certs` in `docker-compose.quick.yml` und `frontend/e2e/docker-compose.e2e.yml`

**Konto-CLI:**
- Ort: `backend/src/WordQuest.Api/AccountCommands.cs`, genutzt von `setup.sh`

**Frontend:**
- Ort: `frontend/src/main.tsx` → `frontend/src/App.tsx` (Routen `/login`, `/`, `/lernen`, `/verwalten/*` mit `sets/:setId`, `fortschritt`, `kinder`, `kinder/neu`, `kinder/:learnerId`, `konto`)

**Betriebsskripte:** `setup.sh`, `upgrade.sh`, `restore.sh`; Release-Paket: `.github/release-package.sh`; CI: `.github/workflows/ci.yml` (Jobs `backend`, `frontend`, `images`, `release`)

## Architektonische Rahmenbedingungen

- **Threading:** ASP.NET-Request-Modell, async durchgehend; keine Hintergrund-Worker im Webhost. Der einzige Dauer-Takt ist `tls watch` im separaten Container.
- **Globaler Zustand:** Singletons `JwtTokenService`, `SchedulerOptions`, `Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`, `TimeProvider.System`; In-Memory-Rate-Limiter (`Program.cs:161`).
- **Zirkuläre Abhängigkeiten:** keine; Projektreferenzen sind gerichtet (Api → Infrastructure → Module → Shared.Kernel).
- **Eine Instanz:** Migration beim Start und Rate-Limiter setzen genau eine API-Instanz voraus.
- **Ein Schreiber für Zertifikate:** Nur `certs` schreibt und bindet `tls-ca` ein; `certs` hat kein Netz (`network_mode: none`); `web` liest `tls` nur.
- **Kein HSTS:** bewusst (`frontend/nginx.conf:10-13`), damit Zertifikatswarnungen auf Geräten ohne installierte CA wegklickbar bleiben.
- **Service Worker nur mit vertrauter CA:** Ohne installierte CA keine PWA-Installation/Offline; die App muss als reine Browser-App funktionieren (`vite-plugin-pwa` in `frontend/vite.config.ts`).

## Anti-Patterns

### Geschäftslogik im Endpoint

**Was passiert:** Endpoints wie `SetEndpoints.cs` (390 Zeilen) und `LearnerEndpoints.cs` (276 Zeilen) sind groß und laufen Gefahr, Logik zu sammeln.
**Warum falsch:** Widerspricht „Endpoints parsen, autorisieren, rufen auf, mappen“ (`AGENTS.md`).
**Stattdessen:** Regeln in Modul-Services (`ContentRules.cs`) oder Infrastructure-Service (Muster `LearningService.cs`).

### Filter umgehen

**Was passiert:** `IgnoreQueryFilters()` / `SystemTenantContext` außerhalb von Auth/Start.
**Warum falsch:** Bricht Mandantentrennung.
**Stattdessen:** Nur wie im Bestand: `Auth/AuthService.cs`, `Endpoints/AuthEndpoints.cs`, `AccountCommands.cs`, `Program.cs`, `Seed/DemoDataSeeder.cs`, `DesignTimeDbContextFactory.cs`; neue Entitäten über `ITenantOwned` im `WordQuestDbContext` registrieren.

### Zertifikate außerhalb von `certs` schreiben

**Was passiert:** Skripte oder `web` legen Dateien in den TLS-Volumes an.
**Warum falsch:** Bricht die Ein-Schreiber-Regel; halbe Dateien oder zu weite Rechte möglich.
**Stattdessen:** Änderungen nur in `TlsCommand.cs`/`TlsCertificates.cs`; `setup.sh` liest nur (`tls show`, `cat ca.crt`) und startet `certs` bei Namensänderung neu.

### Integrität per Hand

**Was passiert:** Handgeschriebene Löschlisten.
**Stattdessen:** Fremdschlüssel/Constraints in `Configurations/*Configurations.cs`.

## Fehlerbehandlung

**Strategie:** Endpoints liefern `IResult` (`Results.ValidationProblem`, `Results.NotFound`, `Results.Problem`); globale `AddProblemDetails` + `UseExceptionHandler` + `UseStatusCodePages`.

**Muster:**
- Deutsche Nutzertexte als Konstanten im Endpoint (z. B. `SessionEndpoints.cs`).
- Services signalisieren „nicht gefunden“ über `null`; Frontend wirft `ApiError(message, status)` (`frontend/src/lib/api.ts:24`).
- CLI-Verben: Exit-Code ungleich 0 plus deutsche Meldung; `tls watch` endet nur bei Startfehlern (Docker startet neu), spätere Fehler werden geloggt und der Takt läuft weiter.

## Querschnittsthemen

**Logging:** `ILogger` nur in Api/Infrastructure, keine personenbezogenen Daten; Module loggen nicht.
**Validierung:** an der API-Grenze über Modulregeln (`ContentRules`, `AccountRules`, `PictureRules`); TLS-Namen über `TlsCertificates` (gleiche Regel in `setup.sh`).
**Authentifizierung:** JWT-Bearer, Policies `Guardian` (Owner/Guardian) und `Learner` (`Program.cs:135-136`); Secrets über `ReadSecret()` (`<NAME>_FILE`, dann Env), in Compose als Docker-Secrets aus `./secrets/`.
**Security-Header:** zentral in `frontend/nginx-security-headers.conf`, in jeder `location` mit eigenem `add_header` erneut eingebunden.

---

*Architecture analysis: 2026-10-26*
