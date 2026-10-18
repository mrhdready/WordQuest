---
phase: 03-installable-1-0-0-release
plan: 01
subsystem: release
tags: [release, version, setup, install-page, smoke, docs]
status: complete

requires:
  - phase: 02-07
    provides: "Stand nach Phase 2; Gate-Skript backend-test.sh, Install-Smoke setup-smoke.sh"
provides:
  - "Standard WQ_VERSION=1.0.0 und WQ_IMAGE_PREFIX=ghcr.io/mrhdready/wordquest in .env.example, docker-compose.quick.yml und docker-compose.yml (je api und web)"
  - "setup.sh: Präfix-Frage mit Standard aus .env.example, Enter übernimmt ihn (D-04)"
  - "Documentation/Installation.md: Voraussetzungen, Installation, Sicherung, Hilfe bei Problemen (ohne Update und Wiederherstellen)"
  - "README: Heimnetz-Anleitung auf Verweis gekürzt; Doku-Index listet die Seite"
  - "smoke/release-smoke.sh: VERSION OK → INSTALL OK → SEITE OK → RELEASE-SMOKE OK; Aufräumliste vor dem Build, auth_budget, page_cmd und Handgriff-Liste für 03-03/03-04"
affects: [03-02, 03-03, 03-04, 03-05]

actuals:
  tokens: 7300
  tasks: 2
  commits: 2
plan_head_before: c915576ca979337929e75802264aab7ba2ba1895
plan_head_after: 4399c18d0bbf87a8d7c3df961ca29d2c18a196e8

tech-stack:
  added: []
  patterns:
    - "Doku-Abgleich im Smoke: Befehle der Seite per page_cmd vor dem Ausführen belegt, übrige als Handgriff mit Grund; zitierte Ausgaben in Stücke an <…> zerlegt und gegen die Logs des Laufs gesucht"
    - "Aufräumliste vor dem Anlegen: eigene Tags stehen nach der Vorprüfung und vor dem Build im trap-Cleanup"
    - "Zustand aus $(…)-Helfern in einer Datei im Arbeitsverzeichnis (auth_budget)"

key-files:
  created:
    - Documentation/Installation.md
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
  modified:
    - .env.example
    - docker-compose.quick.yml
    - docker-compose.yml
    - setup.sh
    - README.md
    - Documentation/README.md

key-decisions:
  - "Präfix-Standard wird in setup.sh inline aus .env.example gelesen (eine Zeile im Muster von env_value), env_value selbst bleibt unverändert"
  - "Docker-Installation für Raspberry Pi OS 64-bit verweist auf die Debian-Anleitung; die Pi-OS-Seite von Docker verweist für 64-bit selbst dorthin"
  - "reset-password auf der Seite mit Beispieladresse statt <E-Mail>, weil <…> in der Shell eine Umleitung ist (Review INFO)"
  - "REL-03 und REL-04 nicht als erledigt markiert: Seite und Veröffentlichung werden in 03-02 bis 03-05 vervollständigt; 03-05 führt alle vier REL-IDs"

requirements-completed: []

duration: 24min
completed: 2026-10-18
---

# Phase 3 Plan 01: Feste Version 1.0.0 und Installationsseite – Zusammenfassung

**Eine frische Installation aus dem Repo zieht jetzt `ghcr.io/mrhdready/wordquest-{api,web}:1.0.0`, die Präfix-Frage nimmt Enter, und `Documentation/Installation.md` führt vom leeren Gerät bis zum Elternlogin. Der neue Release-Smoke belegt das mit lokal gebauten 1.0.0-Images und gleicht jeden Befehl und jede zitierte Ausgabe der Seite gegen den echten Lauf ab. Das Plan-Gate ist grün.**

## Leistung

- **Dauer:** ca. 24 min (2026-10-18T10:50Z bis 11:14Z), Container-Builds, zwei Gate-Läufe und Review eingeschlossen
- **Tasks:** 2 von 2
- **Dateien:** 8 (2 neu, 6 geändert), +392 / −118 Zeilen

## Task-Commits

1. **Task 1: Tracer – frische Installation zieht 1.0.0, Präfix mit Enter** – `9213b09` (feat)
2. **Task 2: Installationsseite mit Seitenabgleich, README-Verweis, Doku-Index, Review-Befunde** – `4399c18` (docs)

Zwei Commits statt „ein atomarer Commit“ (Plan-Ziel, D-01), weil der Ausführungsauftrag atomare Commits je Anliegen verlangt. Die Review-Befunde stecken in `4399c18`, weil das Review vor dem Commit von Task 2 lief. Kein Push, kein Tag.

## TDD-Belege

**Task 1, Schritt 1 (Smoke vor dem Code):**
- `bash release-smoke.sh` → Exit 1: `RELEASE-SMOKE FEHLER: .env.example: WQ_VERSION ist 'master' statt '1.0.0'.`
- Danach (`.env.example`, Compose-Standardwerte, `setup.sh`): Exit 0, `VERSION OK`, `INSTALL OK`, `RELEASE-SMOKE OK` (43 s). Die Ausgabe zeigt den Hinweis `Das Image-Präfix besteht aus …` nach `GHCR.io/X`, dann `✓ .env angelegt.` nach Enter, `✓ API ist bereit.`, `Fertig. WordQuest läuft unter: http://mbp-2.local:18082 — …`.
- Tracer-Gate: Verify aus Task 1 (`bash -n`-Schleife, Smoke, `git diff --quiet -- frontend/Dockerfile`) end-to-end erneut grün, erst danach Task 2.

**Task 1, Gegenprobe Teil-Build (Review 03-01 MEDIUM):** `RUN false` als letzte Zeile an `frontend/Dockerfile` angehängt, Smoke → Exit 1 im Build (`target web: failed to solve: process "/bin/sh -c false" …`).
- Das API-Tag war vor dem Abbruch entstanden: Build-Ausgabe `#27 naming to ghcr.io/mrhdready/wordquest-api:1.0.0 done`.
- Danach: `docker image inspect` für beide 1.0.0-Tags Exit 1; `docker ps -aq --filter label=com.docker.compose.project=wq-release` leer; `docker volume ls -q --filter label=com.docker.compose.project=wq-release` leer.
- Zeile per `git checkout -- frontend/Dockerfile` zurückgenommen; `git diff --quiet -- frontend/Dockerfile` Exit 0.

**Task 1, Zähler für Auth-Anfragen:** `auth_budget` isoliert mit einem `docker`-Stub (Skript im Scratchpad, nicht committet): zehn Aufrufe ergeben `t1 10`; neue Startzeit setzt auf `t2 1`; nach neun weiteren bricht der elfte mit `RELEASE-SMOKE FEHLER: Anmelde-Limit: 11 Auth-Anfragen seit dem letzten API-Start (Grenze 10 pro Minute, Program.cs:113-138). Reihenfolge im Smoke prüfen.` ab, der gespeicherte Zähler bleibt `t2 10` (Anfrage nicht gesendet). Im Smoke selbst gibt es in diesem Plan genau eine Anmeldung.

**Task 2, Schritt 1 (Seitenabgleich vor der Seite):**
- `bash release-smoke.sh` → Exit 1 nach `VERSION OK`: `RELEASE-SMOKE FEHLER: Die Installationsseite Documentation/Installation.md fehlt.`
- Danach: Exit 0 mit `VERSION OK`, `INSTALL OK`, `SEITE OK`, `RELEASE-SMOKE OK`.

**Task 2, Gegenproben (je einmal, danach zurückgenommen, `cmp` gegen die Kopie ok):**
- Zeile `./setp.sh` zusätzlich im bash-Block → `RELEASE-SMOKE FEHLER: Seitenbefehl ohne Beleg: ./setp.sh`
- `SQL backup created successfuly` im text-Block → `RELEASE-SMOKE FEHLER: Seitenausgabe nicht beobachtet: SQL backup created successfuly`
- (nach dem Review) Block ```` ```sh ```` angehängt → `RELEASE-SMOKE FEHLER: Codeblock ohne Sprache bash oder text auf Documentation/Installation.md, Zeile 169: ```sh`

Umfang des Abgleichs auf dem Endstand: 12 Befehlszeilen (4 per `page_cmd` ausgeführt: `./setup.sh`, `docker compose version`, `docker compose ps`, `docker compose exec backup /backup.sh`; 8 als Handgriff mit Grund) und 11 Ausgabestücke aus den text-Blöcken.

## Belege je Akzeptanzkriterium

| Kriterium | Beleg |
|---|---|
| `.env.example` mit `WQ_VERSION=1.0.0` und Präfix | `grep -q '^WQ_VERSION=1.0.0$'` und `grep -q '^WQ_IMAGE_PREFIX=ghcr.io/mrhdready/wordquest$'` Exit 0; Smoke `VERSION OK` |
| Compose-Standardwerte je 2 | `grep -c 'WQ_VERSION:-1.0.0}'` und `grep -c 'WQ_IMAGE_PREFIX:-ghcr.io/mrhdready/wordquest}'` in beiden Dateien je 2 (`docker-compose.quick.yml:42,70`, `docker-compose.yml:31,60`) |
| `setup.sh` liest `.env.example` | `setup.sh:66-71`; Smoke: nach `GHCR.io/X` Hinweis, Enter → `.env` mit `WQ_IMAGE_PREFIX=ghcr.io/mrhdready/wordquest` und `WQ_VERSION=1.0.0` |
| Container-Image-Namen | Smoke prüft `{{.Config.Image}}` = `ghcr.io/mrhdready/wordquest-api:1.0.0` bzw. `-web:1.0.0`; `INSTALL OK` |
| Login 200 | Smoke `login eltern@example.de geheim-123` → 200, `INSTALL OK` |
| Keine Exporte von `WQ_VERSION`/`WQ_IMAGE_PREFIX` | `grep -v '^ *#' release-smoke.sh \| grep -c 'export WQ_VERSION\|export WQ_IMAGE_PREFIX'` → 0 |
| `INSTALL OK`, `Anmelde-Limit`, `SEITE OK`, `Seitenbefehl ohne Beleg` im Smoke | `grep -q` je Exit 0 |
| Seite mit ≥ 4 Abschnitten | `grep -c '^## ' Documentation/Installation.md` → 4 |
| Schnelltest ein Satz (D-06) | `grep -c 'wordquest-quick'` → 1, Satz mit `docker compose -p wordquest-quick down` |
| Keine Demo-Konto-Meldung | `grep -c 'demo@'` → 0 |
| README ohne Variante A, mit Variante B, Verweis | `grep -c '^### Variante A' README.md` → 0; `grep -q '^### Variante B'` Exit 0; `grep -q 'Installation.md' README.md` und `Documentation/README.md` Exit 0 |
| Plan-Gate grün | Tabelle unten |

## URLs der Seite (in dieser Session abgerufen, 2026-10-18)

| URL | Abruf | Ergebnis |
|---|---|---|
| `https://docs.docker.com/engine/install/debian/` | `curl -sSL -w '%{http_code}'` | 200; nennt arm64 |
| `https://docs.docker.com/engine/install/raspberry-pi-os/` | `curl` | 200; Text „64-bit ARM: … use Debian arm64 packages; see the Debian installation instructions“ |
| `https://docs.docker.com/engine/install/linux-postinstall/` | `curl` | 200; enthält `usermod -aG docker` |
| `https://github.com/mrhdready/WordQuest.git` | `curl` und `git ls-remote --symref … HEAD` | 200 (→ Repo-Seite); Standardbranch `master` (Klon ohne Tag, 03-RESEARCH A5) |
| README-Anker `#variante-b--mit-domain-und-tls-für-fortgeschrittene` | Slug aus der Überschrift `README.md:31` | im Review als korrekt bestätigt |

## Zitierte Meldungen gegen den Code (D-10)

| Seite | Quelle |
|---|---|
| „Images konnten nicht geladen werden. …“ | `setup.sh:91` (vor dem Diff `:87`) |
| „Der Ordner backups gehört nicht dir. …“ | `setup.sh:56` (Escapes aufgelöst) |
| „Die API ist nach zwei Minuten nicht bereit. …“ | `setup.sh:108` (vor dem Diff `:104`) |
| „Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt oder ist ein bekannter Standardwert. …“ | `SecretCheck.cs:40` mit Name aus `SecretCheck.cs:50` |
| `port is already allocated` | beobachtet mit einem Compose-Projekt auf dem belegten Port 8080: `Bind for 0.0.0.0:8080 failed: port is already allocated` |
| `SQL backup created successfully` | `/backup.sh` im Image `prodrigestivill/postgres-backup-local:17`, Zeile 98; im Smoke-Log beobachtet |

## Automatisches Gate

**Status: grün.** Zwei vollständige Läufe: der erste auf dem Stand vor den Review-Fixes, der zweite auf dem Endstand (Inhalt von `4399c18`, vor dem Commit). Zahlen aus dem zweiten Lauf; der erste hatte dieselben Marker und Exit-Codes.

| Schritt | Befehl | Exit | Ergebnis |
|---|---|---|---|
| Syntax | `for f in setup.sh …/release-smoke.sh; do bash -n "$f" \|\| exit 1; done` | 0 | – |
| Release-Smoke | `bash .planning/phases/03-…/smoke/release-smoke.sh` | 0 | `VERSION OK`, `INSTALL OK`, `SEITE OK`, `RELEASE-SMOKE OK` (25 s) |
| Dockerfile sauber | `git diff --quiet -- frontend/Dockerfile` | 0 | – |
| Verweise | `grep -q 'Installation.md' README.md` / `Documentation/README.md` | 0 / 0 | – |
| Install-Smoke Phase 1 | `bash .planning/phases/01-…/smoke/setup-smoke.sh` | 0 | `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `FIRST RUN OK` (1 passed), `DEMO-ABBRUCH OK`, `RATE-LIMIT OK`, `SMOKE OK` |
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` (Release, `/warnaserror`) | 0 | `0 Warning(s)`, `0 Error(s)`; Learning.Tests **137 passed**, 0 failed, 0 skipped; Api.Tests **251 passed**, 0 failed, 0 skipped |
| Frontend (Node 22) | `docker run … node:22 sh -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'` | 0 | vitest **14 Dateien, 230 passed**; DESIGN.md `errors: 0, warnings: 0` |
| Aufräumen | `bash .planning/phases/02-…/gate/backend-test.sh down` | 0 | – |

Kein e2e und kein axe: Der Plan ändert weder C#- noch UI-Code (Plan `<verification>`; e2e laufen in 03-02 und 03-05). Keine neue Dependency (`package.json`, `package-lock.json`, `*.csproj` unberührt). shellcheck ist nicht installiert (D-02), nur `bash -n`.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Rule 2 – Fehlendes] Handgriff `sudo apt install git`**
- **Gefunden in:** Task 2
- **Problem:** Die Seite nennt git als Voraussetzung (03-RESEARCH A8: Raspberry Pi OS Lite bringt es nicht mit). Der Befehl steht in einem bash-Block und braucht deshalb einen Beleg.
- **Behebung:** Neunte Zeile in `HANDGRIFFE` („Paketinstallation auf dem Zielgerät; der Entwicklungsrechner hat git“).
- **Commit:** `4399c18`

**2. [Rule 2 – Fehlendes] Zitat „Die API ist nach zwei Minuten nicht bereit“**
- **Gefunden in:** Task 2
- **Problem:** Der Plan nennt für „API startet nicht“ nur `docker compose logs api` und die `Start abgebrochen:`-Zeile. Woran ein Elternteil den Fall erkennt, stand nicht da.
- **Behebung:** Meldung aus `setup.sh:108` als `>`-Zitat.
- **Commit:** `4399c18`

**3. Review-Befunde** (siehe Review), alle in `4399c18`.

### Nicht im Plan, offen gelassen

- `README.md:243` („Betrieb“, früher Zeile 341) nennt `restore.sh` noch als „Phase 3“; „Demo-Daten“ und „Aktualisieren“ bleiben laut Plan bis 03-04. Konzept §14 („geplant“) kommt mit 03-02.
- Kopfkommentare in `docker-compose.quick.yml:1-18` und `docker-compose.yml:1-7` nicht angefasst (Plan: „Sonst nichts ändern“); sie widersprechen dem neuen Stand nicht.

## Review (AGENTS.md „Review“, D-02)

Unabhängiges Review per `claude -p`, nur lesend (Tools Read/Grep/Glob und lesende git-/sed-/grep-Befehle, Edit/Write verboten), gegen `03-01-PLAN.md`, `03-CONTEXT.md` (D-04, D-06, D-09, D-10), AGENTS.md und `git diff c915576`. Ergebnis: **0 BLOCKER, 0 HIGH, 2 MEDIUM, 4 LOW, 4 INFO.**

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 1 | Seite: Reihenfolge der Fragen falsch; `setup.sh` fragt E-Mail und Passwort erst nach Laden und Start | MEDIUM | **behoben:** Präfix → Laden/Start → E-Mail, Passwort |
| 2 | Alter Schnelltest belegt 8080; Hinweis stand erst am Seitenende | MEDIUM/LOW | **behoben:** Satz im Port-Absatz verweist auf „Früherer Schnelltest“, ohne den Befehl zu wiederholen (`wordquest-quick` weiter 1×) |
| 3 | „Die letzte Zeile lautet“ nicht belegt | LOW | **behoben:** „In der Ausgabe steht:“ |
| 4 | `SEITE OK` könnte leer durchlaufen; fremde Blocksprachen still übersprungen | LOW | **behoben:** Zähler mit `fail` bei 0, `fail` bei anderer Sprache als bash/text; Gegenprobe oben |
| 5 | „erzeugt die fehlenden Secrets“ gilt nur für fehlende Dateien | LOW | **behoben:** „Fehlt eine Datei in `secrets/`, erzeugt `./setup.sh` sie neu; eine vorhandene Datei lässt es unverändert.“ |
| 6 | Unter Linux gehören die Dumps root, `rm -rf "$WORK"` scheitert | LOW | **behoben:** `cleanup` löscht `/backups/*` im backup-Container vor `down` |
| 7 | `reset-password <E-Mail>` wörtlich kopiert = Shell-Umleitung | INFO | **behoben:** Beispieladresse plus Satz „Ersetze … durch …“; Handgriff angepasst |
| 8 | Satz zu `hostname -I` grammatisch kaputt | INFO | **behoben** |
| 9 | Plan nennt `setup.sh:87/104`, nach dem Diff `:91/108` | INFO | **übernommen** in dieses SUMMARY (Tabelle „Zitierte Meldungen“) |
| 10 | `auth_budget`: leeres `started` setzte den Zähler still zurück | INFO | **behoben:** `[[ -n "$started" ]] \|\| fail …` |

Nach den Fixes: Release-Smoke mit Gegenprobe (fremde Blocksprache) und das volle Plan-Gate erneut grün. Kein zweites Review (kein strukturelles Signal: keine Auth-, Krypto-, Migrations- oder Secret-Änderung).

## Bedrohungen

| ID | Umsetzung |
|---|---|
| T-03-01 | Fester Tag `1.0.0` statt `master` an drei Stellen; Standardpräfix `ghcr.io/mrhdready`; Smoke prüft die Image-Namen der laufenden Container |
| T-03-03 | Vorprüfung bricht ab, wenn ein 1.0.0-Tag schon existiert, und löscht nichts; erst danach Aufräumliste; Gegenprobe Teil-Build ohne Reste |
| T-03-04 | Smoke bricht ab, wenn das Testpasswort im Log steht; `secrets/` kommt nicht ins Log; Seite nennt keine Secret-Inhalte |
| T-03-SC | Keine neue Dependency, kein neues Image |

Keine neue Angriffsfläche über das Threat-Modell hinaus.

## Self-Check: PASSED

- Dateien vorhanden: `Documentation/Installation.md`, `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh`
- Commits im Verlauf: `9213b09`, `4399c18` (`git merge-base --is-ancestor` je Exit 0)
- `git rev-list --count c915576..HEAD` = 2 vor dem Doku-Commit
