---
task: 261022-q7a
phase: quick-261022-q7a
plan: "01"
subsystem: learning, manage-ui, startup, docs
tags: [antwortbewertung, csv-import, kodierung, migration, logging]
status: complete
date: 2026-10-22
requirements_completed: []
requirements_touched: []
key-files:
  created:
    - backend/tests/WordQuest.Api.Tests/StartupLogTests.cs
  modified:
    - backend/src/WordQuest.Modules.Learning/Services/TextNormalizer.cs
    - backend/tests/WordQuest.Learning.Tests/AnswerEvaluatorTests.cs
    - .claude/skills/vokabel-csv/SKILL.md
    - frontend/src/features/manage/SetDetailPage.tsx
    - frontend/src/features/manage/SetDetailPage.test.tsx
    - backend/src/WordQuest.Api/Program.cs
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/STATE.md
decisions:
  - "„?“ am Antwortende zaehlt wie „.“ und „!“ nicht als Abweichung, beide Seiten (Dennis, 2026-10-22)"
  - "CSV-Datei-Wahl erkennt UTF-16 am BOM (FF FE → LE, FE FF → BE) vor dem UTF-8-Versuch (Dennis, 2026-10-22)"
  - "Erster Start: Migrationshistorie vor OrphanCleanup/MigrateAsync per IHistoryRepository.CreateIfNotExistsAsync anlegen statt Log-Filter; echte SQL-Fehler bleiben fail:"
metrics:
  started: 2026-10-22T10:12:14Z
  completed: 2026-10-22T10:30:00Z
actuals:
  tokens: 4200  # chars/4 ueber den eigenen Diff (9 Dateien, +160/-9 Zeilen)
  tasks: 4
  commits: 5  # gemessen 8f2c579..def3519; davon 3 aus diesem Quick, 2624997 und def3519 (docs 03.1.1) aus der parallelen Planer-Sitzung
plan_head_before: 8f2c579fb1ec4b87e0d2df490d778aad09b3eef3
plan_head_after: def3519940f5fadd68121282344397244c83d45b
---

# Fragezeichen, UTF-16-Import, ruhiger erster Start

Drei unabhängige Entscheidungen von Dennis (2026-10-22), je ein Commit.

## A. „?“ am Antwortende ignorieren (4bd3fc1)

- `TextNormalizer.Normalize` (Zeile 66) entfernt am Ende jetzt „.“, „!“, „?“
  und Leerzeichen. Gegebene und erwartete Antwort laufen beide hindurch, damit
  gilt es für beide Richtungen.
- **Andere Aufrufer:** `grep -rn "TextNormalizer\|\.Normalize(" backend/src`
  findet `Normalize` nur in `AnswerEvaluator.cs:40` (gegebene Antwort) und
  `:122`/`:133` (Kandidaten aus Primär- und Alternativantwort). Kein anderer
  Aufrufer, kein Frontend-Vergleich. Einzige Nebenwirkung: Eine Vokabel, die
  nur aus „?“ besteht, ergibt einen leeren Kandidaten und wird übersprungen –
  wie bisher schon „.“ oder „!“.
- Konzept §6.4 nennt „.“, „!“ und „?“. `SKILL.md` „Grenzen“ sagt jetzt, dass
  die App die drei Zeichen am Ende ignoriert. `check-csv.mjs` prüft „?“ nicht
  (einzige „?“-Fundstelle ist ein Regex `\r?\n`), keine Änderung.

## B. UTF-16 im CSV-Import (0eb9275)

- `decodeCsv` (`SetDetailPage.tsx:31`): erste zwei Bytes `FF FE` →
  `TextDecoder('utf-16le')`, `FE FF` → `utf-16be`; der Decoder entfernt den BOM
  selbst. Sonst unverändert UTF-8 strikt, dann windows-1252.
- Vitest: „Löwe;lion“ in UTF-16LE und UTF-16BE (Teil des bestehenden
  `it.each`), dazu Excel „Unicode-Text“ als UTF-16LE mit Tab und CRLF
  (`vokabeln.txt`) bis zum Textfeld `Löwe\tlion\nHund\tdog\n` und zur
  Statusmeldung. Der Server-Parser erkennt Tab als Trenner schon
  (`CsvVocabularyParser.cs:30`).
- Konzept M2 ergänzt. Keine sichtbare UI-Änderung.

## C. Keine `fail:`-Zeilen beim ersten Start (0c52f8f)

**Ursache (Quellcode, nicht Doku):** Bei leerer, aber vorhandener Datenbank
lesen zwei Stellen die noch fehlende `__EFMigrationsHistory`:

1. `OrphanCleanup.RunAsync` → `GetAppliedMigrationsAsync`.
2. `NpgsqlMigrator.MigrateAsync` (Npgsql.EntityFrameworkCore.PostgreSQL
   v10.0.3, `src/EFCore.PG/Migrations/Internal/NpgsqlMigrator.cs`) ruft
   `GetAppliedMigrationsAsync` **vor** `base.MigrateAsync` auf, um danach zu
   entscheiden, ob Typen neu geladen werden.

`NpgsqlHistoryRepository.GetAppliedMigrationsAsync` (v10.0.3) fängt
`UndefinedTable` ab und gibt `[]` zurück, aber `RelationalCommand` hat die
Abfrage vorher schon als `CommandError` (20102, Error) geloggt. EF Cores
`Migrator.MigrateAsync` (v10.0.12, `Migrator.cs:252`) legt die Tabelle per
`CreateIfNotExistsAsync` erst danach an.

**Lösung:** `Program.cs` legt die Historie vor `OrphanCleanup` selbst an –
derselbe Aufruf, den `MigrateAsync` ohnehin als Erstes macht:
`IHistoryRepository.CreateIfNotExistsAsync()`, nur wenn
`IRelationalDatabaseCreator.ExistsAsync()` (fehlt die Datenbank, legt
`MigrateAsync` sie wie bisher an). Kein Log-Filter, also bleiben alle anderen
SQL-Fehler `fail:`. Keine neue Dependency. Beide Aufrufe laufen in der
Execution-Strategy (`MigrationCommandExecutor.cs:186` EF 10.0.12,
`NpgsqlDatabaseCreator.cs:219` v10.0.3).

Verworfen: Log-Filter nur während `Migrate()` (globaler Zustand im Logging,
mehr Code) und eine Prüfung nur in `OrphanCleanup` (ausprobiert, ließ die
zweite Zeile aus `NpgsqlMigrator` stehen).

**Belege:**
- `StartupLogTests` (Api.Tests): Datenbank per
  `IRelationalDatabaseCreator.CreateAsync` leer angelegt, Logger-Provider über
  `TestServices`; Start → keine Einträge ab Error. Gegentest:
  `SELECT * FROM gibt_es_nicht` im laufenden Host → Error-Eintrag der Kategorie
  `Microsoft.EntityFrameworkCore.Database.Command`.
- Install-Smoke gibt den API-Log des ersten Starts aus und bricht bei
  `fail:`/`crit:` ab (`STARTLOG OK`, Log unten).
- Konzept (Zielbild Erstinstallation) nennt das Verhalten.

## Rot-Beleg

| Teil | Befehl | Rot | Grund | Grün |
|---|---|---|---|---|
| A | `backend-test.sh 'FullyQualifiedName~AnswerEvaluatorTests'` | 4 failed, 26 passed | `Assert.False() Failure Expected: False Actual: True` (HadTypo, Fehlen des „?“ als Tippfehler gewertet) | `…~WordQuest.Learning.Tests`: 148 passed |
| B | `npx vitest run src/features/manage/SetDetailPage.test.tsx` | 3 failed, 85 passed | `expected 'ÿþL\u0000ö\u0000w…' to be 'Löwe;lion'` (UTF-16 als windows-1252 gelesen) | 88 passed |
| C | `backend-test.sh 'FullyQualifiedName~StartupLogTests'` | 2 failed, 0 passed | Test 1: `Assert.Empty() Failure`, zwei Einträge `Failed executing DbCommand … SELECT "MigrationId", "ProductVersion" FROM "__EFMigrationsHistory"`; Test 2: Testfehler (`DbContextOptions` aus dem Root-Provider), behoben mit eigenem Scope – er ist ein Gegentest und soll vor und nach dem Fix grün sein | `…~StartupLogTests\|…~MigrationTests`: 5 passed |

## Gate (Code-Stand 0c52f8f; danach nur `.planning/` der Planer-Sitzung)

- Backend (`backend-test.sh`, SDK-Container): Build Release `/warnaserror`
  0 Warnungen, 0 Fehler; Learning.Tests **148 passed**, Api.Tests **277 passed**.
- Frontend: `npm ci`, lint, typecheck, build grün; vitest **267 passed**
  (15 Dateien; vorher 264, +3); `design:check` errors 0, warnings 0;
  `design:classes` „keine alten Klassen“.
- e2e mit axe (`npm run e2e:stack && npm run e2e`): **56 passed, 1 skipped**
  (first-run nur in den Smokes), darunter „Set-Detail: axe 0, Fokus nicht
  verdeckt“ und „CSV-Import: Datei wählen, Vorschau“ (`checkPage` auf der
  Set-Detailseite). Stack danach mit `down -v` entfernt.
- Install-Smoke `setup-smoke.sh`: **SMOKE OK**, Exit 0, neu `STARTLOG OK`.
  API-Log des ersten Starts (gekürzt auf die Kategorien):
  `info: Migrations[20402]` ×2 (Initial, ReferentialIntegrity),
  `info: Startup` „Datenbankschema ist aktuell.“, `warn: DataProtection` ×2,
  `info: Hosting.Lifetime` ×4. Kein `fail:`.

## Barrierefreiheit

Teil B ändert nichts Sichtbares außer dem Textfeldinhalt. axe auf der
Set-Detailseite über die e2e-Läufe oben (0 Verstöße, auch mit geöffnetem Import
und eingelesener Datei). Kein neuer Tastatur-/Zoom-Durchgang: keine neue oder
geänderte Bedienung.

## Review (`claude -p`, nur lesend, gegen die Kriterien und `8f2c579..HEAD` ohne 03.1.1)

Ergebnis: kein HIGH/MEDIUM, A/B/C erfüllt.

| # | Schwere | Befund | Behandlung |
|---|---|---|---|
| 1 | LOW | `ExistsAsync`/`CreateIfNotExistsAsync` außerhalb der Execution-Strategy, Wiederholung bei kurzem Verbindungsfehler unklar | zurückgewiesen mit Beleg: beide wickeln sich selbst in die Strategy (`MigrationCommandExecutor.cs:186` EF 10.0.12, `NpgsqlDatabaseCreator.cs:219` Npgsql v10.0.3) |
| 2 | LOW | Rot-Beleg des Starttests nicht im Diff | belegt (Tabelle oben: 2 Einträge vor dem Fix) |
| 3 | INFO | Start ohne Datenbank: Log nicht geprüft | belassen: Verhalten unverändert, Compose legt die Datenbank immer an; außerhalb des Kriteriums |
| 4 | INFO | Einschränkung „nur wenn Datenbank existiert“ nur im Code-Kommentar | belassen, Reviewer hält die Doku für ausreichend |
| 5 | INFO | Gate vom Reviewer nicht ausgeführt | Gate oben grün |

## Deviations from Plan

**1. [Rule 1 - Bug] Gegentest C rief einen Scoped-Dienst aus dem Root-Provider ab**
– Testfehler im ersten Rot-Lauf, behoben mit `CreateAsyncScope` vor dem Commit.

**2. Erster Lösungsversuch C verworfen** – Prüfung `ExistsAsync`/`HasTablesAsync`
in `OrphanCleanup` ließ eine `fail:`-Zeile stehen (gemessen); Ursache
`NpgsqlMigrator`, siehe oben. Änderung zurückgenommen, nicht committet.

## Offen

- Der erste Start loggt weiter zwei `warn:` von DataProtection (Schlüssel nur im
  Container, unverschlüsselt). Nicht Teil des Auftrags; ob das für Eltern stört,
  entscheidet Dennis.
- Tag-Kandidat fe24d8b enthält p4z, v4n, fke, cb3 und q7a nicht. Kein Push, kein Tag.
- Parallele Sitzung: 2624997 und def3519 (docs 03.1.1) liegen zwischen den
  Commits dieses Quicks; nicht angefasst. Untracked `.planning/milestone.lock`,
  `.planning/state.json`, `.planning/phases/03.1.1-vocabulary-pictures/.gitkeep`
  stammen nicht von hier.

## Self-Check: PASSED

Dateien vorhanden (StartupLogTests.cs, SUMMARY, PLAN); Commits 4bd3fc1, 0eb9275,
0c52f8f sind Vorfahren von HEAD.
