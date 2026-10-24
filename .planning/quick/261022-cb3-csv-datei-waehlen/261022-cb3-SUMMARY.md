---
task: 261022-cb3
phase: quick-261022-cb3
plan: "01"
subsystem: manage-ui, docs
tags: [csv-import, datei, kodierung, a11y]
status: complete
date: 2026-10-22
requirements_completed: []
requirements_touched: []
key-files:
  modified:
    - frontend/src/features/manage/SetDetailPage.tsx
    - frontend/src/features/manage/SetDetailPage.test.tsx
    - frontend/e2e/manage.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/STATE.md
decisions:
  - "CSV-Import: „Datei wählen“ liest .csv/.txt im Browser ins Textfeld; API unveraendert (Dennis, 2026-10-22)"
  - "Grenze 1 MB (1024 × 1024 Bytes), vor dem Lesen geprueft"
  - "Kodierung strikt UTF-8, sonst windows-1252; UTF-16 nicht erkannt (offen fuer Dennis)"
metrics:
  started: 2026-10-22T09:23:02Z
  completed: 2026-10-22T09:40:00Z
actuals:
  tokens: 6600
  tasks: 3
  commits: 9  # gemessen 01a41a3..99b99b6; davon 8 aus diesem Quick, 4f95562 (docs 03.1.1) aus einer parallelen Sitzung
plan_head_before: 01a41a336491b7bb5c3af5470b1a7592c2c70635
plan_head_after: 99b99b6e517ce6ec58bd522bd193df558bacd56a
---

# CSV-Import: Datei wählen

Eltern können im Import („Liste importieren (CSV)“) eine Datei wählen, statt
Text einzufügen. Der Browser liest sie ins vorhandene Textfeld, danach laufen
Vorschau und Übernehmen wie bisher. Backend und API sind unverändert.

## Umsetzung

- `SetDetailPage.tsx` `ImportPanel`: verstecktes natives
  `<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden>`, ausgelöst
  über den vorhandenen `Button` (`secondary`, 60 px, globaler Fokusring, Icon
  `FileUp` aus dem installierten `lucide-react`). Kein neues Primitive.
- `decodeCsv` (Zeile 30): `TextDecoder('utf-8', { fatal: true })`, bei Fehler
  `windows-1252`. Den BOM entfernt der UTF-8-Decoder selbst (`ignoreBOM` false).
- Größe wird vor dem Lesen geprüft (`file.size`), danach `file.arrayBuffer()`.
- Meldungen: Erfolg als `SuccessNote` (role=status) „Die Datei „<Name>“ ist
  eingelesen.“, Fehler als `ErrorNote`. Eine neue Eingabe oder Dateiwahl nimmt
  alte Meldungen und Fehler aus Vorschau/Import weg.
- Leere Datei: Textfeld leer, „Vorschau“ gesperrt, keine Meldung (wie leeres Feld).
- Während des Lesens sind Textfeld, „Vorschau“ und „Übernehmen“ gesperrt
  (`busy`), „Datei wählen“ nicht, damit der Fokus bleibt.
- Hinweistext nennt „Datei wählen“; Konzept M2 und Grenzen „Uploads“ präzisiert.

**Grenze 1 MB:** Eine Vokabelliste hat Hunderte Zeilen zu je rund 20 Bytes
(„Hund;dog“), also wenige KB; 1 MB entspricht rund 50 000 Zeilen. Die Grenze
fängt nur Fehlgriffe ab (Foto, PDF, falscher Export), bevor sie gelesen werden,
das Textfeld lahmlegen und als Megabyte-Text an die API gehen (deren
Größenlimit ist offen, `OPS2-03`). Gerechnet als 1024 × 1024 Bytes.

## Rot-Beleg

| Befehl | Rot | Grund | Grün |
|---|---|---|---|
| `npx vitest run src/features/manage/SetDetailPage.test.tsx` (b789e99) | 8 failed, 75 passed | `Unable to find an accessible element with the role "button" and name "Datei wählen"` | 83 passed (1fdf6c9) |
| dto. (c82264a, Review-Befunde 1/2) | 2 failed, 83 passed | `expected false to be true` („Vorschau“ während des Lesens nicht gesperrt); `expected [ …(2) ] to deeply equal [ Array(1) ]` (zwei Alerts) | 85 passed (f5a0db9) |
| dto. (c94909b, Fokus-Befund aus dem Tastatur-Durchgang) | 1 failed, 84 passed | `expected true to be false` („Datei wählen“ während des Lesens gesperrt) | 85 passed (99b99b6) |

## Gate (auf 99b99b6)

- Frontend: `npm ci`, lint, typecheck, build grün; vitest **264 passed**
  (15 Dateien; vorher 254, +10); `design:check` errors 0, warnings 0;
  `design:classes` „keine alten Klassen“.
- e2e mit axe (`npm run e2e:stack && npm run e2e`): **56 passed, 1 skipped**
  (first-run nur in den Smokes), darunter neu „CSV-Import: Datei wählen,
  Vorschau“ (`setInputFiles` mit Windows-1252-Datei, Textfeld „Löwe…“,
  Statusmeldung, Vorschau „1 erkannt“, `checkPage`: axe, Glas-Kontrast je
  Backdrop, Opaque-Fallback, Reflow). Stack danach mit `down -v` entfernt.
- Install-Smoke `setup-smoke.sh`: SMOKE OK (first-run 1 passed), Exit 0.
- Backend unberührt, nicht gebaut.

## Barrierefreiheit

Playwright-Skript (`$TMPDIR/cb3/cb3-a11y.cjs`, `@axe-core/playwright`, Tags
wcag2a/aa, 21a/aa, 22aa) gegen den e2e-Stack, 1280×720 und 200 %
(640×360, Skalierung 2), Set-Detailseite mit geöffnetem Import:

- axe 0 Verstöße in beiden Stufen: Import offen, Datei eingelesen, Vorschau.
- „Datei wählen“ 190×60 px; Tab-Folge ab „Import schließen“: Datei wählen →
  Textfeld → Hund bearbeiten → Hund löschen (gesperrte Buttons übersprungen),
  jede Station `solid 3px` Fokusring.
- Enter auf „Datei wählen“ öffnet den Dateidialog (`filechooser`, accept wie
  verlangt); nach dem Einlesen Status „Die Datei „vokabeln.csv“ ist
  eingelesen.“, Fokus bleibt auf „Datei wählen“ (vor 99b99b6: body).
- Kein waagrechtes Scrollen in beiden Stufen.
- Screenshots: `$TMPDIR/cb3/shots/1280-fokus.png`, `zoom200-fokus.png`,
  `1280-vorschau.png`, `zoom200-vorschau.png` (nicht im Repo).

## Review (`claude -p`, nur lesend, gegen die Kriterien und `01a41a3..HEAD`)

| # | Schwere | Befund | Behandlung |
|---|---|---|---|
| 1 | LOW | Wettlauf: „Vorschau“ des alten Textes startbar, während die Datei gelesen wird; „Übernehmen“ nähme danach die alten Zeilen | behoben (c82264a/f5a0db9): `reading` gehört zu `busy`, „Vorschau“/„Übernehmen“/Textfeld gesperrt |
| 2 | LOW | Dateifehler und alter Vorschau-/Importfehler stehen gleichzeitig | behoben (c82264a/f5a0db9): Dateiwahl setzt beide Mutationen zurück |
| 3 | LOW | Excel „Unicode-Text (*.txt)“ ist UTF-16LE und kommt als Zeichensalat an | nicht umgesetzt: AK 2 legt UTF-8 → windows-1252 fest; als Frage an Dennis (unten) |
| 4 | INFO | 1 MB ist 1 MiB | belassen, für Eltern üblich; oben begründet |
| 5 | INFO | Leere Datei überschreibt eingefügten Text ohne Hinweis | belassen: AK 3 („wie leeres Textfeld“) |
| 6 | INFO | Testlücken: dieselbe Datei erneut, Wettlauf, Tastatur, 200 % | Wettlauf jetzt getestet; Tastatur/200 % per Skript belegt; „dieselbe Datei erneut“ zurückgewiesen: jsdom setzt `files` direkt, der `value`-Reset ist dort nicht prüfbar |
| 7 | INFO | e2e-Test lag beim Review nur im Arbeitsbaum | committet (18431eb), e2e grün |

Die Fixes nach dem Review (f5a0db9, 99b99b6) liefen nicht durch ein zweites
Review; belegt durch Vitest, e2e und Tastatur-Durchgang.

## Deviations from Plan

**1. [Rule 1 - Bug] Fokusverlust nach dem Einlesen** – Fund im Tastatur-Durchgang:
der Fix zu Review-Befund 1 sperrte auch „Datei wählen“, der fokussierte Button
gab den Fokus an body ab. „Datei wählen“ ist jetzt nur während Vorschau/Import
gesperrt (c94909b, 99b99b6).

**2. Nebenwirkung von `busy`:** „Vorschau“ ist jetzt auch während „Übernehmen“
läuft gesperrt und umgekehrt (vorher nur je eigener Lauf). Bestandstests grün.

## Offen

- Frage an Dennis: UTF-16 (Excel „Unicode-Text“) zusätzlich erkennen? Wäre
  eine BOM-Prüfung `FF FE` vor dem UTF-8-Versuch.
- Keine Anforderungs-ID für die Datei-Wahl in `REQUIREMENTS.md` (Entscheidung
  Dennis 2026-10-22, M2 im Konzept).
- Parallele Sitzung auf `v1-fertig`: 4f95562 (docs 03.1.1) liegt zwischen den
  Commits dieses Quicks; nicht angefasst. Untracked `.planning/milestone.lock`,
  `.planning/state.json`, `.planning/phases/03.1.1-vocabulary-pictures/.gitkeep`
  stammen nicht von hier.
- Tag-Kandidat fe24d8b enthält p4z, v4n, fke und cb3 nicht. Kein Push, kein Tag.

## Self-Check: PASSED
