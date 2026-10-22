---
task: 261022-fke
phase: quick-261022-fke
plan: "01"
subsystem: auth-ui, docs
tags: [pin, kinder-anmeldung, PAR-02, FIX-08, a11y]
status: complete
date: 2026-10-22
requirements_completed: []
requirements_touched: [PAR-02, FIX-08]
key-files:
  modified:
    - frontend/src/features/auth/ProfilePickerPage.tsx
    - frontend/src/features/auth/ProfilePickerPage.test.tsx
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/STATE.md
decisions:
  - "„Einen Moment …“ waehrend der Kinder-Anmeldung sichtbar, ueber dieselbe Statuszeile (role=status); Ziffernanzahl bleibt sr-only (Dennis, 2026-10-22)"
  - "min-h-lh reserviert die Zeile dauerhaft, damit die Tasten beim Einblenden nicht springen"
metrics:
  started: 2026-10-22T09:12:32Z
  completed: 2026-10-22T09:25:00Z
actuals:
  tokens: 2500
  tasks: 3
  commits: 3  # gemessen bis plan_head_after, ohne den Abschluss-Commit
plan_head_before: cd071f7d1e01544dcc0e666a271e9186ba11a4a4
plan_head_after: c9ac2c0a0408d0de8b5087f0a2a80e42ce528f6c
---

# Sichtbare Warteanzeige auf der Kinder-Anmeldung

Folge von 261021-v4n (Review-Befund 1). Nach der vierten Ziffer steht
„Einen Moment …“ sichtbar unter den Punkten, bis die Anmeldung antwortet.

## Umsetzung

- `ProfilePickerPage.tsx`: Die bestehende Statuszeile ist jetzt
  `<p role="status" className="min-h-lh text-center type-body-md text-ink">`.
  Der Text steht in einem `<span>`, der nur bei `busy` sichtbar ist, sonst
  `sr-only` (Ziffernanzahl bleibt reine Ansage, die Punkte zeigen sie).
  Ein Baustein, eine Live-Region, keine doppelte Ansage.
- `min-h-lh` (Tailwind 4.3.3, `min-height:1lh` im Build belegt) haelt die Zeile
  immer frei; Tokens wie „Gib deine Zahlen ein.“ (`type-body-md text-ink`).
- Konzept §Kinder-Login: Warteanzeige sichtbar, Ziffernanzahl nur angesagt.

## Rot-Beleg

| Befehl | Rot | Grund | Grün |
|---|---|---|---|
| `npx vitest run src/features/auth/ProfilePickerPage.test.tsx` | 1 failed, 5 passed | `ProfilePickerPage.test.tsx:130` `expected <span class="sr-only">… to be null` — „Einen Moment …“ lag in `sr-only` | 6 passed |

## Gate

- Frontend: `npm ci`, lint, typecheck, build grün; vitest 254 passed (15 Dateien,
  vorher 253, +1); `design:check` errors 0, warnings 0; `design:classes` „keine alten Klassen“.
- e2e mit axe (`npm run e2e:stack && npm run e2e`): 55 passed, 1 skipped
  (first-run nur in den Smokes), darunter „Anmeldung per Tastatur“ (axe auf
  Profilwahl und Ziffernfeld) und „Ziffernfeld-Grenzen und falsche PIN“. Stack
  danach mit `down -v` entfernt.
- Install-Smoke `setup-smoke.sh`: SMOKE OK (first-run 1 passed).
- Backend unberührt, nicht gebaut.

## Barrierefreiheit

Playwright-Skript (`$TMPDIR/fke/fke-a11y.cjs`, axe-core über
`@axe-core/playwright`, Tags wcag2a/aa, 21a/aa, 22aa, vor axe ans Seitenende
gescrollt wie `checkPage`) gegen den e2e-Stack, 1280×720 und 200 % (640×360,
Skalierung 2); learner-login per `page.route` bis zur Freigabe zurückgehalten:

- axe 0 Verstöße auf dem Ziffernfeld und während „Einen Moment …“, beide Stufen;
  kein waagrechtes Scrollen.
- Kontrast der Warteanzeige je Backdrop einfarbig (wie `expectGlassContrast`):
  base 14.7, blue 7.45, cyan 11.65, pink 8.97, yellow 12.98; 0 Verstöße, 0 incomplete.
- Kein Springen: Taste „1“ y=322 vor und während des Wartens (beide Stufen).
- Nach falscher PIN „Die PIN stimmt nicht.“, Warteanzeige 0-mal im DOM; nach
  richtiger PIN angemeldet, Ziffernfeld weg.
- Tab: 1–9, 0, „Letzte Ziffer löschen“, (Seitenende), „Zurück zur Profilwahl“;
  jede Station 3 px Fokusring.
- Screenshots: `$TMPDIR/fke/shots/fke-1280-warten.png`, `fke-zoom200-warten.png`,
  `fke-1280-fehler.png`, `fke-zoom200-fehler.png` (nicht im Repo).

## Review (`claude -p`, nur lesend, gegen die Kriterien und `cd071f7..HEAD`)

| # | Schwere | Befund | Behandlung |
|---|---|---|---|
| 1 | INFO | AK 1 und 2 erfüllt, eine Live-Region | — |
| 2 | INFO | AK 3 Tokens/Springen erfüllt; Kontrast nur abgeleitet | Kontrast gemessen (7.45–14.7, oben) |
| 3 | LOW | Zeile ist dauerhaft im Fluss: Ziffernfeld eine Zeile + `gap-4` tiefer, nach Fehler Leerzeile vor der Meldung | belassen: gewollte Reservierung (AK 3); e2e `expectReflow` grün, 200 % ohne waagrechtes Scrollen |
| 4 | LOW | Sichtbarkeit im Vitest nur über die Klasse, kein Browser-Check, axe nie im Wartezustand | zurückgewiesen für den Diff: AK 4 nennt genau diese Prüfung; Browser-Sichtbarkeit und axe im Wartezustand belegt das Skript oben. Kein e2e-Ausbau ohne Auftrag |
| 5 | INFO | `learn.spec.ts` passt weiter, e2e nicht selbst ausgeführt | e2e 55 passed |
| 6 | INFO | Doku stimmt mit dem Code | — |

## Deviations from Plan

None - plan executed exactly as written.

## Offen

- Tag-Kandidat fe24d8b enthält p4z, v4n und fke nicht. Kein Push, kein Tag.

## Self-Check: PASSED
