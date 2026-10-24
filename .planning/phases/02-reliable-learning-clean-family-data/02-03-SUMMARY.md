---
phase: 02-reliable-learning-clean-family-data
plan: 03
subsystem: manage-ui
tags: [react, radix-dialog, a11y, design-tokens, delete, playwright, axe]
status: complete

requires:
  - phase: 02-02
    provides: "DELETE /api/v1/learners/{id} mit 404 „Dieses Kind gibt es nicht (mehr).“, Übersicht 404 „Dieses Profil gibt es nicht mehr. Bitte melde dich ab.“"
provides:
  - "DESIGN.md: colors.scrim rgba(20, 28, 50, 0.4) und components.sheet-scrim, exportiert als --color-scrim"
  - "components/ui/dialog.tsx: Dialog und ConfirmDialog auf @radix-ui/react-dialog, Pflicht-Prop returnFocusRef, aria-modal, Startfokus „Abbrechen“"
  - "„Kind löschen“ auf der Bearbeiten-Seite mit Bestätigung und Erfolgsmeldung „{Name} ist gelöscht.“ in der Kinderliste"
  - "PATCH /api/v1/learners/{id}/settings eines gelöschten Kindes: 404 mit „Dieses Kind gibt es nicht (mehr).“"
  - "SuccessNote bricht lange Wörter um (break-words)"
affects: [02-04, 02-05]

actuals:
  tokens: 11239
  tasks: 3
  commits: 5
plan_head_before: 41c978da0469b25155f242e65370e41d651d2a05
plan_head_after: 2bb9f43dca1462604d6706bdbb389b4545471f42

tech-stack:
  added: []
  patterns:
    - "Dialog ohne Dialog.Trigger: der Aufrufer übergibt returnFocusRef, onCloseAutoFocus mit preventDefault fokussiert es"
    - "Nach 404 im Dialog erst beim Schließen neu laden, Fokus-Ersatzziel für den verschwundenen Auslöser"
    - "Kontrast eines Sheets in e2e: Seiteninhalt unsichtbar, Dialog allein über jeder Backdrop-Farbe und über primary-deep messen"

key-files:
  created:
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/dialog.test.tsx
  modified:
    - DESIGN.md
    - frontend/src/design-tokens.css
    - frontend/src/features/manage/ChildFormPage.tsx
    - frontend/src/features/manage/ChildFormPage.test.tsx
    - frontend/src/features/manage/ChildrenPage.test.tsx
    - frontend/src/features/learn/LearnHomePage.test.tsx
    - frontend/src/components/ui/misc.tsx
    - frontend/e2e/children.spec.ts
    - frontend/e2e/keyboard-zoom.spec.ts
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - backend/tests/WordQuest.Api.Tests/LearnerDeleteTests.cs
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Button-Zeile im ConfirmDialog mit flex-auto statt flex-1: mit Basis 0 brach die Zeile nie um, der Text brach im 60-px-Button"
  - "Dialog-Kontrast in e2e ohne Seiteninhalt gemessen (über Backdrop-Farben und primary-deep), weil axe bei Glas über wechselndem Inhalt nur „elmPartiallyObscuring“ meldet"
  - "Carry-over aus 02-02 hier erledigt: PATCH …/settings liefert für ein gelöschtes Kind 404 mit deutschem Text"

requirements-completed: [PAR-03]
requirements-partial: [FIX-04]

duration: 23min
completed: 2026-10-17
---

# Phase 2 Plan 03: Kind löschen in der Oberfläche – Zusammenfassung

**„Kind löschen“ auf der Bearbeiten-Seite mit einem Bestätigungsdialog auf `@radix-ui/react-dialog` (Startfokus „Abbrechen“, Fokusrückgabe über `returnFocusRef`, 404 bleibt bis zum Schließen sichtbar), neues Token `colors.scrim`, axe 0 Verstöße mit offenem Dialog und bei 200 % Zoom.**

## Leistung

- **Dauer:** ca. 23 min (2026-10-17T18:41Z bis 19:04Z)
- **Tasks:** 3 von 3, dazu ein Backend-Fix (Carry-over) und ein Commit mit Review-Befunden
- **Dateien:** 14 (2 neu)

## Ergebnis

- `DESIGN.md`: `colors.scrim: "rgba(20, 28, 50, 0.4)"`, `components.sheet-scrim` und ein Satz unter „Ebenen“. Export ergibt `--color-scrim: #141c3266;`.
- `components/ui/dialog.tsx`: `Dialog` (Overlay `bg-scrim`, Sheet `glass-sheet rounded-sheet p-6`, unten mit `sheet-inset` verankert, `max-w-md`, Höchsthöhe `calc(100dvh - 2 * var(--spacing-sheet-inset))`, `overflow-y-auto`; Titel `h2` mit `break-words`) und `ConfirmDialog` (`alertdialog`, Startfokus „Abbrechen“, `ErrorNote` über den Buttons, während `busy` gesperrt und nicht schließbar). Klick auf die Abdunklung schließt nicht.
- `ChildFormPage`: eigener Block `DeleteChild` unter der Formular-Card, außerhalb des `<form>`, nur bei gefundenem Kind. Bestätigen: Ref-Riegel, `DELETE /learners/{id}`, `['learners']`, `['profiles']`, `['overview']`, `['traffic-light']` neu laden, Navigation mit „{Name} ist gelöscht.“. Bei 404 wechselt das Fokusziel auf „Alle Kinder“; neu geladen wird erst beim Schließen.
- `LearnHomePage` blieb unverändert: Der Servertext „Dieses Profil gibt es nicht mehr. Bitte melde dich ab.“ erscheint schon über die bestehende `ErrorNote` (Test belegt).
- Konzept, Abschnitt „Löschung“: Oberfläche ergänzt.

## Task-Commits

1. **Task 1: Tracer Kind löschen Ende-zu-Ende** – `07cd0d6` (feat)
2. **Task 2: Dialog-Matrix und Kind-löschen-Fälle (vitest)** – `4068856` (test)
3. **Carry-over 02-02: PATCH …/settings 404 mit Text** – `7b7dd1c` (fix)
4. **Task 3: axe, Tastatur, 200 % Zoom, Konzept** – `d5ad81f` (test, mit den zwei Lücken-Fixes)
5. **Review-Befunde** – `2bb9f43` (fix)

## TDD-Belege

**Task 1, Schritt 1 (e2e „Kind löschen“ vor dem Code):** rot, `1 failed`: `locator.click: Test timeout of 30000ms exceeded … waiting for getByRole('button', { name: 'Kind löschen' })`. Nach Schritt 2 bis 4: `children.spec.ts` 6 passed. Tracer-Gate: Verify erneut grün, danach erweitert.

**Task 2, Schritt 1:** Alle Fälle waren beim ersten Lauf grün (`4 passed`, `87 passed`), weil Task 1 das Verhalten schon vollständig lieferte. Damit die Tests nicht nur zufällig grün sind, wurden vier Mutationen gemessen (danach zurückgesetzt):

| Mutation | rote Fälle |
|---|---|
| ohne `onCloseAutoFocus` | 6 (Enter, Esc, Ersatzziel, Abbrechen, 404, 500 – jeweils Fokus) |
| ohne `onPointerDownOutside`/`onInteractOutside` | 1 (Abdunklung) |
| Neuladen sofort nach 404 | 1 (404 bleibt bis zum Schließen) |
| `busy` schließt trotzdem | 1 (busy/Esc) |

**Carry-over (Backend):** `LearnerDeleteTests.Einstellungen_eines_geloeschten_Kindes_ergeben_404_mit_Text` rot: `Expected: "Dieses Kind gibt es nicht (mehr)." Actual: null`. Danach `LearnerDeleteTests|LearnerEndpointTests` 53 passed.

**Task 3, Schritt 1:** „Dialog Kind löschen bei 200 %“ war sofort grün (erwarteter Beleg). „Kind löschen barrierefrei“ war zweimal rot:
1. `nicht gemessener Kontrast auf backdrop-base`: axe meldete Titel, Beschreibung und „Endgültig löschen“ als `elmPartiallyObscuring` (je Textzeile anderer Seiteninhalt hinter dem Glas). Folge: Messweise angepasst (siehe Abweichung 3).
2. `.rounded-sm` `elmPartiallyObscured` auf der Kinderliste: die `SuccessNote` mit 100-Zeichen-Namen lief über ihren Rand (kein `break-words`). Folge: Fix in `misc.tsx` (Abweichung 2).
Danach `children.spec.ts` + `keyboard-zoom.spec.ts` 15 passed.

## design.md-diff (UI-SPEC E9)

`npx -y @google/design.md@0.4.0 diff <HEAD:DESIGN.md> DESIGN.md`: `colors.added: ["scrim"]`, `components.added: ["sheet-scrim"]`, sonst nichts geändert oder entfernt; Findings vorher und nachher `errors 0, warnings 0, infos 1`, `"regression": false`. `design:check` danach: `errors: 0, warnings: 0`, kein Diff zu `design-tokens.css`.

## Gate-Ergebnisse (Stand `2bb9f43`)

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` | Build ohne Warnung (`/warnaserror`); Learning.Tests 104 passed, Api.Tests 170 passed, 0 failed |
| Frontend | `npm ci`, `lint`, `typecheck`, `build`, `test`, `design:check`, `design:classes` | alle Exit 0; Vitest 14 Dateien, 134 Tests passed; DESIGN.md errors 0, warnings 0; „keine alten Klassen“ |
| Keine neue Dependency | `git diff --quiet HEAD -- frontend/package.json frontend/package-lock.json` | Exit 0 |
| e2e | `npm run e2e:stack && npx playwright test` (frischer Stack) | 34 passed, 1 skipped (`first-run.spec.ts`, absichtlich nur im Install-Smoke) |

Container danach entfernt: `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v`, `backend-test.sh down` („wq-p2 entfernt.“), `docker ps` ohne Testcontainer.

## Barrierefreiheit (Beleg)

- **Tool:** `@axe-core/playwright` 4.13.0, Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Seiten:** `/verwalten/kinder/{id}` mit offenem Dialog „Kind löschen“ (100-Zeichen-Name): **0 Verstöße**; Kontrast des Dialogs über allen fünf Backdrop-Farben und über `primary-deep`: 0 Verstöße, 0 nicht gemessen. `/verwalten/kinder` mit Erfolgsmeldung: `checkPage` (axe, Glas-Kontrast, deckender Fallback, Reflow): **0 Verstöße**. `/verwalten/kinder/{id}` geschlossen weiter über „Kind bearbeiten barrierefrei“: 0 Verstöße.
- **320 px:** kein waagerechtes Scrollen; Dialogtitel und Erfolgsmeldung brechen um, Text vollständig.
- **200 % (640 × 400):** Öffnen per Enter, Startfokus „Abbrechen“, Tab Abbrechen → Endgültig löschen → Abbrechen, sichtbarer Fokus (Outline), beide Buttons ganz im Bild, Sheet ≤ 384 px; mit Fehlertext ebenso; Esc gibt den Fokus an „Kind löschen“; Enter auf „Abbrechen“ löscht nicht (Kind danach noch in der Liste).
- Sichtkontrolle per Screenshot: bei 640 px eine Button-Zeile, bei 320 px zwei volle Zeilen.
- **Offen (human-check, end-of-phase):** Bedienung auf dem Tablet und mit echtem Browser-Zoom 200 % nur per Tastatur. Nicht durchgeführt; UNBEKANNT: Ergebnis am Gerät.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Regel 1 – Bug] Button-Zeile brach nie um**
- **Gefunden bei:** Task 3 (Screenshot des Dialogs)
- **Problem:** Plan und UI-SPEC nennen `flex-1` und zugleich „bei 320 px zwei volle Zeilen“. Mit `flex-1` (Basis 0) passen beide Buttons immer in eine Zeile; „Endgültig löschen“ brach im 60-px-Button zweizeilig um.
- **Fix:** `flex-auto` (Basis = Inhalt): bei 640 px eine Zeile, bei 320 px zwei volle Zeilen.
- **Datei:** `frontend/src/components/ui/dialog.tsx` · **Commit:** `d5ad81f`

**2. [Regel 1 – Bug] Erfolgsmeldung mit langem Namen lief über den Rand**
- **Gefunden bei:** Task 3 (axe `elmPartiallyObscured` auf `.rounded-sm`)
- **Problem:** `SuccessNote` hatte kein `break-words`; „{Name} ist gelöscht.“ mit 100 Zeichen ohne Trennstelle ragte über die Fläche.
- **Fix:** `break-words` an `SuccessNote` (gemeinsamer Baustein, wirkt für alle Aufrufer). Datei nicht im Plan.
- **Datei:** `frontend/src/components/ui/misc.tsx` · **Commit:** `d5ad81f`

**3. Glas-Kontrast des Dialogs anders gemessen als geplant**
- Der Plan nennt `expectGlassContrast(page)` bei offenem Dialog. axe kann den Text auf dem Glas-Sheet dort nicht bewerten (`elmPartiallyObscuring`, weil hinter jeder Textzeile anderer Seiteninhalt liegt). `children.spec.ts` blendet deshalb `#root` aus und misst den Dialog allein über jeder Backdrop-Farbe (`expectGlassContrast`) und zusätzlich über `primary-deep`, der dunkelsten Fläche der Seite, die darunter liegen kann (eigene Hilfe `expectDialogContrast`, verlangt 0 Verstöße und 0 nicht gemessene Knoten). `axe.ts` blieb unverändert.

**4. Backend geändert, obwohl der Plan „kein Backend“ sagt**
- Auftrag des Koordinators (Carry-over aus dem 02-02-Review): `PATCH /learners/{id}/settings` eines gelöschten Kindes gab 404 ohne Text, die Bearbeiten-Seite zeigte dann „Das hat nicht geklappt.“. Jetzt `Results.Problem` mit „Dieses Kind gibt es nicht (mehr).“ wie beim Löschen; Integrationstest zuerst rot. Commit `7b7dd1c`.

**5. `DeleteChild` als eigener Baustein**
- Der Plan reicht den Ref über `EditChild` an `ChildForm` weiter. Umgesetzt als eigener Block `DeleteChild` neben `ChildForm` (in `EditChild` gerendert, Ref von `ChildFormPage` über `EditChild`): `ChildForm` bleibt das reine Formular für Anlegen und Bearbeiten. Verhalten wie geplant.

## Review (AGENTS.md „Review“, D-02)

Unabhängige zweite Instanz (`claude -p`, nur Lesen: Read/Grep/Glob, `git diff/show/log`) gegen Plan, UI-SPEC, 02-CONTEXT, AGENTS.md, DESIGN.md und Diff `41c978d..d5ad81f`: kein BLOCKER, kein HOCH, kein MITTEL. Gesamturteil „freigabefähig“. Der Reviewer hat selbst keine Tests ausgeführt.

| Befund | Schwere | Umgang |
|---|---|---|
| Backend-Änderung, `misc.tsx` und `flex-auto` weichen vom Plan ab | NIEDRIG | angenommen: als Abweichungen 1, 2 und 4 dokumentiert |
| UI-SPEC sagt, Radix setze `aria-modal`; tut es nicht (`index.mjs:230` setzt nur `role`) | NIEDRIG | behoben (`2bb9f43`): `aria-modal="true"` am Content, vitest prüft es |
| 200-%-Test ohne Fehlertext im Dialog (UI-SPEC overflow) | NIEDRIG | behoben (`2bb9f43`): DELETE per `page.route` auf 500, `ErrorNote` sichtbar, Sheet ≤ 384 px, beide Buttons per Tab ganz im Bild |

## Bekannte Folgen

- Die UI-SPEC (Zeile 281) behauptet weiter, Radix liefere `aria-modal`; der Baustein setzt es jetzt selbst. Die UI-SPEC ist ein Planungsdokument und blieb unverändert.
- UNBEKANNT: wo der Fokus nach einem Fehler im Dialog steht. „Endgültig löschen“ ist während der Anfrage gesperrt und kann den Fokus dabei verlieren; nicht gemessen. Die `ErrorNote` (`role="alert"`) sagt den Fehler an. Klären mit den Formular-Dialogen in 02-04/02-05.

## Anforderungen

- **PAR-03** ist mit der Oberfläche vollständig (war seit 02-02 abgehakt).
- **FIX-04** bleibt offen: die 404-Texte für Set und Vokabel (`DELETE`/`PATCH /sets/{id}`, `…/entries/{entryId}`) folgen in 02-04/02-05 (Hinweis aus 02-01-SUMMARY). Deshalb nicht als erledigt markiert, obwohl der Plan FIX-04 nennt.

## Nächste Schritte

02-04 und 02-05 nutzen `Dialog` und `ConfirmDialog` für Set umbenennen, Vokabel bearbeiten und die beiden übrigen Löschungen.

## Self-Check: PASSED

`frontend/src/components/ui/dialog.tsx` und `dialog.test.tsx` vorhanden; Commits 07cd0d6, 4068856, 7b7dd1c, d5ad81f, 2bb9f43 sind Vorfahren von HEAD.
