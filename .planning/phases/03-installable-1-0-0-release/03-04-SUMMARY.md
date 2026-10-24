---
phase: 03-installable-1-0-0-release
plan: 04
subsystem: release
tags: [release, update, backup, smoke, docs]
status: complete

requires:
  - phase: 03-03
    provides: "restore.sh (Weg zurück), Release-Smoke mit fingerprint, token, learners, auth_budget, wait_api, wait_web, restore_run, Seitenabgleich"
provides:
  - "upgrade.sh (100755): Zielversion aus .env.example, geprüfte Sicherung backups/vor-update-<Zeitstempel>.sql.gz (0600), Pull mit Zielversion vor dem Schreiben der .env, abgesicherter Start mit start_failed (alte Version, Sicherungsdatei, ./restore.sh), Strg+C-Trap, restart web"
  - "Release-Smoke: UPDATE OK (ältere Version 0.0.0-smoke, Pull-Spy, Fingerabdruck, Sicherung in der restore-Liste) und UPDATE-ABBRUCH OK (keine Sicherung, Zielversion fehlt, Start scheitert, API nicht bereit, je mit Weg zurück; zweiter Aufruf)"
  - "Installationsseite: Abschnitt „Update“; README ohne eigene Update-Anleitung und ohne Demo-Anleitung für ältere Installationen; Konzept §14 auf dem umgesetzten Stand"
affects: [03-05]

actuals:
  tokens: 8700
  tasks: 3
  commits: 4
plan_head_before: b2cfb908bbb690690f5bfcc1024cb14f9f73c6c3
plan_head_after: eac22ca885e3ecc92c0dc553a126d605e92948f4

tech-stack:
  added: []
  patterns:
    - "Pull-Spy: docker-Wrapper vorn im PATH protokolliert nur 'docker compose pull' (Zielversion aus der Umgebung, Stand der .env) und reicht alles andere per exec an das echte docker"
    - "Smoke ab dem Update ohne Build-Overlay, damit pull --ignore-buildable api und web nicht überspringt"
    - "Fehlerweg nach dem Schreiben der .env: ein start_failed für up -d, Health-Timeout, restart web und Strg+C"

key-files:
  created:
    - upgrade.sh
  modified:
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - Documentation/Installation.md
    - README.md
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Reihenfolge nach D-05 beibehalten (Sicherung, Prüfung, Pull, .env, up -d, Health); die Review-Alternative „.env erst nach Bereitschaft“ verworfen, weil ein Abbruch danach eine .env mit alter Version neben migrierter DB hinterließe"
  - "db vor der Sicherung mit up -d --wait --no-recreate: gesichert wird mit der laufenden Datenbank, auch wenn git pull die Compose-Datei geändert hat"
  - "Sicherung mit umask 077 statt chmod an backups/: upgrade.sh ändert keine Ordnerrechte (Pitfall 8), die Datei ist trotzdem 0600"
  - "REL-01/REL-03 nicht als erledigt markiert, wie in 03-01 und 03-03: 03-05 führt alle vier REL-IDs"

requirements-completed: []

duration: 31min
completed: 2026-10-18
---

# Phase 3 Plan 04: upgrade.sh – Zusammenfassung

**Nach `git pull` sichert `./upgrade.sh` die Datenbank geprüft nach `backups/vor-update-…`, lädt die Version aus `.env.example`, schreibt sie erst danach in `.env` und startet WordQuest damit. Fehlt das Image, ändert es nichts. Startet die neue Version nicht, nennt die Meldung alte Version, Sicherungsdatei und `./restore.sh`. Der Release-Smoke belegt das mit echtem Lernstand, einem Pull-Spy, allen Fehlerpfaden und dem Weg zurück. Seite, README und Konzept beschreiben den umgesetzten Stand. Das Plan-Gate ist grün.**

## Leistung

- **Dauer:** ca. 31 min (2026-10-18T12:25Z bis 12:56Z), Smoke-Läufe, Gate und Review eingeschlossen
- **Tasks:** 3 von 3
- **Dateien:** 5 (1 neu, 4 geändert), +392 / −32 Zeilen

## Task-Commits

1. **Task 1: Tracer – Update von einer älteren Version mit Lernstand** – `775f209` (feat)
2. **Task 2: Abbruch- und Startfehlerpfade im Smoke** – `3341826` (test)
3. **Review-Befunde** – `94e851d` (fix)
4. **Task 3: Seite, README, Konzept §14, Seitenabgleich** – `eac22ca` (docs)

Vier Commits statt „ein atomarer Commit“ (Plan-Ziel), weil der Ausführungsauftrag atomare Commits je Anliegen verlangt; gleiche Handhabung wie 03-01 bis 03-03. Task 2 ist `test`, weil `upgrade.sh` dafür nicht geändert werden musste. Kein Push, kein Tag.

## TDD-Belege

**Task 1, rot** (`upgrade.sh` fehlt): `bash release-smoke.sh` → Exit 1 nach 99 s, `VERSION OK`, `INSTALL OK`, `RESTORE OK`, `RESTORE-FEHLER OK`, dann `RELEASE-SMOKE FEHLER: upgrade.sh fehlt oder ist nicht ausfuehrbar.` Der Wechsel auf `0.0.0-smoke` ohne Build-Overlay lief davor durch. Damit ist auch die Vorbedingung belegt (03-03 committet, Restore-Teile grün).

**Task 1, grün:** Exit 0 nach 130 s mit `UPDATE OK`, `SEITE OK`, `RELEASE-SMOKE OK`. Beobachtet:
- Ausgabe: `Aktualisiere WordQuest von 0.0.0-smoke auf 1.0.0.`, `✓ Sicherung geprüft: backups/vor-update-20261018-143256.sql.gz`, letzte Zeile `Fertig. WordQuest läuft jetzt mit Version 1.0.0. Die Sicherung von vorher liegt in backups/vor-update-20261018-143256.sql.gz.`
- **Spy-Protokoll:** genau eine Zeile `ziel=1.0.0 env=0.0.0-smoke`, also Zielversion beim Pull 1.0.0 und `.env` zu diesem Zeitpunkt noch alt
- genau eine `vor-update-*`-Datei: `gzip -t`, Endzeile, enthält „Erstes Kind“; `.env` mit `WQ_VERSION=1.0.0`; api `…-api:1.0.0`, web `…-web:1.0.0`; API bereit
- Fingerabdruck vor jeder Anmeldung gleich F0; Login 200; „Erstes Kind“ in `/api/v1/learners`
- `./restore.sh </dev/null` zeigt `  1) backups/vor-update-20261018-143256.sql.gz` und endet mit „Eingabe beendet. Es wurde nichts geändert.“

**Tracer-Gate:** `<verify>` aus Task 1 (`bash -n` je Datei, `test -x upgrade.sh`, Smoke) auf dem Endstand von Task 1 grün, erst danach Task 2.

**Probe Strg+C (nicht im Stack):** `upgrade.sh` in einem Wegwerf-Ordner mit einem Fake-`docker`, dessen `compose up -d` 10 s schläft; SIGINT an die Prozessgruppe nach 2 s unter `/bin/bash` 3.2 → Exit 1, Meldung `Abgebrochen. Deine Daten von vorher liegen in backups/vor-update-….sql.gz. … Zurück zur Version 0.9: Trage in .env WQ_VERSION=0.9 ein …`. Nach dem Review-Fix (Trap vor dem Schreiben der `.env`) wiederholt, gleiches Ergebnis, Datei `-rw-------`.

**Task 2:** Wie im Plan erwartet direkt grün auf dem Stand von Task 1, kein Fall rot, `upgrade.sh` unverändert. Exit 0 nach 332 s mit `UPDATE-ABBRUCH OK`:

| Fall | Ergebnis |
|---|---|
| Keine Sicherung (`chmod 500 backups`, Spy an) | Exit 1, „Die Sicherung vor dem Update ist fehlgeschlagen. Es wurde nichts geändert.“ (davor `Permission denied` von der Shell); `.env` per `shasum` gleich, keine neue `vor-update-*`, keine neue Spy-Zeile, Image und StartedAt der api gleich |
| Zielversion fehlt (`9.9.9-fehlt`, echter Pull) | Exit 1, Docker: `ghcr.io/mrhdready/wordquest-web:9.9.9-fehlt: not found`; „Die Version 9.9.9-fehlt ließ sich nicht laden. … Es wurde nichts geändert.“; `.env`, Image, StartedAt gleich; API bereit; neue Sicherung besteht die Prüfung |
| Start scheitert (`7.7.7-ohne-image`, Spy an) | Spy-Zeile `ziel=7.7.7-ohne-image env=1.0.0`; `up -d` scheitert an `…-api:7.7.7-ohne-image: not found`; Exit 1, „Der Start der Version 7.7.7-ohne-image ist fehlgeschlagen. Deine Daten von vorher liegen in backups/vor-update-…. … Trage in .env WQ_VERSION=1.0.0 ein und spiele danach die Sicherung mit ./restore.sh … ein.“ Weg zurück wie gemeldet: `.env` auf 1.0.0, `./restore.sh <Datei aus der Meldung>` mit `ja` → Exit 0, api `:1.0.0`, Fingerabdruck gleich |
| API nicht bereit (`WQ_SEED_DEMO_DATA=true`, Spy an) | Exit 1 nach **132 s** (Endstand: 130 s), „Die API ist nach zwei Minuten nicht bereit. …“ mit Datei und `./restore.sh`; `docker compose logs api` enthält „Start abgebrochen: WQ_SEED_DEMO_DATA“. Weg zurück: `WQ_SEED_DEMO_DATA=false`, `./restore.sh <Datei>` mit `ja` → Exit 0, Fingerabdruck gleich, Login 200 |
| Zweiter Aufruf ohne neue Version (Spy an) | Exit 0, `.env` mit `WQ_VERSION=1.0.0`, Fingerabdruck gleich |

## Belege je Akzeptanzkriterium

| Kriterium | Beleg |
|---|---|
| `test -x upgrade.sh`; Greps `vor-update-`, `pull --ignore-buildable`, `.env.example`, `start_failed` | je Exit 0 (`/usr/bin/grep -qF`); `git ls-files -s upgrade.sh` → `100755` |
| Pull vor `.env`, Start mit `\|\|` danach | `upgrade.sh:69` (Pull mit `WQ_VERSION="$target"`), `:83-88` (`.env`), `:95` (`up -d … \|\| start_failed`), `:106` (Health), `:109` (`restart web`) |
| `mapfile\|readarray\|declare -A` = 0; `demo@` außerhalb von Kommentaren = 0 | 0 und 0 |
| Smoke-Greps `UPDATE OK`, `WQ_SPY_PULL`; Ausgabe `UPDATE OK`; roter Lauf und Spy-Protokoll | TDD-Belege Task 1 |
| Smoke-Greps `UPDATE-ABBRUCH OK`, `9.9.9-fehlt`, `7.7.7-ohne-image`, `WQ_SEED_DEMO_DATA=true`, `chmod 500 backups` | je Exit 0 (`grep -qF`); `WQ_SEED_DEMO_DATA=true` stand zuerst nur als `set_env WQ_SEED_DEMO_DATA true` im Smoke, der Kommentar nennt den Wert jetzt wörtlich |
| Ergebnis je Fall, Laufzeit Health-Fall, rot oder nicht | Tabelle Task 2 |
| `^## Update`, `vor-update-`, `git pull`, `./upgrade.sh` auf der Seite; `REL-01` im Konzept | je Exit 0 |
| `^#### Aktualisieren`, `Ältere Installationen haben das Demo-Konto`, `reset-password demo@` im README; `Geplant: Update` im Konzept | je 0; `WQ_SEED_DEMO_DATA=true` im README vorhanden (Entwickler-Option) |
| Faktenaussagen mit Fundstelle, Gate je Schritt | Tabellen unten |

## Faktenaussagen des Seitenabschnitts „Update“ (D-10)

| Aussage (`Documentation/Installation.md:99-148`) | Fundstelle |
|---|---|
| Zwei Befehle nach dem Ordnerwechsel: `git pull`, `./upgrade.sh` | Kopfkommentar `upgrade.sh:7-8`; Smoke `page_cmd './upgrade.sh'`, `git pull` mit Grund in HANDGRIFFE |
| Nimmt die Version, die `git pull` mitgebracht hat | `upgrade.sh:25` (`.env.example`) |
| Sichert vorher nach `backups/vor-update-<Datum>-<Uhrzeit>.sql.gz` und prüft | `upgrade.sh:52-62`; Smoke `check_upd_backup` |
| Erst danach laden, `.env`, Start, Warten | `upgrade.sh:69`, `:83-88`, `:95`, `:97-106` |
| Kinder, Vokabeln, Lernstand bleiben erhalten | Smoke Fingerabdruck F0 über 11 Tabellen, „Erstes Kind“ in `/api/v1/learners` |
| Ausgabezeilen im text-Block | `upgrade.sh:28`, `:62`, `:68`, `:92`, `:97`, `:111`, `:113`; Seitenabgleich `SEITE OK` gegen `.smoke/upgrade.log` |
| Sicherung steht in der Liste von `./restore.sh` | `restore.sh:47` (`backups/*.sql.gz`); Smoke `restore-nach-update.log` |
| Ohne neue Version: weitere Sicherung, höchstens neuere Images für db/backup, Daten unverändert | `upgrade.sh:69` (Pull aller Dienste); Smoke zweiter Aufruf |
| `git pull` bricht bei einer selbst geänderten Datei, die das Update ändert, ab und ändert nichts; nach `git checkout -- <Datei>` geht es | Beobachtet in dieser Session im Wegwerf-Repo unter dem Scratch-Ordner (`git version 2.54.0`): `error: Your local changes to the following files would be overwritten by merge: docker-compose.quick.yml … Aborting`, Exit 1, Datei und HEAD unverändert; danach `git checkout -- docker-compose.quick.yml && git pull -q` → Exit 0, HEAD auf dem neuen Stand |
| `git pull` lässt `.env`, `secrets/`, `backups/` unverändert | `git check-ignore -v`: `.gitignore:19` (`.env`), `:18` (`secrets/`), `:24` (`backups/`) |
| Version noch nicht verfügbar: Zitat, nichts geändert, alte Version läuft weiter | `upgrade.sh:69-70`; Smoke Fall `9.9.9-fehlt` (Image, StartedAt, API bereit) |
| Sicherung gelingt nicht: kein Laden, Zitat | `upgrade.sh:58-61`; Smoke Fall `chmod 500` (keine Spy-Zeile) |
| Start scheitert: Zitat, alternativer erster Satz | `upgrade.sh:73-77`, `:95`, `:106`; Smoke Fälle `7.7.7-ohne-image` und `WQ_SEED_DEMO_DATA=true` |
| Weg zurück: alte Version in `.env`, `./restore.sh <Datei>`, fragt nach `ja`, startet mit Version aus `.env` und Stand von vor dem Update | `restore.sh:74-75`, `:133-139`; Smoke Weg zurück in beiden Fällen (Exit 0, api `:1.0.0`, Fingerabdruck gleich) |
| Nicht erneut aufrufen, sonst nennt die Meldung die neue Datei; ältere Datei steht in der Liste unter der neueren | `upgrade.sh:57` (neuer Zeitstempel je Aufruf), `:75`; `restore.sh:47` (`ls -1t`, neueste zuerst) |
| Gilt für Installationen aus `setup.sh` | D-06; `upgrade.sh:22` |
| `vor-update-…`-Dateien löscht man selbst (Abschnitt Wiederherstellen) | 03-RESEARCH Befund 3 (Dienst räumt nur `last/daily/weekly/monthly`) |

README: Der Satz zu Variante B (Update und Wiederherstellen wie auf der Seite, weil `docker compose` `COMPOSE_FILE` aus `.env` liest) stützt sich auf `.env.example:7` und 03-RESEARCH Befund 5; im Smoke nicht mit `docker-compose.yml` belegt (Traefik braucht Domain und DNS-Token).

## Automatisches Gate

**Status: grün.** Smoke und Frontend auf dem Endstand (Inhalt = `eac22ca`), Backend vor den Review-Fixes; danach kein C#-Code geändert.

| Schritt | Befehl | Exit | Dauer | Ergebnis |
|---|---|---|---|---|
| Syntax | `for f in setup.sh upgrade.sh restore.sh …/release-smoke.sh; do bash -n "$f" \|\| exit 1; done` | 0 | – | – |
| Ausführbar | `test -x upgrade.sh`; `git ls-files -s upgrade.sh` | 0 | – | `100755` |
| Release-Smoke | `bash .planning/phases/03-…/smoke/release-smoke.sh` | 0 | 275 s | `VERSION OK`, `INSTALL OK`, `RESTORE OK`, `RESTORE-FEHLER OK`, `UPDATE OK`, `UPDATE-ABBRUCH OK`, `SEITE OK`, `RELEASE-SMOKE OK` |
| Backend | `bash .planning/phases/02-…/gate/backend-test.sh` (Release, `/warnaserror`) | 0 | 85 s | `0 Warning(s)`, `0 Error(s)`; Learning.Tests **137 passed**, Api.Tests **251 passed**, je 0 failed, 0 skipped |
| Frontend | `docker run … node:22 sh -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'` | 0 | 44 s | vitest **14 Dateien, 230 passed**; DESIGN.md `errors: 0, warnings: 0`; `keine alten Klassen` |
| Aufräumen | `bash .planning/phases/02-…/gate/backend-test.sh down` | 0 | – | keine `wq-`-Container, keine Tags `…:1.0.0`/`…:0.0.0-smoke` übrig |

Kein e2e und kein axe: kein C#- und kein UI-Code geändert (Plan `<verification>`). Keine neue Dependency, kein neues Image. shellcheck nicht installiert (D-02).

## Abweichungen vom Plan

### Automatisch behoben

**1. [Rule 2 – Fehlendes] Strg+C nach dem Schreiben der `.env`**
- **Gefunden in:** Task 1
- **Problem:** Ein Abbruch während `up -d` oder der Warteschleife beendete das Skript ohne Meldung, mit umgestellter `.env` und womöglich halb ersetzten Containern (gleiche Lücke wie Review 03-03 MEDIUM 2 bei `restore.sh`).
- **Behebung:** `trap 'start_failed "Abgebrochen."' INT TERM`; nach dem Review vor das Schreiben der `.env` gezogen (`upgrade.sh:80`). Probe oben.
- **Commits:** `775f209`, `94e851d`

**2. [Rule 1 – Bug] Fehler beim Schreiben der `.env` wäre still übergangen worden**
- **Gefunden in:** Task 1
- **Problem:** `sed … >.env.tmp && mv .env.tmp .env` unter `set -e`: Scheitert `sed`, endet die Liste ohne Abbruch, und das Skript meldete „läuft jetzt mit Version <Ziel>“ mit alter `.env` (gleiches Muster in `setup.sh:75`, dort nicht angefasst).
- **Behebung:** `|| die …` an beiden Zweigen (`upgrade.sh:84-88`).
- **Commit:** `775f209`

**3. `--no-recreate` beim Start der Datenbank vor der Sicherung**
- Der Plan nennt `docker compose up -d --wait db`. Hat `git pull` den Dienst `db` geändert, erzeugte das den Container vor der Sicherung neu. Mit `--no-recreate` (`upgrade.sh:37`) sichert das Skript mit der laufenden Datenbank.

**4. `warn` nicht kopiert**
- Der Plan nennt `say`/`warn`/`die`/`env_value` als Kopie. `upgrade.sh` warnt nirgends; eine ungenutzte Funktion wäre toter Code (gleiche Handhabung wie `env_value` in 03-03).

**5. `upgrade_run` statt `tee` mit `PIPESTATUS`**
- Der Plan nennt `tee upgrade.log` und `PIPESTATUS`. Unter `set -e` und `pipefail` beendete eine scheiternde Pipeline den Smoke vor der Auswertung. `upgrade_run` folgt dem Muster von `restore_run` aus 03-03 (Ausgabe in die Datei, dann `cat`, Exit-Code in `$status`).

**6. Review-Befunde** (siehe Review), in `94e851d` und `eac22ca`.

### Hinweise

- **Grenze des Smokes:** Alte und neue Version sind dieselben Images. Den Weg zurück nach einer Migration der neuen Version kann der Smoke deshalb nicht zeigen; belegt sind Reihenfolge, Zielversion, Meldungen und der Weg zurück auf derselben Schema-Version. Der echte Pull aus GHCR ist Nach-Release-Abnahme (03-VALIDATION).
- **Zweig ohne bekannte aktuelle Version** (`upgrade.sh:74`): im Smoke nicht erreicht, weil `.env.example` seit langem eine Zeile `WQ_VERSION` hat; vom Plan verlangt.
- **`chmod 500 backups`** wirkt nicht, wenn der Smoke als root läuft (Linux-CI); der Fall würde dann rot, nicht falsch grün.
- **Requirements:** REL-01 und REL-03 bleiben offen markiert, wie in 03-01 und 03-03 entschieden (03-05 führt alle vier REL-IDs).
- **grep:** ugrep auf dem Host; die Akzeptanz-Greps liefen mit `/usr/bin/grep -F` bzw. `-c`.

## Review (AGENTS.md „Review“, D-02)

Unabhängiges Review per `claude -p`, nur lesend (Read/Grep/Glob und lesende git-/sed-/cat-/grep-/ls-/wc-Befehle; Edit/Write verboten), gegen `03-04-PLAN.md`, `03-CONTEXT.md` (D-05, D-06, D-07, D-10), `03-REVIEWS.md` (03-03 HIGH/MEDIUM, Plan-Checker-BLOCKER), AGENTS.md und `git diff b2cfb90` (Arbeitsbaum mit Doku). Schwerpunkt halbe Zustände, Datenverlust, Weg zurück. Ergebnis: **0 BLOCKER, 0 HIGH, 3 MEDIUM, 6 LOW, 5 INFO.** Als sicher bestätigt u. a.: Reihenfolge Sicherung → Prüfung → Pull → `.env` → Start, `pipefail` in `backup_now` auch über `if`, Spy belegt den `.env`-Stand beim Pull, Fall `9.9.9-fehlt` belegt den echten Pull ohne Build-Overlay, `--no-recreate`, kein Demo-Zweig und kein `git`-Aufruf, README-Bereinigung, text-Blöcke wörtlich gleich den Meldungen, §14 deckt sich mit dem Code.

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 1 | Erneuter Aufruf nach gescheitertem Update: neue Sicherung ist schon migriert, Meldung nennt dann die neue Version und die neue Datei | MEDIUM | **behoben (Doku):** Seite sagt, `./upgrade.sh` vor dem Weg zurück nicht erneut aufzurufen, und dass die Datei aus der ersten Meldung in der Liste unter der neueren steht. **Zurückgewiesen** für die Alternative „Start mit Shell-Variable, `.env` erst nach Bereitschaft“: widerspricht D-05 und der must-have-Reihenfolge; nach einem Abbruch zwischen Start und `.env` liefe die neue Version, `.env` nennte die alte, und der nächste `up -d` startete die alte Version auf migrierter DB. Kein Datenverlust im bestehenden Weg: auch die neuere Sicherung enthält alle Daten |
| 2 | Weg zurück macht `git pull` nicht rückgängig; künftige Compose-Änderungen oder ein Postgres-Major könnten ihn brechen | MEDIUM (Vermutung, künftige Releases) | **zurückgewiesen für 1.0.0:** erstes Release, kein Fall vorhanden. Als Regel für künftige Releases in STATE festgehalten: Compose-Änderungen bleiben mit der Vorversion lauffähig, kein Postgres-Major ohne eigenen Plan |
| 3 | `git pull`-Aussage womöglich nicht beobachtet, Folgeschritt fehlt | MEDIUM | **behoben:** Beobachtung im Wegwerf-Repo (Faktentabelle), Seite ergänzt „und starte `git pull` erneut“ |
| 4 | web nach `up -d` nicht neu gestartet | LOW | **behoben:** `docker compose restart web` nach der Bereitschaft mit `\|\| start_failed` (`upgrade.sh:109`), wie `restore.sh:138` |
| 5a | Fenster zwischen `.env` und Trap | LOW | **behoben:** Trap vor dem Schreiben (`upgrade.sh:80`), Probe wiederholt |
| 5b | Strg+C während `pg_dump` lässt halbe `vor-update-*` liegen | LOW | **zurückgewiesen:** kein Datenverlust, `restore.sh` lehnt die Datei mit „keine vollständige WordQuest-Sicherung“ ab; eigener Trap wäre Code für einen harmlosen Fall |
| 6 | Sicherung 0644, wenn `backups/` fehlt | LOW | **behoben:** `umask 077` im Sicherungsschritt (`upgrade.sh:54`), Ordnerrechte bleiben unberührt; Smoke prüft `-rw-------` |
| 7 | „nur eine weitere Sicherung“ ungenau; `vor-update-*` wird nie aufgeräumt | LOW | **behoben:** Seite nennt neuere Images für db/backup; Abschnitt Wiederherstellen nennt `vor-update-…` bei den selbst zu löschenden Dateien |
| 8 | Restore-Rat auch, wenn `up -d` schon beim Laden scheitert und nichts migriert ist | LOW | **zurückgewiesen:** ein einheitlicher Weg ist für Eltern einfacher; zwischen Sicherung und Fehlschlag liegt nur das Update selbst, und der überschriebene Stand liegt in `vor-wiederherstellung-…` |
| 9 | Lade-Meldung nennt nur „gerade erst erschienen“ | LOW | **behoben:** „sonst prüfe die Internetverbindung und WQ_IMAGE_PREFIX in .env“ (`upgrade.sh:70`, Seite) |
| INFO | Migrierter Weg zurück nicht belegbar; erneuter Aufruf nach Fehlschlag nicht getestet; `chmod 500` als root; leerer `current` unerreichbar; Seitenabgleich über alle Logs | INFO | im SUMMARY benannt (Hinweise), keine Änderung |

Nach den Fixes: Strg+C-Probe, Smoke (275 s) und Frontend-Gate erneut grün. Kein zweites Review: kein Auth-, Krypto-, Migrations- oder Secret-Code geändert.

## Bedrohungen

| ID | Umsetzung |
|---|---|
| T-03-11 | Pull mit Zielversion vor dem Schreiben der `.env`; Smoke `9.9.9-fehlt` (`.env`, Image, StartedAt), Spy `env=<alt>` beim Pull |
| T-03-12 | `backup_now` mit `\|\| return 1` je Schritt und `check_dump`; ohne geprüfte Sicherung kein Pull; Smoke `chmod 500` mit unveränderter Spy-Zeilenzahl |
| T-03-13 | Ablage in `backups/` nach Besitz-Prüfung, Datei `0600` per `umask 077`; Smoke gibt nur Dateinamen aus |
| T-03-14 | angenommen; kein Demo-Zweig in `upgrade.sh`, README ohne Demo-Anleitung für ältere Installationen |
| T-03-15 | angenommen; Zielversion aus dem Repo, Präfix aus `.env` |
| T-03-18 | `start_failed` für `up -d`, Health-Timeout, `restart web` und Strg+C; Smoke geht den Weg zurück in zwei Fällen |
| T-03-SC | keine neue Dependency, kein neues Image; Pull-Spy ist ein Shell-Skript im Smoke |

Neue Fläche über das Threat-Modell hinaus: keine.

## Self-Check: PASSED

- Dateien vorhanden: `upgrade.sh` (`100755`), `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh`, `Documentation/Installation.md`
- Commits im Verlauf: `775f209`, `3341826`, `94e851d`, `eac22ca` (`git merge-base --is-ancestor` je Exit 0)
- `git rev-list --count b2cfb90..HEAD` = 4 vor dem Doku-Commit
