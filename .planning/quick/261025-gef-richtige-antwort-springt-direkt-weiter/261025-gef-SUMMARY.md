---
phase: quick-261025-gef
plan: "01"
subsystem: frontend/learn
status: complete
tags: [lernrunde, quiz, a11y, fix-07, design-01]
requirements: [FIX-07, DESIGN-01]
requires: []
provides:
  - "Richtige Antwort ohne Tippfehler schaltet ohne „Weiter“ zur naechsten Aufgabe"
  - "Dauerhafter role=status-Bereich mit „Richtig! +N XP“ ueber dem Antwortfeld"
affects: [frontend/src/features/learn/SessionPage.tsx, DESIGN.md]
tech-stack:
  added: []
  patterns: ["dauerhafter Live-Bereich (role=status immer im DOM, Inhalt wechselt)", "Item-ID-Riegel in send()"]
key-files:
  created: []
  modified:
    - frontend/src/features/learn/SessionPage.tsx
    - frontend/src/features/learn/SessionPage.test.tsx
    - frontend/e2e/learn.spec.ts
    - frontend/e2e/first-run.spec.ts
    - DESIGN.md
decisions:
  - "Richtig ohne Tippfehler → next() direkt aus onSuccess; falsch und Tippfehler behalten das Sheet mit „Weiter“ (A1, vom Owner bestaetigt)"
  - "Bestaetigung als note-success in einem dauerhaften role=status-Div statt SuccessNote (bedingt eingehaengtes role=status wird oft ueberhoert)"
  - "scrollIntoView({block:'nearest'}) auf das Antwortfeld, sobald die Bestaetigung erscheint: bei 200 % schob sie das fokussierte Feld sonst unter den Bildrand"
metrics:
  started: 2026-10-25T11:00:58Z
  completed: 2026-10-25T15:40:00Z
  duration: "ca. 4 h 40 min (davon gut 2 h Warten auf e2e unter Hostlast 70-130)"
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 8900
  tasks: 3
  commits: 3
plan_head_before: 136d7853993bcfd6c89467b0e2e8a59d4da8d1c0
plan_head_after: 9184075ec57513429db5ac06c1c02dc0b91e2d84
---

# Quick 261025-gef Plan 01: Richtige Antwort springt direkt weiter Summary

Richtig ohne Tippfehler fuehrt ohne „Weiter“ sofort zur naechsten Aufgabe bzw. zur Zusammenfassung; „Richtig! +N XP“ steht als `note-success` in einem dauerhaften `role="status"`-Bereich ueber dem fokussierten, leeren Antwortfeld. Falsch und Tippfehler behalten das Sheet mit „Weiter“.

## Commits

| Hash | Message |
|------|---------|
| 9184075 | feat: Richtige Antwort springt direkt zur nächsten Aufgabe (genau die fuenf Plan-Pfade, Trailer `A11y-Check:` und `Co-Authored-By:`) |

`commits: 3` ist gemessen (`git rev-list --count 136d785..HEAD`). Zwei davon stammen nicht aus diesem Plan, sondern wurden parallel auf v1-fertig committet: `0d70335` und `0280bb6` (docs, SPL2). Aus diesem Plan stammt nur 9184075. Kein Push.

`actuals.tokens` = chars/4 ueber `git diff 136d785 HEAD` der fuenf Pfade (35 438 Zeichen). Das ist der Diff, nicht der Aufwand.

## TDD

- **Rot** (vor der Aenderung an SessionPage.tsx, node:22-Container): 10 von 18 Tests in `SessionPage.test.tsx` rot. Ursachen: 6× „Unable to find … 2 von 2“ (keine Weiterschaltung), 3× „Unable to find role status“, 1× keine Ueberschrift „Geschafft!“ ohne Klick.
- **Gruen**: 18/18.
- **Zweiter Rot-Gruen-Zyklus** (Fund im e2e, siehe Abweichungen): Assertion „scrollIntoView auf dem Antwortfeld“ rot (1 Fehlschlag, `expected [] to include <input>`), nach dem Effekt gruen.
- **Mutationsprobe answerMs** (Review-Befund 3): `shownAt.current = Date.now()` in `next()` testweise entfernt → 1 Fehlschlag (`answerMs` 4300 statt 300), danach zurueckgestellt.

## Gate

| Befehl | Stand | Exit | Ergebnis |
|--------|-------|------|----------|
| `bash .planning/phases/02-…/gate/backend-test.sh` | vor Review-Fixes (Backend unberuehrt) | 0 | Build 0 Warnungen; Learning.Tests 166/166, Api.Tests 312/312 |
| node:22: `npm ci && lint && typecheck && build && npm test && design:check && design:classes` | final | 0 | lint 0, typecheck 0, Build ok, vitest 16 Dateien / 332 Tests gruen, design:lint errors 0 warnings 0 (keine Kontrast-Warnung), Export ohne Diff, „keine alten Klassen“ |
| `npx @google/design.md@0.4.0 diff <HEAD-Kopie> DESIGN.md` | final | 0 | `"regression": false`, keine Token-Aenderung |
| e2e Lauf 2: `npm run e2e:stack && npx playwright test` | vor Review-Fixes | 0 | 66 passed, 1 skipped (first-run, wie erwartet) |
| e2e Lauf 3: ganze Suite | final | abgebrochen | Host-Last 93; Timeouts (30 s) in children/keyboard-zoom/manage (Elternbereich, nicht beruehrt). Lauf von mir gestoppt, Stack abgebaut |
| e2e Lauf 4: `npx playwright test e2e/learn.spec.ts` | final | 1 | 8 passed, 1 failed: „Anmeldung per Tastatur“, Timeout in `AxeBuilder.analyze()` auf der Startseite bei Last 130 (Seite unberuehrt, in Lauf 2 gruen). Beide Lernrunden-Tests gruen |
| Install-Smoke `setup-smoke.sh` | vor Review-Fixes | 0 | SMOKE OK; `first-run.spec.ts` 1 passed (FIRST RUN OK) |

Unterschied Lauf 2 → final: nur Kommentare in SessionPage.tsx, `toBeInViewport({ ratio: 1 })` fuer den Statusbereich, eine DESIGN.md-Zeile und der vitest-Fall fuer answerMs. Die volle Suite auf dem finalen Stand ist wegen der Hostlast nicht gruen belegt. **UNBEKANNT: voller e2e-Lauf auf 9184075 bei normaler Last.**

e2e-Stack nach jedem Lauf mit `down -v` abgebaut (0 Container `wordquest-e2e`). Smoke raeumt per trap selbst auf. Ports 8080/18090, `wq-preview` und fremde Container nicht angefasst.

## A11y-Beleg

- Tool: @axe-core/playwright 4.13.0 (axe-core 4.13.0), Playwright 1.64.0, Chromium.
- Seite/Zustand: `/lernen` ohne Secure Context, direkt nach automatischer Weiterschaltung mit sichtbarer Bestaetigung, `checkPage` (axe 0 Verstoesse, Glas-Kontrast, opaker Rueckfall, Reflow 320 px) → 0 Befunde (Lauf 2 und Lauf 4).
- Tastatur: „Lernen mit Bild über HTTP“ ganze Runde nur per Tastatur (Enter im Feld, Enter auf „Weiter“ nur nach falsch), gruen.
- 200 % (640×400): nach der ersten automatischen Weiterschaltung Antwortfeld fokussiert und `toBeInViewport({ ratio: 1 })`, Statusbereich `toBeInViewport({ ratio: 1 })`, `scrollWidth ≤ 640` → gruen (Lauf 4).
- Reduced motion: nur `animate-pop`, das `index.css` bei `prefers-reduced-motion` abschaltet. Farben nur `bg-surface-success`/`text-success-text`.

## Doku-Abgleich

`grep -rn -i "rückmeldung\|richtig!\|„weiter" Documentation/*.md README.md` → 0 Treffer. Der breitere grep auf „weiter“ trifft nur unbeteiligte Zeilen („läuft weiter“, „springt weiter“). Angepasst ist nur DESIGN.md (Quiz-Zeile :317 und Hinweise :321).

## Annahmen (A1-A9, wie geplant)

- A1: Falsch und richtig mit Tippfehler behalten das Sheet mit „Weiter“ (vom Owner bestaetigt).
- A2: Auswahl-Aufgaben verhalten sich gleich, Fokus auf der ersten Auswahl. Grenze: Ein Doppeltipp auf dieselbe Stelle koennte bei Auswahl die naechste Aufgabe beantworten. Relevant erst mit LRN2-01.
- A3: Die Bestaetigung verschwindet beim Senden der naechsten Antwort; bei 0 XP nur „Richtig!“.
- A4: Ist die letzte Aufgabe richtig, kommt sofort die Zusammenfassung.
- A5: Das Antwortfeld bleibt dasselbe Element, `focus()` nach Klick auf Senden; iOS oeffnet die Tastatur dann eventuell nicht selbst.
- A6: Das neue Wort wird nicht automatisch vorgelesen (unveraendert).
- A7: Zuordnung FIX-07 und DESIGN-01.
- A8: Das Zeitfenster fuer den Item-ID-Riegel ist im Test nicht deterministisch herstellbar. Laut Review blockiert der deaktivierte Button es im Browser ohnehin; der Riegel ist Absicherung, der Kommentar sagt das jetzt so.
- A9: Doku siehe oben.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Antwortfeld bei 200 % nach der Weiterschaltung unter dem Bildrand**
- **Found during:** Task 2 (e2e Lauf 1: `toBeInViewport` ratio 0,29)
- **Issue:** Die neue Bestaetigung schiebt das fokussierte Feld nach unten; `focus()` auf ein schon fokussiertes Feld scrollt nicht.
- **Fix:** `useEffect` auf `confirmedXp` → `answerInput.current?.scrollIntoView({ block: 'nearest' })`; vitest-Assertion vorher rot, danach gruen; jsdom-Stub fuer `scrollIntoView` im Test.
- **Files modified:** SessionPage.tsx, SessionPage.test.tsx
- **Commit:** 9184075

**2. Testabdeckung erweitert:** Im Fall „falsch“ traegt die Serverantwort ein `retryItem`, deshalb prueft der Test „1 von 3“ statt „1 von 2“ wie im Plan. Damit ist belegt, dass `retryItem` wie bisher angehaengt wird.

**3. Commit-Anzahl:** Der Plan wollte genau einen Commit. Es gibt einen (9184075), der Ledger misst aber 3, weil zwei fremde docs-Commits parallel auf dem Branch landeten.

## Review (unabhaengige Instanz `claude -p`, nur Read/Grep/Glob)

Ergebnis: 7 Befunde (0 blocker, 0 major, 3 minor, 4 nit).

| # | Schwere | Befund | Entscheidung |
|---|---------|--------|--------------|
| 1 | minor | DESIGN.md:321 sagt „unter dem auslösenden Element“, Quiz zeigt die Bestaetigung darueber | behoben: Ausnahme „im Quiz … über dem Antwortfeld (siehe Quiz)“ |
| 2 | minor | `toBeInViewport()` ohne ratio fuer den Statusbereich zu schwach | behoben: `{ ratio: 1 }`, in Lauf 4 gruen |
| 3 | minor | answerMs ab Anzeige der neuen Aufgabe nicht belegt | behoben: `Date.now`-Spy, `answerMs` 4000/300 geprueft, Mutationsprobe rot |
| 4 | nit | retryItem-Anhaengen vor `next()` suggeriert, dass next() es mitzaehlt | behoben: Kommentar, dass richtige Antworten nie eine Wiederholung bringen |
| 5 | nit | Kommentar zum Item-ID-Riegel: der deaktivierte Button blockiert das Fenster schon | behoben: Kommentar als Absicherung formuliert, Code bleibt |
| 6 | nit | `!result.correct \|\| result.hadTypo` in FeedbackPanel jetzt praktisch immer wahr | zurueckgewiesen: Der Plan verlangt FeedbackPanel unveraendert; die Bedingung ist weiter korrekt und haelt das Panel unabhaengig vom Aufrufer |
| 7 | nit | `Element.prototype.scrollIntoView = vi.fn()` nie zurueckgesetzt | zurueckgewiesen: `vi.spyOn` geht nicht, weil jsdom die Methode nicht hat; vitest isoliert je Datei. `vi.restoreAllMocks()` ist trotzdem im afterEach (fuer den Date-Spy) |

Ohne Befund geprueft: Doppel-Senden, „Schließen“ nach Auto-Weiter, letzte Aufgabe genau ein /complete, Fehlerpfad, onSuccess-Closure (TanStack 5.102.8), Fokus, Live-Bereich, Tokens, Sicherheit.

## Known Stubs

Keine.

## Threat Flags

Keine neue Oberflaeche. T-261025-gef-01 mitigiert (sending-Ref + Item-ID-Riegel, vitest „Zweimal Enter“/„Doppelklick“/Body-Pruefung), T-03 mitigiert (vitest genau ein /complete).

## Self-Check: PASSED

- FOUND: alle fuenf Dateien im Commit 9184075 (`git show --name-only`)
- FOUND: 9184075 ist Vorfahr von HEAD
- Keine geloeschten Dateien im Commit
