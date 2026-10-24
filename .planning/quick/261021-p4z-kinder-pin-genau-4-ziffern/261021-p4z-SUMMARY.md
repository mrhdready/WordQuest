---
task: 261021-p4z
phase: quick-261021-p4z
plan: "01"
subsystem: identity, auth-ui, manage-ui
tags: [pin, kinder-anmeldung, PAR-02, FIX-08]
status: complete
date: 2026-10-21
requirements_completed: []
requirements_touched: [PAR-02, FIX-08, PAR-01, PAR-05]
key-files:
  modified:
    - backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - frontend/src/features/auth/ProfilePickerPage.tsx
    - frontend/src/features/manage/ChildFormPage.tsx
    - frontend/e2e/learn.spec.ts
    - frontend/e2e/children.spec.ts
    - frontend/e2e/first-run.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/REQUIREMENTS.md
decisions:
  - "Kinder-PIN genau 4 Ziffern, Auto-Absenden mit der vierten Ziffer (Dennis, 2026-10-21)"
  - "Keine Migration bestehender 5- bis 6-stelliger PINs (keine echten Installationen)"
  - "Enter auf einer fokussierten Ziffern-Taste wird verworfen, Leertaste bedient sie"
  - "\"Los geht’s\" bleibt als dauerhaft gesperrte Warteanzeige"
metrics:
  started: 2026-10-21T18:32:36Z
  completed: 2026-10-21T19:25:00Z
actuals:
  tokens: 7000
  tasks: 4
  commits: 12  # gemessen bis plan_head_after, ohne den Abschluss-Commit
plan_head_before: dbe37dd4b5b461b63c1b9131c9d1095346973740
plan_head_after: b780ab5389bf9d86dfbc52ec125aa11ced13caf9
---

# Kinder-PIN genau 4 Ziffern, Anmeldung mit der vierten Ziffer

Server, Eltern-Formulare und Kinder-Anmeldung kennen nur noch PINs mit genau
4 Ziffern 0–9. Auf der Kinder-Anmeldung sendet die vierte Ziffer (Tippen oder
Tastatur) genau einmal ab; „Los geht’s“ ist nur noch Warteanzeige.

## Annahme

Bestehende PINs mit 5 oder 6 Ziffern werden nicht migriert und nicht mehr
unterstützt, weil es keine echten Installationen gibt. Über das Ziffernfeld
lässt sich eine solche PIN nicht mehr eingeben; ein Elternteil muss eine neue
PIN vergeben. Steht so auch im Konzept (Abschnitt Kinder-Login) und in PAR-02.

## Umsetzung

- `AccountRules.IsValidPin`: `Length: 4`, Ziffern 0–9. Meldungen „Bitte gib
  eine PIN mit 4 Ziffern ein.“ und „Die PIN muss aus genau 4 Ziffern bestehen.“
- `ProfilePickerPage.tsx`: feste 4 Punkte; `press()` sendet beim Erreichen von
  4 Ziffern direkt aus dem Event-Handler ab. PIN und Sperre liegen zusätzlich
  in Refs, damit Tasten im selben Takt weder eine zweite Anfrage noch eine
  fünfte Ziffer erzeugen. Ein Effekt auf `pin` scheiterte an der Lint-Regel
  `react-hooks/set-state-in-effect`. Enter-Zweig und `<form>` entfallen.
  Die Sperre wird nur nach einem Fehler gelöst.
- `ChildFormPage.tsx`: `^[0-9]{4}$`, Hinweise „Genau 4 Ziffern. …“. Kein
  `maxLength`, damit 5 Ziffern die genaue Fehlermeldung zeigen.

## Rot-Belege

| Bereich | Befehl | Rot | Grund | Grün |
|---|---|---|---|---|
| Server | `backend-test.sh 'FullyQualifiedName~AccountRulesTests\|FullyQualifiedName~LearnerEndpointTests'` | 19 failed, 75 passed | 5 und 6 Ziffern angenommen, alte Texte | 94 passed |
| Anmeldung | `npx vitest run src/features/auth/ProfilePickerPage.test.tsx` | 4 failed, 1 passed | kein Auto-Absenden | 5 passed |
| Formulare | `npx vitest run src/features/manage/ChildFormPage.test.tsx` | 17 failed, 52 passed | 5/6 Ziffern angenommen, alte Texte | 69 passed |
| Review-Befund 1 | `npx vitest run src/features/auth/ProfilePickerPage.test.tsx` | 1 failed, 4 passed | Enter auf Taste „1“ ergab „2 Ziffern eingegeben“ | 5 passed |

## Gate (Endstand)

- Backend (`backend-test.sh`, SDK-Container): Build `/warnaserror` 0 Warnungen;
  Learning.Tests 144 passed, Api.Tests 275 passed. Seit diesem Lauf kein
  Backend-Code geändert.
- Frontend: `npm ci`, lint, typecheck, build grün; vitest 255 passed
  (15 Dateien); `design:check` errors 0, warnings 0; `design:classes`
  „keine alten Klassen“.
- e2e mit axe (`npm run e2e:stack && npm run e2e`): 55 passed, 1 skipped
  (first-run läuft nur in den Smokes). Dabei axe 0 auf Profilwahl und
  Ziffernfeld („Anmeldung per Tastatur“), „Kinder barrierefrei“,
  „Kind bearbeiten barrierefrei“. Stack danach mit `down -v` entfernt.
- Install-Smoke `setup-smoke.sh`: SMOKE OK (first-run 1 passed).
- Release-Smoke `release-smoke.sh`: RELEASE-SMOKE OK (first-run 1 passed).

## Barrierefreiheit PIN-Anmeldung

Playwright-Skript gegen den e2e-Stack mit axe 4.13 (wcag2a/aa, 21a/aa, 22aa),
1280×720 und 200 % (640×360, Skalierung 2):

- axe 0 Verstöße auf beiden Stufen, kein waagrechtes Scrollen.
- Tab-Reihenfolge: 1–9, 0, „Letzte Ziffer löschen“, dann „Zurück zur
  Profilwahl“. Jede Station hat einen sichtbaren Fokusring (3 px). Der
  gesperrte Button wird übersprungen.
- 200 %: Der schwebende Button überdeckt keine fokussierte Taste (gemessen für
  1, 4, 7, 9 und 0: 0 px Überdeckung).
- Enter auf der fokussierten „1“ bleibt bei „0 Ziffern eingegeben“, Leertaste
  ergibt „1 Ziffer eingegeben“, die vierte Ziffer meldet an (HTTP 200).

## Review (`claude -p`, nur lesend, gegen die Kriterien und `dbe37dd..HEAD`)

| # | Schwere | Befund | Behandlung |
|---|---|---|---|
| 1 | HIGH | Enter auf der nach einem Fehler fokussierten „1“ klickt sie und kann eine falsche PIN absenden | behoben: roter Test, Enter auf Ziffern-Tasten verworfen, Leertaste bedient sie (2e88ba4, 60f2bbb), e2e prüft das |
| 2 | LOW | Nach Erfolg bis zum Unmount wäre eine zweite Anmeldung möglich | behoben: Sperre nur nach Fehler gelöst (60f2bbb) |
| 3 | LOW | „Los geht’s“ dauerhaft gesperrt, Wartezustand nicht angesagt | zurückgewiesen: Kriterium 2 erlaubt den Button, er zeigt das Warten sichtbar, verdeckt bei 200 % keine fokussierte Taste; Entfernen wäre eine eigene UI-Änderung (offene Frage an Dennis) |
| 4 | LOW | Satzbezug im Konzept nach dem Migrationssatz falsch | behoben (b780ab5) |
| 5 | LOW | `CONCERNS.md` empfahl noch 4–6 Ziffern | behoben (b780ab5) |
| 6 | INFO | `ROADMAP.md:40` nennt „PIN 4–6“ für Plan 01-04 | belassen: historisch |
| 7 | INFO | FIX-08 verliert „Enter“ | Folge der Entscheidung; FIX-08 nennt jetzt „die vierte Ziffer sendet genau einmal ab“ |

## Deviations from Plan

1. [Rule 1 - Bug] Zwei Positivfälle mit 6 Ziffern (`Pin_with_4_to_6_digits_is_accepted`,
   `New_pin_replaces_the_old_one`) fehlten im roten Commit und wurden im
   grünen Commit 8aae465 auf `0000` umgestellt (Testname jetzt
   `Pin_with_exactly_4_digits_is_accepted`).
2. [Rule 1 - Bug] Review-Befunde 1 und 2 (siehe oben).
3. Enter auf einer fokussierten Ziffern-Taste weicht vom üblichen
   Button-Verhalten ab; Leertaste, Tippen und Tastatur-Ziffern bleiben.
   „Zurück“ und „Löschen“ reagieren weiter auf Enter.
4. Zusätzlich angepasst: `.planning/ROADMAP.md` Erfolgskriterium 4 von Phase 1
   und `.planning/codebase/CONCERNS.md`.
5. Historische Phasen-Dokumente unter `.planning/phases/` (4–6 Ziffern,
   D-09 „kein Auto-Absenden“) bleiben unverändert.

## Offen

- Das vorgesehene Tag `v1.0.0` auf fe24d8b enthält diese Änderung nicht.
  Soll sie in 1.0.0 enthalten sein, muss der Tag-Kandidat neu bestimmt werden.
- Frage an Dennis: „Los geht’s“ entfernen (Review-Befund 3)?
- Kein Push, kein Tag.

## Self-Check: PASSED
