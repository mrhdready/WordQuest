---
task: 261021-v4n
phase: quick-261021-v4n
plan: "01"
subsystem: auth-ui, manage-ui, docs
tags: [pin, kinder-anmeldung, PAR-02, FIX-08]
status: complete
date: 2026-10-21
requirements_completed: []
requirements_touched: [PAR-02, FIX-08, PAR-01, PAR-05]
key-files:
  modified:
    - frontend/src/features/auth/ProfilePickerPage.tsx
    - frontend/src/features/auth/ProfilePickerPage.test.tsx
    - frontend/src/features/manage/ChildFormPage.tsx
    - frontend/src/features/manage/ChildFormPage.test.tsx
    - frontend/e2e/learn.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
decisions:
  - "„Los geht’s“ auf der Kinder-PIN-Anmeldung entfaellt; Warten sagt die bestehende Statuszeile an (Dennis, 2026-10-21)"
  - "PIN-Felder der Eltern nehmen hoechstens 4 Zeichen an (maxLength=4)"
  - "Keine Altbestand-Hinweise zu 5-/6-stelligen PINs: die Software war nie ausgebracht"
metrics:
  started: 2026-10-21T19:45:21Z
  completed: 2026-10-21T20:15:00Z
actuals:
  tokens: 6000
  tasks: 4
  commits: 5  # gemessen bis plan_head_after, ohne den Abschluss-Commit
plan_head_before: 5369d1ef238bb69e58a7b480c9b1e47b24a7b6c4
plan_head_after: e00a013574d86eb22a757638c7f296329e8bc7e6
---

# PIN-Anmeldung ohne „Los geht’s“, Eltern-PIN-Felder auf 4 Zeichen

Folge von 261021-p4z. Die Kinder-Anmeldung hat keinen Absende-Button mehr; die
vierte Ziffer sendet ab, die bestehende Statuszeile (`role="status"`, sr-only)
sagt währenddessen „Einen Moment …“. „PIN“ und „Neue PIN“ nehmen höchstens
4 Zeichen an. Konzept und PAR-02 ohne Hinweise auf 5-/6-stellige Alt-PINs.

## Umsetzung

- `ProfilePickerPage.tsx`: Button entfernt; Statuszeile zeigt bei `busy`
  „Einen Moment …“, sonst wie bisher (leer nach Fehler, „n Ziffern eingegeben“).
  Die Tasten bleiben während der Anmeldung gesperrt (sichtbar abgeblendet).
- `ChildFormPage.tsx`: `maxLength={4}` neben `inputMode="numeric"`.
- Formular-Matrix: Fälle 5 und 6 Ziffern entfernt (beide Formulare), „PIN mit
  Leerzeichen“ auf `'12 4'` (sonst kürzt die Begrenzung den Fall weg); neu je
  Formular: Tippen von „123456“ ergibt „1234“ im Feld und im Request.
  Server-Tests 5/6 Ziffern → 400 unverändert.
- e2e `learn.spec.ts`: „Los geht’s“ auf dem Ziffernfeld `toHaveCount(0)` statt gesperrt.
- Doku: Konzept §Kinder-Login ohne „vorher 4–6“ und ohne Migrationssatz, dafür
  Statuszeile und Feldbegrenzung; PAR-02 ohne Migrationshinweis; STATE.md-Eintrag
  von p4z ohne „keine Migration“.

## Rot-Belege

| Bereich | Befehl | Rot | Grund | Grün |
|---|---|---|---|---|
| Anmeldung | `npx vitest run src/features/auth/ProfilePickerPage.test.tsx` | 2 failed, 3 passed | Button „Los geht’s“ vorhanden; Status „4 Ziffern eingegeben“ statt „Einen Moment …“ | 5 passed |
| Formulare | `npx vitest run src/features/manage/ChildFormPage.test.tsx` | 2 failed, 65 passed | `maxLength` -1 statt 4 | 67 passed |

## Gate

- Backend (`backend-test.sh`, SDK-Container, eigenes PostgreSQL wq-p2): Build
  `/warnaserror` 0 Warnungen, 0 Fehler; Learning.Tests 144 passed, Api.Tests 275 passed.
- Frontend: `npm ci`, lint, typecheck, build grün; vitest 253 passed (15 Dateien;
  vorher 255: −4 Matrixfälle, +2 neue); `design:check` errors 0, warnings 0;
  `design:classes` „keine alten Klassen“.
- e2e mit axe (`npm run e2e:stack && npm run e2e`): 55 passed, 1 skipped
  (first-run nur in den Smokes). Darunter axe 0 in „Anmeldung per Tastatur“
  (Profilwahl, Ziffernfeld), „Kinder barrierefrei“ (Kind anlegen),
  „Kind bearbeiten barrierefrei“. Stack danach mit `down -v` entfernt.
- Install-Smoke `setup-smoke.sh`: SMOKE OK (first-run 1 passed).
- Release-Smoke `release-smoke.sh`: erster Lauf rot nach bestandenem first-run:
  `GET /api/v1/learners: HTTP 000` direkt nach der Sicherung S1 (keine
  HTTP-Antwort, Load 21–27). Der Schritt berührt keinen geänderten Code; zweiter
  Lauf RELEASE-SMOKE OK (first-run 1 passed). Roter Installationsordner gelöscht.
- Beide Smokes melden das Kind per Tastatur an (`first-run.spec.ts:52-57`,
  vierte Ziffer sendet ab); deren „Los geht’s“ (`first-run.spec.ts:66`,
  `children.spec.ts:111`) ist der Start-Button der Lern-Startseite
  (`LearnHomePage.tsx:136`), nicht die Anmeldung.

## Barrierefreiheit

Playwright-Skript (Scratch, axe-core 4.13, wcag2a/aa, 21a/aa, 22aa, vor axe ans
Seitenende gescrollt wie `checkPage`) gegen den e2e-Stack, 1280×720 und 200 %
(640×360, Skalierung 2):

- axe 0 Verstöße auf Ziffernfeld, Kind anlegen, Kind bearbeiten, beide Stufen;
  kein waagrechtes Scrollen.
- Ziffernfeld: 0 Buttons „Los geht’s“. Tab: 1–9, 0, „Letzte Ziffer löschen“,
  (Seitenende), „Zurück zur Profilwahl“; jede Station 3 px Fokusring.
- Verzögerte Anmeldung (800 ms): Statuszeile „Einen Moment …“, Tasten gesperrt,
  danach angemeldet.
- Kind anlegen: Tab Abmelden, Alle Kinder, Name, Neue Karten pro Tag, PIN (3 px
  Ring); Tippen von „123456“ ergibt „1234“. Kind bearbeiten: bis „Änderungen
  speichern“, „987654“ ergibt „9876“.
- Ohne Scrollen ans Seitenende meldet axe bei 1280×720 auf „Kind anlegen“
  `target-size` am Button, den die schwebende Tab-Leiste überdeckt. Unabhängig
  von diesem Diff; `checkPage` (`e2e/axe.ts:143-147`) dokumentiert genau diese
  Scrolllage als Messkonvention.

## Review (`claude -p`, nur lesend, gegen die Kriterien und `5369d1e..HEAD`)

| # | Schwere | Befund | Behandlung |
|---|---|---|---|
| 1 | LOW | Sehende sehen kein „Einen Moment …“ mehr, nur abgeblendete Tasten | zurückgewiesen: Kriterium 1 verlangt den Wartezustand für Screenreader; sichtbare Anzeige wäre eine eigene UI-Entscheidung (Frage an Dennis) |
| 2 | LOW | `STATE.md:165` „keine Migration 5-/6-stelliger PINs“, `:179` Frage offen; SUMMARY fehlt | behoben im Abschluss-Commit |
| 3 | INFO | Warte-Ansage nur im Unit-Test, nicht e2e | belassen; Scratch-Skript belegt sie im Browser |
| 4 | INFO | 5./6. getippte Ziffer wird still verworfen | belassen; Hinweis „Genau 4 Ziffern“ steht am Feld, gewünschtes Verhalten |
| 5 | INFO | Gate nicht vom Reviewer ausgeführt | Gate oben |

## Deviations from Plan

1. `.planning/ROADMAP.md:40` („PIN 4–6“ bei Plan 01-04) bleibt: Eintrag eines
   abgeschlossenen historischen Plans, kein Altbestand-Hinweis.
2. Der STATE.md-Entscheidungseintrag von 261021-p4z wurde gekürzt (Review-Befund 2).

## Offen

- Frage an Dennis: sichtbare Warteanzeige auf der Kinder-Anmeldung (Review 1)?
- Tag-Kandidat fe24d8b enthält weder p4z noch diese Änderung. Kein Push, kein Tag.

## Self-Check: PASSED
