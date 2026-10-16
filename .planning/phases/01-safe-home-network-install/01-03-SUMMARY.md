---
phase: 01-safe-home-network-install
plan: 03
subsystem: ui
tags: [liquid-glass, tab-bar, axe-core, playwright, vitest, forms, wcag22]
status: complete

requires:
  - 01-01 (Token-Pipeline, checkPage, Teststack wordquest-e2e, Vitest)
provides:
  - ManageLayout mit Kopf, <main>, Tab-Leiste (nav "Bereiche", flex-wrap) und seitenabhaengigem "+"
  - ListGroup/ListRow (components/ui/list.tsx)
  - Field (components/ui/field.tsx) mit {id}-hilfe/{id}-fehler, aria-describedby, aria-invalid
  - ApiError.errors, deutsche Texte fuer Netz- (Status 0) und Serverfehler (5xx, unlesbarer Koerper)
  - renderWithProviders(ui, { route, path }) mit echter Route und Fangroute (src/test/render.tsx)
  - Playwright-globalSetup mit einer Eltern-Anmeldung (WQ_E2E_GUARDIAN_EMAIL/_PASSWORD), storageState playwright/.auth/guardian.json
affects: [01-04, 01-06, 01-07, 01-08]

actuals:
  tokens: 13620
  tasks: 3
  commits: 7
plan_head_before: 54456453232d700bed4d2606c7f65d392f88aa55
plan_head_after: 4ca1530629c10f7c67e6db39eedee26e31d78a73

tech-stack:
  added: []
  patterns:
    - "Formularfelder ueber Field mit Render-Prop: {(control) => <Input {...control} />}"
    - "Serverfeldfehler aus ApiError.errors[feld] am Field, uebrige Fehler im ErrorNote"
    - "e2e-Specs im Elternbereich mit test.use({ storageState: guardianStorageState })"
    - "Pfeil/Symbol nie allein in einem Textknoten (axe nonBmp, Kontrast unmessbar)"
    - "Kein Glas auf Glas: Listen innerhalb einer Card mit divide-separator statt ListGroup"

key-files:
  created:
    - frontend/src/components/ui/list.tsx
    - frontend/src/components/ui/field.tsx
    - frontend/src/components/ui/field.test.tsx
    - frontend/src/lib/api.test.ts
    - frontend/src/test/render.tsx
    - frontend/src/test/render.test.tsx
    - frontend/src/features/manage/SetsPage.test.tsx
    - frontend/e2e/global-setup.ts
    - frontend/e2e/manage.spec.ts
  modified:
    - frontend/src/features/manage/ManageLayout.tsx
    - frontend/src/features/manage/SetsPage.tsx
    - frontend/src/features/manage/SetDetailPage.tsx
    - frontend/src/features/manage/ProgressPage.tsx
    - frontend/src/lib/api.ts
    - frontend/e2e/axe.ts
    - frontend/playwright.config.ts
    - .gitignore

key-decisions:
  - "Tab-Leiste im Fluss unter <main> statt sticky: ueber scrollendem Inhalt verdeckt sie Teile von Links/Buttons (axe target-size partiallyObscured, WCAG 2.5.8); ein eigener Scrollbereich in <main> macht den Kontrast fuer axe unmessbar (elmPartiallyObscured)"
  - "axe.ts expectOpaqueFallback schliesst laufende CSS-Uebergaenge vor der Messung ab (Endzustand statt erster Frame)"
  - "Feldbeschriftung des Set-Formulars: \"Titel\" (neu, Field verlangt ein sichtbares Label)"

requirements-completed: []

coverage:
  - id: D1
    description: "/verwalten, /verwalten/sets/:id (inkl. Import geoeffnet, Vorschau, Fehler) und /verwalten/fortschritt: checkPage 0 Verstoesse, 320-px-Reflow"
    requirement: DESIGN-01
    verification:
      - kind: e2e
        ref: "frontend/e2e/manage.spec.ts (/verwalten: axe 0; Set-Detail; CSV-Import; Fortschritt)"
        status: pass
  - id: D2
    description: "Tab-Reihenfolge Abmelden -> Set-Link -> Tab Vokabeln -> Neues Set, aktiver Tab aria-current=page"
    requirement: DESIGN-01
    verification:
      - kind: e2e
        ref: "frontend/e2e/manage.spec.ts#Tab-Reihenfolge: Kopf, Inhalt, Tabs, \"+\""
        status: pass
  - id: D3
    description: "Kein fokussiertes Element unter der Tab-Leiste bei 320 px (/verwalten, Set-Detail mit 32 Eintraegen)"
    requirement: DESIGN-01
    verification:
      - kind: e2e
        ref: "frontend/e2e/manage.spec.ts#Fokus nicht verdeckt bei 320 px; #Set-Detail: axe 0, Fokus nicht verdeckt"
        status: pass
  - id: D4
    description: "Eintrag-Formular: unvollstaendig 0 POST, Enter im Feld Englisch genau 1 POST"
    requirement: QUAL-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/manage.spec.ts#Eintrag-Formular"
        status: pass
  - id: D5
    description: "Field, ApiError.errors, renderWithProviders, Set-Formular-Matrix"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "frontend/src/components/ui/field.test.tsx, src/lib/api.test.ts, src/test/render.test.tsx, src/features/manage/SetsPage.test.tsx"
        status: pass
  - id: D6
    description: "Tab-Leiste bei 200 % Zoom, leere Zustaende, aktiver Tab ohne Farbwahrnehmung (backstop)"
    requirement: DESIGN-01
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md Manual-Only Verifications (end-of-phase)"
        status: unknown

duration: 29min
completed: 2026-10-16
---

# Phase 1 Plan 03: Elternbereich im Token-Design und Formular-Bausteine Summary

**Vokabeln, Set-Detail und Fortschritt laufen im Liquid-Glass-Token-Design mit Tab-Leiste und "+". Im gebauten Stack besteht jede Seite `checkPage` (axe 0 im Hauptlauf, je Backdrop-Farbe und im deckenden Fallback, 320-px-Reflow), auch in den CSV-Import-Zuständen geöffnet, Vorschau und Fehler. Dazu sind `Field`, `ApiError.errors` mit deutschen Netz- und Serverfehlern und `renderWithProviders` test-first entstanden.**

## Task Commits

1. **Task 1: Tracer Vokabeln-Seite mit Tab-Leiste und "+":** `4af1992` (feat)
2. **Task 2: Set-Detail, CSV-Import, Fortschritt:** `62a0d2f` (feat)
3. **Task 3 RED: rote Tests für Field, api, render, Set-Formular:** `dbfbe77` (test)
4. **Task 3 GREEN: Field, ApiError.errors, renderWithProviders, SetsPage über Field:** `4ca1530` (feat)

`commits: 7` ist von `plan_head_before` aus gemessen. Darin stecken drei fremde Commits, die der Orchestrator während des Laufs auf `v1-fertig` gesetzt hat (`e307ad1`, `c84a3ee`, `06fab4e`, Review-Nachbesserung 01-02). Von diesem Plan stammen 4 Commits plus der Doku-Commit.

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Schritt 0** (`manage.spec.ts` gegen den Stack vor dem Umbau): `4 failed`. `/verwalten: axe 0`, `Tab-Reihenfolge` und `Fokus nicht verdeckt` scheiterten an `getByRole('navigation', { name: 'Bereiche' })` → `element(s) not found`. `"+" öffnet das Set-Formular` lief in den Timeout beim Warten auf `getByRole('link', { name: 'Neues Set' })`.
- **Task 2, Schritt 1** (neue Tests gegen die alten Seiten): `3 failed | 5 passed`. Die vier Task-1-Tests blieben grün. `Eintrag-Formular` war ebenfalls schon grün, weil es Bestandsverhalten festhält (keine Anfrage bei unvollständigem Eintrag, Enter legt an). Rot waren `Set-Detail`, `CSV-Import` und `Fortschritt`, jeweils mit `nicht gemessener Kontrast auf backdrop-base`: 130 bzw. 134 Knoten `incomplete`, Grund `nonBmp`. Ursache waren die allein stehenden `→`-Spans in `text-ink-soft`.
- **Task 3, Schritt 1** (`npm run test`): `Test Files 4 failed | 1 passed (5)`, `Tests 4 failed | 6 passed (10)`. In `api.test.ts` scheiterten 4 von 5 Tests an Assertions: `expected undefined to be 'X'`; beim Netzfehler kam der rohe `TypeError: Failed to fetch` durch; beim 500er `expected 'An error occurred while processing your request.' to be 'Das hat nicht geklappt. …'`; beim unlesbaren Körper `'Fehler 400'`. `field.test.tsx`, `render.test.tsx` und `SetsPage.test.tsx` scheiterten beim Laden (`Failed to resolve import "@/components/ui/field"` bzw. `"@/test/render"`), weil die Module noch fehlten. So hatte es der Plan vorgesehen.
- **RED-Nachweis (Klassifikator):** `vitest run src/lib/api.test.ts --reporter=tap-flat`, Exit 1, Ziel `api() Fehlerform > Serverfehler 500 ergibt den allgemeinen Text` → `gsd-tools check tdd-red-evidence` meldet `RED_EVIDENCE_OK` (`target_test_failed`, 5 Tests, 4 fail). Inhaltliche Prüfung: Das Ziel lief und scheiterte an der geplanten Assertion (englischer Servertext statt des deutschen Allgemeintexts). Für die drei Dateien mit Ladefehler gibt es keinen gültigen RED im Sinn des Klassifikators, nur „Modul fehlt“.

## Verify-Ergebnisse (beobachtet)

- **Task 1** `<automated>` (design:classes → lint → typecheck → build → e2e:stack → e2e manage.spec): **Exit 0**, `keine alten Klassen`, `4 passed`. Alle Acceptance-Greps OK. Den Tracer-Gate habe ich danach nicht als eigenen Schritt erneut ausgeführt; der Interaktiv-Modus mit `end-of-phase` verlangt keinen Checkpoint, und der Verify war grün.
- **Task 2** `<automated>`: **Exit 0**, `keine alten Klassen`, `8 passed` (Set-Detail, Eintrag-Formular, CSV-Import, Fortschritt dazu). Greps auf `type-display`, `label=`, `Der Import ist fehlgeschlagen.` und `page.route` OK.
- **Task 3** `<automated>` (test → design:classes → lint → typecheck → build → e2e:stack → e2e manage + login): **Exit 0**, `Test Files 5 passed (5)`, `Tests 21 passed (21)`, `keine alten Klassen`, `10 passed` (2 login, 8 manage). Greps auf `path={path}`, den Netzfehlertext in `api.ts`, `-fehler` und `aria-invalid` in `field.tsx` OK.
- **Plan-Verification:** `npm ci && lint && typecheck && build && test` Exit 0 (21 passed). `design:check` Exit 0 (`errors: 0, warnings: 0`, Export-Diff leer). `design:classes -- src/components/ui src/features/manage src/features/auth/GuardianLoginPage.tsx` → `keine alten Klassen`.
- **Backend-Gate** (vom Plan nicht berührt, nach Hausregel trotzdem gemessen): im SDK-Container `dotnet build backend/WordQuest.slnx -c Release /warnaserror` → `0 Warning(s), 0 Error(s)`. `dotnet test` gegen einen eigenen PostgreSQL-Container `wq-0103-db` im Netz `wq-0103-tests` → Learning.Tests `Passed 104/104`, Api.Tests `Passed 18/18`. Container und Netz sind danach entfernt.
- Der Teststack ist danach mit `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v` entfernt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sticky Tab-Leiste verdeckt Ziele, axe target-size schlägt fehl**
- **Found during:** Task 2 (Set-Detail mit 32 Einträgen)
- **Issue:** Die über dem Inhalt schwebende Leiste deckte einen Löschen-Button bis auf 48 × 9 px ab. axe meldet dann `target-size`, `partiallyObscured`, Impact `serious`. Das passiert bei jeder Seite, die länger ist als der Bildschirm, und hängt von der Scrollposition ab. Mit dem Plan-Ansatz (sticky plus `scroll-padding`) lässt sich die Truth „target-size 0“ auf langen Seiten nicht halten.
- **Erster Versuch, verworfen:** Ein eigener Scrollbereich in `<main>` mit der Leiste darunter. Dann meldet axe für jede Zeile im Scrollbereich `incomplete elmPartiallyObscured`, also Kontrast nicht messbar, dazu `scrollable-region-focusable` auf der Fortschrittsseite.
- **Fix:** Die Leiste steht im Fluss unter `<main>`. `main flex-1` schiebt sie auf kurzen Seiten an den unteren Rand, mit `float-bottom` Abstand. Auf langen Seiten erreicht man sie erst am Seitenende. Die `scroll-padding`-Regel aus Task 1 ist wieder entfernt, weil die Leiste nichts mehr verdeckt. Der Test „Fokus nicht verdeckt“ bleibt als Wächter, falls jemand die Leiste wieder sticky macht.
- **Folge für die Gestaltung:** Auf langen Seiten (Set-Detail) „schwebt“ die Leiste nicht mehr sichtbar am unteren Rand. Das weicht von DESIGN.md/UI-SPEC ab („Tab-Leiste schwebt float-bottom über dem unteren Rand“) und gehört in die Abnahme am Ende der Phase.
- **Files modified:** ManageLayout.tsx, index.css
- **Commit:** 62a0d2f

**2. [Rule 3 - Blocking] Fallback-Messung las den ersten Frame eines CSS-Übergangs**
- **Found during:** Task 1
- **Issue:** `expectOpaqueFallback` las `backdrop-filter: blur(28px)` am runden Abmelden-Button. Der deckende Fallback griff zwar, aber `transition` am Button blendete Blur und Fläche noch über, und gemessen wurde sofort nach dem Umschalten.
- **Fix:** Vor der Messung `document.getAnimations().forEach(a => a.finish())`. Damit wird der Endzustand gemessen, den man sieht. Die Prüfung selbst ist nicht schwächer geworden.
- **Files modified:** frontend/e2e/axe.ts
- **Commit:** 4af1992

**3. [Rule 1 - Bug] Reflow bei 320 px mit offenem Set-Formular (321 px)**
- **Found during:** Task 1. Die Buttons „Anlegen“ und „Abbrechen“ passten nicht nebeneinander. **Fix:** `flex-wrap`, im Import-Bereich genauso. **Commit:** 4af1992

**4. [Rule 1 - Bug] axe misst den Kontrast allein stehender Pfeile nicht (`nonBmp`)**
- **Found during:** Task 2. **Fix:** `→` steht im selben Textknoten wie die Wörter (Einträge, Import-Vorschau, Wortschatz). **Commit:** 62a0d2f

### Sonstige Abweichungen

- **Anzeigename im Kopf in `text-ink` statt `text-ink-soft`:** Er steht direkt auf dem Backdrop, `ink-soft` auf `backdrop-blue` liegt unter 4,5:1. Gleiche Entscheidung wie beim Login-Link in 01-01.
- **Import-Vorschau und Wortschatz-Liste ohne `ListGroup`:** Sie liegen in einer Glas-Karte, und DESIGN.md verbietet Glas auf Glas. Statt dessen Trennlinien in `separator`. Die Vorschau ist als `role="region"`, `aria-label="Vorschau"`, `tabIndex={0}` erreichbar, weil sie ab `max-h-64` scrollt (axe `scrollable-region-focusable`).
- **Sichtbare Labels:** Das Eintrag-Formular hat sichtbare Labels „Deutsch“/„Englisch“ statt nur `aria-label` + Platzhalter (DESIGN.md Formulare). Das Import-Textfeld ist per `aria-labelledby` mit dem bestehenden Hinweistext verbunden. Für das Set-Formular ist das Label „Titel“ neu, weil `Field` ein Label braucht.
- **Fokus bei Serverfeldfehler:** `SetsPage` setzt den Fokus bei `errors.title` ins Titelfeld (UI-SPEC: „Fokus auf das erste fehlerhafte Feld“).
- **Kind-Auswahl auf der Fortschrittsseite:** `flex-wrap` statt `overflow-x-auto`, `aria-pressed` für die Auswahl, Avatar in `type-emoji` wie im Plan. Mit nur einem Kind (Demo) erscheint sie nicht, axe hat sie deshalb nicht geprüft.
- **Kennzahlen:** Unter `sm` stehen sie untereinander, weil drei Werte in `type-display` bei 320 px nicht nebeneinander passen.
- **Übergangsschuld 01-01 erledigt:** Der doppelte Innenabstand `Card p-6` plus `CardContent pt-5/py-*` ist auf allen drei Seiten entfernt (kein `CardContent` mehr in `src/features/manage`). `glass`, `glass-clear`, `glass-selected` und `glass-flat*` laufen auf diesen Seiten durch den deckenden Fallback in `checkPage`.
- **Ein Commit pro Task statt einem pro Plan (D-02):** Der Orchestrator verlangt atomare Task-Commits. Task 3 ist als TDD in RED und GREEN aufgeteilt.

## Issues Encountered

- Während des Laufs kamen drei Commits des Orchestrators auf `v1-fertig` (01-02-Nachbesserung). Sie stehen in der gemessenen Commit-Zahl, sind aber nicht Teil dieses Plans.

## Offene Punkte

- **Review durch Subagent (AGENTS.md „Review“, Plan-Verification) nicht von mir ausgeführt.** Diesem Executor steht kein Subagent-Werkzeug zur Verfügung. Laut Orchestrator läuft parallel ein Reviewer, er prüft gegen DESIGN-01/QUAL-02 und den Diff `5445645..4ca1530` (nur die 01-03-Commits).
- **Abnahme am Ende der Phase:** Tab-Leiste nicht sticky (siehe Abweichung 1). Dazu Tab-Leiste bei 200 % Zoom, leere Zustände und Glas-Wirkung auf dem Tablet.
- **01-04 ff.:** Kommen Kinder und Konto als Tabs dazu, bricht die Leiste bei 320 px um (`flex-wrap`). Weil sie im Fluss steht, verdeckt sie dabei nichts. Für das „+“ auf der Kinderliste reicht ein Eintrag in `createActions` in `ManageLayout.tsx`.
- **01-07 (Install-Smoke ohne Seed):** Die Tests „Tab-Reihenfolge“, „Fokus nicht verdeckt“, „Set-Detail“, „Eintrag-Formular“ und „CSV-Import“ setzen mindestens ein Set voraus. Ohne Demo-Seed muss der Smoke vorher ein Set anlegen oder nur die übrigen Tests ausführen.
- `refreshAccessToken` wirft bei Netzfehler weiter einen rohen `TypeError` (nur auf dem 401-Pfad). Das ist bewusst nicht geändert, der Plan verlangt „401-Refresh unverändert“.
- DESIGN-01 und QUAL-02 sind erst zum Teil erfüllt, Kinder- und Kontoseiten fehlen noch (01-04, 01-06 bis 01-08). Deshalb steht in `requirements-completed` nichts.

## Next Phase Readiness

- `Field`, `ApiError.errors`, `renderWithProviders` und `guardianStorageState` sind für 01-06 bis 01-08 bereit.
- Der Teststack `wordquest-e2e` ist frei für 01-04.

## Self-Check: PASSED

- FOUND: frontend/src/components/ui/list.tsx, frontend/src/components/ui/field.tsx, frontend/src/components/ui/field.test.tsx, frontend/src/lib/api.test.ts, frontend/src/test/render.tsx, frontend/src/test/render.test.tsx, frontend/src/features/manage/SetsPage.test.tsx, frontend/e2e/global-setup.ts, frontend/e2e/manage.spec.ts
- FOUND: 4af1992, 62a0d2f, dbfbe77, 4ca1530 (Vorfahren von HEAD)
