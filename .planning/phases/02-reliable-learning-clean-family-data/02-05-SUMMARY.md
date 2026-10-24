---
phase: 02-reliable-learning-clean-family-data
plan: 05
subsystem: manage-ui
tags: [react, radix-dialog, a11y, ef-core, validation, playwright, axe]
status: complete

requires:
  - phase: 02-04
    provides: "ContentRules.CheckText, Set-Kopf mit h2 (tabIndex -1), useSetGone, expectDialogContrast"
  - phase: 02-03
    provides: "Dialog und ConfirmDialog mit Pflicht-Prop returnFocusRef"
  - phase: 02-02
    provides: "Fremdschlüssel: Vokabel löschen entfernt Karten und Lernstand"
provides:
  - "PUT /api/v1/sets/{setId}/entries/{entryId}: Deutsch und Englisch an Ort und Stelle, IDs und Lernstand bleiben; 400/404/403"
  - "POST /api/v1/sets/{id}/entries: über 200 Zeichen 400 statt 500, unbekanntes Set 404 mit Text"
  - "DELETE /api/v1/sets/{id}/entries/{entryId}: 404 mit „Diese Vokabel gibt es nicht (mehr).“"
  - "Vokabelzeile mit Stift und Papierkorb, Dialog „Vokabel bearbeiten“, Bestätigung „„{Deutsch}“ löschen?“"
  - "Schnellerfassung mit Feldfehlern bei leeren Feldern und ErrorNote für Server- und Netzfehler"
affects: [02-06, 02-07]

actuals:
  tokens: 14800
  tasks: 3
  commits: 5
plan_head_before: c87830c60c27f1cccd701f8719f2fd09ed9fa33d
plan_head_after: e4809901497b8f66bd6184df50add7f3fcee6fc5

tech-stack:
  added: []
  patterns:
    - "Dialog je Zeile über Seitenzustand (editing/deleting) und einen Ref für das Fokusziel: angeklickter Button, nach Löschen oder 404 die Set-Überschrift"
    - "useGone(queryKey): 404 im Dialog, Neuladen erst beim Schließen (verallgemeinert aus useSetGone)"
    - "WordProblems: alle Feldfehler gemeinsam, Grenze aus ContentRules, Texte beim Aufrufer"

key-files:
  created: []
  modified:
    - backend/src/WordQuest.Api/Contracts/Contracts.cs
    - backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs
    - backend/tests/WordQuest.Api.Tests/SetEditTests.cs
    - backend/tests/WordQuest.Api.Tests/SetDeleteTests.cs
    - frontend/src/features/manage/SetDetailPage.tsx
    - frontend/src/features/manage/SetDetailPage.test.tsx
    - frontend/src/features/manage/ChildrenPage.tsx
    - frontend/e2e/manage.spec.ts
    - frontend/e2e/keyboard-zoom.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Fokusziel der Vokabel-Dialoge ist ein einziger Ref (rowFocusRef): beim Öffnen der angeklickte Stift bzw. Papierkorb, nach Löschen oder 404 die Set-Überschrift. Ein Zustand hätte beim Löschen nicht mehr gerendert, bevor der Dialog schließt."
  - "useSetGone zu useGone(queryKey) verallgemeinert; Set-Dialoge nutzen ['sets'], Vokabel-Dialoge ['entries', setId]"
  - "Fehlertexte als Konstanten (SOURCE_MISSING, TARGET_MISSING, WORD_TOO_LONG) für Dialog und Erfassung"
  - "Erfassung oben ausgerichtet, Button-Abstand über --leading-label-section, damit ein Feldfehler das Nachbarfeld nicht verschiebt"

requirements-completed: [PAR-04]
requirements-partial: [QUAL-01]

duration: 28min
completed: 2026-10-17
---

# Phase 2 Plan 05: Vokabeln korrigieren und löschen – Zusammenfassung

**Vokabel korrigieren an Ort und Stelle (`PUT /sets/{setId}/entries/{entryId}`, gleiche Entry- und Card-IDs, Lernstand bleibt) über einen Stift je Zeile; Vokabel löschen nur nach Bestätigung, danach Fokus auf der Set-Überschrift; zu lange Wörter beim Hinzufügen ergeben 400 statt 500; axe 0 Verstöße mit beiden Dialogen offen.**

## Leistung

- **Dauer:** ca. 28 min (2026-10-17T19:34Z bis 20:02Z)
- **Tasks:** 3 von 3, dazu je ein Commit für den Kommentar-Übertrag und die Review-Befunde
- **Dateien:** 10 geändert, keine neu

## Ergebnis

- **Backend:**
  - `UpdateEntryAsync` prüft beide Wörter über `WordProblems` (→ `ContentRules.CheckText`) und gibt alle Feldfehler gemeinsam zurück (`sourceText`/`targetText`).
  - Danach lädt es die Vokabel mit `Id == entryId && SetId == setId` unter dem Mandantenfilter. Fremd, unbekannt oder aus einem anderen Set → 404 „Diese Vokabel gibt es nicht (mehr).“.
  - Es setzt nur `SourceText` und `TargetText`; Karten, Lernstand, Emoji, Alternativen und Beispiele bleiben.
  - `AddEntryAsync`: unbekanntes Set → 404 mit Text, nach der Bestands-Leerprüfung die Längenprüfung. `DeleteEntryAsync`: 404 mit Text. `Results.NotFound()` steht nur noch in `ConfirmImportAsync`.
- **Vokabelzeile:** Emoji, Text, Stift „{Deutsch} bearbeiten“, Papierkorb „{Deutsch} löschen“; beide `ghost`, `icon`, 48 × 48.
- **Vokabel bearbeiten:** `Dialog` mit `vokabel-deutsch`/`vokabel-englisch`, vorbefüllt, `autoComplete="off"`. Clientprüfung nach dem Trimmen mit den Servertexten, Fokus auf das erste fehlerhafte Feld. Feldfehler des Servers stehen am Feld, sonst `ErrorNote`. Ref-Riegel plus `busy`; während der Anfrage schließen weder Esc noch „Abbrechen“. Nach Erfolg: „Die Vokabel ist gespeichert.“, Fokus auf den Stift (gleiche ID, `key={entry.id}`).
- **Vokabel löschen:** `ConfirmDialog` „„{Deutsch}“ löschen?“. Danach werden `['entries', setId]`, `['sets']`, `['traffic-light']` und `['overview']` neu geladen, über der Liste steht „„{Deutsch}“ ist gelöscht.“, der Fokus liegt auf der Set-Überschrift.
- **404 in beiden Dialogen:** Der Fehler bleibt stehen, bis der Dialog geschlossen wird; erst dann wird die Vokabelliste neu geladen. Das Fokusziel wechselt auf die Überschrift.
- **Erfassung:** `<form noValidate>`. Leere Felder ergeben Feldfehler (`eintrag-*-fehler`, `aria-invalid`), Fokus auf das erste fehlerhafte Feld, kein POST. Server- und Netzfehler erscheinen als `ErrorNote` unter dem Formular. Jeder neue Versuch nimmt eine alte Erfolgsmeldung weg.
- **Konzept:** API-Zeilen `POST`, `PUT` und `DELETE /sets/{id}/entries…` mit Regeln und Folgen. Im Abschnitt „Löschung“ sind jetzt die Vokabel-Dialoge beschrieben statt „vorgesehen“.

## Task-Commits

1. **Task 1: Tracer Vokabel korrigieren Ende-zu-Ende** – `de775d7` (feat)
2. **Task 2: Vokabel löschen mit Bestätigung, Erfassung ohne 500** – `04d1587` (feat)
3. **Task 3: Matrizen, axe, Tastatur, 200 % Zoom, Konzept** – `a88ad36` (test)
4. **Übertrag aus 02-04: Kommentar `ChildrenPage.tsx:12`** – `74a962e` (docs)
5. **Review-Befunde** – `e480990` (fix)

## TDD-Belege

**Task 1, Schritt 1 (rot vor dem Code):**
- Backend (`SetEditTests`): 10 von 17 Fällen rot, alle mit `Expected: … Actual: MethodNotAllowed` (PUT fehlte). Die 7 Bestandsfälle waren grün.
- e2e „Vokabel bearbeiten“: `1 failed`, Abbruch beim Warten auf `getByRole('button', { name: 'Hnud bearbeiten' })`.
- Danach grün: `SetEditTests` 17 passed (`Failed: 0`); `manage.spec.ts` 14 passed.
- Tracer-Gate: Verify erneut gelaufen und grün, erst danach erweitert.

**Task 2, Schritt 1:**
- Backend: `Failed: 4, Passed: 26`.
  - `Vokabel_einer_anderen_Familie_oder_unbekannt_ergibt_404_mit_Text`: `Actual: null` (kein `detail`).
  - `Hinzufuegen_mit_201_Zeichen_ergibt_400_statt_500` (beide Felder): `Actual: InternalServerError`.
  - `Hinzufuegen_zu_unbekanntem_oder_fremdem_Set_ergibt_404_mit_Text`: `Actual: null`.
- e2e „Vokabel löschen“: `1 failed`, Abbruch beim Warten auf `getByRole('alertdialog', { name: '„Katze“ löschen?' })`; der Papierkorb löschte noch sofort.
- Danach grün: 30 passed; `manage.spec.ts` 15 passed.

**Task 3, Schritt 1 (vitest):**
- Erster Lauf: `22 failed`, Ursache im Test. `getByLabelText('Deutsch')` fand Erfassung und Dialog zugleich; die Abfrage wurde auf den Dialog eingeschränkt.
- Danach `7 failed | 56 passed`. Rot waren genau die Erfassungsfälle 1–5, „Fehlertext unter eintrag-deutsch-fehler“ und der Happy Path mit vorherigem Fehlversuch, weil die Clientprüfung fehlte.
- Die Fälle für „Vokabel bearbeiten“ und „Vokabel löschen“ waren grün, denn Task 1 und 2 lieferten das Verhalten schon.
- Nach Schritt 3: 63 passed.

**Task 3, Schritt 2 (e2e):** „Vokabel-Dialoge barrierefrei“, „Lange Vokabel bei 320 px“ und „Dialoge der Vokabelzeile bei 200 %“ waren beim ersten Lauf grün (3 passed). Das Verhalten kam aus Task 1 und 2. Die Tests sind der Beleg für axe, Umbruch und Tastatur, keine Treiber neuer Logik.

**Review-Fixes (per Mutation rot belegt, danach zurückgesetzt):**

| Mutation | rote Fälle |
|---|---|
| ohne Ref-Riegel in `EditEntry.submit` | 1 („Zweimal Absenden im selben Takt: genau ein PUT“) |
| ohne `setSaved(null)` in der Erfassung | 1 („Hinzufügen nimmt eine alte Erfolgsmeldung weg“) |

## Gate-Ergebnisse (Stand `e480990`)

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` (voller Lauf) | Build ohne Warnung (`/warnaserror`); Learning.Tests 110 passed, Api.Tests 195 passed, 0 failed |
| Frontend | `npm ci`, `lint`, `typecheck`, `build`, `test`, `design:check`, `design:classes` | alle Exit 0; Vitest 14 Dateien, 199 Tests passed; DESIGN.md `errors: 0, warnings: 0`; „keine alten Klassen“ |
| Keine neue Dependency | `git diff --quiet HEAD -- frontend/package.json frontend/package-lock.json` | Exit 0 |
| `dialog.tsx` unverändert | `git diff --quiet c87830c -- frontend/src/components/ui/dialog.tsx` | Exit 0 |
| e2e | `npm run e2e:stack && npx playwright test` (frischer Stack auf `e480990`) | 44 passed, 1 skipped (`first-run.spec.ts`, absichtlich nur im Install-Smoke) |

Akzeptanz-Greps: `MapPut("/{setId:guid}/entries/{entryId:guid}"`, „Diese Vokabel gibt es nicht (mehr).“, „Bitte gib das englische Wort ein.“, `record UpdateEntryRequest`, „Vokabel bearbeiten“, `vokabel-englisch`, „Der Lernstand aller Kinder zu dieser Vokabel wird mit gelöscht.“, `addEntry.isError` und die drei `describe`- bzw. e2e-Namen sind vorhanden. Weitere Zählungen:
- `grep -c 'Results.NotFound()'` = 1
- `grep -c returnFocusRef` in `SetDetailPage.tsx` = 10
- `onClick={() => removeEntry.mutate` fehlt (Exit 1)

Einzige Abweichung: `grep -c 'Bitte gib das deutsche Wort ein.'` = 1 statt mindestens 2, siehe Abweichung 1.

Container danach entfernt: `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v`, `backend-test.sh down` („wq-p2 entfernt.“), `docker ps` ohne Testcontainer.

## Barrierefreiheit (Beleg)

- **Tool:** `@axe-core/playwright` 4.13.0, Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Seiten:**
  - `/verwalten/sets/{id}` geschlossen: `checkPage` (axe, Glas-Kontrast, deckender Fallback, Reflow), **0 Verstöße**.
  - Mit offenem Dialog „Vokabel bearbeiten“ und beiden Fehlertexten: `expectNoAxeViolations` **0 Verstöße**, dazu `expectDialogContrast` **0**.
  - Mit offenem Dialog „„Hund“ löschen?“: **0 Verstöße**, dazu `expectDialogContrast` **0**.
  - Nach dem Löschen der letzten Vokabel, Erfolgsmeldung über „Noch keine Vokabeln in diesem Set“: `checkPage`, **0 Verstöße**.
- **Zeilengröße:** Stift und Papierkorb je 48 × 48 (`boundingBox`), der Stift steht vor dem Papierkorb.
- **320 px:** Eine Vokabel aus 200 Zeichen ohne Leerzeichen bricht in der Zeile, im Dialogtitel und in der Erfolgsmeldung um. `scrollWidth <= clientWidth`, Seite `scrollWidth <= 320`, der Text bleibt vollständig.
- **200 % (640 × 400):**
  - „Vokabel bearbeiten“: per Enter geöffnet, Fokus auf „Deutsch“. Beide Felder leer abgesendet ergibt zwei Fehlertexte, der Fokus geht auf „Deutsch“. Das Sheet ist höchstens 384 px hoch. Tab läuft Deutsch → Englisch → Abbrechen → Speichern → Deutsch, jedes Ziel ganz im Bild und mit sichtbarem Fokus. Esc gibt den Fokus an „Hund bearbeiten“ zurück.
  - „Vokabel löschen“: Startfokus „Abbrechen“, Tab läuft Abbrechen → Endgültig löschen → Abbrechen. Enter auf „Abbrechen“ löscht nicht, der Fokus geht an „Hund löschen“. Zum Schluss wird das Testset per Tastatur gelöscht.
- **Sichtcheck Erfassung (1024 px):** Mit und ohne Feldfehler schließen beide Felder und „Hinzufügen“ unten bündig ab (Unterkante je 393 px).
- **Offen (human-check, end-of-phase):** Bedienung auf dem Tablet und mit echtem Browser-Zoom 200 % nur per Tastatur. Nicht durchgeführt; UNBEKANNT: Ergebnis am Gerät.

## Abweichungen vom Plan

### Automatisch behoben

**1. Fehlertexte als Konstanten statt doppelt im Quelltext**
- Das Akzeptanzkriterium verlangt `grep -c 'Bitte gib das deutsche Wort ein.'` ≥ 2 in `SetDetailPage.tsx` (Dialog und Erfassung). Beide nutzen dieselbe Konstante `SOURCE_MISSING`, die Zählung ergibt 1.
- Das Verhalten belegen die vitest-Fälle beider Matrizen. Den Text zu verdoppeln, nur damit die Zählung stimmt, widerspräche der Regel „gleiche Bausteine für gleiche Zwecke“. Das Review hat das als MITTEL gemeldet und denselben Umgang vorgeschlagen.

**2. [Regel 1 – Bug] Erfassung oben ausgerichtet**
- **Gefunden bei:** Task 3, Sichtcheck. Mit `sm:items-end` schob ein Fehlertext unter „Deutsch“ das Feld „Englisch“ nach unten.
- **Fix:** Die Zeile ist jetzt `sm:items-start`. „Hinzufügen“ bekommt `sm:mt-[var(--leading-label-section)]`: Label 18 + Abstand 8 + Feld 52 = 18 + Button 60, also unten bündig wie vorher. Es gibt keinen neuen Token und keinen Einzelfall-px. Gemessen: Unterkante 393 px in beiden Zuständen.
- **Datei:** `frontend/src/features/manage/SetDetailPage.tsx` · **Commit:** `a88ad36`

**3. Fokusziel als Ref statt als Zustand**
- Der Plan nennt für 404 „`returnFocusRef` wechselt auf die Set-Überschrift“. Beim erfolgreichen Löschen schließt der Dialog im selben Handler. Ein Zustand würde dann nicht mehr gerendert, und der Fokus fiele auf den verschwindenden Papierkorb.
- Deshalb gibt es einen Ref `rowFocusRef`: beim Öffnen der angeklickte Button, `onRowGone` setzt ihn auf die Überschrift. `returnFocusRef` aller Dialoge ist dieser Ref.

**4. `useSetGone` → `useGone(queryKey)`**
- Der Plan verlangt eine gemeinsame kleine Hilfe für den 404-Fall. Die Hilfe aus 02-04 bekam deshalb den Schlüssel als Parameter, statt eine zweite Variante danebenzustellen. Die Set-Dialoge verhalten sich unverändert; ihre vitest-Fälle sind grün.

**5. Dialog-Kontrast mit `expectDialogContrast`**
- Der Plan nennt in Task 3 `expectGlassContrast(page)` bei offenem Dialog. Wie in 02-04 (Abweichung 2) wird dort `expectDialogContrast` genutzt, weil axe Text auf dem Glas-Sheet sonst nicht bewertet.

**6. Kommentar `ChildrenPage.tsx:12` (Übertrag, außerhalb der Plan-Dateien)**
- Der Kommentar behauptete, die Erfolgsmeldung überlebe kein Neuladen. Der Router-State liegt aber in `history.state` und übersteht F5. Das war im Review von 02-04 gemeldet, der Auftrag dieses Laufs nennt die Korrektur ausdrücklich. Eine Zeile. **Commit:** `74a962e`

**7. Fünf Commits statt „ein atomarer Commit“ (PLAN Ziel, D-01)**
- Der Ausführungsauftrag verlangt einen Commit je Task. Hinzu kommen der Übertrag aus 02-04 und die Review-Befunde, je als eigenes Anliegen. Kein Push.

## Review (AGENTS.md „Review“, D-02)

Geprüft hat eine unabhängige zweite Instanz (`claude -p`, nur Lesen: Read/Grep/Glob, `git diff/show/log`). Grundlage waren Plan, UI-SPEC, 02-CONTEXT, AGENTS.md, DESIGN.md und der Diff `c87830c..74a962e`. Ergebnis: kein BLOCKER, kein HOCH. Der Reviewer hat keine Tests ausgeführt.

Ohne Befund geprüft wurden:
- Mandantentrennung bei PUT, DELETE und POST
- Prüfreihenfolge (400 verrät nicht, ob eine fremde Vokabel existiert)
- Rolle und D-08 (Snapshot, Emoji, Alternativen, Runde des Geschwisterkinds)
- 404-Texte, Fokusführung und 404 im Dialog
- Matrizen, Barrierefreiheit und DESIGN.md
- Konzept-Aussagen gegen den Code

| Befund | Schwere | Umgang |
|---|---|---|
| Akzeptanz-Grep „deutsche Wort“ ergibt 1 statt ≥ 2 | MITTEL | begründet zurückgewiesen: gemeinsame Konstante, siehe Abweichung 1 |
| Doppelklick-Tests beweisen den Ref-Riegel nicht, weil `dblClick` schon den gesperrten Button trifft | NIEDRIG | behoben (`e480990`): vitest „Zweimal Absenden im selben Takt“ mit zweimal `fireEvent.submit`; ohne Riegel rot (Mutation). Beim Löschen sperrt `disabled` den zweiten Klick; der Riegel dort bleibt Absicherung, getrennt messbar ist er so nicht (wie 02-04). |
| Erfolgreiches „Hinzufügen“ ließ „„Katze“ ist gelöscht.“ stehen | NIEDRIG | behoben (`e480990`): `setSaved(null)` bei jedem Absenden; vitest-Fall, per Mutation rot belegt |
| POST `/sets/{id}/entries` kann per direktem API-Aufruf weiter 500 ergeben: fehlendes `sourceText` (NullReferenceException in `BuildEntry`), Emoji über 16 oder Beispiele über 500 Zeichen | NIEDRIG | Bestand, über die Oberfläche nicht erreichbar; als Befund ohne Änderung festgehalten (unten), nicht in diesen Plan gezogen |
| Kein Test „Vokabel löschen mit Kinder-Token → 403“ | NIEDRIG | behoben (`e480990`): `Vokabel_loeschen_mit_Kinder_Token_ergibt_403`, grün (Policy bestand schon) |
| Änderung an `ChildrenPage.tsx` außerhalb der Plan-Dateien | NIEDRIG | beauftragter Übertrag, siehe Abweichung 6 |
| Vier bzw. fünf Commits statt einem | NIEDRIG | Vorgabe des Ausführungsauftrags, siehe Abweichung 7 |
| SUMMARY fehlte zum Review-Zeitpunkt | offen | erledigt (diese Datei) |

## Befund ohne Änderung

- **CSV-Import über 200 Zeichen ergibt 500** (aus 02-04): `CsvVocabularyParser` und `ConfirmImportAsync` prüfen die Länge weiter nicht. `WordProblems` steht für eine spätere Korrektur bereit.
- **POST `/sets/{id}/entries` per direktem API-Aufruf:** Fehlt `sourceText`/`targetText` im JSON, endet `BuildEntry` mit einer NullReferenceException (500). Emoji über 16 und Beispiele über 500 Zeichen enden als Datenbankfehler (`ContentConfigurations.cs:44-46`). Über die Oberfläche ist das nicht erreichbar, es gehört zu keiner Anforderung dieser Phase.

## Anforderungen

- **PAR-04** ist erfüllt: „Set umbenennen“ kam mit 02-04, „Vokabel korrigieren“ mit diesem Plan. Beide behalten IDs und Lernstand, das belegen Integrationstests gegen PostgreSQL. Abgehakt.
- **FIX-02** war seit 02-02 abgehakt; „Vokabel löschen“ hat jetzt eine Bestätigung.
- **QUAL-01** ist teilweise erfüllt (`SetEditTests`, `SetDeleteTests` erweitert), nicht abgehakt.

## Self-Check: PASSED

Alle zehn geänderten Dateien sind vorhanden. Die Commits de775d7, 04d1587, a88ad36, 74a962e und e480990 sind Vorfahren von HEAD. `git rev-list --count c87830c..HEAD` = 5.
