# Phase 2 — UI Review

**Audited:** 2026-10-17
**Baseline:** `02-UI-SPEC.md` (Status draft, Checker-Sign-off offen) und `DESIGN.md` (normativ), WCAG 2.2 AA (AGENTS.md)
**Diff-Bereich:** `git diff c3534f1 HEAD -- frontend/src` (20 Dateien, +2378/−62)
**Screenshots:** erstellt gegen den e2e-Stack (127.0.0.1:18080), 1440×900 und 320×568: Set-Seite, „Set löschen“, „Set umbenennen“ mit Fehler, CSV-Vorschau mit Problemzeilen, Fortschritt. Ablage `.planning/ui-reviews/02-20261017-230936/` (per `.gitignore` ausgeschlossen).
**Interaction captures:** off (workflow.ui_interaction_capture nicht gesetzt); Interaktion über die e2e-Suite und ein eigenes Playwright-Skript belegt.
**A11y-Beleg (neu gemessen):** `npx playwright test` (Playwright 1.64.0, `@axe-core/playwright`) gegen den gebauten Stack: **46 passed, 1 skipped, 0 failed**, Exit 0. Enthält axe 0 auf Set-Seite mit offenen Dialogen, Kind-Löschdialog, Startseite Serie 0/3, Fortschritt, Lernrunden-Fehleransicht, Tastatur-Durchgang und 320-px-/Zoom-Specs (`keyboard-zoom.spec.ts`, `manage.spec.ts:327-461`).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Alle Vertragstexte wörtlich; CSV-Import mit Grammatikfehler „1 Vokabeln übernehmen“ und Fehlertext ohne nächsten Schritt |
| 2. Visuals | 3/4 | Dialog-Sheet wie vereinbart; CSV-Problemzeilen zeigen nur den Grund, nicht das betroffene Wort |
| 3. Color | 4/4 | Kein Hex/Inline-Style; Scrim als Token ergänzt; kein `primary` in Bestätigungsdialogen |
| 4. Typography | 4/4 | Nur `type-*`-Tokens, Rollen wie UI-SPEC-Tabelle |
| 5. Spacing | 3/4 | Skala eingehalten; neue Arbitrary-Klasse `sm:mt-[var(--leading-label-section)]` |
| 6. Experience Design | 3/4 | Dialog-Verhalten vollständig und belegt; CSV-Vorschau scrollt bei 320 px zweidimensional, Import-Buttons ohne Busy-Text |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **WARNING — CSV-Vorschau erzwingt waagerechtes Scrollen bei 320 px** (`frontend/src/features/manage/SetDetailPage.tsx:722-736`): gemessen Region `scrollWidth 574` bei `clientWidth 238` mit einem langen Wort ohne Trennstelle (Seite selbst 320/320). Zeilen-`span` ohne `min-w-0 break-words`, Container `overflow-y-auto` erzeugt auch x-Scroll. WCAG 1.4.10 (Reflow); die UI-SPEC-Regel „`break-words`, nie abschneiden“ gilt hier ebenso. Fix: Text-`span` in `:734` und `:732` `min-w-0 flex-1 break-words`, in `manage.spec.ts` den 320-px-Reflow-Test um die offene Vorschau ergänzen.
2. **WARNING — Problemzeilen nennen das Wort nicht** (`SetDetailPage.tsx:731-732`): Zeile 3 zeigt nur „Ein Wort darf höchstens 200 Zeichen lang sein.“, das betroffene Wort fehlt; Eltern müssen per Zeilennummer im Textfeld zählen. Dazu ist die Aussage nur über `text-danger-text` und Text getragen, das ist ok, aber ohne Inhalt nicht korrigierbar. Fix: unter dem Grund den (gekürzt per `break-words`, nicht abgeschnitten) Rohinhalt der Zeile `text-ink-soft` anzeigen; braucht `row.source`/`row.target` auch für Problemzeilen, sonst die Rohzeile aus `content.split('\n')[lineNumber-1]`.
3. **WARNING — Import-Texte außerhalb des Vertrags** (`SetDetailPage.tsx:746,760`): „1 Vokabeln übernehmen“ (Singular fehlt, im e2e sogar festgeschrieben `manage.spec.ts:203,209`), „Der Import ist fehlgeschlagen.“ statt `ApiError.message` bzw. „Das hat nicht geklappt. Versuche es noch einmal.“; „Vorschau“/„Übernehmen“ ohne Busy-Text „Einen Moment …“ (`:749-761`). Fix: `${n} ${n === 1 ? 'Vokabel' : 'Vokabeln'} übernehmen`, `ErrorNote message={confirm.error.message}`, Busy-Labels wie die Dialoge.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Abgeglichen gegen den Copywriting Contract, wörtlich vorhanden: Dialogtitel/-beschreibungen Kind/Set/Vokabel (`ChildFormPage.tsx` DeleteChild, `SetDetailPage.tsx:590-591,651-652`), „Endgültig löschen“, „Abbrechen“, „Speichern“, „Umbenennen“, „Set löschen“, „Kind löschen“, `aria-label` „{Deutsch} bearbeiten/löschen“ (`:196,207`), Erfolgstexte (`:343,463,570,632`, Kind „{Name} ist gelöscht.“), Feldfehler (`:17-20,257-258`), leerer Zustand „Dieses Set gibt es nicht (mehr).“ (`:104`), Serie 0/1/n (`LearnHomePage.tsx:60-67`, `ProgressPage.tsx:86-90`), „Sicher gelernt: {m} von {n} Wort/Wörtern“ (`LearnHomePage.tsx:81`), „Wörter sitzen sicher“ (`ProgressPage.tsx:100`). Busy-Text „Einen Moment …“ in allen Dialogen.

- **WARNING** `SetDetailPage.tsx:760` „1 Vokabeln übernehmen“, siehe Top 3.
- **WARNING** `SetDetailPage.tsx:746` „Der Import ist fehlgeschlagen.“: kein ganzer Handlungssatz, verwirft `ApiError.message` (Phase-1-Regel). Bestand, aber im Phase-Scope „CSV-Vorschau“ und nicht angefasst.
- **Hinweis** `SessionPage.tsx:155` Fallback „Etwas ist schiefgegangen.“ (Bestand) weicht vom Vertragstext „Das hat nicht geklappt. Versuche es noch einmal.“ ab; erreicht nur bei Nicht-`Error`-Würfen.

### Pillar 2: Visuals (3/4)

Screenshots bestätigen: Sheet unten mit `sheet-inset`, Titel oben links, „Abbrechen“ über „Endgültig löschen“ bei 320 px auf zwei volle Zeilen (`mobile-set-loeschen.png`), Fehlertext am Feld mit `aria-invalid`-Rand (`mobile-umbenennen-fehler.png`). Set-Kopf `h2` mit „Umbenennen“ (`secondary`) und „Set löschen“ (`danger`) wie vereinbart (`SetDetailPage.tsx:114-122`). Icon-Buttons haben `aria-label`, Icons `aria-hidden`.

- **WARNING** Problemzeilen ohne Wort, siehe Top 2.
- **Hinweis** UI-SPEC verlangt Buttons `flex-1`, umgesetzt `flex-auto` (`dialog.tsx:105-117`, `SetDetailPage.tsx:389,395,516,522`), begründet im Kommentar und visuell korrekt. UI-SPEC nachziehen.
- **Hinweis** Erfolgsmeldung „Die Vokabel ist gespeichert.“ / „„X“ ist gelöscht.“ steht unter dem Set-Kopf (`:124`), UI-SPEC sagt „über der Liste“. Bei langer Seite (Screenshot `mobile-set.png`, 40+ Zeilen) ist sie nach Bearbeiten in Zeile 30 außer Sicht; der Fokus geht zurück auf den Stift, `role="status"` sagt sie an. Sehende Nutzer ohne Screenreader bekommen kein sichtbares Feedback.
- **Hinweis** Zurück-Link weiter von Hand gebaut (`SetDetailPage.tsx:84-91`), Phase-1-Befund unverändert offen.

### Pillar 3: Color (4/4)

`grep` über die Diff-Dateien: 0 Hex, 0 `style={…}`. Neuer Token `--color-scrim: #141c3266` (`design-tokens.css:28`) aus `DESIGN.md:34,188` exportiert, genutzt nur in `dialog.tsx:32` als Fläche. Accent neu nur auf „Speichern“ in Formular-Dialogen (je Dialog ein `primary`); Bestätigungsdialoge ohne `primary`, Hauptaktion `danger` mit Text + `Trash2` (`dialog.tsx:117-120`). Kontrast im offenen Dialog per axe und `expectDialogContrast` belegt (e2e grün).

- **Hinweis** `SetDetailPage.tsx:732` Problemtext `text-danger-text` direkt auf Glas statt auf `surface-error`: axe grün, aber außerhalb der in DESIGN.md geprüften Paarung `note-error`.

### Pillar 4: Typography (4/4)

Neu nur `type-headline` (Dialogtitel `dialog.tsx:53`, Set-Titel `SetDetailPage.tsx:115`), `type-body-md` (Beschreibung `dialog.tsx:54`), `type-body-sm` (Meisterschaftszeile), Feldlabels über `Field`. Rohe `text-(xs…)`/`font-(weight)` im Diff: 0. Lange Titel `break-words` in Titel, Kopf und `SuccessNote` (`misc.tsx:80`).

- **Hinweis** `SetDetailPage.tsx:703` `font-mono` im Import-Textfeld (Bestand) ist kein `DESIGN.md`-Token.

### Pillar 5: Spacing (3/4)

Abstände im Diff nur `gap-2`, `gap-4`, `p-6`, `py-2`, `px-4` (Skala 4/8/16/24). Sheet-Abstand per Token `inset-x-sheet-inset bottom-sheet-inset`.

- **WARNING** `SetDetailPage.tsx:152` `sm:mt-[var(--leading-label-section)]` neu in dieser Phase: Arbitrary-Wert, koppelt einen Abstand an eine Zeilenhöhe. Ergebnis optisch korrekt, verstößt aber gegen „keine Einzelfall-Werte, fehlt eine Stufe, wird sie zentral ergänzt“. Fix: `sm:items-end` am Formular plus Fehlertext-Reservierung, oder Token in `DESIGN.md`.
- **Hinweis** `dialog.tsx:37` `max-h-[calc(100dvh_-_2*var(--spacing-sheet-inset))]`: Arbitrary-Wert, aber genau so in UI-SPEC „Spacing Scale“ freigegeben (über `--spacing`-Token). Kein Abzug.

### Pillar 6: Experience Design (3/4)

Abgedeckt und durch Tests belegt: Startfokus „Abbrechen“ (`dialog.tsx:38-42,101`), Enter danach löscht nichts, Esc schließt, Scrim-Klick schließt nicht (`:50-51`), `aria-modal` + `alertdialog` (`:34-36,100`), Schließen während `busy` gesperrt (`:90-92`, `SetDetailPage.tsx:314,434`), Ref-Riegel gegen Doppelklick in allen fünf Aktionen und der Lernrunde (`SessionPage.tsx:38,95-99`), Fokusrückgabe inkl. Sonderfall „Zeile/Set/Kind schon weg“ (`useGone`, `SetDetailPage.tsx:274-289`, `ChildFormPage` `backRef`), 404 im Dialog mit Neuladen erst beim Schließen, „Zurück“ mit `autoFocus` in der Fehleransicht (`SessionPage.tsx:157`), Serie 0 eigener Zustand, Lade-/Fehler-/Leer-Zustand der Set-Seite getrennt (`SetDetailPage.tsx:94-107`).

- **WARNING** CSV-Vorschau 2D-Scroll bei 320 px, siehe Top 1.
- **WARNING** Import ohne Busy-Text, siehe Top 3; „Vorschau“ und „Übernehmen“ sind nur `disabled`.
- **WARNING** Veraltete Vorschau: Nach Änderung im Textfeld bleibt `preview` stehen (`SetDetailPage.tsx:669-676,699`) und „n Vokabeln übernehmen“ importiert die alte Auswertung, nicht den sichtbaren Text. Fix: `setPreview(null)` in `onChange` des Textfelds. Bestand, aber Kernpfad der CSV-Vorschau.
- **Hinweis** Der Löschen-Button der Vokabelzeile und „Set löschen“ (`size="sm"`) haben ≥ 44 px (Button-Größen laut UI-SPEC); `size="icon"` 48 px. Zielgröße 2.5.8 erfüllt.

Registry audit: übersprungen, kein `components.json`, keine Drittregistries (UI-SPEC Registry Safety).

---

## Files Audited

- `frontend/src/components/ui/dialog.tsx`, `misc.tsx`, `design-tokens.css`
- `frontend/src/features/manage/SetDetailPage.tsx`, `ChildFormPage.tsx`, `SetsPage.tsx`, `ChildrenPage.tsx`, `ProgressPage.tsx`
- `frontend/src/features/learn/LearnHomePage.tsx`, `SessionPage.tsx`
- `frontend/e2e/manage.spec.ts` (CSV-Import, Dialoge), Lauf der gesamten e2e-Suite
- `.planning/phases/02-reliable-learning-clean-family-data/02-UI-SPEC.md`, `DESIGN.md`, `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs` (Problemtexte)
