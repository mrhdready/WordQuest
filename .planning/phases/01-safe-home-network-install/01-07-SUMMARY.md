---
phase: 01-safe-home-network-install
plan: 07
subsystem: identity
tags: [learner, pin, edge-case-matrix, vitest, playwright, axe-core, install-smoke, wcag22]
status: complete

requires:
  - 01-02 (AccountRules, ApiFactory mit Isolationsregel, setup-smoke.sh)
  - 01-03 (Field, ApiError.errors, renderWithProviders, Tab-Leiste, checkPage, globalSetup mit WQ_E2E_GUARDIAN_*)
  - 01-05 (Reset-Passwort im Smoke als Variable)
  - 01-06 (Formularmuster AccountPage, Freiraum unter der Tab-Leiste, body-Grid mit minmax(0,1fr))
provides:
  - AccountRules.IsValidPin, MaxDisplayNameLength, ValidateLearnerProfile, ClampDailyNewLimit; Enum LearnerProfileProblem
  - POST /api/v1/learners mit Pflicht-PIN (4 bis 6 Ziffern 0-9), Namenslaenge 100, dailyNewLimit (3-15, Standard 5)
  - Seiten /verwalten/kinder (Kinderliste) und /verwalten/kinder/neu (ChildFormPage mode="create"), Tab "Kinder", "+" "Kind anlegen"
  - renderWithProviders mit optionalem Router-State
  - Seedfreier Erstdurchlauf im Install-Smoke (FIRST RUN OK)
affects: [01-08]

estimate:
  tokens: 165000
actuals:
  tokens: 15700
  tasks: 3
  commits: 3
plan_head_before: 7d36a63d2aa3ff2b40689811aac536610c1af463
plan_head_after: 00818587cbfba848a3e2bd2a3f3f7d85b751081f

tech-stack:
  added: []
  patterns:
    - "Regel im Identity-Modul liefert Befund-Codes (LearnerProfileProblem), der Endpoint mappt sie auf Feldtexte und sammelt alle in einem ValidationProblem"
    - "PIN-Pruefung mit dem Zeichenbereich '0'-'9' statt char.IsDigit bzw. \\d, im Server und im Formular gleich"
    - "Seiten mit Liste ohne Card: ListGroup und EmptyState sind selbst Glas (DESIGN.md: kein Glas auf Glas)"

key-files:
  created:
    - backend/src/WordQuest.Modules.Identity/Services/LearnerProfileProblem.cs
    - backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs
    - frontend/src/features/manage/ChildrenPage.tsx
    - frontend/src/features/manage/ChildrenPage.test.tsx
    - frontend/src/features/manage/ChildFormPage.tsx
    - frontend/src/features/manage/ChildFormPage.test.tsx
    - frontend/e2e/children.spec.ts
    - frontend/e2e/first-run.spec.ts
  modified:
    - backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs
    - backend/src/WordQuest.Api/Contracts/Contracts.cs
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - backend/tests/WordQuest.Api.Tests/AccountRulesTests.cs
    - frontend/src/App.tsx
    - frontend/src/features/manage/ManageLayout.tsx
    - frontend/src/types.ts
    - frontend/src/test/render.tsx
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - README.md

key-decisions:
  - "Servertexte mit echten Umlauten wie in der UI-SPEC (Orchestrator-Entscheidung 2026-10-16): auch der bisherige Text fuer den leeren Namen lautet jetzt 'Wie soll das Kind heißen? Ein Spitzname genügt.'"
  - "Kinderliste ohne Card: Ueberschrift 'Kinder' als h2, darunter ListGroup bzw. EmptyState direkt auf dem Backdrop (DESIGN.md:319 Glas nicht auf Glas stapeln)"
  - "Beim Anlegen ist die PIN Pflicht; die Pruefung beim Aendern (PATCH) bleibt fuer 01-08"

requirements-completed: [PAR-05]

coverage:
  - id: D1
    description: "Server-Regeln Kind anlegen: PIN 4/6 Ziffern 201, 3/7 Ziffern, Buchstaben und arabisch-indische Ziffern 400 pin, fehlende PIN 400 pin, Name 100 Zeichen 201 und 101 Zeichen 400 statt 500, leerer Name 400, beide Fehler zugleich, Umlaut und Emoji unveraendert, Limit 3/15/2/16/null -> 3/15/3/15/5, Kinder-Token 403, fremder Mandant sieht das Kind nicht, Anmeldung mit der PIN 200"
    requirement: PAR-02
    verification:
      - kind: integration
        ref: "backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs (22/22 gegen PostgreSQL)"
        status: pass
      - kind: unit
        ref: "backend/tests/WordQuest.Api.Tests/AccountRulesTests.cs (IsValidPin, ValidateLearnerProfile, ClampDailyNewLimit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Kind anlegen in der App und Anmeldung des Kindes mit 6-stelliger PIN"
    requirement: PAR-05
    verification:
      - kind: e2e
        ref: "frontend/e2e/children.spec.ts#Kind anlegen und anmelden"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edge-Case-Matrix Kind anlegen (13 Client-Faelle, 4 Grenzen, Server-Feldfehler, Server weg, Enter, Doppelklick, Happy Path zuletzt) und Zustaende der Kinderliste (leer, eins, drei, Erfolgsmeldung)"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "frontend/src/features/manage/ChildFormPage.test.tsx (23/23), ChildrenPage.test.tsx (4/4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "/verwalten/kinder und /verwalten/kinder/neu: checkPage 0 Verstoesse ohne und mit Feldfehlern, vier Tabs bei 320 px, Tab-Reihenfolge, 100-Zeichen-Name bricht um"
    requirement: QUAL-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/children.spec.ts#Kinder barrierefrei; #Langer Name"
        status: pass
    human_judgment: false
  - id: D5
    description: "Frische Installation ohne Demo-Daten: leere Kinderliste, erstes Kind, eigenes Set mit Eintrag, Kind-Anmeldung, erste Antwort mit Rueckmeldung"
    requirement: PAR-05
    verification:
      - kind: e2e
        ref: "bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh (FIRST RUN OK, SMOKE OK)"
        status: pass
    human_judgment: false
  - id: D6
    description: "200 % Zoom und Tastatur-Durchgang auf Kinderliste und Formular; 100-Zeichen-Name in der Anmelde-Kachel"
    requirement: QUAL-02
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md Manual-Only Verifications (end-of-phase)"
        status: unknown
    human_judgment: true

duration: 18min
completed: 2026-10-16
---

# Phase 1 Plan 07: Kind anlegen mit serverseitiger PIN-Regel Summary

**Ein Elternteil legt unter `/verwalten/kinder/neu` ein Kind mit Name, Neue Karten pro Tag und PIN an; das Kind meldet sich danach mit genau dieser PIN an. Die Regeln für PIN (4 bis 6 Ziffern 0–9), Namenslänge (100) und Tageslimit (3–15) stehen in `AccountRules` im Identity-Modul, der Endpoint mappt nur. Auf einer frischen Installation ohne Demo-Daten kommt der Install-Smoke ohne Eingriff bis zur ersten Lernantwort des Kindes (`FIRST RUN OK`).**

## Task Commits

1. **Task 1 (Tracer): Kind anlegen Ende-zu-Ende, Regeln im Identity-Modul:** `8084769` (feat)
2. **Task 2: Client-Prüfung, Edge-Case-Matrix, Zustände der Kinderliste:** `d98cf06` (feat)
3. **Task 3: Kinder barrierefrei, seedfreier Erstdurchlauf, Doku:** `0081858` (feat, Trailer `A11y-Check: @axe-core/playwright 4.13.0 0 violations /verwalten/kinder /verwalten/kinder/neu`)

`commits: 3`, gemessen mit `git rev-list --count 7d36a63..HEAD`.

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Schritt 1, erster Lauf** (`dotnet test --filter AccountRulesTests|LearnerEndpointTests`, Regeln fehlen): Build-Fehler, `error CS0103: The name 'LearnerProfileProblem' does not exist in the current context` (AccountRulesTests.cs:44 ff.).
- **Task 1, Schritt 1, zweiter Lauf** (Regeln im Modul da, Endpoint noch alt): `Failed!  - Failed: 14, Passed: 49, Total: 63`. Rot waren alle 4 ungültigen PINs, beide fehlenden PINs, 101 Zeichen (der alte Endpoint speicherte bis zur DB), beide leeren Namen (alter Text ohne Umlaute), beide Fehler zugleich und die Limits 3, 15, 2, 16 (Limit wurde ignoriert). Grün waren schon 4/6 Ziffern, 100 Zeichen, Umlaut/Emoji, Limit null → 5, 403, Mandant und Anmeldung, weil der Bestand sie trägt.
- **Task 1, Schritt 2** (`children.spec.ts` gegen einen Stack aus dem Stand vor dem Plan, gebaut in einem temporären `git worktree` von `7d36a63`): `1 failed`, `waiting for getByRole('link', { name: 'Kind anlegen' })` (children.spec.ts:15), Test-Timeout 30 s.
- **Task 2, Schritt 1** (`vitest run ChildFormPage ChildrenPage` gegen den Rundweg aus Task 1): `Tests 17 failed | 10 passed (27)`. Alle 13 Client-Fälle und „Leeres Absenden“: Fehlertext nicht gefunden. Server-PIN-Fehler: Fokus auf dem Button statt im Feld. Server weg: kein `role="alert"`. Doppelklick: `expected 'Kind anlegen' to be 'Einen Moment …'`. Grün waren die 4 Grenzen, Enter, Happy Path und die 4 Listen-Zustände.
- **Task 3, erster Lauf** (`e2e children.spec.ts first-run.spec.ts`): grün, `3 passed`, `1 skipped` (zulässig laut Plan, Seiten aus Task 1/2). Erster Smoke-Lauf: rot, `SMOKE FEHLER: Erstdurchlauf auf frischer Installation fehlgeschlagen.` Ursache war der Test, nicht die App: der Eintrag steht als „Hund → dog“ in einer Zeile, `getByText('dog', { exact: true })` fand nichts. Assertion korrigiert, zweiter Lauf grün.

## Verify-Ergebnisse (beobachtet)

- **Backend** im SDK-Container gegen eigenes `postgres:17-alpine` (`wq-0107-db`, Netz `wq-0107`): `dotnet build -c Release /warnaserror` `0 Warning(s)`, `0 Error(s)`. Learning.Tests `Passed: 104, Total: 104`, Api.Tests `Passed: 102, Total: 102` (50 Bestand, 30 neue Regel-Fälle, 22 LearnerEndpointTests). Zweimal gelaufen, nach Task 1 und nach Task 3.
- **Task 1:** lint, typecheck, build Exit 0; `e2e:stack` Exit 0; `e2e children.spec.ts` `1 passed`; `manage.spec.ts` mit vier Tabs `9 passed`. Alle Acceptance-Greps OK, `grep -c 'Math.Clamp' LearnerEndpoints.cs` = 0. Tracer-Gate (interaktiv, end-of-phase, rein automatischer Verify): Verify erneut grün, kein Checkpoint.
- **Task 2:** `npm run test` `Test Files 9 passed (9)`, `Tests 65 passed (65)` (38 Bestand plus 27). `design:classes -- src/features/manage` `keine alten Klassen`, lint und typecheck Exit 0. Greps auf `Limit 5.5`, `١٢٣٤`, `renderWithProviders` OK; der letzte Test der Datei ist der Happy Path.
- **Task 3:** `e2e children.spec.ts first-run.spec.ts`: „Kind anlegen und anmelden“, „Langer Name“, „Kinder barrierefrei“ passed, „Erste Installation bis zur ersten Lernantwort“ skipped. Smoke (zweiter Lauf, 51 s): `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `1 passed` (first-run.spec), `FIRST RUN OK`, `SMOKE OK`, Exit 0.
- **Ganzes e2e am frischen Stack:** `account children first-run login manage` `16 passed`, `1 skipped`; nach Neustart der API (Rate-Limit `auth`) `learn.spec.ts` `4 passed`. 20 von 20 plus 1 übersprungen, alle `checkPage`-Läufe 0 axe-Verstöße. Die Profilwahl in learn.spec zeigt dabei auch das Kind mit 100-Zeichen-Namen.
- **Frontend-Gate (Plan-Verification):** `npm ci` 0, lint 0, typecheck 0, build 0, test `65 passed`, design:check `errors: 0, warnings: 0` (Exit 0), design:classes `keine alten Klassen` (Exit 0).
- Aufgeräumt: e2e-Stack `down -v`, der Stack aus dem temporären Worktree samt Worktree, Container `wq-0107-db`, Netz `wq-0107`, Volume `wq-0107-nuget`. Der Smoke räumt per `trap` selbst ab (keine `wq-smoke`-Container oder -Images übrig).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Falsche Assertion im Erstdurchlauf**
- **Found during:** Task 3, erster Smoke-Lauf
- **Issue:** Die Set-Detailseite zeigt einen Eintrag als `Hund → dog` in einem Absatz; die Suche nach genau `dog` fand nichts.
- **Fix:** Assertion auf `Hund → dog`.
- **Files modified:** frontend/e2e/first-run.spec.ts
- **Commit:** 0081858

### Sonstige Abweichungen

- **Kinderliste ohne `Card`:** Der Plan nennt `Card` mit `CardTitle` „Kinder“ und darin eine `ListGroup`. Beide sind Glas, DESIGN.md:319 verbietet Glas auf Glas. Die Seite hat deshalb eine `h2` „Kinder“ (`type-headline text-ink`) und darunter `ListGroup` bzw. `EmptyState`, wie SetsPage. axe ist mit 0 Verstößen belegt.
- **Text für den leeren Namen:** Der Plan verlangt den Bestandstext unverändert (`heissen`, `genuegt`). Nach der Orchestrator-Entscheidung vom 2026-10-16 schreiben Servertexte echte Umlaute wie die UI-SPEC; Server und Formular haben jetzt denselben Text „Wie soll das Kind heißen? Ein Spitzname genügt.“.
- **`renderWithProviders` erweitert (frontend/src/test/render.tsx, nicht in `files_modified`):** optionaler Router-State und Anzeige der mitgegebenen Meldung in der Fangroute. Ohne das ließen sich „Erfolgsmeldung aus dem Router-State“ (ChildrenPage) und „Weiterleitung mit Erfolgsmeldung“ (Happy Path) nicht prüfen. Bestehende Aufrufe ohne `state` bleiben unverändert (Starteintrag weiter als String).
- **Regel-Theorien in `AccountRulesTests`:** erst als zweite Klasse in derselben Datei angelegt, vor dem ersten Lauf in die bestehende Klasse verschoben (ein Haupttyp pro Datei).
- **README (nicht in `files_modified`):** Abschnitt Datenschutz sagte „Pflichtfeld für ein Kind ist ausschließlich ein Anzeigename“. Das stimmt nicht mehr; jetzt „ein Anzeigename … und die PIN für die Anmeldung“ (AGENTS.md: Doku folgt dem Code).
- **Konzept §3 zusätzlich zur API-Zeile und der Sicherheitstabelle:** Der Satz „Das PIN-Format wird serverseitig derzeit nicht geprüft“ war nach Task 1 falsch. Er nennt jetzt die Prüfung beim Anlegen und die noch fehlende beim Ändern (`PAR-01`). Aus demselben Grund steht in der Sicherheitstabelle „beim Anlegen; beim Ändern geplant“ statt nur „serverseitig geprüft“.
- **Eigene Test-Datenbank** statt `host.docker.internal:5432` aus dem Plan-Verify (Port 5432 belegt), wie in 01-06.
- **Roter e2e-Lauf über einen Worktree:** Der Frontend-Rundweg entstand vor dem Bau des Stacks. Für den roten Lauf lief der Stack deshalb aus einem temporären `git worktree` von `7d36a63`, die neue Spec aus dem Arbeitsbaum. Worktree danach entfernt.
- **Ein Commit pro Task statt einem pro Plan (D-02):** Auftrag des Orchestrators.

## Issues Encountered

- Rate-Limit `auth`: Alle e2e-Specs in einem Lauf kämen über 10 Aufrufe pro Minute. Gelaufen in zwei Durchgängen mit API-Neustart dazwischen (bekannt, wird in 01-08 behoben). Jede Datei bleibt für sich im Budget: children.spec 2 Aufrufe plus globalSetup, first-run im Smoke 3 plus 4 Smoke-Logins = 7.
- „Limit keine Zahl“ (`abc`) landet in jsdom wie im Browser als leerer Wert eines `type="number"`-Felds. Der Fall prüft damit denselben Pfad wie „Limit leer“, der Fehlertext ist derselbe.

## Offene Punkte

- **Review durch Subagent** (AGENTS.md „Review“, Plan-Verification): Dieser Executor hat kein Subagent-Werkzeug. Prüfgegenstand für den Reviewer ist der Diff `7d36a63..0081858` gegen PAR-05, PAR-02 (Anlegen) und QUAL-02.
- **Manuell am Ende der Phase:** Kinderliste und Formular per Tastatur und bei 200 % Zoom; 100-Zeichen-Name in der Anmelde-Kachel ansehen. Automatisiert angenähert über 320-px-Reflow, Tab-Durchgang bei 320 × 568 und checkPage auf der Profilwahl (learn.spec) mit dem langen Namen.
- **01-08:** PIN-Regel und Namensprüfung beim Ändern (`ValidateLearnerProfile(…, nameRequired: false, …, pinRequired: false)` ist dafür schon getestet), Zeilen der Kinderliste als Links mit `ChevronRight`, Theorie mit denselben ungültigen PINs gegen POST und PATCH.
- **Veralteter Doku-Kommentar, nicht angefasst:** `LearnerProfile.PinHash` heißt in backend/src/WordQuest.Modules.Identity/Entities/LearnerProfile.cs:29 noch „Vierstellige PIN“. Passt in 01-08 mit der PIN-Regel beim Ändern.
- `REQUIREMENTS.md` ist nicht angefasst (Vorgabe des Orchestrators). PAR-05 ist erfüllt. PAR-02 und QUAL-02 sind für das Anlegen erfüllt, das Ändern folgt in 01-08.

## Self-Check: PASSED

- Dateien vorhanden: LearnerProfileProblem.cs, LearnerEndpointTests.cs, ChildrenPage.tsx, ChildrenPage.test.tsx, ChildFormPage.tsx, ChildFormPage.test.tsx, children.spec.ts, first-run.spec.ts
- Commits in HEAD: 8084769, d98cf06, 0081858
