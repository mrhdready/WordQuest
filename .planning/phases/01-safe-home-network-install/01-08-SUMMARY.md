---
phase: 01-safe-home-network-install
plan: 08
subsystem: identity
tags: [learner, pin, patch, edge-case-matrix, vitest, playwright, axe-core, rate-limit, wcag22]
status: complete

requires:
  - 01-02 (ApiFactory mit Isolationsregel, setup-smoke.sh)
  - 01-03 (renderWithProviders mit Route-Pfad, ApiError, checkPage)
  - 01-06 (Fokus-nicht-verdeckt-Test, Formularmuster)
  - 01-07 (AccountRules.ValidateLearnerProfile/ClampDailyNewLimit, LearnerProfileProblem, ChildFormPage mode="create", Kinderliste)
provides:
  - PATCH /api/v1/learners/{id}/settings mit displayName und PIN-/Namensregel aus AccountRules (gemeinsame Feldtexte mit POST)
  - AccountRules.MaxAvatarKeyLength und LearnerProfileProblem.AvatarKeyTooLong (POST avatarKey > 50 → 400)
  - Auth:RequestsPerMinute (Standard 10), im e2e-Teststack 1000
  - Seite /verwalten/kinder/:learnerId (ChildFormPage mode="edit"), Kinderliste mit Zeilen-Links und Ladefehler
affects: [phase-02]

estimate:
  tokens: 160000
actuals:
  tokens: 18860
  tasks: 3
  commits: 3
plan_head_before: 79227e327c3659a768f2fb4c6ab3b10ac7180e9b
plan_head_after: 459c22fde134f1ead07a43f218605223ac259f1b

tech-stack:
  added: []
  patterns:
    - "Eine private ValidationProblem-Abbildung je Endpoint-Datei fuer alle Wege, die dieselbe Modulregel nutzen (POST und PATCH)"
    - "Bearbeiten-Seite ohne Einzelabruf: Kind aus der Liste ['learners']; Ladefehler (ErrorNote) getrennt von 'gibt es nicht' (EmptyState)"
    - "Formular-Komponente mit key=id erst nach dem Laden montiert: Felder vorbefuellt ohne Leer-Flackern"
    - "Rate-Limit-Wert aus der Konfiguration, im Teststack per Umgebungsvariable angehoben"

key-files:
  created:
    - backend/tests/WordQuest.Api.Tests/RateLimitTests.cs
  modified:
    - backend/src/WordQuest.Api/Contracts/Contracts.cs
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs
    - backend/src/WordQuest.Modules.Identity/Services/LearnerProfileProblem.cs
    - backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs
    - backend/src/WordQuest.Api/Program.cs
    - backend/src/WordQuest.Api/appsettings.json
    - frontend/e2e/docker-compose.e2e.yml
    - frontend/e2e/children.spec.ts
    - frontend/e2e/manage.spec.ts
    - frontend/src/App.tsx
    - frontend/src/types.ts
    - frontend/src/features/manage/ChildFormPage.tsx
    - frontend/src/features/manage/ChildFormPage.test.tsx
    - frontend/src/features/manage/ChildrenPage.tsx
    - frontend/src/features/manage/ChildrenPage.test.tsx
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Unbekannte ID: EmptyState nur mit dem Satz 'Dieses Kind gibt es nicht (mehr). Gehe zurück zur Liste.'; der Link 'Alle Kinder' ist der Zurück-Link darüber, kein zweiter Link mit gleichem Namen"
  - "AvatarKey-Länge als Regel in AccountRules (optionaler Parameter von ValidateLearnerProfile), Feldtext 'Das Bild darf höchstens 50 Zeichen lang sein.'; PATCH kennt kein avatarKey-Feld, deshalb nur POST geprüft"
  - "Fokus-nicht-verdeckt bei 640 px mit Querformat-Höhe 360 px, weil bei 640 × 568 kein Ziel unter der Leiste liegt und der Test sonst nur den trivialen Fall prüft"

requirements-completed: [PAR-01, PAR-02, QUAL-02]

coverage:
  - id: D1
    description: "PATCH-Regeln: ungültige PINs (123, 1234567, 12a4, '12 34', '   ', ١٢٣٤) 400 pin an POST und PATCH; PIN 4/6 Ziffern 200, neue PIN 200, alte PIN 401 'Die PIN stimmt nicht.'; leere/fehlende PIN unverändert; Name 100 → 200, 101 → 400, leer/Leerzeichen → 400, Umlaut+Emoji unverändert, ohne Name unverändert; ungültige Anfrage ändert nichts; fremder Mandant 404; Kinder-Token 403; neue PIN hebt Sperre auf; ReviewState feldweise, Xp und CurrentStreak unverändert; avatarKey 51 Zeichen 400"
    requirement: PAR-02
    verification:
      - kind: integration
        ref: "backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs (gegen PostgreSQL 17, Api.Tests 126/126)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Elternteil ändert Name, Limit und PIN in der App; Kind meldet sich mit der neuen PIN an"
    requirement: PAR-01
    verification:
      - kind: e2e
        ref: "frontend/e2e/children.spec.ts#Kind bearbeiten und mit neuer PIN anmelden"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edge-Case-Matrix Kind bearbeiten (14 Client-Fälle, 5 Grenzen, Laden, Kind ohne PIN, unbekannte ID, 2 Ladefehler, PIN leer, Server-PIN-Fehler, Server weg, Enter, Doppelklick, Happy Path zuletzt); Kinderliste Zeilen-Links und Ladefehler; Anlegen: Name 100 Zeichen, Server-Fehler am Namen"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "frontend/src/features/manage/ChildFormPage.test.tsx, ChildrenPage.test.tsx (vitest 99/99)"
        status: pass
    human_judgment: false
  - id: D4
    description: "/verwalten/kinder/{id}: checkPage 0 Verstöße vorbefüllt, mit Feldfehler und bei unbekannter ID; Tab-Reihenfolge bei 320 px; Fokus nicht verdeckt bei 640 px"
    requirement: QUAL-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/children.spec.ts#Kind bearbeiten barrierefrei; frontend/e2e/manage.spec.ts#Fokus nicht verdeckt bei 640 px"
        status: pass
    human_judgment: false
  - id: D5
    description: "Auth-Limit Standard 10 (11. Login und 11. Passwortänderung → 429); e2e-Gesamtlauf aller Specs in einem Durchgang ohne 429"
    requirement: QUAL-02
    verification:
      - kind: integration
        ref: "backend/tests/WordQuest.Api.Tests/RateLimitTests.cs (2/2)"
        status: pass
      - kind: e2e
        ref: "npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e (23 passed, 1 skipped, Exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Tastatur-Durchgang (sichtbarer Fokus, Esc/Enter) und 200 % Zoom auf Kinderliste, Kind anlegen, Kind bearbeiten, Konto; Glas-Wirkung auf günstigem Tablet; Betrieb auf Raspberry Pi"
    requirement: QUAL-02
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md Manual-Only Verifications (end-of-phase)"
        status: unknown
    human_judgment: true
    rationale: "Fokusbild, Lesbarkeit bei Zoom und echte Hardware brauchen Augenschein"

duration: 20min
completed: 2026-10-16
---

# Phase 1 Plan 08: Kind bearbeiten mit PIN-Regel beim Ändern Summary

**Ein Elternteil öffnet ein Kind aus der Kinderliste, ändert Name, Neue Karten pro Tag und PIN und sieht „Die Änderungen sind gespeichert. Die neue PIN gilt ab sofort.“; das Kind meldet sich danach mit der neuen PIN an, auch wenn es vorher gesperrt war. `PATCH /learners/{id}/settings` prüft Name und PIN über dieselbe `AccountRules.ValidateLearnerProfile` wie das Anlegen, bevor irgendetwas gespeichert wird. Das Auth-Limit kommt aus `Auth:RequestsPerMinute` (Standard 10); nur der e2e-Teststack hebt es an, deshalb läuft das ganze e2e in einem Durchgang grün.**

Start 2026-10-16T20:28:58Z, Ende 2026-10-16T20:49:23Z, 3 Tasks, 18 Dateien.

## Task Commits

1. **Task 1 (Tracer): Kind bearbeiten Ende-zu-Ende, PIN-Regel beim Ändern:** `3a0db27` (feat)
2. **Task 2: Edge-Case-Matrix Bearbeiten, Lade-/Fehlerzustände:** `a5cc70a` (feat)
3. **Task 3: axe/Tastatur/640 px, Auth-Limit konfigurierbar, Doku, Phasen-Gate:** `459c22f` (feat, Trailer `A11y-Check: @axe-core/playwright 4.13.0 0 violations /verwalten/kinder /verwalten/kinder/{id}`)

`commits: 3`, gemessen mit `git rev-list --count 79227e3..HEAD`.

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Schritt 1** (`dotnet test --filter LearnerEndpointTests`, Endpoint alt): `Failed: 13, Passed: 31, Total: 44`. Rot: alle 6 Fälle der PIN-Invariante POST+PATCH, beide leeren Namen, Name 100 und 101 Zeichen, Umlaut/Emoji (PATCH kannte keinen Namen), „ungültige Anfrage ändert nichts“ und avatarKey mit 51 Zeichen. Grün schon im Bestand: neue PIN ersetzt alte, Sperre aufheben, fehlende PIN unverändert, fremder Mandant 404, 403, Lernstand unverändert.
- **Task 1, Schritt 2** (`playwright test children.spec.ts -g "Kind bearbeiten und mit neuer PIN"` gegen einen Stack aus dem Stand ohne Umsetzung): `1 failed`, Test-Timeout 30 s, `waiting for getByRole('link', { name: /Bearbeitkind …/ })` (children.spec.ts:65).
- **Task 2, Schritt 1** (`vitest run ChildFormPage ChildrenPage` gegen den Rundweg aus Task 1): `Tests 18 failed | 43 passed (61)`. Rot: 14 Client-Fälle Bearbeiten, unbekannte ID, Ladefehler 500, Ladefehler Netz, Ladefehler der Kinderliste.
- **Task 3, erster Lauf:** `RateLimitTests` `Passed: 2` (hält den Bestand fest, wie im Plan erwartet). `Kind bearbeiten barrierefrei` grün. `Fokus nicht verdeckt bei 640 px` rot an der Testbedingung „kein Ziel lag bei Scroll 0 unter der Leiste“ (bei 640 × 568 reicht nichts unter die Leiste); Viewport auf 640 × 360, danach grün. Ganzes e2e am frischen Stack **vor** der Limit-Einstellung: `19 passed, 4 failed, 1 skipped`, alle 4 in learn.spec mit `Rate-Limit auth erreicht … Expected: not 429`.

## Verify-Ergebnisse (beobachtet)

- **Task 1:** Build `0 Warning(s)`, `0 Error(s)`; Learning.Tests `Passed: 104`, Api.Tests `Passed: 124`; vitest `65 passed`; lint, typecheck, build Exit 0; `e2e children.spec.ts` `4 passed`. Acceptance-Greps alle PASS, `grep -c 'AccountRules.ValidateLearnerProfile' LearnerEndpoints.cs` = 2. Tracer-Gate (end-of-phase, rein automatischer Verify): erneut grün, kein Checkpoint.
- **Task 2:** vitest `Test Files 9 passed (9)`, `Tests 99 passed (99)`; `design:classes -- src/features/manage` `keine alten Klassen`; lint und typecheck Exit 0. Greps PASS; letzter Fall der Datei ist der Happy Path.
- **Task 3 / Phasen-Abschluss-Gate in einem Lauf:**
  - Backend im SDK-Container gegen eigenes `postgres:17-alpine` (`wq-0108-db`, Netz `wq-0108`): `0 Warning(s)`, `0 Error(s)`; Learning.Tests `Passed: 104, Total: 104`; Api.Tests `Passed: 126, Total: 126` (darunter RateLimitTests 2/2, LearnerEndpointTests 42).
  - Frontend: `npm ci` 0, lint 0, typecheck 0, build 0, test `99 passed (99)`, design:check `errors: 0, warnings: 0` (Exit 0), design:classes `keine alten Klassen` (Exit 0).
  - e2e: `e2e:stack` Exit 0, `npm run e2e` **ein Durchgang** Exit 0: `23 passed`, `1 skipped` (first-run.spec läuft nur im Smoke), kein 429; „Kind bearbeiten und mit neuer PIN anmelden“ und „Kind bearbeiten barrierefrei“ passed. Im Container `printenv Auth__RequestsPerMinute` = `1000`. Danach `down -v`.
  - Produktions-Compose: `git diff --quiet HEAD -- docker-compose.quick.yml docker-compose.yml` Exit 0; keine der beiden Dateien enthält `RequestsPerMinute`.
  - Install-Smoke: `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `1 passed`, `FIRST RUN OK`, `SMOKE OK`, Exit 0.
  - Aufgeräumt: e2e-Stack, `wq-0108-db`, Netz `wq-0108`, Volume `wq-0108-nuget`; keine `wordquest`- oder `wq-smoke`-Container übrig.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testbedingung bei 640 px trivial**
- **Found during:** Task 3, erster Lauf
- **Issue:** Bei 640 × 568 lag kein fokussierbares Ziel bei Scroll 0 unter der Tab-Leiste; der Test hätte nichts geprüft und scheiterte an seiner eigenen Schutzbedingung.
- **Fix:** `expectFocusNotObscured` nimmt einen Viewport; der 640-px-Fall läuft mit 640 × 360.
- **Files modified:** frontend/e2e/manage.spec.ts
- **Commit:** 459c22f

### Sonstige Abweichungen

- **Eigene Test-Datenbank** statt `host.docker.internal:5432` aus dem Plan-Verify (Port 5432 belegt), wie in 01-06/01-07.
- **Dateien außerhalb von `files_modified`:** `AccountRules.cs`, `LearnerProfileProblem.cs` (AvatarKey-Regel, Übergabe 01-07), `frontend/e2e/manage.spec.ts` (640 px, Übergabe 01-06).
- **AvatarKey nur bei POST geprüft:** Die Übergabe nennt POST und PATCH; `UpdateLearnerSettingsRequest` hat kein `avatarKey`, ein gesendetes Feld wird ignoriert. Kein neues Feld eingeführt.
- **Ladefehler der Kinderliste** zeigt die Meldung des `ApiError` (bei 500 „Das hat nicht geklappt. Versuche es noch einmal.“, ohne Netz der Server-Hinweis), wie die Bearbeiten-Seite, statt eines eigenen Textes.
- **ChildrenPage.test.tsx Selektor** `div.min-h-15` → `a.min-h-15`, weil die Zeilen jetzt Links sind (Task 1).
- **`PATCH` hasht die PIN bei nicht leerer Eingabe** (`IsNullOrEmpty` statt `IsNullOrWhiteSpace`): Leerzeichen-PINs lehnt die Prüfung vorher ab, die Bedingung spiegelt jetzt „leer = unverändert“.
- **Ein Commit pro Task statt einem pro Plan (D-02):** Auftrag des Orchestrators.

**Total deviations:** 1 auto-fixed (Rule 1), 6 sonstige. **Impact:** keine auf das Verhalten über den Plan hinaus.

## Issues Encountered

- `npm ci` meldet `2 vulnerabilities (1 low, 1 high)`; `package-lock.json` ist in diesem Plan unverändert, also Altbestand. Nicht angefasst (keine neuen oder geänderten Dependencies ohne Freigabe).

## Offene Punkte

- **Review durch Subagent** (AGENTS.md „Review“, Plan-Verification): Dieser Executor hat kein Subagent-Werkzeug. Prüfgegenstand: Diff `79227e3..459c22f` gegen PAR-01, PAR-02 (Ändern), QUAL-02, IDOR/Eingaben (T-01-31 bis T-01-35, T-01-39).
- **Manuell am Ende der Phase (nicht geprüft, nicht als bestanden markiert):**
  1. Kinderliste, Kind anlegen, Kind bearbeiten und Konto nur mit der Tastatur: sichtbarer Fokus, Enter sendet, Esc wo vorhanden.
  2. Dieselben vier Seiten bei 200 % Browser-Zoom ohne Verlust von Inhalt oder Funktion.
  3. 100-Zeichen-Name in der Anmelde-Kachel ansehen (aus 01-07).
  4. Glas-Wirkung und Leistung auf einem günstigen Tablet (Android/Windows).
  5. Installation und Betrieb auf einem Raspberry Pi 5 (ARM64).
  Automatisch angenähert über Tab-Reihenfolge bei 320 px, Fokus-nicht-verdeckt bei 320 und 640 px, 320-px-Reflow und checkPage.
- **Bewusst ohne Sperre:** Zwei Eltern bearbeiten dasselbe Kind gleichzeitig: die letzte Speicherung gilt (Plan-Truth, kein Test).
- `REQUIREMENTS.md` nicht angefasst (Vorgabe des Orchestrators); PAR-01, PAR-02 und QUAL-02 sind mit diesem Plan erfüllt.

## Self-Check: PASSED

- Dateien vorhanden: RateLimitTests.cs, LearnerEndpointTests.cs, ChildFormPage.tsx, ChildFormPage.test.tsx, ChildrenPage.tsx, children.spec.ts, manage.spec.ts
- Commits in HEAD: 3a0db27, a5cc70a, 459c22f
