---
phase: 01-safe-home-network-install
plan: 01
subsystem: ui
tags: [design-md, tailwind4, liquid-glass, playwright, axe-core, vitest, wcag22]
status: complete

requires: []
provides:
  - Token-Pipeline DESIGN.md -> design-tokens.css -> Tailwind (design:export, design:check)
  - type-*-, glass*- und glass-flat*-Utilities mit deckendem Fallback in index.css
  - UI-Bausteine button/input/card/misc auf Tokens, Login-Seite umgestellt
  - Playwright-/axe-Infrastruktur (Teststack wordquest-e2e, checkPage)
  - Vitest-Einrichtung mit erstem Test (Progress-Vertrag)
  - Klassen-Gate scripts/design-classes.mjs
affects: [01-03, 01-04, 01-06, 01-07, 01-08]

actuals:
  tokens: 10667
  tasks: 3
  commits: 2
plan_head_before: 0b49bf283425cf04a7ad911a2957d45bd5cdde7f
plan_head_after: c7008bc83f789ebe12800f7f95fc2eac2d329630

tech-stack:
  added:
    - vitest 5.0.3
    - jsdom 30.1.2
    - "@testing-library/react 16.3.3"
    - "@testing-library/dom 10.4.2"
    - "@testing-library/user-event 14.6.7"
    - "@playwright/test 1.64.0"
    - "@axe-core/playwright 4.13.0"
  patterns:
    - "Schriftstufe nur als type-<stufe>, nie text-<stufe> (tailwind-merge)"
    - "Glasflaechen nur ueber glass*/glass-flat*-Utilities; bg-glass* ohne Varianten-Praefix ist im Gate verboten"
    - "checkPage(page) in e2e/axe.ts als Standard-a11y-Beleg je Seite"

key-files:
  created:
    - frontend/src/design-tokens.css
    - frontend/playwright.config.ts
    - frontend/e2e/docker-compose.e2e.yml
    - frontend/e2e/axe.ts
    - frontend/e2e/login.spec.ts
    - frontend/scripts/design-classes.mjs
    - frontend/src/components/ui/misc.test.tsx
    - frontend/src/test/setup.ts
  modified:
    - DESIGN.md
    - frontend/src/index.css
    - frontend/index.html
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/tsconfig.json
    - frontend/vite.config.ts
    - frontend/src/components/ui/button.tsx
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/card.tsx
    - frontend/src/components/ui/misc.tsx
    - frontend/src/features/auth/GuardianLoginPage.tsx

key-decisions:
  - "1,5-px-Verlaufsrand der Glasflaechen entfaellt: als ::before verhindert er die axe-Kontrastberechnung (incomplete pseudoContent); Tiefe nur ueber Schatten und Inset-Lichtkante"
  - "playwright-core per npm overrides auf 1.64.0 gepinnt (Peer von @axe-core/playwright zog sonst 1.64.1)"
  - "Seitenueberschrift der Login-Seite als h1 type-large-title statt CardTitle-Override (tailwind-merge kennt type-* nicht)"

patterns-established:
  - "Test zuerst: e2e/login.spec.ts und misc.test.tsx vor dem Umbau rot"
  - "Uebergangsblock: alte @theme-Namen bleiben bis 01-04"

requirements-completed: []

coverage:
  - id: D1
    description: "design-tokens.css stammt aus DESIGN.md, Lint 0/0, Export-Diff leer"
    requirement: DESIGN-01
    verification:
      - kind: other
        ref: "npm --prefix frontend run design:check"
        status: pass
  - id: D2
    description: "/login: axe 0 (Hauptlauf, je Backdrop-Farbe, reduzierte Transparenz), 320-px-Reflow, Login per Enter"
    requirement: QUAL-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/login.spec.ts#Login: Token-Design, axe 0, Anmeldung per Enter"
        status: pass
  - id: D3
    description: "Tastatur auf /login: E-Mail, Passwort, Anmelden mit 3-px-Fokusring"
    requirement: QUAL-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/login.spec.ts#Login: Tastatur mit sichtbarem Fokus"
        status: pass
  - id: D4
    description: "Progress behaelt Vertrag 0 bis 1 (0, 0,5, 1, 1,4, Beschriftung)"
    requirement: DESIGN-01
    verification:
      - kind: unit
        ref: "frontend/src/components/ui/misc.test.tsx"
        status: pass
  - id: D5
    description: "UI-Bausteine und Login-Seite ohne alte Klassen, Inline-Styles, Hex, Einzelfall-px"
    requirement: DESIGN-01
    verification:
      - kind: other
        ref: "npm --prefix frontend run design:classes -- src/components/ui src/features/auth/GuardianLoginPage.tsx"
        status: pass
  - id: D6
    description: "Glas-Wirkung auf guenstigem Tablet und 200 % Zoom auf /login"
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md Manual-Only Verifications (end-of-phase)"
        status: unknown

duration: 15min
completed: 2026-10-16
---

# Phase 1 Plan 01: Token-Pipeline und Login-Seite im Liquid-Glass-Design Summary

**Die Login-Seite läuft vollständig mit den Tokens aus DESIGN.md (generiertes Tailwind-Theme, Glas-Utilities mit deckendem Fallback). Im gebauten Docker-Stack ist sie mit axe-core 4.13 belegt: 0 Verstöße im Hauptlauf, auf jeder der fünf Backdrop-Farben und bei reduzierter Transparenz, dazu 320-px-Reflow und Tastatur.**

## Paket-Freigabe (Task 1)

- Checkpoint `blocking-human` erreicht und zurückgemeldet. Die Fortsetzung kam vom Orchestrator mit „freigegeben“. Er stützt sich auf Dennis' stehende Freigabe genau dieser sieben Dev-Dependencies (Projekt-Memory, 2026-10-15) und nicht auf ein live getipptes „freigegeben“ von Dennis.
- Versionsprüfung am 2026-10-16 per `npm view`: Jede gepinnte Version existiert, Repository und Maintainer passen (vitest-dev, jsdom, testing-library, microsoft, dequelabs), kein `postinstall`. Veröffentlicht zwischen 2026-08-11 und 2026-10-07, also mindestens 9 Tage alt.
- Installiert mit `--save-exact`: vitest 5.0.3, jsdom 30.1.2, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/user-event 14.6.7, @playwright/test 1.64.0, @axe-core/playwright 4.13.0. Chromium-Headless-Shell 156 per `npx playwright install chromium`.

## Accomplishments

- `DESIGN.md` um `body-md-strong` und `emoji` ergänzt. `design.md diff` meldet `"regression": false`, der Lint `errors: 0, warnings: 0`.
- `frontend/src/design-tokens.css` wird per `design:export` erzeugt, `design:check` prüft Lint und Export-Diff.
- `index.css`: Übergangsblock (alte Theme-Namen), Token-Import, Spacing-Reset, `type-*`, `glass`/`glass-clear`/`glass-sheet`/`glass-selected` mit Blur und Tiefe, `glass-flat`/`glass-flat-clear`/`glass-flat-selected` ohne Blur, jeweils mit `@supports not`- und `prefers-reduced-transparency`-Fallback. Dazu Backdrop mit vier Radialverläufen auf `body`, globaler `:focus-visible`-Ring und `progress`-Styling.
- Bausteine `button` (neu: `round`, `roundPrimary`), `input`, `card`, `misc` (Label, ErrorNote, Progress nativ, Badge, Spinner, EmptyState) und `GuardianLoginPage` auf Tokens umgestellt.
- `index.html`: Zoom-Sperren entfernt.
- Teststack `wordquest-e2e` (Port 127.0.0.1:18080, reine Testwerte, Demo-Seed), `e2e/axe.ts` mit `checkPage` (Hauptlauf, Glas-Kontrast je Blob, deckender Fallback für die Glas-Utilities, die auf der Seite vorkommen — auf /login nur `glass` und `glass-flat`; die übrigen fünf belegen 01-03 und 01-04 auf ihren Seiten —, Reflow).
- Vitest mit `misc.test.tsx`, Klassen-Gate `scripts/design-classes.mjs`.

## Task Commits

1. **Task 1: Paket-Legitimität:** kein Commit (Checkpoint)
2. **Task 2: Tracer Login-Seite Ende-zu-Ende:** `35ebf24` (feat)
3. **Task 3: Kontrast je Blob, Fallback, Reflow, Tastatur, Progress, Klassen-Gate:** `c7008bc` (feat)

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 2, Schritt 3** (`e2e/login.spec.ts` gegen den Stack vor dem Umbau): `1 failed` mit `expect(design.fontFamily.startsWith('-apple-system')).toBe(true)`, also `Expected: true / Received: false` (login.spec.ts:20). Die Body-Schrift fehlte, die folgenden Assertions für Backdrop und `--color-primary` liefen deshalb nicht mehr.
- **Task 3, Schritt 2** (`npm run test` vor dem Umbau von Progress): `Tests 5 failed (5)`. Es gab kein `progress`-Element, nur ein `div role="progressbar"` mit `style="width: 50%;"`, und `getByRole('progressbar', { name: 'Fortschritt' })` fand nichts.
- **Task 3, Schritt 3** (axe-Erweiterung und Tastatur-Test gegen den Task-2-Stack): sofort `2 passed`, also kein roter Lauf. Die Annotationen zeigten aber pro Blob 6 Knoten `incomplete` mit Grund `pseudoContent`: axe hat den Kontrast auf Glas wegen des `::before`-Verlaufsrands gar nicht berechnet (siehe Abweichung 1). Nach dem Entfernen blieb pro Blob 1 Knoten `incomplete`. Dass es der Verlaufs-Button ist, habe ich nicht belegt; der Probelauf, der die Knoten benannte, lief noch mit dem Rand.
- **Task 3, Schritt 4** (Klassen-Gate-Gegenprobe vor dem Skript): `Cannot find module …/design-classes.mjs`, Exit 1.

## Verify-Ergebnisse (beobachtet)

- Task 2 `<automated>` (design:check → lint → typecheck → build → grep `.bg-brand`/`.text-white` → e2e:stack → e2e): **Exit 0**, `errors: 0, warnings: 0`, `1 passed`. Alle Acceptance-Greps OK, auch `.rounded-2xl` im gebauten CSS.
- Task 3 `<automated>` (test → design:classes → lint → typecheck → build → e2e:stack → e2e): **Exit 0**. `Tests 5 passed (5)`, `keine alten Klassen`, `2 passed` (Design/axe und Tastatur).
- Klassen-Gate-Gegenprobe: Datei mit `text-sm` gibt Exit 1 und 1 Treffer. Datei mit `bg-glass-clear` (ohne Präfix) gibt Exit 1 und 1 Treffer; `hover:bg-glass-clear` und `bg-glass-opaque` in derselben Datei bleiben erlaubt.
- Über ganz `src` meldet das Gate noch 157 Treffer in nicht umgestellten Seiten. Erwartet, die stellen 01-03 und 01-04 um.
- axe-Annotationen /login: Hauptlauf 7 × `incomplete color-contrast` (Verläufe), 2 best-practice-Verstöße (`landmark-one-main` 1, `region` 4 Knoten), je Backdrop-Farbe 1 × `incomplete`.
- Teststack danach mit `docker compose … down -v` entfernt.
- Backend nicht berührt, `dotnet build/test` nicht gelaufen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Verlaufsrand per `::before` macht die Kontrastprüfung wirkungslos**
- **Found during:** Task 3 (Annotationen des Blob-Laufs)
- **Issue:** axe meldet für alle 6 Textknoten auf der Glas-Karte `incomplete` mit `pseudoContent`. Die D-19-Prüfung je Blob war damit grün, ohne etwas zu messen.
- **Fix:** Wie im Plan als Ausweichweg vorgesehen, bleiben nur die Inset-Schatten (Lichtkante) und der Schlagschatten, der `::before`-Rand ist raus. Der Grund steht als Kommentar in `index.css`.
- **Files modified:** frontend/src/index.css
- **Commit:** c7008bc

**2. [Rule 1 - Bug] Gate-Regex aus RESEARCH Pitfall 1 trifft neue Token-Klassen**
- **Found during:** Task 3, Schritt 7
- **Issue:** Das schließende `\b` endet auch vor `-`, deshalb trafen `bg-surface-error`, `text-danger-text` und `border-danger-text` (12 Fehltreffer).
- **Fix:** `(?![\w-])` statt `\b` am Ende der Farb-, Größen- und Gewichtsgruppe.
- **Files modified:** frontend/scripts/design-classes.mjs
- **Commit:** c7008bc

**3. [Rule 3 - Blocking] Zwei playwright-core-Versionen brechen den Typecheck**
- **Found during:** Task 3 (typecheck mit `e2e/` im include): 3 × TS2322 in `e2e/axe.ts`, weil `Page` aus playwright-core 1.64.0 nicht zu `Page` aus 1.64.1 passt.
- **Issue:** Der Peer `playwright-core` von `@axe-core/playwright` wurde als neueste Version 1.64.1 aufgelöst. Genau diese Version hatte die Recherche als „too-new“ markiert.
- **Fix:** `"overrides": { "playwright-core": "1.64.0" }` in `frontend/package.json`. Kein neues Paket, nur der Peer auf die Version von @playwright/test gepinnt.
- **Files modified:** frontend/package.json, frontend/package-lock.json
- **Commit:** c7008bc

### Sonstige Abweichungen

- **Ein Commit pro Task statt ein Commit pro Plan (D-02):** Der Orchestrator verlangt atomare Task-Commits.
- **Login-Überschrift:** `h1` mit `type-large-title` statt `CardTitle` mit Override. `tailwind-merge` kennt `type-*` nicht, `cn('type-headline', 'type-large-title')` behält beide Klassen. Außerdem hatte die Seite vorher kein `h1`.
- **Link „Zur Profilauswahl“** in `text-ink` statt `text-ink-soft`. Er steht direkt auf dem Backdrop, `ink-soft` auf `backdrop-blue` läge bei etwa 4,1:1 (eigene Rechnung, kein axe-Beleg).
- **`roundPrimary` ohne eigene Größe:** DESIGN.md nennt 52 px, die Größe `icon` ergibt 48 px. Eine eigene Größe kommt mit dem ersten Verbraucher (Quiz-Senden).

## Issues Encountered

- `npm install` warnt, dass `fsevents@2.3.3` ein Install-Skript hat, das nicht über `allowScripts` erfasst ist. Das ist eine bestehende optionale macOS-Abhängigkeit, keine der neuen Pakete.

## Offene Punkte

- **Review durch Subagent (AGENTS.md „Review“, Plan-Verification) nicht erfolgt.** Diesem Executor steht kein Subagent-Werkzeug zur Verfügung. Das Review muss der Orchestrator gegen DESIGN-01 und den Diff `0b49bf2..c7008bc` anstoßen.
- DESIGN-01 und QUAL-02 sind nur zum Teil erfüllt (Login-Seite und Werkzeug). Die übrigen Seiten stellen 01-03 und 01-04 um, deshalb steht in `requirements-completed` nichts.
- `tailwind-merge` kennt `type-*` nicht. Wer in 01-03/01-04 eine Schriftstufe per `className` überschreiben will, braucht `extendTailwindMerge` in `src/lib/utils.ts` oder muss das Override vermeiden.
- `Progress` ohne `label` hat keinen zugänglichen Namen (wie vorher). Die Aufrufer setzen ihn in 01-03 und 01-04.
- Manuelle Prüfung am Ende der Phase: Glas auf einem günstigen Tablet, 200 % Zoom auf /login.

## Next Phase Readiness

- `checkPage(page)` und der Teststack sind für weitere e2e-Specs bereit.
- `npm run design:classes` über ganz `src` ist erst nach 01-04 grün.

## Self-Check: PASSED

- FOUND: frontend/src/design-tokens.css, frontend/playwright.config.ts, frontend/e2e/docker-compose.e2e.yml, frontend/e2e/axe.ts, frontend/e2e/login.spec.ts, frontend/scripts/design-classes.mjs, frontend/src/components/ui/misc.test.tsx, frontend/src/test/setup.ts
- FOUND: 35ebf24, c7008bc (Vorfahren von HEAD)

## Review (Subagent, 2026-10-16) und Nachbesserung

Urteil NACHBESSERN, behoben vom Orchestrator:
- MAJOR: `expectGlassContrast` liess nicht gemessenen Kontrast (`incomplete`) still durch. Jetzt scheitert jeder `incomplete`-Knoten ausser `bgGradient` (getoente Buttons, Kontrast per Token belegt).
- MINOR: SUMMARY nannte den Fallback-Test für alle sieben Glas-Utilities; korrigiert.
- MINOR: DESIGN.md an Code angeglichen (Lichtkante ohne Verlaufsrand, `note-error` mit `body-md-strong`); `design.md diff` ohne Regression.
- MINOR: Fokusring in `primary-deep` statt `primary` (gegen `backdrop-blue` 2,94:1 → ca. 3,7:1, WCAG 1.4.11).

Als Übergangsschuld an 01-03/01-04 übergeben (nicht hier geändert): doppelter Innenabstand durch `Card p-6` plus `CardContent pt-5/py-*` in den alten Seiten, gewachsene Button-Höhen, Blur auf jeder Ziffern-Taste in `ProfilePickerPage.tsx`, `bg-success-soft` gegen `glass` in `LearnHomePage.tsx:112`.
Bewusst offen: Button-Variante `round` ist identisch mit `secondary`; beim ersten Nutzer unterscheiden oder streichen.
