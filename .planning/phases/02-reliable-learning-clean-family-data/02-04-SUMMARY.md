---
phase: 02-reliable-learning-clean-family-data
plan: 04
subsystem: manage-ui
tags: [react, radix-dialog, a11y, ef-core, validation, playwright, axe]
status: complete

requires:
  - phase: 02-03
    provides: "Dialog und ConfirmDialog mit returnFocusRef, aria-modal, Startfokus „Abbrechen“; Muster DeleteChild"
  - phase: 02-02
    provides: "Fremdschlüssel: Set löschen entfernt Vokabeln, Karten und Lernstand, Runden behalten SetId = null"
provides:
  - "ContentRules.CheckText (MaxTextLength 200) und ContentTextProblem im Content-Modul, für 02-05 (Wörter)"
  - "PATCH /api/v1/sets/{id}: Titel an Ort und Stelle, IDs und Lernstand bleiben; 400/404/403"
  - "POST /api/v1/sets mit mehr als 200 Zeichen: 400 statt 500"
  - "DELETE /api/v1/sets/{id}: 404 mit „Dieses Set gibt es nicht (mehr).“"
  - "Set-Seite: Kopf mit Titel, „Umbenennen“ (Dialog) und „Set löschen“ (Bestätigung); Leer- und Ladefehlerzustand"
  - "SetsPage: Erfolgsmeldung aus dem Router-State"
  - "e2e/axe.ts: expectDialogContrast für Dialog und ConfirmDialog"
affects: [02-05]

actuals:
  tokens: 18360
  tasks: 3
  commits: 4
plan_head_before: 3fb0f016d3868f99acfc9dc3e9c5bc55b9759eb1
plan_head_after: 4eda3a1fc30af3a21cdee69f081eab04afdd0f1e

tech-stack:
  added: []
  patterns:
    - "useSetGone: 404 im Dialog merkt sich die Seite; neu geladen wird erst beim Schließen, Fokus-Ersatzziel „Alle Sets“"
    - "Titel der Set-Seite aus der Liste ['sets'] statt Einzelabruf (Muster EditChild)"
    - "Eine Regel im Modul (ContentRules), Texte beim Aufrufer (Muster AccountRules)"

key-files:
  created:
    - backend/src/WordQuest.Modules.Content/Services/ContentRules.cs
    - backend/src/WordQuest.Modules.Content/Services/ContentTextProblem.cs
    - backend/tests/WordQuest.Api.Tests/SetEditTests.cs
    - backend/tests/WordQuest.Learning.Tests/ContentRulesTests.cs
  modified:
    - backend/src/WordQuest.Api/Contracts/Contracts.cs
    - backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs
    - backend/tests/WordQuest.Api.Tests/SetDeleteTests.cs
    - frontend/src/features/manage/SetDetailPage.tsx
    - frontend/src/features/manage/SetDetailPage.test.tsx
    - frontend/src/features/manage/SetsPage.tsx
    - frontend/src/features/manage/SetsPage.test.tsx
    - frontend/e2e/manage.spec.ts
    - frontend/e2e/keyboard-zoom.spec.ts
    - frontend/e2e/axe.ts
    - frontend/e2e/children.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Ohne gefundenes Set rendert die Set-Seite nur Kopf-Zustand (Spinner, Ladefehler oder Leerzustand); Erfassung, Import und Liste erst mit Set"
  - "Titelprüfung als eine private Hilfe TitleProblem für POST und PATCH; ContentRules.CheckText steht deshalb einmal in SetEndpoints"
  - "expectDialogContrast nach e2e/axe.ts verschoben und auf [aria-modal] erweitert; Buttons mit eigenem Verlauf (bgGradient) wie in expectGlassContrast ausgenommen"

requirements-completed: []
requirements-partial: [PAR-04, QUAL-01]

duration: 22min
completed: 2026-10-17
---

# Phase 2 Plan 04: Sets korrigieren und löschen – Zusammenfassung

**Set umbenennen an Ort und Stelle (`PATCH /sets/{id}`, gleiche IDs, Lernstand bleibt) und Set löschen mit Bestätigung, beides im Kopf der Set-Seite; Titel über 200 Zeichen ergeben 400 statt 500; axe 0 Verstöße mit beiden Dialogen offen.**

## Leistung

- **Dauer:** ca. 22 min (2026-10-17T19:07Z bis 19:29Z)
- **Tasks:** 3 von 3, dazu ein Commit mit Review-Befunden
- **Dateien:** 16 (4 neu)

## Ergebnis

- **Backend:** `ContentRules.CheckText` (trimmen; leer → `Missing`, über 200 → `TooLong`). `SetEndpoints` nutzt die Regel über `TitleProblem` in `CreateAsync` und im neuen `UpdateAsync` (Guardian, Mandantenfilter, 404 mit Text, 200 mit `VocabularySetDto`). `DeleteAsync` antwortet bei fremdem oder unbekanntem Set mit 404 und „Dieses Set gibt es nicht (mehr).“.
- **Set-Seite:** Der Titel kommt aus `['sets']`. Während die Liste lädt, erscheint ein Spinner. Bei einem Ladefehler steht `ErrorNote` mit dem Fehlertext da, bei unbekannter ID der Leerzustand „Dieses Set gibt es nicht (mehr).“ / „Gehe zurück zu allen Sets.“. Ist das Set gefunden, zeigt der Kopf `h2` (`break-words`, `tabIndex={-1}`) und darunter „Umbenennen“ (`secondary`, `sm`) und „Set löschen“ (`danger`, `sm`). Unter dem Kopf steht die `SuccessNote`, danach folgen die bisherigen Teile.
- **Umbenennen:** `Dialog` „Set umbenennen“ mit dem Feld `set-titel`. Geprüft wird beim Absenden mit denselben Texten wie auf dem Server. Feldfehler des Servers stehen am Feld, alle anderen Fehler als `ErrorNote`. Ref-Riegel plus `busy` sperren doppeltes Absenden, während der Anfrage schließen weder Esc noch „Abbrechen“. Nach Erfolg geht der Fokus auf „Umbenennen“.
- **Löschen:** `ConfirmDialog` mit „Set „{Titel}“ löschen?“. Danach werden `['sets']`, `['traffic-light']` und `['overview']` neu geladen, `['entries', id]` wird entfernt, und die Seite wechselt zu `/verwalten` mit „Das Set „{Titel}“ ist gelöscht.“.
- **404 in beiden Dialogen** (`useSetGone`): Der Fehler bleibt bis zum Schließen stehen. Erst dann wird `['sets']` neu geladen, und der Fokus geht auf „Alle Sets“.
- **Konzept:** API-Zeilen `POST`, `PATCH` und `DELETE /sets` mit Regeln und Folgen. Im Abschnitt „Löschung“ sind jetzt die Set-Dialoge beschrieben statt „vorgesehen“.

## Task-Commits

1. **Task 1: Tracer Set umbenennen Ende-zu-Ende** – `ac3e287` (feat)
2. **Task 2: Set löschen mit Bestätigung** – `54f796d` (feat)
3. **Task 3: Matrizen, axe, Tastatur, 200 % Zoom, Konzept** – `e75d83b` (test)
4. **Review-Befunde** – `4eda3a1` (fix)

## TDD-Belege

**Task 1, Schritt 1 (rot vor dem Code):**
- Backend: Build bricht ab, 7 Fehler `CS0103: The name 'ContentRules' does not exist` / `'ContentTextProblem'` in `ContentRulesTests.cs`.
- e2e „Set umbenennen“: `1 failed`, `waiting for getByRole('heading', { name: 'Zz E2E Umbenennen …', level: 2 })`.
- Danach grün: Learning.Tests 6 passed, Api.Tests 13 passed (Filter SetEdit/ContentRules/SetDelete); `manage.spec.ts` 10 passed. Tracer-Gate: Verify erneut gelaufen und grün, erst danach erweitert.

**Task 2, Schritt 1:**
- Backend: `1 failed, 14 passed`. `Set_einer_anderen_Familie_oder_unbekannt_ergibt_404_mit_Text`: `Expected: "Dieses Set gibt es nicht (mehr)." Actual: null`. Der 403-Fall war schon grün, denn die Guardian-Policy gab es bereits.
- e2e „Set löschen“: `1 failed`, `waiting for getByRole('button', { name: 'Set löschen' })`.
- Danach grün: Api.Tests 15 passed, `manage.spec.ts` 11 passed.

**Task 3, Schritt 1 (vitest):** Alle 27 neuen Fälle waren beim ersten Lauf grün, weil Task 1 und 2 das Verhalten schon lieferten. Damit belegt ist, dass die Tests greifen, wurden Mutationen gemessen und danach zurückgesetzt:

| Mutation | rote Fälle |
|---|---|
| ohne Clientprüfung des Titels | 3 (leer, nur Leerzeichen, 201 Zeichen) |
| Neuladen sofort nach 404 | 2 (404 Umbenennen, 404 Löschen) |
| Fokusziel immer der Auslöser | 2 (404 Umbenennen, 404 Löschen: Fokus „Alle Sets“) |
| ohne Ref-Riegel beim Umbenennen | 0 – `userEvent.dblClick` trifft schon den gesperrten Button; der Riegel ist so nicht getrennt messbar |
| ohne `SuccessNote` in `SetsPage` | 1 (Erfolgsmeldung über dem Leerzustand) |
| Review-Fix ohne `onSaved(null)` | 1 („Neuer Versuch nimmt die alte Erfolgsmeldung weg“) |

**Task 3, Schritt 2 (e2e):** „Set-Dialoge barrierefrei“ war rot (`1 failed, 28 passed`). Grund: `nicht gemessener Kontrast ueber primary-deep`, axe meldete für „Speichern“ (eigener Verlauf `from-primary-light to-primary-deep`) `bgGradient`. „Langer Set-Titel bei 320 px“ und „Dialoge der Set-Seite bei 200 %“ waren sofort grün, das ist der erwartete Beleg. Folge siehe Abweichung 2.

## Gate-Ergebnisse (Stand `4eda3a1`)

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` | Build ohne Warnung (`/warnaserror`); Learning.Tests 110 passed, Api.Tests 179 passed, 0 failed (Lauf auf `e75d83b`; `4eda3a1` ändert nur Frontend) |
| Frontend | `npm ci`, `lint`, `typecheck`, `build`, `test`, `design:check`, `design:classes` | alle Exit 0; Vitest 14 Dateien, 162 Tests passed; DESIGN.md `errors: 0, warnings: 0`; „keine alten Klassen“ |
| Keine neue Dependency | `git diff --quiet HEAD -- frontend/package.json frontend/package-lock.json` | Exit 0 |
| e2e | `npm run e2e:stack && npx playwright test` (frischer Stack auf `4eda3a1`) | 39 passed, 1 skipped (`first-run.spec.ts`, absichtlich nur im Install-Smoke) |

Container danach entfernt: `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v`, `backend-test.sh down` („wq-p2 entfernt.“), `docker ps` ohne Testcontainer.

## Barrierefreiheit (Beleg)

- **Tool:** `@axe-core/playwright` 4.13.0, Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Seiten:**
  - `/verwalten/sets/{id}` geschlossen: `checkPage` (axe, Glas-Kontrast, deckender Fallback, Reflow), **0 Verstöße**.
  - Mit offenem Dialog „Set umbenennen“ samt Fehlertext „Ein Set braucht einen Titel.“: **0 Verstöße**.
  - Mit offenem Dialog „Set löschen“: **0 Verstöße**.
  - Kontrast beider Dialoge über allen fünf Backdrop-Farben und über `primary-deep`: 0 Verstöße. Nicht gemessen blieb nur „Speichern“ (`bgGradient`, Kontrast über Tokens belegt).
  - `/verwalten` mit „Das Set „…“ ist gelöscht.“: `checkPage`, **0 Verstöße**.
- **320 px:** Ein Titel aus 200 Zeichen ohne Leerzeichen bricht im Set-Kopf, im Dialogtitel und in der Erfolgsmeldung um. `scrollWidth <= clientWidth`, Seite `scrollWidth <= 320`, der Text bleibt vollständig.
- **200 % (640 × 400):**
  - „Umbenennen“: per Enter geöffnet, Fokus im Feld. Leeres Absenden zeigt den Fehlertext, der Fokus bleibt im Feld. Das Sheet ist höchstens 384 px hoch. Tab läuft Feld → Abbrechen → Speichern → Feld, jeder Button ganz im Bild und mit sichtbarem Fokus. Esc gibt den Fokus an „Umbenennen“ zurück.
  - „Set löschen“: Startfokus „Abbrechen“, Tab läuft Abbrechen → Endgültig löschen → Abbrechen. Enter auf „Abbrechen“ löscht nicht, der Fokus geht an „Set löschen“. Zum Schluss wird das Set per Tastatur gelöscht.
- **Offen (human-check, end-of-phase):** Bedienung auf dem Tablet und mit echtem Browser-Zoom 200 % nur per Tastatur. Nicht durchgeführt; UNBEKANNT: Ergebnis am Gerät.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Regel 3 – blockierend] Bestandstest der Set-Seite schon in Task 1 angepasst**
- **Gefunden bei:** Task 1 (vitest rot: „Set-Detail zeigt beim Laden und nach einem Fehler keine leere Liste“)
- **Problem:** Der Stub bediente nur eine offene Anfrage. Die neue Abfrage `['sets']` blieb hängen, deshalb verschwand der Spinner nie.
- **Fix:** Der Stub beantwortet beide Abfragen, die Aussage bleibt unverändert. Der Plan sah das für Task 3 vor; vorgezogen, damit jeder Commit grün ist.
- **Datei:** `frontend/src/features/manage/SetDetailPage.test.tsx` · **Commit:** `ac3e287`

**2. Dialog-Kontrast mit `expectDialogContrast` statt `expectGlassContrast` gemessen**
- Der Plan nennt `expectGlassContrast(page)` bei offenem Dialog. Laut 02-03 kann axe Text auf dem Glas-Sheet dort nicht bewerten (`elmPartiallyObscuring`). Die Hilfe `expectDialogContrast` aus `children.spec.ts` wurde deshalb nach `e2e/axe.ts` verschoben. Sie gilt jetzt über `[aria-modal="true"]` für beide Dialogarten, `children.spec.ts` importiert sie. Neu ist eine Ausnahme: Buttons mit eigenem Verlauf (`bgGradient`) dürfen auch über `primary-deep` als nicht gemessen bleiben, wie schon in `expectGlassContrast`. Ihr Hintergrund hängt nicht vom Untergrund ab. Dateien außerhalb des Plans: `frontend/e2e/axe.ts`, `frontend/e2e/children.spec.ts`. **Commit:** `e75d83b`

**3. Konzept nennt `PATCH /sets/{id}` zusätzlich im Fließtext**
- Das Akzeptanzkriterium greppt `PATCH /sets/{id}` mit einem Leerzeichen. Der API-Block richtet die Verben aber wie der Bestand aus (`PATCH  /sets/{id}`). Statt die Ausrichtung zu brechen, nennt der Abschnitt „Löschung“ den Endpunkt in Code-Schrift.

**4. `h2` ohne Ref**
- Der Plan nennt einen Ref auf den Set-Titel als Fokusziel. In 02-04 braucht ihn kein Ablauf; erst „Vokabel gelöscht → Fokus auf den Set-Titel“ in 02-05. Gesetzt ist deshalb nur `tabIndex={-1}`, der Ref kommt mit 02-05.

**5. Ohne Set nur der Kopf-Zustand**
- Die Set-Seite zeigt Erfassung, Import und Liste erst, wenn das Set in der Liste gefunden ist. Während des Ladens sieht man nur den Spinner, bei einem Ladefehler nur die `ErrorNote`. Der Plan verlangte das Ausblenden nur für „Set fehlt“. So blitzt bei einer unbekannten ID nie die Erfassung auf.

## Review (AGENTS.md „Review“, D-02)

Geprüft hat eine unabhängige zweite Instanz (`claude -p`, nur Lesen: Read/Grep/Glob, `git diff/show/log`) gegen Plan, UI-SPEC, 02-CONTEXT, AGENTS.md, DESIGN.md und den Diff `3fb0f01..e75d83b`. Ergebnis: kein BLOCKER, kein HOCH, kein MITTEL. Ohne Befund geprüft wurden PAR-04/D-08 (Snapshot-Vergleich), die Validierung in POST und PATCH, IDOR und Rolle, die Doku-Aussage `SetNull` (`LearningConfigurations.cs:73`), das 404-Verhalten, Doppel-Submit, die Matrizen und die Tokens. Der Reviewer hat keine Tests ausgeführt.

| Befund | Schwere | Umgang |
|---|---|---|
| Kommentar in `SetsPage.tsx` „überlebt kein Neuladen“ ist falsch: der Router-State liegt in `history.state` und übersteht F5 | NIEDRIG | behoben (`4eda3a1`): „bleibt bis zur nächsten Navigation“. `ChildrenPage.tsx:12` trägt denselben falschen Kommentar; der stammt nicht aus diesem Plan, wird hier gemeldet und nicht geändert. |
| „Der neue Titel ist gespeichert.“ bleibt bei späteren Versuchen stehen | NIEDRIG | behoben (`4eda3a1`): ein neuer Speicherversuch entfernt die Meldung (Muster `ChildForm`); vitest-Fall, per Mutation rot belegt |

## Befund ohne Änderung (laut Plan)

- **CSV-Import über 200 Zeichen ergibt 500:** `CsvVocabularyParser` und `ConfirmImportAsync` prüfen die Länge nicht. Ein Wort mit mehr als 200 Zeichen endet beim Übernehmen als Datenbankfehler (500). Das gehört zu keiner Anforderung dieser Phase; gemeldet, nicht gebaut. `ContentRules.CheckText` steht für eine spätere Korrektur bereit.

## Bekannte Folgen

- `POST /sets/{id}/entries` prüft die Länge weiterhin nicht (heute 500 bei mehr als 200 Zeichen). Das deckt 02-05 mit `ContentRules` ab.
- `openFirstSet` in `manage.spec.ts` wartet auf einen Button mit „…löschen“. Seit dieser Änderung trifft das auch „Set löschen“ im Kopf, also schon vor dem Laden der Vokabeln. Alle Läufe waren grün, einen Flake gab es nicht. Wird `openFirstSet` instabil, ist hier zu suchen.

## Anforderungen

- **PAR-04** ist teilweise erfüllt (Set umbenennen). „Vokabel korrigieren“ folgt in 02-05, deshalb nicht abgehakt.
- **FIX-02** war seit 02-02 abgehakt; „Set löschen“ hat jetzt eine Oberfläche.
- **QUAL-01** ist teilweise erfüllt (`SetEditTests`, erweiterte `SetDeleteTests`), nicht abgehakt.
- **FIX-04** (Hinweis aus 02-03): die 404-Texte für `DELETE`/`PATCH /sets/{id}` sind erledigt, die für Vokabeln folgen in 02-05.

## Self-Check: PASSED

`ContentRules.cs`, `ContentTextProblem.cs`, `SetEditTests.cs`, `ContentRulesTests.cs` vorhanden; Commits ac3e287, 54f796d, e75d83b, 4eda3a1 sind Vorfahren von HEAD.
