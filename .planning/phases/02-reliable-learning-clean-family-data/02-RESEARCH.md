# Phase 2: Reliable Learning & Clean Family Data – Research

**Researched:** 2026-10-17
**Domain:** ASP.NET Core 10 Minimal API (Forwarded Headers, Rate Limiting, Fehler-Mapping), EF Core 10 + Npgsql (Fremdschlüssel/Cascade, Datenmigration, Concurrency), SM-2-Auswahl, React 19 + Radix Dialog, xUnit + WebApplicationFactory gegen PostgreSQL
**Confidence:** HIGH für Codebefunde (alle mit Datei:Zeile gelesen), MEDIUM für die Proxy-Kette im Betrieb, MEDIUM für das xmin-Concurrency-Token (Migration muss geprüft werden)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ablauf
- **D-01:** Autonomer Lauf auf Branch `v1-fertig`: atomare Commits pro Plan erlaubt, **kein Push**. Pläne laufen sequenziell im Arbeitsbaum (`workflow.use_worktrees=false`), weil sie Docker-Stacks und Ports teilen.
- **D-02:** Jeder Plan ist ein vertikaler Slice (API + UI + Tests), Tracer zuerst. Jede Code-Änderung bekommt vor der Fertig-Meldung ein Subagent-Review (AGENTS.md).

#### Lernen (FIX-03, FIX-09, Schließen)
- **D-03:** Entscheidung Dennis (2026-10-16) zu „Schließen“ in einer angefangenen Runde: mit mindestens einer beantworteten Karte wird die Runde regulär abgeschlossen (Serie zählt, Bonus rechnet der Server), danach Startseite; ohne Antwort wird nur navigiert. Bereits umgesetzt in 01-04 — nicht ändern.
- **D-04:** FIX-09 ist Anforderung: Ein Abbruch verbraucht das Tageslimit für neue Karten nicht. Neue Karten zählen erst, wenn sie beantwortet sind. FIX-03 gehört zur selben Ursache (Phase-1-Befund 01-04-SUMMARY „Verwaiste neue Karten“: `StartSessionAsync` legt `ReviewState` im Zustand `New` beim Start an; `Compose` wählt sie nie wieder aus; `dueToday` zählt sie trotzdem). Beide in einem Plan lösen; die Recherche bestimmt den kleinsten Weg (Vorschlag: ReviewState erst bei der ersten Antwort anlegen oder `New` wieder auswählbar machen) — Bewertung und Terminierung bleiben auf dem Server.
- **D-05:** FIX-06: Die Meisterschaftsregel (ease ≥ 2.1, wie in REQUIREMENTS.md) wird genau einmal im Domänenmodul definiert und von Eltern-Übersicht und Ampel benutzt. Die Recherche prüft, welche weiteren Bedingungen die heutigen Stellen haben (z. B. nur gesehene Karten), damit neue Karten mit Start-Ease nicht als gemeistert zählen; die bestehende Semantik bleibt, nur die doppelte Definition verschwindet.

#### Familie und Daten (FIX-02, PAR-03, PAR-04)
- **D-06:** Datenintegrität in der Datenbank (AGENTS.md): Fremdschlüssel mit `ON DELETE CASCADE` statt handgeschriebener Löschlisten. Der Phase-1-Review hat gezeigt, dass `ReviewState` keinen Fremdschlüssel auf Card/Learner hat (`LearningConfigurations.cs`). Migration per `dotnet ef migrations add`, nie von Hand ändern. Vor dem Anlegen der FKs müssen vorhandene Waisen in Altinstallationen bereinigt werden (in der Migration), sonst scheitert sie.
- **D-07:** PAR-03: Kind löschen löscht hart, inklusive aller Lerndaten (Review-States, Sitzungen, XP/Serie, Refresh-Tokens). Bestätigungsdialog Pflicht. Dialog mit dem bereits installierten `@radix-ui/react-dialog` als neuer Baustein in `components/ui/` nach DESIGN.md (Glas-Sheet), keine neue Dependency.
- **D-08:** PAR-04: Set umbenennen und Eintrag korrigieren ändern den Datensatz an Ort und Stelle (gleiche IDs), damit der Lernstand am Wort bleibt. Kein Löschen-und-neu-Anlegen.
- **D-09:** Neue Formulare (Set umbenennen, Eintrag bearbeiten, Kind-löschen-Dialog) folgen der Edge-Case-Matrix (ein Feld falsch, rotieren; exakte Fehlertexte; Enter-Submit eigener Pfad; Happy Path zuletzt) plus axe 0 Verstöße, Tastatur-Durchgang und 200 % Zoom (Muster: `frontend/e2e/keyboard-zoom.spec.ts`, falls aus der Phase-1-Nachbesserung vorhanden).

#### Robustheit (FIX-01, FIX-04, FIX-05)
- **D-10:** FIX-01: Rate-Limit pro echter Client-IP. Die API steht hinter nginx (Schnellstart) bzw. Traefik (Fortgeschrittene); `ForwardedHeaders` nur für den Proxy im Compose-Netz vertrauen, nicht für beliebige Absender. Token-Refresh verbraucht das Login-Budget nicht. Die Fehlertexte bleiben wie in Phase 1 (429-Text in `api.ts`). Die angehobene Grenze im e2e-Stack (`Auth__RequestsPerMinute: "1000"`) darf bleiben, wenn dort alle Anfragen von einer IP kommen.
- **D-11:** FIX-04: Ungültige Sitzungs-/Item-IDs und Doppel-Tipps liefern 4xx/409 mit deutschem Satz, nie 500. Die Oberfläche zeigt eine lesbare Meldung.
- **D-12:** FIX-05: Nach einem verpassten Tag zeigt die Startseite die aktuelle Serie (0 bzw. unterbrochen), nicht die alte als laufend. Zeitzone wie im Bestand (IANA, `InvariantGlobalization=false`).

#### Tests (QUAL-01)
- **D-13:** Das Integrationstest-Projekt `backend/tests/WordQuest.Api.Tests` existiert seit Phase 1 (WebApplicationFactory, echtes PostgreSQL, eigene DB je Factory; CI mit Postgres-Service). Die STATE-Notiz „only a pure domain test project exists“ ist überholt. QUAL-01 heißt: Tests für Login, Refresh, Trennung zwischen Geschwistern und je FIX-Anforderung ergänzen, alle grün in CI.
- **D-14:** Lokales Gate ohne .NET-SDK und mit belegtem Port 5432: Backend-Tests im Container gegen eigenes `postgres:17-alpine` im Docker-Netz (`WQ_TEST_DB='Host=<db-container>;Port=5432;Username=wordquest;Password=devpassword'`), nicht über `docker-compose.dev.yml` auf 5432.
- **D-15:** Keine neuen Dependencies. Freigegeben bleiben nur die aus Phase 1.

### Claude's Discretion
- Schnitt und Reihenfolge der Pläne, exakte Fehlertexte im Stil des Bestands (ganze deutsche Sätze), Form der Migration für Altdaten-Waisen.

### Deferred Ideas (OUT OF SCOPE)
Nicht in dieser Phase: Release, GHCR, upgrade.sh/restore.sh (Phase 3), alles aus v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Ein Familienmitglied kann die anderen nicht aussperren (Rate-Limit pro echter Client-IP; Refresh verbraucht das Login-Budget nicht) | `UseForwardedHeaders` mit `KnownIPNetworks` (Docker-Bereich) + `ForwardLimit = 2` vor `UseRateLimiter`; `/refresh` mit `.DisableRateLimiting()`; `refreshAccessToken` meldet nur bei 401 ab. Abschnitt „FIX-01“ |
| FIX-02 | Set/Eintrag löschen entfernt Lerndaten; keine Waisen in Sessions | Neue FKs mit Cascade/SetNull (Liste in „FIX-02 / PAR-03“), Waisenbereinigung als `migrationBuilder.Sql` vor `AddForeignKey` |
| FIX-03 | Gezeigte, nicht beantwortete Karten kommen wieder | Kein `ReviewState` mehr beim Start; `alreadySeen` schließt `New` aus; `dueToday` nur `Review`/`Relearning` |
| FIX-04 | Ungültige IDs und Doppel-Tipps → 4xx/409, nie 500 | Not-found als `null` statt Exception, Endpoint mappt auf 404 mit deutschem `detail`; xmin-Token auf `SessionItem` + Catch von Concurrency-/23505-Fehlern → 409; `size` begrenzen |
| FIX-05 | Startseite zeigt die aktuelle Serie | Reine Funktion `StreakRules.CurrentStreak(profile, today)` im Gamification-Modul, von `OverviewAsync` benutzt |
| FIX-06 | Meisterschaftsregel einmal definiert, von Übersicht und Ampel benutzt | Regel nach `WordQuest.Modules.Learning` (Bedingungen: `Repetitions >= 3 && EaseFactor >= 2.1 && Lapses <= 1`, nur vorhandene States); Übersicht zählt Wörter wie die Ampel (Open Question 1) |
| FIX-09 | Abbruch verbraucht das Tageslimit nicht | Folgt aus FIX-03-Änderung: `FirstSeenAt` entsteht erst bei der ersten Antwort (`CreateInitialState` existiert schon) |
| PAR-03 | Kind samt Lernhistorie löschen | `DELETE /api/v1/learners/{id}` (Guardian, nur Rolle Learner), `ExecuteDeleteAsync` auf `app_user`, DB-Cascade; `ConfirmDialog` mit Radix Dialog |
| PAR-04 | Set umbenennen, Eintrag korrigieren ohne Lernstandverlust | `PATCH /api/v1/sets/{setId}`, `PUT /api/v1/sets/{setId}/entries/{entryId}`; IDs von Entry und Cards bleiben, `review_state` hängt an `card_id` |
| QUAL-01 | Integrationstests gegen echtes PostgreSQL: Login, Refresh, Geschwister-Trennung, je FIX | Lückenliste in „Validation Architecture“; heute existieren nur Account-, Learner-, RateLimit-, Command-Tests, keine Session-/Auth-/Set-Tests |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Projektsprache Deutsch (Doku, Commits, Kommentare, Nutzertexte); Bezeichner englisch. Kommentare erklären das *Warum*, Umlaute im Code als `ae/oe/ue` wie im Bestand; Nutzertexte (API-`detail`, UI) mit echten Umlauten wie in Phase 1 (`LearnerEndpoints.cs:153-157`).
- Kein Commit/Push ohne Freigabe — hier durch D-01 für atomare Commits pro Plan freigegeben, Push nicht.
- Keine neuen Dependencies (D-15). Radix Dialog ist installiert (`frontend/package.json:21` `"@radix-ui/react-dialog": "^1.1.23"`, `node_modules` 1.1.23).
- DDD-light: Domänenmodule ohne EF/HTTP/NuGet; Geschäftslogik in Modul-Services oder Infrastructure-Service (`LearningService`), nie in Endpoints. Keine Repositories, keine Domain Events, kein `Result<T>`.
- Datenintegrität in die Datenbank (FKs, Constraints), keine handgeschriebenen Löschlisten.
- Migrationen nur per `dotnet ef migrations add`; Dateien in `Migrations/` nie von Hand ändern (Spannung zu D-06, siehe Pitfall 1).
- Endpoints liefern `IResult`: `Results.ValidationProblem`, `Results.NotFound`, `Results.Problem`; „Nicht gefunden“ und Konflikte werden 4xx, nie 500. Meldungen auf Deutsch in ganzen Sätzen. Frontend wirft `ApiError(message, status)`.
- C#: ein Haupttyp pro Datei, `sealed`, `sealed record` für DTOs, `Async`-Suffix, `_camelCase`, file-scoped Namespaces, Build warnungsfrei mit `/warnaserror` und `EnforceCodeStyleInBuild=true`. Entity-IDs `Guid.CreateVersion7()`.
- TS/React: keine Semikolons, einfache Anführungszeichen, Imports über `@/…`, `import type`, gemeinsame Typen in `frontend/src/types.ts`.
- `DESIGN.md` ist normativ: keine Inline-Styles, kein Hex im JSX, keine Einzelfall-px; Gate `npm run design:check` und `npm run design:classes`.
- UI-Formulare: Edge-Case-Matrix + axe (WCAG 2.2 AA, 0 Verstöße) + Tastatur + 200 % Zoom; Ergebnis als Beleg; Commit-Trailer `A11y-Check:` (Muster aus Phase 1).
- Jede Code-Änderung: Subagent-Review vor Fertig-Meldung (Projektentscheidung, AGENTS.md „Review“).
- Doku muss dem Code entsprechen: `Documentation/WordQuest_Konzept_und_Architektur.md` in derselben Änderung anpassen (Rate-Limit, Meisterschaft, Kind löschen, Lernauswahl).
- Gate: `dotnet build … /warnaserror`, `dotnet test …`, Frontend `npm ci && lint && typecheck && build && test && design:check && design:classes`; UI zusätzlich `npm run e2e:stack && npm run e2e`.
- Logging nur in Api/Infrastructure, keine personenbezogenen Daten in Logs.
- Mandantentrennung über Global Query Filters; `IgnoreQueryFilters()`/`SystemTenantContext` nur in Auth- und Start-/Seed-Code.

## Summary

Alle zehn Anforderungen haben eine klar lokalisierbare Ursache im Bestand, und keine braucht eine neue Bibliothek. Der größte Hebel ist eine einzige EF-Migration, die die fehlenden Fremdschlüssel anlegt (heute existieren nur vier: card→entry, entry→set, learner_profile→app_user, session_item→session). Sie löst FIX-02 und macht PAR-03 zu einem einzigen `DELETE` auf `app_user`. Vorher muss die Migration Waisen per SQL entfernen, sonst scheitert `ADD CONSTRAINT` in Altinstallationen.

FIX-03 und FIX-09 haben dieselbe Ursache: `StartSessionAsync` legt beim Start einen `ReviewState` im Zustand `New` an (`LearningService.cs:116-130`). Danach schließt `alreadySeen` die Karte von den neuen Karten aus (`:75-80`), und die Due-Abfragen nehmen nur `Relearning`/`Review` (`:48`, `:58`). Der kleinste Weg ist, die Anlage beim Start zu streichen (die Antwort legt den State über `CreateInitialState` ohnehin an, `:191-193`) und `alreadySeen` auf Nicht-`New` zu beschränken. Damit kommen auch Altbestände und im Cram-Modus beantwortete Karten wieder.

FIX-01 ist ein reines Konfigurationsproblem: Die API sieht nur die nginx-IP, weil `UseForwardedHeaders` fehlt; `/refresh`, `/logout` und `/profiles` hängen an derselben Policy wie Login (`AuthEndpoints.cs:13-21`). FIX-04 entsteht, weil `LearningService` für „nicht gefunden“ `InvalidOperationException` wirft, die `UseExceptionHandler` als 500 ausliefert. Ein Doppel-Tipp führt nach der FIX-03-Änderung zu einer PK-Verletzung (23505) und heute schon zu doppelten `review_log`-Zeilen. FIX-05 und FIX-06 liegen allein in `LearnerEndpoints.OverviewAsync` und `TrafficLightAsync`.

**Primary recommendation:** Fünf sequenzielle Slices: (1) Lernauswahl + Fehlerpfade mit Session-Integrationstests als Tracer, (2) FK-Migration + Kind löschen mit ConfirmDialog, (3) Set umbenennen/Eintrag bearbeiten (+ Set löschen per Dialog), (4) Forwarded Headers/Refresh + Serie + Meisterschaft, (5) QUAL-01-Lücken schließen, Doku, Phasen-Gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Echte Client-IP ermitteln | API (Forwarded-Headers-Middleware) | Proxy (nginx `X-Forwarded-For`) | nginx setzt den Header schon (`nginx.conf:44`); vertrauen darf nur die API |
| Rate-Limit pro IP | API (`AddRateLimiter`) | — | In-Memory, eine Instanz (AGENTS.md) |
| Kartenauswahl, Tagesbudget | API/Infrastructure (`LearningService`) | Domäne (`SessionComposer`) | Server entscheidet Bewertung und Terminierung |
| Doppel-Tipp-Schutz | Database (xmin/PK/Unique) | API (Mapping → 409), Browser (Ref-Riegel) | Atomarität gehört in die DB |
| Serie anzeigen | Domäne (`StreakRules`) | API (`OverviewAsync`) | Reine Datumslogik, testbar ohne DB |
| Meisterschaftsregel | Domäne (`WordQuest.Modules.Learning`) | API (Übersicht, Ampel) | Eine Definition, Unit-testbar |
| Löschen mit Lerndaten | Database (FK `ON DELETE CASCADE`) | API (Endpoint), Browser (Dialog) | AGENTS.md: Integrität in die DB |
| Umbenennen/Korrigieren | API (Endpoints, Validierung) | Browser (Formulare) | In-place-Update hält IDs |
| Bestätigungsdialog | Browser (`components/ui/dialog.tsx`) | — | Radix Dialog, DESIGN.md Sheet-Tokens |

## Standard Stack

### Core (alles schon im Projekt)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ASP.NET Core `Microsoft.AspNetCore.HttpOverrides` (Shared Framework) | net10.0 | `UseForwardedHeaders`, `ForwardedHeadersOptions.KnownIPNetworks` | BCL/Framework, keine Dependency [CITED: learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer] |
| ASP.NET Core Rate Limiting | net10.0 | `RequireRateLimiting`, `DisableRateLimiting` | Schon in `Program.cs:114-125` benutzt (Stand nach CR-01) |
| Microsoft.EntityFrameworkCore / .Relational / .Design | 10.0.12 | FK-Konfiguration, Migration, `ExecuteDeleteAsync` | [VERIFIED: backend/src/WordQuest.Infrastructure/WordQuest.Infrastructure.csproj] |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.3 | xmin-Concurrency-Token, `PostgresException` | [VERIFIED: ebd.] |
| @radix-ui/react-dialog | 1.1.23 (installiert) | ConfirmDialog | [VERIFIED: frontend/node_modules/@radix-ui/react-dialog/package.json] |
| xunit 2.9.3 + Microsoft.AspNetCore.Mvc.Testing 10.0.12 | — | Integrationstests | [VERIFIED: backend/tests/WordQuest.Api.Tests/WordQuest.Api.Tests.csproj] |
| @axe-core/playwright 4.13.0, @playwright/test 1.64.0, vitest + Testing Library | — | Matrix, axe, Tastatur/Zoom | [VERIFIED: frontend/package.json] |

### Werkzeug (keine Projekt-Dependency)
| Tool | Version | Purpose |
|------|---------|---------|
| dotnet-ef | 10.0.12 (passend zu EF) | `migrations add` im SDK-Container; per `--tool-path` installieren, kein Tool-Manifest anlegen [VERIFIED: api.nuget.org dotnet-ef index listet 10.0.12] |

**Installation:** keine.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `KnownIPNetworks` = `172.16.0.0/12` | Subnetze der eigenen Container-Interfaces zur Laufzeit ermitteln | Präziser, falls Docker ein 192.168.x-Netz vergibt; mehr Code, schlechter testbar. Bei falschem Netz fällt es sicher auf „ein Topf“ zurück |
| xmin-Token auf `SessionItem` | Explizite Transaktion + `ExecuteUpdate … WHERE answered_at IS NULL` | Braucht wegen `EnableRetryOnFailure(3)` (`Program.cs:72`) `CreateExecutionStrategy().ExecuteAsync(...)` — mehr Code |
| `@radix-ui/react-alert-dialog` | — | Neue Dependency, verboten (D-15). `role="alertdialog"` lässt sich auf `Dialog.Content` setzen |
| Rate-Limit-Policy „refresh“ mit eigenem Topf | `.DisableRateLimiting()` | Refresh-Token sind 256-Bit-zufällig, Raten sinnlos; eigener Topf ist zusätzlicher Code ohne Nutzen |

## Package Legitimacy Audit

Diese Phase installiert keine Pakete (D-15).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | keine neue Installation |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
`dotnet-ef` wird nur temporär im Wegwerf-SDK-Container installiert (Microsoft-Paket, Version passend zu den bereits referenzierten EF-Paketen).

## Befunde je Anforderung (mit Belegen)

### FIX-03 / FIX-09: verwaiste neue Karten, Tagesbudget

- `ReviewState` wird beim Start angelegt [VERIFIED: backend/src/WordQuest.Infrastructure/LearningService.cs:116-130]:
  > `// Lernstand fuer neue Karten anlegen, damit das Tagesbudget schon beim` … `foreach (SessionCandidate candidate in selected.Where(c => c.State == ReviewCardState.New))` … `State = ReviewCardState.New,`
- Budget zählt `FirstSeenAt` [VERIFIED: LearningService.cs:66-70]: `.CountAsync(r => r.LearnerId == learnerId && r.FirstSeenAt >= dayStart, ct);` und `int newBudget = Math.Max(0, profile.DailyNewLimit - introducedToday);`
- Neue Karten schließen jeden vorhandenen State aus [VERIFIED: LearningService.cs:75-80]: `IQueryable<Guid> alreadySeen = db.ReviewStates.Where(r => r.LearnerId == learnerId).Select(r => r.CardId);` … `.Where(c => !alreadySeen.Contains(c.Id))`
- Due-Abfragen nehmen nur `Relearning` (`:48`) und `Review` (`:58`) → ein `New`-State wird nie wieder gewählt.
- Die Antwort legt einen fehlenden State selbst an [VERIFIED: LearningService.cs:191-193, 318-326]: `?? CreateInitialState(learnerId, card.Id, now);` mit `FirstSeenAt = now, State = ReviewCardState.New`. `EaseFactor` kommt dort aus dem Entity-Default `2.5` (`ReviewState.cs:34`), identisch mit `SchedulerOptions.InitialEaseFactor { get; init; } = 2.5;` (`SchedulerOptions.cs:11`).
- Zweiter Weg zum hängenden `New`: Spiel `cram` mit `AffectsScheduling=false` setzt nur `LastReviewedAt` (`LearningService.cs:201-204`), der State bleibt `New` [VERIFIED: GameCatalog.cs:37 `[Cram] = new(Cram, "Klassenarbeit-Modus", 0.5, Grade.Good, false),`].
- `dueToday` in der Übersicht zählt `New` mit [VERIFIED: LearnerEndpoints.cs:191-194]: `r.State != ReviewCardState.Suspended && r.DueAt <= now`.

**Kleinster Weg (Empfehlung):**
1. Block `LearningService.cs:116-130` streichen. → FIX-09: Abbruch kostet nichts, `FirstSeenAt` entsteht bei der ersten Antwort.
2. `alreadySeen` auf `r.State != ReviewCardState.New` einschränken. → FIX-03 auch für Altbestände und Cram-Karten; keine Datenbereinigung nötig. Im Kandidaten bleibt `ReviewCardState.New`; `SubmitAnswerAsync` findet den vorhandenen State und wendet `scheduler.Apply` an.
3. `dueToday` auf `r.State == ReviewCardState.Review || r.State == ReviewCardState.Relearning` (gleiche Mengen wie `Compose`).
4. Kommentar „damit das Tagesbudget schon beim Vorlegen zaehlt“ entfällt; die neue Regel im Kommentar begründen (FIX-09, Konzept-Verweis).

Restgrenze (bewusst, dokumentieren): Ein Kind kann neue Karten beliebig oft *ansehen*, ohne zu antworten. Das verlangt FIX-09 so.

### FIX-04: 500er bei ungültigen IDs und Doppel-Tipps

| Pfad | Heute | Beleg |
|------|-------|-------|
| `POST /sessions` mit fremder/unbekannter `learnerId` (Elternkonto) | `InvalidOperationException` → 500 | `LearningService.cs:39-41`; `MayActFor` prüft nur die Kinderrolle (`SessionEndpoints.cs:141-154`) |
| `POST /sessions` mit `size` < 0 | `new List<SessionCandidate>(capacity)` wirft → 500 | `SessionComposer.cs:35-36`; `StartSessionRequest(Guid LearnerId, Guid? SetId, string? GameKey, int? Size)` (`Contracts.cs:97`) |
| `POST /sessions/{id}/answers`, unbekannte Session | `Results.NotFound()` ohne Body → Frontend zeigt nur „Das hat nicht geklappt …“ | `SessionEndpoints.cs:52-56`; `api.ts:154-168` |
| … unbekannte/fremde `itemId` | `InvalidOperationException("Aufgabe gehoert nicht zu dieser Session.")` → 500 | `LearningService.cs:155-156` |
| … Karte inzwischen gelöscht | `db.Cards…FirstAsync` wirft → 500 | `LearningService.cs:160-162` (verschwindet mit FK-Cascade auf `session_item.card_id`, dann greift die Item-Prüfung) |
| Doppel-Tipp, neue Karte (nach FIX-03-Änderung) | zweiter INSERT `review_state` → PK-Verletzung 23505 → 500 | PK `(LearnerId, CardId)` `LearningConfigurations.cs:12` |
| Doppel-Tipp, bekannte Karte | beide 200, zwei `review_log`-Zeilen, XP lost update | `LearningService.cs:169-246`; kein Concurrency-Token im Modell |
| `clientAnswerId` eines anderen Items | Unique-Index → 23505 → 500 | `LearningConfigurations.cs:72-74` |
| `POST /sessions/sync` mit `answers: null` oder einem falschen Item | NRE bzw. IOE → 500, ganzer Batch | `SessionEndpoints.cs:115-121` (Frontend nutzt `sync` nicht — grep ohne Treffer) |
| `complete` mit unbekannter Session | 404 ohne Body | `SessionEndpoints.cs:77-81` |

**Empfehlung:**
- `LearningService.StartSessionAsync` / `SubmitAnswerAsync` / `CompleteSessionAsync` geben bei „nicht gefunden“ `null` zurück (Rückgabetyp nullable) statt zu werfen; Endpoints mappen `null` auf `Results.Problem(statusCode: 404, title: "Nicht gefunden", detail: "<deutscher Satz>")`. Kein `Result<T>` (AGENTS.md), keine neue Exception-Hierarchie.
- `size` am Endpoint prüfen: `Results.ValidationProblem` bei `Size is < 1 or > 50` (Grenze 50 [ASSUMED], Standard `SessionSize = 15`).
- Doppel-Tipp: xmin als Concurrency-Token auf `SessionItem` (Shadow-Property, Domänenklasse bleibt sauber). Im Endpoint (oder Service) `DbUpdateConcurrencyException` und `DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }` fangen → `Results.Problem(statusCode: 409, detail: "Diese Antwort ist schon angekommen.")`. Damit entsteht auch kein doppeltes `review_log` mehr. Die sequenzielle Wiederholung (FIX-07) bleibt 200 über den Zweig `item.AnsweredAt is not null` (`LearningService.cs:169-180`).
- Frontend `SessionPage.tsx`: Ref-Riegel wie `ChildFormPage.tsx:84,122` vor `answer.mutate`, weil `answer.isPending` (`SessionPage.tsx:176,215,227`) erst nach dem nächsten Rendern greift. Fehleranzeige existiert schon (`SessionPage.tsx:82-85, 139-147`) und zeigt `ApiError.message` = `detail`.
- Sync: `answers` null → 400; nicht gefundene Items im Batch überspringen und am Ende zählen, oder ganzen Batch mit 404 ablehnen. Empfehlung: 404 für den Batch (kleinster Diff, Endpoint ist ungenutzt).

### FIX-01: Rate-Limit pro Client-IP, Refresh ohne Login-Budget

- Partition nach Verbindungs-IP [VERIFIED: Program.cs (Stand 2026-10-17) `RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", …)`]; Pipeline ohne `UseForwardedHeaders`: `app.UseExceptionHandler(); app.UseStatusCodePages(); … app.UseHsts(); … app.UseRateLimiter();`.
- Ganze Auth-Gruppe gedrosselt [VERIFIED: AuthEndpoints.cs:13-21]: `.RequireRateLimiting("auth");` für `/profiles`, `/login`, `/learner-login`, `/refresh`, `/logout`. Account-Gruppe ebenso (`AccountEndpoints.cs:13-16`).
- nginx [VERIFIED: frontend/nginx.conf:39-47]: `proxy_pass http://api:8080;` … `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. `/health/` ohne Header (egal).
- Quick-Stack: `web` veröffentlicht `"${WQ_PORT:-8080}:8080"`, `api` hat keinen veröffentlichten Port (`docker-compose.quick.yml:41-75`). Traefik-Stack: Traefik → `web` (nginx) → `api` (`docker-compose.yml:59-95`, Labels nur auf `web`). Alle Dienste im Compose-Standardnetz.

Middleware-Verhalten [CITED: learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer]: „Forwarded headers middleware processes headers in reverse order from right to left. If the default value (`1`) is used, only the rightmost value from the headers is processed“; Standard-`KnownNetworks` nur `127.0.0.0/8`, `KnownProxies` nur `::1`; „Forwarded headers middleware should run before other middleware“. Quellcode [VERIFIED: github.com/dotnet/aspnetcore main, ForwardedHeadersMiddleware.cs:239-241]: `if (!CheckKnownAddress(currentValues.RemoteIpAndPort.Address))` → „Stop at the first unknown remote IP, but still apply changes processed so far.“ IPv4-mapped-IPv6 wird auf IPv4 zurückgeführt (`:406-409`).

.NET 10: `KnownNetworks` ist obsolet, Warnung `ASPDEPR005` [CITED: learn.microsoft.com/aspnet/core/breaking-changes/10/ipnetwork-knownnetworks-obsolete]. Mit `/warnaserror` bricht der Build → zwingend `KnownIPNetworks` mit `System.Net.IPNetwork`.

Kette mit `ForwardLimit = 2`, `KnownIPNetworks` = Loopback (Standard) + `172.16.0.0/12`:
- Quick: Verbindung nginx (172.x, vertraut) → rechter XFF-Wert = Client-LAN-IP (z. B. 192.168.178.20) → nicht vertraut → Stopp. Ein vom Client mitgeschickter XFF-Präfix wird nie gelesen.
- Traefik: Verbindung nginx (vertraut) → rechter Wert = Traefik-IP (172.x, vertraut) → nächster Wert = Client-IP → Stopp. Ob Traefik eingehende XFF-Werte verwirft, ist für die Kette egal, weil sie an der ersten nicht vertrauten IP endet.
- Restrisiko: Läuft Docker mit userland-proxy (Docker Desktop, Hairpin vom Host selbst), sieht nginx die Gateway-IP 172.x.0.1. Die liegt im vertrauten Bereich, der Client könnte dann seinen Topf per XFF wählen. Auf Linux-Heimservern bleibt die Quell-IP bei DNAT erhalten [ASSUMED]. Folge wäre nur ein umgangenes Rate-Limit im eigenen Heimnetz; die PIN-Sperre pro Profil (`AuthService.cs:73-89`) bleibt.
- Vergibt Docker ein 192.168.x-Netz (nur bei erschöpften 172er-Pools [ASSUMED]), fällt FIX-01 sicher auf „ein Topf“ zurück. Kein Sicherheitsproblem.

Refresh: `group.MapPost("/refresh", RefreshAsync).DisableRateLimiting();` — Disable gewinnt immer [VERIFIED: aspnetcore RateLimitingMiddleware.cs:68-69 „If this endpoint has a DisableRateLimitingAttribute, don't apply any rate limits.“]. `/logout` ebenso; `/profiles` darf gedrosselt bleiben (pro IP jetzt unkritisch).

Frontend: `refreshAccessToken` löscht die Tokens bei jedem `!response.ok` (`api.ts:96-99`), also auch bei 429/5xx; ein Netzfehler wirft aus dem `async`-Block heraus. Empfehlung: nur bei 400/401 `tokenStore.clear()`, sonst `false` ohne Abmelden; `fetch`-Fehler fangen. 429-Text bleibt (D-10).

Testbarkeit: TestServer setzt keine `RemoteIpAddress` (Phase-1-Rate-Limit-Tests laufen im Topf `"unknown"`). `TestServer.SendAsync(Action<HttpContext>)` existiert [VERIFIED: aspnetcore TestHost PublicAPI.Shipped.txt `TestServer.SendAsync(System.Action<…HttpContext!>! configureContext, …)`] und erlaubt `ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.3")` plus `X-Forwarded-For`. Damit lassen sich „zwei Geräte, zwei Töpfe“ und „gefälschter XFF eines Nicht-Proxys wird ignoriert“ deterministisch prüfen.

e2e-Stack: Playwright → `127.0.0.1:18080` auf Docker Desktop, alle Anfragen von einer Gateway-IP → `Auth__RequestsPerMinute: "1000"` bleibt (D-10, `frontend/e2e/docker-compose.e2e.yml:41-44`); Kommentar dort und in `Program.cs` („Die Ursache … behebt FIX-01 in Phase 2“) anpassen.

### FIX-05: Serie

- Übersicht gibt den gespeicherten Wert ungeprüft aus [VERIFIED: LearnerEndpoints.cs:215 `Streak: gamification.CurrentStreak,`]. Startseite (`LearnHomePage.tsx:57`) und Eltern-Fortschritt (`ProgressPage.tsx:84`) lesen beide `overview.streak` → eine Stelle reicht.
- Regeln [VERIFIED: StreakRules.cs:40-65]: `gap == 1` → +1; `gap == 2 && profile.StreakSaversLeft > 0` → Retter; sonst `CurrentStreak = 1`. Retter werden am Monatswechsel aufgefüllt (`RefillSaversIfNewMonth`, `:74-82`, `MonthlyStreakSavers = 2`).
- Empfehlung: reine Funktion `public static int CurrentStreak(GamificationProfile profile, DateOnly today)` in `StreakRules`, ohne Mutation:
  - `LastActiveDate is null` → 0
  - `gap <= 1` → `CurrentStreak`
  - `gap == 2` und Retter verfügbar (`StreakSaverPeriod != yyyy-MM(today)` oder `StreakSaversLeft > 0`) → `CurrentStreak` (heute noch rettbar, gleiche Regel wie `RegisterActivity`)
  - sonst 0
- `OverviewAsync` ruft sie mit `scheduler.LocalDate(now)` (`Sm2Scheduler.cs:54-55`, IANA-Zeitzone aus `WQ_TIMEZONE`). Unit-Tests in `GamificationTests.cs` (`StreakRulesTests`), Integrationstest mit geseedetem `LastActiveDate` (kein Fake-Clock nötig).

### FIX-06: Meisterschaft

- Zwei Kopien derselben Kartenregel [VERIFIED: LearnerEndpoints.cs:199-203 `r.Repetitions >= 3 && r.EaseFactor >= 2.1 && r.Lapses <= 1`; :254-258 `x.State is not null && x.State.Repetitions >= 3 && x.State.EaseFactor >= 2.1 && x.State.Lapses <= 1`].
- Zusatzbedingungen heute: nur vorhandene States zählen (`State is not null` bzw. Abfrage auf `ReviewStates`), `Repetitions >= 3` schließt neue Karten mit Start-Ease 2.5 aus. Ein reines `ease >= 2.1` würde jeden `New`-State (Ease 2.5) als gemeistert zählen → die Bedingungen müssen bleiben (D-05).
- Einheiten unterscheiden sich: Die Übersicht zählt **Karten** (`CardsMastered`, `CardsTotal = db.Cards.CountAsync`, Text „X von Y Karten sitzen“ `LearnHomePage.tsx:72`, „sitzen sicher X/Y“ `ProgressPage.tsx:93-96`), die Ampel **Wörter** (Grün nur, wenn alle Richtungen sitzen, `:254`). Ein Wort mit einer gemeisterten Richtung zählt in der Übersicht 1, in der Ampel 0 → Erfolgskriterium 3 („count the same words“) ist mit geteilter Kartenregel allein nicht erfüllt. Siehe Open Question 1.
- Empfehlung: `MasteryRules` (oder `Mastery`) in `WordQuest.Modules.Learning/Services/` mit `IsMastered(ReviewState? state)` (null → false) und `IsWordMastered(IEnumerable<ReviewState?> directions)` (alle). Beide Endpoints laden Karten (`Id`, `EntryId`) und die States des Kindes und werten im Speicher aus (Familiengröße, unkritisch). Übersicht: `CardsMastered` = Anzahl grüner Wörter, `CardsTotal` = Anzahl Einträge; Texte auf „Wörter“. Optional die Ampel-Statuslogik (`lapses >= 3 || worstEase < 1.8` → rot) in dieselbe Klasse ziehen; Pflicht ist sie nicht.
- Wenn die DTO-Namen bleiben (`CardsMastered`/`CardsTotal`), im Code kommentieren, dass sie Wörter zählen; Umbenennen bricht `types.ts:132-133` und die Tests — Planner entscheidet, kleiner Diff spricht fürs Behalten.

### FIX-02 / PAR-03: Fremdschlüssel, Waisen, Kind löschen

Vorhandene FKs [VERIFIED: Migrations/WordQuestDbContextModelSnapshot.cs:683-722]: `fk_card_vocabulary_entry_entry_id`, `fk_vocabulary_entry_vocabulary_set_set_id`, `fk_learner_profile_app_user_id`, `fk_session_item_learning_session_session_id` (alle Cascade). Spalten [VERIFIED: Migrations/20260917045557_Initial.cs:60-61, 79, 98-100, 117-118, 126, 128, 199-200]: `learning_session.learner_id`, `learning_session.set_id` (nullable), `refresh_token.user_id`, `review_log.learner_id`, `review_log.card_id`, `review_log.session_id` (nullable), `review_state.learner_id`, `review_state.card_id`, `review_state.last_reviewed_at`, `review_state.state`, `session_item.session_id`, `session_item.card_id`. Tabellen: `app_user`, `learner_profile`, `card`, `vocabulary_set`, `learning_session`, `review_log`, `review_state`, `session_item`, `gamification_profile`, `refresh_token`.

Fehlende FKs (Empfehlung):

| Abhängige Spalte | → Prinzipal | OnDelete | Wofür |
|------------------|-------------|----------|-------|
| `review_state.card_id` | `card.id` | Cascade | FIX-02 |
| `review_state.learner_id` | `learner_profile.id` | Cascade | PAR-03 |
| `review_log.card_id` | `card.id` | Cascade | FIX-02 (Lerndaten des Worts weg) |
| `review_log.learner_id` | `learner_profile.id` | Cascade | PAR-03 |
| `review_log.session_id` | `learning_session.id` | SetNull | Log überlebt Session-Löschung nicht nötig, aber kein Zwang |
| `learning_session.learner_id` | `learner_profile.id` | Cascade | PAR-03 |
| `learning_session.set_id` | `vocabulary_set.id` | SetNull | Set löschen lässt Sitzungsprotokoll stehen |
| `session_item.card_id` | `card.id` | Cascade | FIX-02, beendet 500 bei gelöschter Karte |
| `gamification_profile.id` | `learner_profile.id` | Cascade | PAR-03 (XP/Serie) |
| `refresh_token.user_id` | `app_user.id` | Cascade | PAR-03 |

Konfiguration ohne Navigationen (Domänenklassen unverändert), in den bestehenden `IEntityTypeConfiguration`-Klassen in Infrastructure, z. B. `builder.HasOne<Card>().WithMany().HasForeignKey(s => s.CardId).OnDelete(DeleteBehavior.Cascade);`. PostgreSQL erlaubt mehrere Cascade-Pfade (anders als SQL Server). `ApplySnakeCaseNames` benennt die Constraints automatisch (`WordQuestDbContext.cs:80-83`). EF legt Indizes für FK-Spalten an, die kein bestehender Index anführt (z. B. `review_state.card_id`, `session_item.card_id`).

Kind löschen: `DELETE /api/v1/learners/{learnerId:guid}` mit `RequireAuthorization("Guardian")`; `await db.Users.Where(u => u.Id == learnerId && u.Role == UserRole.Learner).ExecuteDeleteAsync(ct)`; 0 Zeilen → 404 mit deutschem `detail`, sonst 204. Der Mandantenfilter greift auch bei `ExecuteDeleteAsync` [ASSUMED]; Integrationstest „anderes Elternhaus → 404“ belegt das. Die Rollenbedingung verhindert, dass ein Elternkonto Owner/Guardian löscht. Ein noch gültiges Access-Token des gelöschten Kindes führt danach überall zu 404 (Profil fehlt), Refresh zu 401 (Token per Cascade weg).

Bestehender Code, der mit den FKs bricht:
- `LearnerEndpointTests.Patch_leaves_learning_and_gamification_state_unchanged` legt einen `ReviewState` mit `CardId = Guid.CreateVersion7()` ohne Karte an [VERIFIED: backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs:480-484] → FK-Verletzung. Test muss Set/Entry/Card seeden.
- `DemoDataSeeder` legt `GamificationProfiles` an (`Seed/DemoDataSeeder.cs:100`); EF sortiert INSERTs nach bekannten FKs, sobald sie im Modell stehen. Im e2e-Stack prüfen (Seed läuft beim Start).

### PAR-04: Umbenennen und Korrigieren

- Es gibt kein Update für Set oder Eintrag [VERIFIED: SetEndpoints.cs:19-27 — nur `MapGet`, `MapPost`, `MapDelete`]. Set löschen hat keinen UI-Pfad (grep `method: 'DELETE'` trifft nur Einträge, `SetDetailPage.tsx:43`).
- Lernstand hängt an `card_id` (`review_state` PK `(LearnerId, CardId)`), Karten hängen am Eintrag mit Unique `(EntryId, Direction)` (`ContentConfigurations.cs:68`). Update in place von `VocabularyEntry.SourceText/TargetText` bzw. `VocabularySet.Title` erhält alles.
- Längen in der DB: Titel `HasMaxLength(200)` (`ContentConfigurations.cs:14`), `SourceText`/`TargetText` `HasMaxLength(200)` (`:35-36`). Heute fehlt die Längenprüfung auch in `CreateAsync`/`AddEntryAsync` (`SetEndpoints.cs:47-53, 116-123`) → 201 Zeichen = 500 durch `DbUpdateException`. Für die neuen Endpoints Pflicht; für die alten im selben Slice mitziehen (FIX-04-Geist), sonst als Befund melden.
- Bestehende Texte: `"Ein Set braucht einen Titel."` (Schlüssel `title`), `"Beide Spalten muessen befuellt sein."` (Schlüssel `entry`, ohne Umlaut, nicht feldbezogen). Für Bearbeiten feldbezogene Schlüssel `sourceText`/`targetText` mit eigenen Sätzen, z. B. „Bitte gib das deutsche Wort ein.“, „Bitte gib das englische Wort ein.“, „Das Wort darf höchstens 200 Zeichen lang sein.“, „Der Titel darf höchstens 200 Zeichen lang sein.“ [ASSUMED Wortlaut, Claude's Discretion].
- Endpoints (Vorschlag): `PATCH /api/v1/sets/{setId:guid}` Body `{ title }` → 200 `VocabularySetDto`; `PUT /api/v1/sets/{setId:guid}/entries/{entryId:guid}` Body `{ sourceText, targetText }` → 200 `VocabularyEntryDto`. Beide Guardian, 404 mit `detail` für fremde/unbekannte IDs (Mandantenfilter).
- Offene Phase-1-Notiz: `addEntry`/`removeEntry`-Fehler werden in `SetDetailPage` nicht angezeigt (`SetDetailPage.tsx:27-48` ohne `isError`-Anzeige) — beim Anfassen mitbeheben.

## Architecture Patterns

### System Architecture Diagram

```
Browser (Kind/Eltern)
   │ HTTP :8080 (quick)            │ HTTPS :443 (fortgeschritten)
   ▼                                ▼
 nginx (web) ◄──────────────── Traefik (proxy)  setzt XFF=<Client>
   │ XFF = <bisher>, <remote_addr>
   ▼
 API: UseExceptionHandler → UseForwardedHeaders (KnownIPNetworks 172.16/12, Limit 2)
   → RemoteIpAddress = Client-IP
   → UseRateLimiter ("auth": login, learner-login, profiles, account/password;
                      refresh/logout: DisableRateLimiting)
   → AuthN/AuthZ → Endpoints (parsen, autorisieren, aufrufen, mappen)
        │
        ├─ Sessions → LearningService ─► SessionComposer / Sm2Scheduler (rein)
        │      null → 404 detail │ Concurrency/23505 → 409 detail
        ├─ Learners: Overview → StreakRules.CurrentStreak, MasteryRules
        │            Delete   → ExecuteDelete(app_user) ─┐
        └─ Sets: PATCH/PUT in place, DELETE ─────────────┤
                                                         ▼
                                  PostgreSQL: FKs ON DELETE CASCADE / SET NULL
                                  (review_state, review_log, learning_session,
                                   session_item, gamification_profile, refresh_token)
```

### Recommended Project Structure (nur neue/geänderte Orte)
```
backend/src/WordQuest.Modules.Learning/Services/MasteryRules.cs        # FIX-06
backend/src/WordQuest.Modules.Gamification/Services/StreakRules.cs     # + CurrentStreak (FIX-05)
backend/src/WordQuest.Infrastructure/Configurations/*.cs               # FKs, xmin
backend/src/WordQuest.Infrastructure/Migrations/<ts>_ReferentialIntegrity.cs
backend/src/WordQuest.Api/Program.cs                                   # ForwardedHeaders
backend/src/WordQuest.Api/Endpoints/{Auth,Session,Learner,Set}Endpoints.cs
backend/tests/WordQuest.Api.Tests/{Session,Auth,SetEdit,LearnerDelete,Migration}…Tests.cs
frontend/src/components/ui/dialog.tsx                                  # ConfirmDialog (Radix)
frontend/src/features/manage/{ChildFormPage,SetDetailPage,SetsPage}.tsx
frontend/e2e/{children,manage,keyboard-zoom}.spec.ts
```

### Pattern 1: Forwarded Headers vor dem Rate-Limiter
```csharp
// Source: learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer (KnownIPNetworks ab .NET 10)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    // nginx und ggf. Traefik davor: zwei Proxy-Stufen.
    options.ForwardLimit = 2;
    // Nur das Docker-Compose-Netz; Loopback bleibt aus dem Standard drin.
    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("172.16.0.0/12"));
});
// …
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseForwardedHeaders();   // vor UseHsts und vor UseRateLimiter
```
`ForwardedHeaders.XForwardedProto` nicht setzen: Der Schnellstart läuft über HTTP; HSTS/Scheme ändern sich sonst unbeabsichtigt [ASSUMED Abwägung].

### Pattern 2: Not-found als null, Mapping im Endpoint
```csharp
AnswerResult? result = await learning.SubmitAnswerAsync(...);
return result is null
    ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Nicht gefunden",
        detail: "Diese Aufgabe gibt es in dieser Runde nicht (mehr).")
    : Results.Ok(result);
```

### Pattern 3: Doppel-Tipp → 409
```csharp
// Infrastructure, SessionItemConfiguration: xmin als Shadow-Concurrency-Token
builder.Property<uint>("xmin").HasColumnType("xid").IsRowVersion();

// Endpoint
catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException
    || ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
{
    return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Schon beantwortet",
        detail: "Diese Antwort ist schon angekommen.");
}
```
Nach `migrations add` prüfen, dass die Migration **keine** `AddColumn`-Anweisung für `xmin` enthält (Systemspalte). `ApplySnakeCaseNames` läuft über alle Properties; der Name `xmin` bleibt durch `ToSnakeCase` unverändert. [ASSUMED: Npgsql erzeugt für xmin-Rowversion keine Spalte; Docs zeigen nur `.IsRowVersion()` auf `uint`, CITED npgsql.org/efcore/modeling/concurrency.html]

### Pattern 4: FK ohne Navigation + Waisenbereinigung in der generierten Migration
```csharp
// LearningConfigurations.cs
builder.HasOne<Card>().WithMany().HasForeignKey(s => s.CardId).OnDelete(DeleteBehavior.Cascade);
builder.HasOne<LearnerProfile>().WithMany().HasForeignKey(s => s.LearnerId).OnDelete(DeleteBehavior.Cascade);

// Generierte Migration, ganz oben in Up(), VOR den AddForeignKey-Aufrufen:
migrationBuilder.Sql("""
    DELETE FROM learning_session s WHERE NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = s.learner_id);
    UPDATE learning_session s SET set_id = NULL WHERE set_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vocabulary_set v WHERE v.id = s.set_id);
    DELETE FROM session_item i WHERE NOT EXISTS (SELECT 1 FROM card c WHERE c.id = i.card_id);
    DELETE FROM review_state r WHERE NOT EXISTS (SELECT 1 FROM card c WHERE c.id = r.card_id)
                                OR NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = r.learner_id);
    DELETE FROM review_log l WHERE NOT EXISTS (SELECT 1 FROM card c WHERE c.id = l.card_id)
                              OR NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = l.learner_id);
    UPDATE review_log l SET session_id = NULL WHERE session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_session s WHERE s.id = l.session_id);
    DELETE FROM gamification_profile g WHERE NOT EXISTS (SELECT 1 FROM learner_profile p WHERE p.id = g.id);
    DELETE FROM refresh_token t WHERE NOT EXISTS (SELECT 1 FROM app_user u WHERE u.id = t.user_id);
    """);
```
`Down()` entfernt nur die Constraints; gelöschte Waisen kommen nicht zurück (im Kommentar festhalten). Tabellen- und Spaltennamen sind gegen `20260917045557_Initial.cs` geprüft (siehe Belege oben); `vocabulary_set` als Tabellenname [VERIFIED: ContentConfigurations.cs:11 `builder.ToTable("vocabulary_set");`], `learner_profile`/`app_user` [VERIFIED: IdentityConfigurations.cs:22, 49].

### Pattern 5: ConfirmDialog mit Radix Dialog
```tsx
// components/ui/dialog.tsx – Klassen ausschliesslich aus DESIGN.md-Tokens (sheet, glass-sheet, sheet-inset)
<Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay className="…" />
    <Dialog.Content role="alertdialog" onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus() }} className="glass-sheet rounded-sheet …">
      <Dialog.Title>…</Dialog.Title>
      <Dialog.Description>…</Dialog.Description>
      <Button ref={cancelRef} variant="secondary">Abbrechen</Button>
      <Button variant="danger" onClick={onConfirm}>Endgültig löschen</Button>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```
`Dialog.Title` ist Pflicht (Radix warnt sonst, axe meldet fehlenden Namen). Esc schließt, Fokus kehrt zum Auslöser zurück (Radix). Startfokus auf „Abbrechen“ bei destruktiven Aktionen. Variante `danger` existiert (`button.tsx:20`). `Button` reicht `ref` als Prop durch (React 19, `ComponentProps<'button'>`). Exakte Klassen bestimmt der UI-Vertrag (gsd-ui-phase ist aktiviert: `workflow.ui_phase: true`).

### Anti-Patterns to Avoid
- **Löschlisten im Code** (`db.ReviewStates.RemoveRange(...)` vor dem Löschen): verboten, Cascade in der DB.
- **`ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`**: vertraut jedem Absender [CITED: proxy-load-balancer „doesn't enable features such as the KnownProxies option“].
- **`KnownNetworks`/`Microsoft.AspNetCore.HttpOverrides.IPNetwork`**: obsolet, ASPDEPR005 bricht `/warnaserror`.
- **`InvalidOperationException` global auf 404 mappen**: trifft auch echte Programmierfehler.
- **Fake-Clock in Integrationstests über `TimeProvider` tauschen**: `JwtTokenService` nimmt den DI-`TimeProvider`, die Bearer-Validierung in `Program.cs` nutzt `TimeProvider.System` → Tokens aus der Zukunft/Vergangenheit werden abgelehnt. Stattdessen Zustand (z. B. `LastActiveDate`) direkt seeden.
- **Demo-Kinder in e2e löschen**: andere Specs brauchen sie; jede Lösch-Spec legt ihr eigenes Kind an.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-IP aus Headern parsen | eigenes XFF-Parsing | `UseForwardedHeaders` + `KnownIPNetworks` | Vertrauenskette, IPv4-mapped, Port-Parsing sind gelöst |
| Lerndaten beim Löschen entfernen | Löschlisten pro Tabelle | FK `ON DELETE CASCADE` | AGENTS.md; vergisst keine neue Tabelle |
| Doppel-Tipp-Sperre | In-Memory-Lock/Set | xmin-Token bzw. PK/Unique + 409 | Funktioniert über Requests und Neustarts |
| Bestätigungsdialog | eigenes Modal mit Fokusfalle | `@radix-ui/react-dialog` | Fokusfalle, Esc, `aria-modal`, Portal |
| Ortsdatum für Serie | UTC-Datum | `Sm2Scheduler.LocalDate(now)` | Zeitzone aus `WQ_TIMEZONE` |

**Key insight:** Fast jeder Defekt dieser Phase ist eine fehlende Invariante in der Datenbank oder in der Middleware-Kette; die Korrektur ist Konfiguration plus wenige Zeilen, kein neuer Code-Pfad.

## Runtime State Inventory

Phase ändert Schema und Laufzeitverhalten (keine Umbenennung), relevant ist die Migration bestehender Installationen.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Altinstallationen können verwaiste Zeilen in `review_state`, `review_log`, `session_item`, `learning_session`, `gamification_profile`, `refresh_token` haben (gelöschte Sets/Einträge, nie gelöschte Kinder gab es mangels Endpoint nicht). Hängende `New`-States ohne Antwort. | Datenmigration: SQL-Bereinigung in der Migration vor `AddForeignKey`. `New`-States brauchen keine Bereinigung (werden durch geänderte Auswahl wieder angeboten). |
| Live service config | Keine — Proxy-Konfiguration liegt in git (`nginx.conf`, Compose-Dateien). | Keine |
| OS-registered state | Keine — verifiziert: kein systemd/cron im Repo, Backup-Container unverändert. | Keine |
| Secrets/env vars | Keine neuen Variablen nötig, wenn `172.16.0.0/12` fest im Code steht. `Auth__RequestsPerMinute` bleibt. | Keine |
| Build artifacts | API-Image enthält die Migration; startet migrierend (`Program.cs` `MigrateAsync`). | Image neu bauen (Phase 3 Release); e2e-Stack baut aus Arbeitsbaum. |

## Common Pitfalls

### Pitfall 1: „Migrations nie von Hand ändern“ vs. Waisenbereinigung
**What goes wrong:** Ohne SQL in `Up()` scheitert `ALTER TABLE … ADD CONSTRAINT` auf Altdaten; mit SQL ist die generierte Datei „von Hand geändert“.
**Why it happens:** Datenmigrationen lassen sich nicht generieren.
**How to avoid:** D-06 verlangt die Bereinigung ausdrücklich „in der Migration“. Auslegung: Datei per `dotnet ef migrations add` erzeugen, nur `migrationBuilder.Sql(...)` an den Anfang von `Up()` setzen; `.Designer.cs` und Snapshot unangetastet. In SUMMARY als bewusste, freigegebene Ausnahme notieren. [ASSUMED: Dennis teilt diese Auslegung — siehe Assumptions A1]
**Warning signs:** Migrationstest gegen eine DB mit Waisen schlägt fehl.

### Pitfall 2: Obsolete Forwarded-Headers-API bricht den Build
**What goes wrong:** `KnownNetworks.Add(new IPNetwork(...))` → Warnung ASPDEPR005 → `/warnaserror` rot.
**How to avoid:** `KnownIPNetworks` + `System.Net.IPNetwork.Parse`.

### Pitfall 3: `UseForwardedHeaders` an der falschen Stelle
**What goes wrong:** Nach `UseRateLimiter` partitioniert der Limiter weiter nach nginx-IP.
**How to avoid:** Direkt nach `UseExceptionHandler`/`UseStatusCodePages`, vor `UseHsts` und `UseRateLimiter` [CITED].

### Pitfall 4: Bestehende Tests verletzen neue FKs
**What goes wrong:** `LearnerEndpointTests.cs:480-484` seedet `ReviewState` mit zufälliger `CardId` → `23503`.
**How to avoid:** Im FK-Plan diesen Test auf echtes Set/Entry/Card umstellen; nach der Migration die ganze Suite laufen lassen.

### Pitfall 5: Doppel-Tipp ist kein Unique-Fall auf `session_item`
**What goes wrong:** Beide Requests aktualisieren dieselbe Zeile; der Unique-Index auf `client_answer_id` schlägt nicht an. Ergebnis: zwei 200, doppeltes `review_log`, verlorenes XP-Update.
**How to avoid:** Concurrency-Token (xmin) auf `SessionItem`; zusätzlich 23505 (PK `review_state`) fangen.
**Warning signs:** Ein `Task.WhenAll`-Test ist nicht deterministisch. Deterministische Tests: (a) gleiche `clientAnswerId` für zwei Items → 409; (b) zwei Kontexte laden dasselbe Item, beide speichern → zweiter wirft Concurrency → Endpoint 409 (über Service mit zwei Scopes) bzw. `Task.WhenAll` nur als Smoke „nie 500“.

### Pitfall 6: `EnableRetryOnFailure` und eigene Transaktionen
**What goes wrong:** `db.Database.BeginTransactionAsync()` wirft mit `NpgsqlRetryingExecutionStrategy` („does not support user-initiated transactions“) [ASSUMED aus EF-Verhalten].
**How to avoid:** Keine expliziten Transaktionen; `SaveChanges` ist atomar. Falls doch nötig: `db.Database.CreateExecutionStrategy().ExecuteAsync(...)`.

### Pitfall 7: Fake-Clock und JWT
Siehe Anti-Patterns. Serie/Budget über geseedete Daten testen.

### Pitfall 8: Rate-Limit in Integrationstests
`ApiFactory`-Dokumentation: gemeinsame Factory → gemeinsamer Limiter (10/min). Neue Auth-Tests mit vielen Logins bekommen eine eigene Factory (Muster `RateLimitTests`), oder nutzen `CreateClientFor` ohne Login.

### Pitfall 9: Waisen nach FK, die EF nicht kennt
EF sendet beim `Remove(entry)` nur DELETEs für geladene Abhängige; der Rest läuft über die DB. Getrackte `ReviewState`-Instanzen im selben Kontext wären danach veraltet — in Endpoints nicht der Fall (ein Kontext pro Request).

### Pitfall 10: Lokales Gate
Kein .NET-SDK lokal, Port 5432 belegt (`com.docker` lauscht auf `127.0.0.1:5432`), Node lokal v26 statt 22 (CI nutzt 22). Backend nur im SDK-Container gegen eigenes Postgres im Docker-Netz (D-14).

## Code Examples

### Integrationstest mit echter Client-IP (FIX-01)
```csharp
// Source: TestServer.SendAsync (aspnetcore TestHost PublicAPI)
HttpContext ctx = await _factory.Server.SendAsync(c =>
{
    c.Request.Method = "POST";
    c.Request.Path = "/api/v1/auth/login";
    c.Request.ContentType = "application/json";
    c.Request.Body = new MemoryStream(JsonSerializer.SerializeToUtf8Bytes(new { email, password = "falsch" }));
    c.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.3");      // nginx
    c.Request.Headers["X-Forwarded-For"] = "192.168.178.20";            // Gerät A
});
Assert.Equal(StatusCodes.Status401Unauthorized, ctx.Response.StatusCode);
// 10x Gerät A → 11. Versuch A = 429, Gerät B (192.168.178.21) = 401.
// Gegenprobe: RemoteIpAddress 192.168.178.30 mit XFF 10.0.0.1 → Topf 192.168.178.30.
```

### Migrationstest (FIX-02, Altdaten)
```csharp
await using var db = _factory.CreateSystemDbContext();
await db.GetService<IMigrator>().MigrateAsync("20260917045557_Initial");
await db.Database.ExecuteSqlRawAsync("INSERT INTO review_state (...) VALUES (... card_id = gen_random_uuid() ...)");
await db.Database.MigrateAsync();          // darf nicht werfen
Assert.Equal(0, await db.ReviewStates.CountAsync());
```
(`ApiFactory.InitializeAsync` in diesem Test nicht aufrufen.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ForwardedHeadersOptions.KnownNetworks` + `HttpOverrides.IPNetwork` | `KnownIPNetworks` + `System.Net.IPNetwork` | .NET 10 Preview 7 | Pflicht wegen `/warnaserror` |
| `UseXminAsConcurrencyToken()` | `uint`-Property mit `.IsRowVersion()` | Npgsql EF 7+ [ASSUMED Zeitpunkt] | Shadow-Property reicht |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `migrationBuilder.Sql` in der generierten Migration verletzt AGENTS.md „nie von Hand ändern“ nicht im Sinn der Regel (D-06 verlangt es) | Pitfall 1 | Plan blockiert; Alternative wäre leere Migration + SQL, gleicher Konflikt |
| A2 | Docker-Compose-Netze liegen bei Heimservern in `172.16.0.0/12`; Linux erhält bei DNAT die Client-IP | FIX-01 | FIX-01 fällt still auf einen Topf zurück (kein Sicherheitsrisiko) |
| A3 | Npgsql legt für xmin-Rowversion keine Spalte an; Name bleibt nach `ApplySnakeCaseNames` `xmin` | Pattern 3 | Migration enthält `AddColumn xmin` → Planer muss Migration prüfen, sonst Alternativweg (explizite Transaktion mit Execution Strategy) |
| A4 | Global Query Filters gelten für `ExecuteDeleteAsync` | PAR-03 | Elternkonto könnte Kind einer anderen Familie löschen — Integrationstest deckt es ab |
| A5 | `NpgsqlRetryingExecutionStrategy` verbietet nutzergestartete Transaktionen | Pitfall 6 | Nur relevant, wenn der Planer Transaktionen wählt |
| A6 | Obergrenze `size` 50 und alle neuen deutschen Fehlertexte | FIX-04, PAR-04 | Wortlaut-Änderung, Claude's Discretion |
| A7 | `XForwardedProto` nicht weiterreichen ist richtig | Pattern 1 | Kein funktionaler Effekt im Bestand (kein Redirect auf HTTPS in der API) |

## Open Questions (RESOLVED)

1. **FIX-06: Karten oder Wörter in der Übersicht?**
   - What we know: Übersicht zählt Karten (beide Richtungen einzeln, Gesamtzahl aller Karten), Ampel zählt Wörter. Erfolgskriterium 3 verlangt „count the same words“; D-05 sagt „bestehende Semantik bleibt“.
   - What's unclear: ob D-05 nur die Kartenbedingungen meint oder auch die Zähleinheit.
   - Recommendation: Übersicht zählt grüne Wörter / Wörter gesamt (Text „Wörter sitzen“). Erfüllt das Kriterium mechanisch prüfbar (Übersicht == Anzahl `status == "green"`). Bedingungen der Kartenregel bleiben unverändert.
   - RESOLVED: D-16

2. **Bestätigung auch für Eintrag- und Set-Löschen?**
   - What we know: Kriterium 4: „After a parent deletes a set, an entry or a child (with confirmation)“. Eintrag-Löschen geht heute ohne Rückfrage (`SetDetailPage.tsx:125-132`), Set-Löschen hat keinen UI-Pfad.
   - Recommendation: Denselben `ConfirmDialog` für alle drei nutzen; Set löschen als Button auf der Set-Detailseite ergänzen (kleiner Diff, Endpoint existiert).
   - RESOLVED: D-17

3. **`sync`-Endpoint bei einzelnen falschen Items**
   - Recommendation: ganzer Batch 404 (ungenutzter Endpoint, kleinster Diff); Umbau auf „überspringen und zählen“ erst, wenn Offline-Sync kommt (v2).
   - RESOLVED: 02-01 Task 2

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Tests, e2e-Stack, SDK-Container | ✓ | 29.8.2 (linux/aarch64) | — |
| `mcr.microsoft.com/dotnet/sdk:10.0` | Build, Test, `dotnet ef` | ✓ (Image lokal) | 10.0 | — |
| `postgres:17-alpine` | Testdatenbank | ✓ (Image lokal) | 17 | — |
| .NET SDK lokal | — | ✗ | — | SDK-Container (D-14) |
| Host-Port 5432 | `docker-compose.dev.yml` | ✗ belegt (`127.0.0.1:5432`, Docker) | — | eigenes Docker-Netz ohne Host-Port |
| Node / npm | Frontend-Gate | ✓ | v26.7.0 / 11.19.0 (CI: 22) | bei Abweichungen `node:22`-Container |
| dotnet-ef | Migration erzeugen | ✗ (kein Manifest) | 10.0.12 auf nuget | im SDK-Container per `--tool-path` |

**Missing dependencies with no fallback:** keine.
**Missing dependencies with fallback:** lokales SDK, Port 5432, dotnet-ef (alle über Container).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | xUnit 2.9.3 + `WebApplicationFactory<Program>` (Mvc.Testing 10.0.12) gegen echtes PostgreSQL; vitest + Testing Library; Playwright 1.64.0 + axe 4.13.0 |
| Config file | `backend/tests/WordQuest.Api.Tests/ApiFactory.cs` (eigene DB je Factory, `DisableTestParallelization = true`), `frontend/playwright.config.ts`, `frontend/e2e/docker-compose.e2e.yml` |
| Quick run command | siehe unten, mit `--filter FullyQualifiedName~<Klasse>` |
| Full suite command | Backend + Frontend-Gate aus AGENTS.md, e2e bei UI |

Backend lokal (D-14):
```bash
docker network create wq-p2 2>/dev/null; \
docker run -d --rm --name wq-p2-db --network wq-p2 -e POSTGRES_DB=wordquest -e POSTGRES_USER=wordquest -e POSTGRES_PASSWORD=devpassword postgres:17-alpine; \
docker run --rm --network wq-p2 -v "$PWD":/src -w /src -v wq-nuget:/root/.nuget/packages \
  -e WQ_TEST_DB='Host=wq-p2-db;Port=5432;Username=wordquest;Password=devpassword' \
  mcr.microsoft.com/dotnet/sdk:10.0 sh -c 'dotnet build backend/WordQuest.slnx -c Release /warnaserror && dotnet test backend/WordQuest.slnx -c Release'
# danach: docker rm -f wq-p2-db; docker network rm wq-p2
```
Migration erzeugen:
```bash
docker run --rm -v "$PWD":/src -w /src/backend mcr.microsoft.com/dotnet/sdk:10.0 sh -c \
 'dotnet tool install dotnet-ef --version 10.0.12 --tool-path /tmp/ef && /tmp/ef/dotnet-ef migrations add ReferentialIntegrity --project src/WordQuest.Infrastructure --startup-project src/WordQuest.Api'
```

### Bestehende Abdeckung (Ist)
`AccountCommandTests`, `AccountEndpointTests`, `AccountRulesTests`, `DemoAccountCheckTests` (neu, parallel), `LearnerEndpointTests` (POST/PATCH Kind), `RateLimitTests` (Topf „unknown“), `ResetPasswordCommandTests`, `SecretCheckTests`; Domäne: `SessionComposerTests`, `GamificationTests` (`StreakRulesTests`), `Sm2SchedulerTests`, u. a. **Keine** Tests für Sessions, Login/Refresh-Endpunkte, Geschwister-Trennung bei Sessions, Sets, Übersicht/Ampel.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | Gerät A gesperrt, Gerät B nicht; XFF von Nicht-Proxy ignoriert; 20 Refreshes in Folge ohne 429 | integration | `dotnet test … --filter FullyQualifiedName~RateLimitTests` | ✅ (erweitern) |
| FIX-01 | Refresh bei 429/5xx meldet nicht ab | unit (vitest) | `npm test -- api.test` | ✅ (erweitern) |
| FIX-02 | Set/Eintrag löschen → keine `review_state`/`review_log`/`session_item`-Zeilen, nächste Session ohne diese Karten | integration | `--filter FullyQualifiedName~SetDeleteTests` | ❌ Wave 0 |
| FIX-02 | Migration auf DB mit Waisen läuft durch, Waisen weg | integration | `--filter FullyQualifiedName~MigrationTests` | ❌ Wave 0 |
| FIX-03 | Start ohne Antwort → nächste Session enthält dieselbe neue Karte; Alt-`New`-State wird angeboten | integration | `--filter FullyQualifiedName~SessionEndpointTests` | ❌ Wave 0 |
| FIX-09 | Abbruch → `newRemainingToday` unverändert; nach Antwort −1 | integration | ebd. | ❌ Wave 0 |
| FIX-04 | unbekannte Session/Item → 404 mit `detail`; `size` -1 → 400; gleiche `clientAnswerId` zweier Items → 409; Concurrency → 409; Wiederholung → 200, XP 0 (FIX-07-Lücke) | integration | ebd. | ❌ Wave 0 |
| FIX-04 | Fehlermeldung sichtbar, Ref-Riegel gegen Doppel-Submit | unit (vitest) / e2e | `npm test`, `npm run e2e -- learn` | teilweise |
| FIX-05 | `CurrentStreak`: gestern, vorgestern mit/ohne Retter, Monatswechsel, null | unit | `--filter FullyQualifiedName~StreakRulesTests` | ✅ (erweitern) |
| FIX-05 | Übersicht nach 3 Tagen Pause zeigt 0 | integration | `--filter FullyQualifiedName~OverviewTests` | ❌ Wave 0 |
| FIX-06 | Regel: neue Karte (Ease 2.5, Reps 0) nicht gemeistert; Grenzwerte 2.1/3/1 | unit | `--filter FullyQualifiedName~MasteryRulesTests` | ❌ Wave 0 |
| FIX-06 | Übersicht == Anzahl grüner Ampel-Wörter | integration | `--filter FullyQualifiedName~OverviewTests` | ❌ Wave 0 |
| PAR-03 | Kind löschen → 204, alle Tabellen leer für die ID, Login 401, Geschwister unberührt; fremde Familie 404; Kind-Token 403; Owner nicht löschbar | integration | `--filter FullyQualifiedName~LearnerDeleteTests` | ❌ Wave 0 |
| PAR-03 | Dialog: Abbrechen/Esc ändert nichts, Bestätigen löscht, Fokus, axe | unit + e2e | `npm test -- ChildFormPage`, `npm run e2e -- children keyboard-zoom` | ✅ (erweitern) |
| PAR-04 | Umbenennen/Korrigieren: gleiche IDs, `review_state` unverändert, neue Texte in nächster Session; Matrix leer/zu lang je Feld; fremde Familie 404 | integration | `--filter FullyQualifiedName~SetEditTests` | ❌ Wave 0 |
| PAR-04 | Formulare: Matrix (ein Feld falsch, rotieren), Enter-Submit, exakte Texte, Happy Path zuletzt, axe 0, Tastatur, 200 % | unit + e2e | `npm test -- SetDetailPage SetsPage`, `npm run e2e -- manage keyboard-zoom` | ✅ (erweitern) |
| QUAL-01 | Login ok/401; Learner-Login ok/falsche PIN/Sperre; Refresh-Rotation; Wiederverwendung → 401 + alle widerrufen; Kind A darf Session/Antwort/Übersicht von Kind B nicht (403) | integration | `--filter FullyQualifiedName~AuthEndpointTests` / `SiblingIsolationTests` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** gefilterter `dotnet test` der berührten Testklasse im SDK-Container; Frontend `npm test -- <Datei>`.
- **Per wave merge:** volles Backend-Gate + Frontend-Gate.
- **Phase gate:** volles Gate inkl. `npm run e2e:stack && npm run e2e` und `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v`; CI-Lauf grün (QUAL-01 „in CI“: CI läuft nur bei Push/PR auf `master` — kein Push in dieser Phase, also lokal gleicher Befehl als Beleg, CI-Beleg in Phase 3).

### Wave 0 Gaps
- [ ] Test-Hilfen für Familie + Set + Entry + Cards + Kind-Token (heute pro Testklasse dupliziert, `LearnerEndpointTests.cs:35-60`) — eine gemeinsame `TestData`-Hilfsklasse im Testprojekt.
- [ ] `SessionEndpointTests.cs` (FIX-03/04/09, FIX-07-Wiederholung)
- [ ] `MigrationTests.cs` (FIX-02 Altdaten)
- [ ] `LearnerDeleteTests.cs`, `SetEditTests.cs`, `SetDeleteTests.cs`, `OverviewTests.cs`, `AuthEndpointTests.cs`, `SiblingIsolationTests.cs`
- [ ] `MasteryRulesTests.cs` (Domäne)
- [ ] `LearnerEndpointTests.cs:480-484` auf echte Karte umstellen

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Rate-Limit pro IP (FIX-01), PIN-Sperre pro Profil unverändert |
| V3 Session Management | yes | Refresh-Rotation unverändert; Kind löschen entfernt Refresh-Tokens per Cascade |
| V4 Access Control | yes | `RequireAuthorization("Guardian")` für Löschen/Bearbeiten; `MayActFor` für Sessions; Mandantenfilter; Rollenbedingung beim Löschen |
| V5 Input Validation | yes | Längen/Leerwerte an der API (`Results.ValidationProblem`), `size`-Grenze |
| V6 Cryptography | no | keine Änderung |
| V8 Data Protection | yes | hartes Löschen aller Kinddaten (PAR-03), keine Kinddaten in Logs |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XFF-Spoofing zur Umgehung des Limits | Spoofing | Vertrauen nur für `172.16.0.0/12`, Kette stoppt an erster fremder IP |
| Gemeinsamer Limiter-Topf sperrt Familie aus | DoS | Partition pro Client-IP, Refresh ohne Limit |
| IDOR: Elternkonto löscht/bearbeitet fremdes Kind/Set | Elevation | Mandantenfilter + 404, Integrationstest je Endpoint |
| Geschwister handelt für anderes Kind | Elevation | `MayActFor` (403), Test je Session-Endpoint |
| Elternkonto löscht Owner über Kind-Endpoint | Tampering | `u.Role == UserRole.Learner` in der Löschabfrage |
| Fehlerdetails in 500 | Information Disclosure | 4xx mit deutschem `detail`; 5xx-Text generisch im Frontend (`api.ts:152`) |
| Doppelwertung durch Wiederholung | Tampering | Concurrency-Token, 409 |

## Sources

### Primary (HIGH confidence)
- Codebasis, in dieser Session gelesen: `LearningService.cs`, `SessionComposer.cs`, `ReviewState.cs`, `LearningSession.cs`, `ReviewLog.cs`, `GameCatalog.cs`, `SchedulerOptions.cs`, `Sm2Scheduler.cs`, `StreakRules.cs`, `GamificationProfile.cs`, `SessionEndpoints.cs`, `LearnerEndpoints.cs` (inkl. paralleler WR-01-Änderung), `SetEndpoints.cs`, `AuthEndpoints.cs`, `AccountEndpoints.cs`, `Program.cs` (inkl. paralleler CR-01-Änderung), `*Configurations.cs`, `WordQuestDbContext.cs`, Snapshot und `20260917045557_Initial.cs`, `ApiFactory.cs`, `RateLimitTests.cs`, `LearnerEndpointTests.cs`, `api.ts`, `SessionPage.tsx`, `SetDetailPage.tsx`, `SetsPage.tsx`, `ChildFormPage.tsx`, `ProgressPage.tsx`, `LearnHomePage.tsx`, `button.tsx`, `nginx.conf`, Compose-Dateien, `ci.yml`, `package.json`
- [Microsoft Learn: Proxy/Load Balancer (aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0) — ForwardLimit, Reihenfolge, Standardnetze
- [Microsoft Learn: Breaking change KnownNetworks obsolete](https://learn.microsoft.com/en-us/dotnet/core/compatibility/aspnet-core/10/ipnetwork-knownnetworks-obsolete) — ASPDEPR005
- [dotnet/aspnetcore ForwardedHeadersMiddleware.cs](https://raw.githubusercontent.com/dotnet/aspnetcore/main/src/Middleware/HttpOverrides/src/ForwardedHeadersMiddleware.cs) — Stopp an erster unbekannter IP
- [dotnet/aspnetcore RateLimitingMiddleware.cs](https://raw.githubusercontent.com/dotnet/aspnetcore/main/src/Middleware/RateLimiting/src/RateLimitingMiddleware.cs) — DisableRateLimiting hat Vorrang
- [dotnet/aspnetcore TestHost PublicAPI.Shipped.txt](https://raw.githubusercontent.com/dotnet/aspnetcore/main/src/Hosting/TestHost/src/PublicAPI.Shipped.txt) — `TestServer.SendAsync(Action<HttpContext>)`
- [nuget dotnet-ef Versionen](https://api.nuget.org/v3-flatcontainer/dotnet-ef/index.json) — 10.0.12 vorhanden

### Secondary (MEDIUM confidence)
- [Npgsql EF Core: Concurrency](https://www.npgsql.org/efcore/modeling/concurrency.html) — `uint` + `IsRowVersion()` auf xmin; Migrationsverhalten nicht dokumentiert
- [Duende: .NET 10 Breaking Changes](https://duendesoftware.com/blog/20251104-dotnet-10-breaking-changes-to-keep-an-eye-on-when-upgrading) — bestätigt KnownIPNetworks

### Tertiary (LOW confidence)
- Docker-Adresspools und Quell-IP-Erhalt bei DNAT (Trainingswissen, A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — keine neuen Pakete, Versionen aus csproj/package.json gelesen
- Architecture: HIGH für Ursachen (Datei:Zeile), MEDIUM für Proxy-Kette im Betrieb (A2)
- Pitfalls: HIGH für Build-/Test-Fallen (gelesen), MEDIUM für xmin-Migration (A3)

**Research date:** 2026-10-17
**Valid until:** 2026-11-16 (stabiler Stack); Codebefunde gelten bis zur nächsten Änderung der genannten Dateien — die parallele Phase-1-Nachbesserung (CR-01, WR-01) ist berücksichtigt.
