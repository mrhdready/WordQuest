---
phase: 03-installable-1-0-0-release
plan: 03
subsystem: release
tags: [release, restore, backup, smoke, docs]
status: complete

requires:
  - phase: 03-02
    provides: "Stand nach Cross-Build; release-smoke.sh mit auth_budget, page_cmd, Handgriff-Liste"
provides:
  - "restore.sh (100755): Liste aus backups/ (neueste zuerst, Hardlinks einmal, ohne latest), Auswahl oder Pfad, Prüfung vor jeder Änderung, Bestätigung mit ja, Vorher-Sicherung, Einspielen in neu angelegte DB in einer Transaktion, Rückfall, Start mit restart web"
  - "Release-Smoke: RESTORE OK (echter Lernstand, Fingerabdruck, Sitzungen) und RESTORE-FEHLER OK (Eingaben, fremde Datei, Import-, Lese-, Drop-Fehler, Weg zurück bei fehlender DB)"
  - "Installationsseite: Abschnitt „Sicherung und Wiederherstellung“; README-Betrieb und Konzept §14 auf dem umgesetzten Stand"
affects: [03-04, 03-05]

actuals:
  tokens: 8700
  tasks: 3
  commits: 4
plan_head_before: b068be2ea8b080957a6d0795fad1ba3a28173f04
plan_head_after: 53ff81ed17b7dc96d3b32341f23c4a2443153658

tech-stack:
  added: []
  patterns:
    - "Fehlerweitergabe in Funktionen, die über if/|| laufen: jeder Teilschritt mit || return 1, Einspielstrom mit && und pipefail"
    - "Smoke-Helfer mit Antworten per < <(printf …) statt Pipe, damit der Exit-Code in der aufrufenden Shell landet"
    - "Smoke zählt nur einen Lauf bis zum Ende als Erfolg (SMOKE_DONE), weil Bash 3.2 mit trap EXIT nach ungesetzter Variable Exit 0 meldet"

key-files:
  created:
    - restore.sh
  modified:
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - Documentation/Installation.md
    - README.md
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Vorher-Sicherung nur auf Vollständigkeit geprüft (gzip, Endzeile), nicht auf app_user: auch eine leere DB nach gescheitertem Rückfall muss sich sichern lassen"
  - "Fehlt die DB ganz, legt restore.sh sie vor der Vorher-Sicherung leer an (Review MEDIUM 1)"
  - "DROP DATABASE IF EXISTS, damit der Rückfall nach einem halben Versuch nicht am fehlenden Objekt scheitert"
  - "trap INT TERM nur um das Einspielen: Strg+C lässt die API gestoppt und nennt ./restore.sh <Vorher-Datei>"
  - "REL-02/REL-03 nicht als erledigt markiert, wie in 03-01: 03-05 führt alle vier REL-IDs; A9 (root-eigene Dumps unter Linux) ist Nach-Release-Abnahme"

requirements-completed: []

duration: 33min
completed: 2026-10-18
---

# Phase 3 Plan 03: restore.sh – Zusammenfassung

**`./restore.sh` zeigt die Sicherungen nummeriert, prüft die gewählte Datei, sichert nach `ja` den heutigen Stand nach `backups/vor-wiederherstellung-…` und spielt die Datei in eine neu angelegte Datenbank ein. Scheitert das, ist der Stand von vorher automatisch wieder da; scheitert auch das, bleibt die API gestoppt. Der Release-Smoke belegt das mit echtem Lernstand, allen Fehlerpfaden und dem Weg zurück aus der Meldung. Seite, README und Konzept beschreiben den umgesetzten Stand. Das Plan-Gate ist grün.**

## Leistung

- **Dauer:** ca. 33 min (2026-10-18T11:49Z bis 12:22Z), Smoke-Läufe, Gate und Review eingeschlossen
- **Tasks:** 3 von 3
- **Dateien:** 5 (1 neu, 4 geändert), +466 / −4 Zeilen

## Task-Commits

1. **Task 1: Tracer – gelöschtes Kind kommt mit ./restore.sh zurück** – `e87f85a` (feat)
2. **Task 2: Rückfall bei Import-, Lese- und Drop-Fehler** – `3c5a6aa` (feat)
3. **Review-Befunde** – `b112d24` (fix)
4. **Task 3: Seite, README, Konzept §14, Seitenabgleich** – `53ff81e` (docs)

Vier Commits statt „ein atomarer Commit“ (Plan-Ziel), weil der Ausführungsauftrag atomare Commits je Anliegen verlangt; gleiche Handhabung wie 03-01 und 03-02. Die Review-Fixes sind ein eigener Commit vor der Doku, damit jeder Stand für sich konsistent ist. Kein Push, kein Tag.

## TDD-Belege

**Task 1, rot** (`restore.sh` fehlt): `bash release-smoke.sh` → Exit 1 nach `VERSION OK`, `INSTALL OK`, Erstdurchlauf `1 passed`: `RELEASE-SMOKE FEHLER: restore.sh fehlt oder ist nicht ausfuehrbar.` Lernstand, Token, S1 und Löschen des Kindes liefen davor durch.

**Task 1, grün:** Exit 0 mit `RESTORE OK`, `SEITE OK`, `RELEASE-SMOKE OK`. Beobachtete Liste:
```
  1) backups/daily/wordquest-20261018.sql.gz
  2) backups/last/wordquest-20261018-115819.sql.gz
```
Eintrag 1 hat die Inode des Tagesdumps (im Debug-Lauf `158571632` = `ls -1i backups/daily/…`), keine Inode doppelt, kein `-latest`. Danach: Fingerabdruck = S1, `refresh_token` 0 Zeilen, **Refresh mit Token aus der Sicherung: HTTP 401**, **alter Access-Token: HTTP 200**, genau eine Vorher-Sicherung (gzip ok, Endzeile, ohne „Erstes Kind“), neuer Login 200, „Erstes Kind“ wieder in `/api/v1/learners`.

Zwei Smoke-Defekte auf dem Weg dahin (siehe Abweichungen 1 und 2): Der erste grüne Versuch endete mit **Exit 0 ohne `RESTORE OK`** (`status: unbound variable`), der zweite mit Exit 1 ohne Meldung (curl auf web direkt nach `restart web`, Code `000`).

**Tracer-Gate:** `<verify>` aus Task 1 (`bash -n` je Datei, `test -x`, Smoke) auf dem Endstand von Task 1 grün, erst danach Task 2.

**Task 2, rot** (Task-1-Stand ohne Rückfall), je Fall ein Lauf, weil der Smoke beim ersten Fehler endet:
- Importfehler (voller Smoke): Eingabefälle 1–4 grün, dann `RELEASE-SMOKE FEHLER: Meldung fehlt in .smoke/restore-import.log: Das Einspielen von backups/fehlerhaft.sql.gz ist fehlgeschlagen. Der vorherige Stand aus backups/vor-wiederherstellung-20261018-140104.sql.gz ist wieder eingespielt`; restore.sh meldete „… Die API bleibt gestoppt. Deine Daten von vorher liegen in …“.
- Lesefehler (temporäre Kopie des Smokes ohne Importfall, danach gelöscht): gleiche Meldung für `backups/lesefehler.sql.gz`, Exit 1.
- Drop-Fehler (Kopie ohne Import- und Lesefall): **grün schon auf dem Task-1-Stand**, Exit 0 mit `RESTORE-FEHLER OK`. Grund: Der Task-1-Abbruch lässt die API bereits gestoppt und nennt „Die API bleibt gestoppt“ – genau das Verhalten bei doppeltem Fehlschlag. Der Plan erwartete hier rot; das traf nicht zu.

**Task 2, grün:** Exit 0 mit `RESTORE OK`, `RESTORE-FEHLER OK`, `SEITE OK`, `RELEASE-SMOKE OK`. Meldungen:
- Rückfall: `Das Einspielen von backups/fehlerhaft.sql.gz ist fehlgeschlagen. Der vorherige Stand aus backups/vor-wiederherstellung-20261018-140428.sql.gz ist wieder eingespielt, WordQuest läuft weiter.` (psql: `ERROR: division by zero`); gleiche Form für `backups/lesefehler.sql.gz` (gunzip: `can't stat: backups/lesefehler.sql.gz`)
- Doppelter Fehlschlag: `Das Einspielen ist fehlgeschlagen, und der vorherige Stand ließ sich nicht zurückspielen. Die API bleibt gestoppt. Deine Daten liegen in backups/vor-wiederherstellung-20261018-140441.sql.gz. Sieh mit `docker compose logs db` nach.` (psql zweimal `ERROR: cannot drop a template database`)

**Gegenprobe Fehlerweitergabe (Review 03-02 HIGH):** `set +o pipefail` vor dem Einspielstrom in `load_dump` eingefügt → Smoke Exit 1: `RELEASE-SMOKE FEHLER: backups/lesefehler.sql.gz: restore.sh endete mit Exit 0.`, restore.sh hatte `Fertig. WordQuest zeigt jetzt den Stand aus backups/lesefehler.sql.gz …` gemeldet (leere Datenbank als Erfolg). Danach aus der Kopie zurückgeholt, `cmp` ok.

**Probe Strg+C (Review MEDIUM 2, nicht im Stack):** `/bin/bash` 3.2 mit `trap '…die…' INT TERM` und einer Funktion `f() { { sleep 5 && echo x; } | cat || return 1; }` über `if ! f`; SIGINT an die ganze Prozessgruppe nach 1 s (wie Strg+C) → Ausgabe `TRAP: abgebrochen`, Exit 1, Folgezeile nicht erreicht.

**Probe Liste mit Leerzeichen (Review LOW 3):** Ordner mit `backups/Mein Stand.sql.gz`, Hardlink `last/`↔`daily/`, Symlink `daily/wordquest-latest.sql.gz` → Ausgabe `backups/daily/wordquest-d.sql.gz`, `backups/Mein Stand.sql.gz`.

## Belege je Akzeptanzkriterium

| Kriterium | Beleg |
|---|---|
| `test -x restore.sh`; Greps `ON_ERROR_STOP=1`, `WITH (FORCE)`, `restart web`, `vor-wiederherstellung-`, `ls -1ti` | Exit 0 je; `git ls-files -s restore.sh` → `100755` |
| `grep -c 'return 1' restore.sh` ≥ 3 | 11 (vor den Review-Fixes; danach unverändert ≥ 11) |
| `mapfile\|readarray\|declare -A` = 0 | `grep -c` → 0, `grep -cE 'mapfile\|readarray\|declare -A'` → 0 |
| Smoke „RESTORE OK“, roter Lauf, Liste, 401/200 | TDD-Belege Task 1 |
| Smoke-Greps `RESTORE-FEHLER OK`, `fehlerhaft.sql.gz`, `lesefehler.sql.gz`, `IS_TEMPLATE`, `mkfifo` | `grep -qF` je Exit 0 |
| `Die API bleibt gestoppt`, `ist wieder eingespielt` in restore.sh | `grep -qF` je Exit 0 (`restore.sh:154`, `:158`) |
| Smoke „RESTORE-FEHLER OK“, rot je Fall, Meldungen | TDD-Belege Task 2 |
| `^## Sicherung und Wiederherstellung`, `vor-wiederherstellung-`, `15 Minuten` auf der Seite | `grep -q` je Exit 0 |
| `grep -c '(Phase 3)' README.md` = 0 | 0 |
| Faktenaussagen mit Fundstelle, Gate je Schritt | Tabellen unten |

## Faktenaussagen des Seitenabschnitts (D-10)

| Aussage (`Documentation/Installation.md`) | Fundstelle |
|---|---|
| Liste der Sicherungen, die neueste zuerst; Format `  1) <Pfad>` | `restore.sh:43-57` (`ls -1ti`, `printf '%3d) %s'`); Smoke-Log |
| Nummer eingeben; nur `ja` ersetzt, alles andere bricht ohne Änderung ab | `restore.sh:59-61`, `:74-75`; Smoke Fälle `99 x 1 nein`, `</dev/null` |
| Ausgabezeilen im text-Block | `restore.sh:52`, `:73`, `:105`, `:162`, `:165`; Seitenabgleich `SEITE OK` gegen `.smoke/restore.log` |
| Prüft vorher die Datei, sichert nach `backups/vor-wiederherstellung-<Datum>-<Uhrzeit>.sql.gz` | `restore.sh:69`, `:93-105` |
| Vorher-Datei steht beim nächsten Aufruf in der Liste | `restore.sh:47` (`backups/*.sql.gz`) |
| WordQuest kurz nicht erreichbar | `restore.sh:108` (`stop api backup`) bis `:162-163` (Start) |
| Unvollständige/fremde Datei wird abgelehnt, nichts geändert | `restore.sh:25-34`, `:69`; Smoke „Kaputte Datei“ |
| Rückfall automatisch, WordQuest läuft weiter, Meldung nennt beide Dateien | `restore.sh:150-158`; Smoke Import- und Lesefehler |
| Doppelter Fehlschlag: API gestoppt, Zitat „Die API bleibt gestoppt. Deine Daten liegen in <Datei>.“ | `restore.sh:153-154`; Smoke Drop-Fehler |
| Diese Datei lässt sich mit `./restore.sh` wieder einspielen | `restore.sh:83-91` (fehlende DB leer anlegen), `:94-100` (Vorher-Sicherung ohne Kontoprüfung); Smoke „Weg zurück“ nach `DROP DATABASE` |
| Pfad-Argument, gleiche Prüfung und Rückfrage | `restore.sh:36-38`, `:69-75`; Smoke mit Tagesdump, `kaputt`, `fehlerhaft`, `lesefehler` |
| Eigene `.sql.gz` direkt in `backups/` erscheinen in der Liste; Dienst räumt nur `last/daily/weekly/monthly` auf | `restore.sh:47`; 03-RESEARCH Befund 3 (`/backup.sh:92-95`) |
| Alle Geräte melden sich neu an | `restore.sh:126` (`DELETE FROM public.refresh_token`); Smoke `refresh_token` 0, Refresh 401; `frontend/src/lib/api.ts:105-108` (400/401 → Tokens gelöscht) |
| Spätestens nach rund 15 Minuten abgemeldet | `AuthOptions.cs:15` (15 min), `JwtTokenService.cs:54` (30 s Toleranz); Smoke alter Access-Token 200 |
| Passwörter und PINs wie zur Zeit der Sicherung | Hashes in `app_user`/`learner_profile` sind Teil des Dumps (Fingerabdruck = S1) |
| „Passwort vergessen“ unter Hilfe | `Documentation/Installation.md:177` |

## Automatisches Gate

**Status: grün.** Ein Lauf auf dem Endstand (Inhalt = `53ff81e`, vor den Commits der Review-Fixes und der Doku im Arbeitsbaum). Ein früherer voller Gate-Lauf vor den Review-Fixes war ebenfalls grün.

| Schritt | Befehl | Exit | Dauer | Ergebnis |
|---|---|---|---|---|
| Syntax | `for f in restore.sh …/release-smoke.sh; do bash -n "$f" \|\| exit 1; done` | 0 | – | – |
| Ausführbar | `test -x restore.sh` | 0 | – | `100755` im Index |
| Verweise | `grep -q './restore.sh' Installation.md && grep -q 'restore.sh' README.md && grep -q 'REL-02' Konzept` | 0 | – | – |
| Release-Smoke | `bash .planning/phases/03-…/smoke/release-smoke.sh` | 0 | 93 s | `VERSION OK`, `INSTALL OK`, `RESTORE OK`, `RESTORE-FEHLER OK`, `SEITE OK`, `RELEASE-SMOKE OK` |
| Backend | `bash .planning/phases/02-…/gate/backend-test.sh` (Release, `/warnaserror`) | 0 | 92 s | `0 Warning(s)`, `0 Error(s)`; Learning.Tests **137 passed**, Api.Tests **251 passed**, je 0 failed, 0 skipped |
| Frontend | `docker run … node:22 sh -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'` | 0 | 88 s | vitest **14 Dateien, 230 passed**; DESIGN.md `errors: 0, warnings: 0` |
| Aufräumen | `bash .planning/phases/02-…/gate/backend-test.sh down` | 0 | – | – |

Kein e2e und kein axe: kein C#- und kein UI-Code geändert (Plan `<verification>`). Keine neue Dependency. shellcheck nicht installiert (D-02). Nach dem Lauf keine Container des Projekts `wq-release` übrig.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Rule 1 – Bug] Release-Smoke meldete Exit 0 bei einem Abbruch**
- **Gefunden in:** Task 1
- **Problem:** Bash 3.2 (`/bin/bash`, der Smoke läuft damit) beendet mit `trap cleanup EXIT` nach einer ungesetzten Variable mit Exit 0; isoliert reproduziert (`trap … EXIT; echo $undefined` → `rc=0`, ohne trap `rc=1`). Ein Gate hätte so einen abgebrochenen Smoke als grün gezählt.
- **Behebung:** `SMOKE_DONE=1` direkt vor `RELEASE-SMOKE OK`; `cleanup` endet sonst mit `exit 1`. Probe danach: `rc=1` bzw. `rc=0` im Erfolgsfall.
- **Commit:** `e87f85a`

**2. [Rule 1 – Bug] Smoke-Helfer in einer Pipe, curl ohne Fehlerpfad**
- **Gefunden in:** Task 1
- **Problem:** `printf … | restore_run` lief in einer Subshell, `$status` ging verloren. `code="$(curl …)"` beendete unter `set -e` ohne Meldung, wenn web nach `restart web` noch nicht annahm (Code `000`).
- **Behebung:** Antworten per `< <(printf …)`; `|| true` an den neuen curl-Aufrufen; `wait_web` (höchstens 30 s) nach `restore.sh`.
- **Commit:** `e87f85a`

**3. [Rule 1 – Bug] Vorher-Sicherung einer leeren Datenbank**
- **Gefunden in:** Task 1 (beim Durchdenken des doppelten Fehlschlags)
- **Problem:** Mit der Prüfung aus c (Kontotabelle) scheitert die Vorher-Sicherung einer leeren DB. Nach einem gescheiterten Rückfall ließe sich die in der Meldung genannte Datei dann nicht einspielen.
- **Behebung:** `dump_complete` (gzip, Endzeile) für die Vorher-Sicherung, `check_dump` (zusätzlich `COPY public.app_user`) für die gewählte Datei. Belegt durch den Smoke-Fall „Weg zurück“.
- **Commit:** `e87f85a`

**4. [Rule 2 – Fehlendes] `DROP DATABASE IF EXISTS`**
- **Gefunden in:** Task 1
- **Problem:** Gelingt DROP und scheitert CREATE, fehlt die DB; der Rückfall scheiterte dann am DROP.
- **Behebung:** `IF EXISTS`; `cannot drop a template database` bleibt ein Fehler (Smoke Drop-Fall).
- **Commit:** `e87f85a`

**5. Review-Befunde** (siehe Review), in `b112d24` und `53ff81e`.

**6. Weg zurück im Smoke statt `up -d` von Hand**
- Der Plan stellte nach dem Drop-Fall mit `IS_TEMPLATE false`, `up -d`, `restart web` wieder her. Stattdessen läuft der Weg aus der Meldung: `DROP DATABASE`, dann `./restore.sh <Vorher-Datei>` mit `ja` → Exit 0, Fingerabdruck gleich. Das belegt die Seitenaussage „Diese Datei kannst du mit `./restore.sh` wieder einspielen“ im schlimmsten Fall (DB fehlt).

### Hinweise

- **`env_value` nicht kopiert:** Der Plan nennt `env_value` als Kopie aus `setup.sh`. `restore.sh` liest keinen Wert aus `.env` (Compose tut das selbst); eine ungenutzte Funktion wäre toter Code.
- **`Starte WordQuest …`** steht zusätzlich vor dem Start in der Ausgabe und im text-Block der Seite.
- **Drop-Fall nicht rot auf dem Task-1-Stand** (TDD-Belege Task 2). Die eigentliche Lücke aus Review 03-02 HIGH (fehlende Fehlerweitergabe) belegt die Gegenprobe ohne `pipefail`.
- **Requirements:** REL-02 und REL-03 bleiben offen markiert, wie in 03-01 entschieden (03-05 führt alle vier REL-IDs; A9 ist Nach-Release-Abnahme).
- **grep:** ugrep auf dem Host; die Akzeptanz-Greps sind feste Zeichenketten bzw. zusätzlich mit `grep -F`/`-E` belegt.

## Review (AGENTS.md „Review“, D-02)

Unabhängiges Review per `claude -p`, nur lesend (Read/Grep/Glob und lesende git-/sed-/cat-/grep-/ls-Befehle; Edit/Write verboten), gegen `03-03-PLAN.md`, `03-CONTEXT.md` (D-07, D-08, D-10), `03-REVIEWS.md` (03-02 HIGH/MEDIUM), AGENTS.md und `git diff b068be2` (Arbeitsbaum). Schwerpunkt Datenverlustpfade in `restore.sh`. Ergebnis: **0 BLOCKER, 0 HIGH, 2 MEDIUM, 2 LOW, 4 INFO.** Als sicher bestätigt u. a.: prüfen vor ändern, Vorher-Sicherung unter `pipefail`, `|| return 1` je Teilschritt, Lesefehler-Test prüft wirklich den leeren Strom, API startet nie nach gescheitertem `load_dump`, `</dev/null` an jedem Docker-Aufruf, Bash 3.2, Sitzungsaussage der Seite.

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 1 | DROP gelingt, CREATE scheitert → DB fehlt; der Weg aus der Meldung scheitert dann an `pg_dump` | MEDIUM | **behoben:** restore.sh legt eine fehlende DB vor der Vorher-Sicherung leer an (`restore.sh:83-91`); Smoke „Weg zurück“ nach `DROP DATABASE` grün |
| 2 | Strg+C während des Einspielens: Teilstand committet, Skript endet ohne Meldung | MEDIUM (Vermutung) | **behoben:** `trap … INT TERM` um das Einspielen (`restore.sh:148`, `:155`, `:160`), Meldung nennt `./restore.sh <Vorher-Datei>`, API bleibt gestoppt; Bash-3.2-Probe mit SIGINT an die Prozessgruppe. Im Stack nicht provoziert |
| 3 | `awk '{ print $2 }'` schneidet Dateinamen mit Leerzeichen ab | LOW | **behoben:** `sub(/^ *[0-9]+ /, "")`; Probe oben |
| 4 | Fehlermeldung beim Start nach Rückfall ohne `$file`; „API nicht bereit“ auch, wenn nur `restart web` scheitert | LOW | **teilweise behoben:** Meldung nennt beide Dateien. **Zurückgewiesen** für die Trennung web/api: `restart web` scheitert bei bereiter API praktisch nicht, und der Verweis auf die Logs passt auch dann; eigener Pfad wäre Code für einen unbeobachteten Fall |
| 5 | Inode-Entdopplung vor dem latest-Filter | INFO | **behoben:** `grep -v` vor `awk` |
| 6 | Root-eigene Dumps unter Linux | INFO | **keine Änderung:** A9, Nach-Release-Abnahme (03-VALIDATION) |
| 7 | Seite „bleibt WordQuest gestoppt“, tatsächlich laufen db und web | INFO | **behoben:** „bleibt die API von WordQuest gestoppt …; anmelden geht dann nicht“ |
| 8 | SUMMARY fehlte | INFO | **erledigt:** dieses SUMMARY |

Nach den Fixes: Smoke und volles Plan-Gate erneut grün (Tabelle oben). Kein zweites Review: kein Auth-, Krypto-, Migrations- oder Secret-Code geändert; die Review-Fixes sind durch Smoke-Fall bzw. Proben belegt.

## Bedrohungen

| ID | Umsetzung |
|---|---|
| T-03-05 | Liste nur aus `backups/` (0700); `check_dump` (gzip, Endzeile, `COPY public.app_user`) vor jeder Änderung, auch für das Pfad-Argument; Smoke „Kaputte Datei“ |
| T-03-06 | Neu angelegte DB, `psql -1 -v ON_ERROR_STOP=1`, `\|\| return 1` je Teilschritt, Rückfall, API bleibt bei doppeltem Fehlschlag gestoppt; Smoke Import-, Lese-, Drop-Fehler; Gegenprobe ohne `pipefail` |
| T-03-07 | Vorher-Sicherung in `backups/` nach Besitz-Prüfung; Tokens und Passwort im Smoke nur in Dateien im Arbeitsverzeichnis, die Ausgabe nennt nur Dateinamen und HTTP-Codes |
| T-03-08 | Nummer per `^[1-9][0-9]{0,5}$` und Bereich; Pfade in Anführungszeichen; Leerzeichen im Namen bleiben ganz |
| T-03-09 | Nur `ja` geht weiter; Vorher-Sicherung in der Schlusszeile genannt |
| T-03-10 | `DELETE FROM public.refresh_token` in der Einspiel-Transaktion; Smoke 0 Zeilen, Refresh 401, Access-Token 200; Seite nennt „spätestens nach rund 15 Minuten“ und den Passwort-Stand |
| T-03-SC | Keine neue Dependency, kein neues Image |

Neue Fläche über das Threat-Modell hinaus: `restore.sh` legt bei fehlender Datenbank eine leere an (`CREATE DATABASE wordquest OWNER wordquest`), nur wenn `pg_database` keinen Eintrag hat; keine Daten betroffen.

## Self-Check: PASSED

- Dateien vorhanden: `restore.sh` (`100755`), `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh`, `Documentation/Installation.md`
- Commits im Verlauf: `e87f85a`, `3c5a6aa`, `b112d24`, `53ff81e` (`git merge-base --is-ancestor` je Exit 0)
- `git rev-list --count b068be2..HEAD` = 4 vor dem Doku-Commit
