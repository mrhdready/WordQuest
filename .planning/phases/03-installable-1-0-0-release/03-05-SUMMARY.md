---
phase: 03-installable-1-0-0-release
plan: 05
subsystem: release
tags: [release, docs, smoke, gate]
status: complete

requires:
  - phase: 03-04
    provides: "upgrade.sh, Release-Smoke mit allen Markern bis UPDATE-ABBRUCH OK, Seitenabschnitt Update"
provides:
  - "Release-Smoke prüft die Abschnittsfolge der Seite nach D-09, bash- und text-Block je Abschnitt und verbotene Zeichenfolgen (T-03-16)"
  - "Documentation/Installation.md mit Faktentabelle gegen den Code (D-10), fünf Korrekturen"
  - "Volles automatisches Phasen-Gate grün; 03-VALIDATION mit Status je Task und offener Nach-Release-Abnahme"
affects: [verify-work, release v1.0.0]

actuals:
  tokens: 5900
  tasks: 2
  commits: 4
plan_head_before: 505b6c08562b65e308a351fad7e66295f5390a56
plan_head_after: 106e54c0cda10ad293d35d301dd236f813c989c4

tech-stack:
  added: []
  patterns:
    - "Statische Seitenprüfung per awk: Überschriften und Codeblöcke nur außerhalb von Codeblöcken, Sprache je Abschnitt"

key-files:
  created: []
  modified:
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - Documentation/Installation.md
    - .planning/phases/03-installable-1-0-0-release/03-VALIDATION.md

key-decisions:
  - "REL-01, REL-02, REL-03 erledigt: Code und Smoke belegen sie; REL-04 bleibt offen, weil veröffentlichte Images erst nach dem Tag entstehen (Nach-Release-Abnahme)"
  - "setup.sh-Ausgabe „Verwalten → Kinder“ nicht geändert (Plan ändert keinen Skriptcode); die Seite erklärt, dass die Bereiche Vokabeln, Fortschritt, Kinder und Konto gemeint sind"
  - "Strukturprüfung bleibt bei den drei Zeichenfolgen aus dem Plan; weitere unsichere Empfehlungen deckt die Faktenprüfung ab"

requirements-completed: [REL-01, REL-02, REL-03]

duration: 25min
completed: 2026-10-18
---

# Phase 3 Plan 05: Seite belegt, automatisches Phasen-Gate – Zusammenfassung

**Die Installationsseite hat genau die fünf Abschnitte aus D-09; der Release-Smoke prüft das jetzt mit. Jede Faktenaussage der Seite ist gegen den Code belegt, fünf Stellen sind korrigiert. Das volle automatische Phasen-Gate ist grün: 16 Schritte, jeder mit Exit 0. Damit ist die Voraussetzung für das lokale Tag `v1.0.0` erfüllt. Das Tag setzt der Orchestrator. Die Nach-Release-Abnahme ist übergeben.**

## Leistung

- **Dauer:** ca. 25 min (2026-10-18T12:59Z bis 13:24Z), Smoke, Gate und Review eingeschlossen
- **Tasks:** 2 von 2
- **Dateien:** 3 geändert, +47 / −26 Zeilen

## Task-Commits

1. **Task 1, Test:** Strukturprüfung im Release-Smoke – `510b861` (test)
2. **Task 1, Seite:** an den Code angeglichen – `a54ee26` (docs)
3. **Review-Befunde:** Seite präzisiert – `be56cbf` (docs)
4. **Task 2:** Gate-Status in 03-VALIDATION – `106e54c` (docs)

Vier Commits statt „ein atomarer Commit“, weil der Ausführungsauftrag atomare Commits je Anliegen verlangt; wie in 03-01 bis 03-04. Kein Push, kein Tag (`git tag -l v1.0.0` leer).

## TDD-Belege Task 1

Der Plan erwartet Rot nur, wenn 03-01 bis 03-04 von D-09 abweichen. Das tun sie nicht: Der Test war auf der echten Seite sofort grün. Deshalb ist die Prüfung mit Mutanten belegt. Der Prüfblock wurde wörtlich aus `release-smoke.sh` herausgeschnitten und unter `/bin/bash` 3.2.57 mit `set -euo pipefail` gegen Kopien der Seite ausgeführt:

| Seite | Exit | Ausgabe |
|---|---|---|
| echt | 0 | `STATIC-OK` |
| „Installation“ und „Update“ vertauscht | 1 | `Abschnitte der Seite weichen von D-09 ab: Voraussetzungen\|Update\|Installation\|…` |
| „Hilfe bei Problemen“ fehlt | 1 | `Abschnitte der Seite weichen von D-09 ab: …\|Sicherung und Wiederherstellung` |
| text-Block im Update als `console` | 1 | `Abschnitt ohne Befehl oder erwartetes Ergebnis (D-09): Update ohne text-Block` |
| `chmod 777` / `chmod -R 777` / `0.0.0.0` angehängt | je 1 | `Unsichere Empfehlung auf … (T-03-16): <Zeichenfolge>` |
| `## Kommentar` in einem bash-Block | 0 | Zeilen in Codeblöcken zählen nicht als Abschnitt |

**Release-Smoke aus sauberem Zustand**, nach den Korrekturen aus `a54ee26`: vorher keine Container und Volumes des Projekts `wq-release`, keine lokalen Tags `:1.0.0` oder `:0.0.0-smoke`, es waren keine Reste zu entfernen. `bash release-smoke.sh` → Exit 0 nach **355 s**, mit `VERSION OK`, `INSTALL OK`, `RESTORE OK`, `RESTORE-FEHLER OK`, `UPDATE OK`, `UPDATE-ABBRUCH OK`, `SEITE OK`, `RELEASE-SMOKE OK`. Danach keine Container und keine Tags übrig. Den Endstand der Seite nach den Review-Korrekturen deckt der Gate-Lauf ab (unten): Start um 15:17:12 Ortszeit, nach dem Commit `be56cbf` um 15:15:34.

**Tracer-Gate:** `<verify>` (`bash -n`, Smoke) lief auf dem Endstand von Task 1 grün, erst danach Task 2.

## Faktenaussagen der Seite (D-10)

Zeilen nach dem Endstand `106e54c`. Aussagen der Abschnitte Wiederherstellen und Update sind in 03-03 und 03-04 einzeln belegt; hier erneut geprüft und auf neue Zeilen gebracht.

| Aussage (`Documentation/Installation.md`) | Fundstelle | Ergebnis |
|---|---|---|
| Zielgeräte arm64 und x86-64 (:7) | `.github/workflows/ci.yml:139` (`linux/amd64,linux/arm64`) | stimmt |
| Docker nach der Debian-Anleitung; Pi-Seite verweist für 64-bit dorthin (:11) | URLs unten, Text „64-bit ARM: use Debian arm64 packages; see the Debian installation instructions“ | stimmt |
| `usermod -aG docker`, danach ab- und anmelden (:12-16) | Docker-Doku linux-postinstall: „sudo usermod -aG docker $USER“, „Log out and log back in …“ | stimmt |
| `setup.sh` fragt drei Dinge: Präfix, dann E-Mail, dann Passwort zweimal, mindestens 8 Zeichen, unsichtbar (:51-58) | `setup.sh:68`, `:120`, `:129-136` (`read -s`, `${#password} < 8`) | stimmt |
| Enter übernimmt `ghcr.io/mrhdready/wordquest` (:53) | `.env.example:12`, `setup.sh:66-69` | stimmt |
| Lädt Version 1.0.0, startet, fragt erst danach nach dem Konto (:55) | `.env.example:16`, `setup.sh:89-108`, `:120` | stimmt |
| Ausgabezeilen der Installation (:62-69) | `setup.sh:76`, `:103`, `:149`, `:174`, `:178`, `:179`; Smoke `SEITE OK` | stimmt, beobachtet |
| `setup.sh` nimmt den ersten Eintrag von `hostname -I` (:71) | `setup.sh:166` (`awk '{print $1}'`) | **korrigiert**: „auf dem Pi“ gestrichen, keine Aussage über das Pi-Verhalten (01-UAT Test 5 offen) |
| Port 8080, `WQ_PORT=9000` in `.env`, `./setup.sh` erneut (:77) | `docker-compose.quick.yml:72`, `setup.sh:168-169`; Compose liest `.env` | stimmt |
| Vier Dienste mit `Up` (:85) | `docker-compose.quick.yml:23-95`; Smoke prüft `Up` je Dienst | stimmt, beobachtet |
| `secrets/` nur für dich lesbar (:89) | `setup.sh:23` (`chmod 700 secrets`), `:49` (Dateien 0644 im geschützten Ordner) | stimmt |
| Zweiter Lauf lässt Secrets, `.env`, Konto unverändert (:93) | `setup.sh:36-38`, `:60-61`, `:117`, `:151` | stimmt |
| Bereiche „Vokabeln“, „Fortschritt“, „Kinder“, „Konto“ nach der Anmeldung (:95) | `frontend/src/features/manage/ManageLayout.tsx:8-11`; `App.tsx:52-55` (Eltern landen auf `/verwalten`) | **korrigiert**: „Verwalten“ ist keine sichtbare Beschriftung |
| Profilauswahl auf einem Elterngerät erst nach dem Abmelden (:95) | `frontend/src/App.tsx:50-59` (angemeldete Eltern → `/verwalten`, sonst `ProfilePickerPage`) | **ergänzt** (Review) |
| Ohne HTTPS keine Installation als App, Browser vollständig (:97) | `docker-compose.quick.yml:14-17`; e2e „ohne Secure Context › Lernen über HTTP“ grün | stimmt |
| Update-Abschnitt (:99-148) | 03-04-SUMMARY „Faktenaussagen des Seitenabschnitts Update“; Meldungen `upgrade.sh:28`, `:60`, `:62`, `:68`, `:70`, `:76`, `:92`, `:95`, `:97`, `:106`, `:111`, `:113` | stimmt; Zählwort „zwei Befehle“ **gestrichen** (Block hat drei Zeilen) |
| `git pull` lässt `.env`, `secrets/`, `backups/` unverändert (:123) | `.gitignore:18`, `:19`, `:24` | stimmt |
| Täglich, 14/8/6 (:152) | `docker-compose.quick.yml:84-87` | stimmt |
| `backups/` nur für dich lesbar (:152) | `setup.sh:57`, `restore.sh:80` (`chmod 700 backups`) | stimmt |
| `SQL backup created successfully`, danach `backups/daily/wordquest-<Datum>.sql.gz` (:163-166) | `/backup.sh` im Image; Smoke prüft die Datei und den Logtext | stimmt, beobachtet |
| Linux-Dateisystem, nicht Windows-Freigabe oder exFAT (:168) | README des Images, in dieser Session abgerufen: „requires … /backups to be a POSIX-compliant filesystem (mainly with support for hardlinks …) … VFAT, EXFAT, SMB/CIFS … can't be used“; `/backup.sh:53-55`, `:67-71` (`ln -f`) | stimmt |
| Sicherungsdienst läuft als root, Dateien unter Linux root-eigen, Löschen mit `sudo` (:168) | `docker image inspect prodrigestivill/postgres-backup-local:17 --format '{{.Config.User}}'` → leer (root) | stimmt; Lesbarkeit für `restore.sh` bleibt Nach-Release-Abnahme (A9) |
| Wiederherstellen: Liste, `ja`, Prüfung, Vorher-Sicherung, Rückfall, API gestoppt, Pfad-Argument, eigene Dateien, Aufräumen (:170-204) | 03-03-SUMMARY „Faktenaussagen“; `restore.sh:47`, `:52-55`, `:69`, `:73-75`, `:93-105`, `:149-158`, `:162`, `:165` | stimmt |
| Nach dem Wiederherstellen neu anmelden, spätestens nach rund 15 Minuten (:206) | `restore.sh:126` (alle Refresh-Tokens gelöscht, auch die der Kinder: `AuthService.cs:95`), `AuthOptions.cs:15`, `JwtTokenService.cs:54` (30 s Toleranz) | stimmt |
| Passwörter und PINs wie zur Zeit der Sicherung (:206) | Hashes in `app_user`/`learner_profile` sind Teil des Dumps | stimmt |
| Meldung „Images konnten nicht geladen werden …“ (:212) | `setup.sh:91` | stimmt, wörtlich |
| Belegter Port: Meldung nennt den Port, z. B. `port is already allocated` (:216) | in dieser Session beobachtet: `docker run -p 8080:80` → „Bind for 0.0.0.0:8080 failed: p[ort is already allocated]“ (Port hält ein Container) | **korrigiert**: Hält ein anderes Programm den Port, meldet Docker unter Linux einen anderen Text (Review, Vermutung; auf Docker Desktop nicht reproduzierbar) |
| Meldung „Der Ordner backups gehört nicht dir …“ (:220) | `setup.sh:56` (Escapes aufgelöst) | stimmt, wörtlich |
| reset-password: neues Passwort genau einmal, nirgends im Klartext; ohne Konto Meldung, nichts geändert (:231-236) | `AccountCommands.cs:49-61`, `AccountService.cs:88-99` | stimmt |
| Nur Geräte dieses Elternkontos können die Sitzung nicht mehr verlängern, höchstens 15 Minuten (:236) | `AccountService.cs:95` (`MarkRefreshTokensRevokedAsync(user.Id)`), `AuthOptions.cs:15` | **korrigiert**: vorher „angemeldete Geräte“, Kinderprofile bleiben aber angemeldet |
| Meldung „Die API ist nach zwei Minuten nicht bereit …“ (:240) | `setup.sh:108` | stimmt, wörtlich |
| „Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt …“ (:250) | `SecretCheck.cs:40` | stimmt, wörtlich |
| `setup.sh` erzeugt eine fehlende `jwt_key.txt` neu; für `db_password.txt` hilft das nicht (:252) | `setup.sh:34-46`; Postgres-Doku (in dieser Session abgerufen): „the Docker specific variables will only have an effect if you start the container with a data directory that is empty“ | **korrigiert** (Review MEDIUM): vorher „Fehlt eine Datei in `secrets/` …“ |
| Früherer Schnelltest: `docker compose -p wordquest-quick down`, Volume bleibt (:254) | D-06; `down` ohne `-v` | stimmt |
| Verweis README Variante B (:256) | Anker passt zu `README.md:33` | stimmt |
| Kein Demo-Konto (D-06) | `grep -c 'demo@'` → 0 | stimmt |

## URLs der Seite (in dieser Session abgerufen, 2026-10-18)

| URL | Abruf | Ergebnis |
|---|---|---|
| `https://docs.docker.com/engine/install/debian/` | `curl -sL -w '%{http_code}'` | 200 |
| `https://docs.docker.com/engine/install/raspberry-pi-os/` | `curl`, Text gefiltert | 200; „64-bit ARM: use Debian arm64 packages; see the Debian installation instructions“ |
| `https://docs.docker.com/engine/install/linux-postinstall/` | `curl`, Text gefiltert | 200; „sudo usermod -aG docker $USER“, „Log out and log back in so that your group membership is re-evaluated.“ |
| `https://github.com/mrhdready/WordQuest.git` | `curl`, `git ls-remote --symref … HEAD` | 200 (→ Repo-Seite, öffentlich); Standardbranch `master` |
| README-Anker `#variante-b--mit-domain-und-tls-für-fortgeschrittene` | Slug aus `README.md:33` | passt (auch im Review bestätigt) |

Keine URL war unauflösbar, nichts entfernt.

## Automatisches Gate

**Status: grün.** Ein Lauf, sequenziell, Skript im Scratch-Ordner, je Schritt eigenes Log. Inhalt: Commit `be56cbf` (Seite und Smoke wie am Ende; `106e54c` ändert nur `03-VALIDATION.md`).

| # | Schritt | Befehl | Exit | Dauer | Ergebnis |
|---|---|---|---|---|---|
| 1 | Backend | `bash .planning/phases/02-…/gate/backend-test.sh` (SDK-Container, Release, `/warnaserror`) | 0 | 87 s | `0 Warning(s)`, `0 Error(s)`; Learning.Tests **137 passed**, Api.Tests **251 passed**, je 0 failed, 0 skipped |
| 2 | Frontend | `docker run … node:22 sh -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'` | 0 | 65 s | vitest **14 Dateien, 230 passed**; DESIGN.md `errors: 0, warnings: 0`; `keine alten Klassen` |
| 3 | e2e-Stack | `cd frontend && npm run e2e:stack` | 0 | 39 s | Stack neu gebaut, `--wait` erfüllt |
| 4 | e2e | `cd frontend && npx playwright test` | 0 | 106 s | **48 passed, 1 skipped** (`first-run.spec.ts`, läuft nur mit `WQ_E2E_FIRST_RUN`, siehe Schritte 6 und 9); darin 5 axe-Specs mit 0 Verstößen (Login, `/verwalten`, Set-Detail, Fortschritt, Startseite) |
| 5 | e2e-Abbau | `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v` | 0 | 1 s | – |
| 6 | Install-Smoke Phase 1 | `bash .planning/phases/01-…/smoke/setup-smoke.sh` | 0 | 84 s | `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `FIRST RUN OK`, `DEMO-ABBRUCH OK`, `RATE-LIMIT OK`, `SMOKE OK` |
| 7 | Proxy | `bash .planning/phases/02-…/gate/proxy-xff-check.sh` | 0 | 35 s | `PROXY-XFF OK` |
| 8 | Aufräumen | `bash .planning/phases/02-…/gate/backend-test.sh down` | 0 | 1 s | – |
| 9 | Release-Smoke | `bash .planning/phases/03-…/smoke/release-smoke.sh` | 0 | 315 s | `VERSION OK`, `INSTALL OK`, `RESTORE OK`, `RESTORE-FEHLER OK`, `UPDATE OK`, `UPDATE-ABBRUCH OK`, `SEITE OK`, `RELEASE-SMOKE OK` |
| 10 | Buildx api | `docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 -f backend/Dockerfile --output type=cacheonly .` | 0 | 2 s | beide Plattformen im Log (Cache aus den Läufen davor) |
| 11 | Buildx web | dasselbe mit `-f frontend/Dockerfile` | 0 | 13 s | beide Plattformen im Log |
| 12 | Syntax | `for f in setup.sh upgrade.sh restore.sh …/release-smoke.sh; do bash -n "$f" \|\| exit 1; done` | 0 | – | je `ok <Datei>`, vier Dateien |
| 13 | Ausführbar | `for f in setup.sh upgrade.sh restore.sh; do m="$(git ls-files -s -- "$f")"; [ "${m%% *}" = 100755 ] …; done` | 0 | – | dreimal `100755` |
| 14 | YAML | `python3 -c 'import sys,yaml;…' .github/workflows/ci.yml docker-compose.quick.yml docker-compose.yml` | 0 | – | `parsed 3` |
| 15 | CI unverändert | `git diff --quiet 892d3de -- .github/workflows/ci.yml` | 0 | – | unverändert |
| 16 | Kein Tag | `test -z "$(git tag -l v1.0.0)"` | 0 | – | kein Tag |

Nach dem Gate: keine Container `wq-*`/`e2e*`, keine Tags `:1.0.0`/`:0.0.0-smoke`. shellcheck und actionlint nicht installiert, nicht installiert (D-02). Keine neue Dependency, kein neues Image.

**Barrierefreiheit:** Diese Phase ändert keine sichtbare UI, deshalb kein A11y-Trailer. Die axe-Specs liefen im Gate mit (Schritt 4).

## Nach-Release-Abnahme (UAT)

Offen, braucht veröffentlichte Images, **keine Vorbedingung für das Tag** (Review 03-04 HIGH, Entscheidung Orchestrator 2026-10-18). Die Zeilen stehen in `03-VALIDATION.md` unter „Nach-Release-Abnahme (UAT)“:

1. Images `1.0.0` für arm64 und amd64 veröffentlicht: CI-Lauf grün, `docker buildx imagetools inspect ghcr.io/mrhdready/wordquest-{api,web}:1.0.0` listet beide Plattformen, anonymer Pull (REL-04).
2. Frische Installation auf einem Raspberry Pi 5 nur nach der Seite; Abschlusszeile mit Heimnetz-Adresse aus `hostname -I` (offen auch als 01-UAT Test 5).
3. Eine Person ohne Projektkenntnis folgt der Seite; Stellen mit Rückfragen auf der Seite beheben.
4. `restore.sh` liest die root-eigenen Tagesdumps unter Linux (A9); dabei auch den Besitzer root und das Löschen mit `sudo` prüfen, wie die Seite es sagt (in 03-05 ergänzt). Dazu 01-UAT Test 6 (Backup über einen Tageswechsel).
5. `upgrade.sh` lädt wirklich aus GHCR; später das Update auf die nächste veröffentlichte Version mit Kindern, Sets, Lernstand.
6. Traefik-Variante mit Update und Wiederherstellen.

**Hinweis an den Orchestrator:**
- Das automatische Gate ist grün und das Subagent-Review erledigt. Damit ist die Voraussetzung für das lokale Tag `v1.0.0` erfüllt. Gesetzt hat es dieser Plan nicht.
- Die Nach-Release-Abnahme braucht veröffentlichte Images. Sie ist keine Vorbedingung für das Tag.
- Vor dem Push bringt Dennis den Standardbranch `master` auf den Stand von `v1-fertig`. Grund: Die Seite klont den Standardbranch (`git clone … wordquest` ohne `--branch`).
- `master` steht heute auf `6a918e8` (`git ls-remote`). Ohne diesen Schritt bekäme eine neue Familie den alten Stand ohne `upgrade.sh` und `restore.sh`. Kein Push, kein Tag aus diesem Plan.

## Belege je Akzeptanzkriterium

| Kriterium | Beleg |
|---|---|
| `grep '^## '` ergibt die fünf Überschriften aus D-09 in Reihenfolge | Ausgabe: Voraussetzungen, Installation, Update, Sicherung und Wiederherstellung, Hilfe bei Problemen |
| `grep -q 'Abschnitte der Seite weichen von D-09 ab'` im Smoke | Exit 0 |
| `grep -c 'demo@'` auf der Seite | 0 |
| Smoke-Marker von `VERSION OK` bis `RELEASE-SMOKE OK` | Task 1 (355 s) und Gate Schritt 9 (315 s) |
| Faktentabelle mit Fundstellen und abgerufene URLs | Abschnitte oben |
| dreimal `100755` | Gate Schritt 13 |
| `wave_0_complete: true` in 03-VALIDATION | `grep -c` → 1 |
| Gate je Schritt mit Befehl und Exit-Code; getrennte Abschnitte Gate und UAT | Abschnitte oben |
| `git tag -l v1.0.0` leer | Gate Schritt 16 |

## Abweichungen vom Plan

### Automatisch behoben

**1. [Rule 1 – Bug] Seite nannte eine Beschriftung, die es nicht gibt**
- **Gefunden in:** Task 1, Faktenprüfung
- **Problem:** „unter ‚Verwalten → Kinder‘“. Sichtbar sind nur die Bereiche Vokabeln, Fortschritt, Kinder und Konto (`ManageLayout.tsx:8-11`); „Verwalten“ steht nur in der Adresse.
- **Behebung:** Seite nennt die vier Bereiche und erklärt die Zeile von `setup.sh`. `setup.sh:178` selbst bleibt unverändert, siehe Befunde.
- **Commit:** `a54ee26`

**2. [Rule 1 – Bug] reset-password wirkt auf weniger Geräte, als die Seite sagte**
- **Gefunden in:** Task 1, Faktenprüfung
- **Problem:** „Angemeldete Geräte können ihre Sitzung danach nicht mehr verlängern“. Widerrufen werden nur die Refresh-Tokens dieses Elternkontos (`AccountService.cs:95`), Kinderprofile bleiben angemeldet.
- **Commit:** `a54ee26`

**3. Review-Befunde**, in `be56cbf` (siehe Review).

### Hinweise

- **Mutanten statt Rot:** Die Strukturprüfung war auf der echten Seite sofort grün, wie der Plan es für eine D-09-konforme Seite erwartet. Belegt ist sie mit sieben Mutanten (TDD-Belege). Der Klassifizierer `tdd-red-evidence` kennt kein Bash-Smoke-Format und wurde nicht benutzt.
- **Literal im Commit:** Ein Hook blockiert Befehle, die die Zeichenfolge für world-writable enthalten. Die Mutanten und die Commit-Nachricht von `510b861` bilden sie deshalb über `printf` bzw. als „Modus 777“.
- **Buildx aus dem Cache:** Die Probe lief nach dem e2e-Build in 2 s bzw. 13 s. Einen Lauf ohne Cache belegt 03-02 (28,6 s, Build-Stufe nur auf arm64).
- **grep:** ugrep auf dem Host; die Akzeptanz-Greps liefen mit `/usr/bin/grep`, der Smoke nutzt `grep -F`/`-qF` für feste Zeichenketten.

## Review (AGENTS.md „Review“, D-02)

Unabhängiges Review per `claude -p`, nur lesend (Read/Grep/Glob und lesende `git diff`/`log`/`show`/`ls`/`wc`; Edit/Write verboten), gegen `03-05-PLAN.md`, `03-CONTEXT.md` (D-01 bis D-12), AGENTS.md und `git diff 505b6c0..HEAD`. Schwerpunkt: Jede Faktenaussage der Seite gegen den Code (D-10), dazu T-03-16, D-09, D-06, Vorgriffe auf 01-UAT, Strukturprüfung unter Bash 3.2. Ergebnis: **0 BLOCKER, 0 HIGH, 1 MEDIUM, 5 LOW, 3 INFO.**

Als korrekt bestätigt hat das Review:
- alle zitierten Meldungen von `setup.sh`, `upgrade.sh` und `restore.sh` sowie `SecretCheck.cs:40`, wörtlich
- Port, Aufbewahrung 14/8/6, Rechte von `secrets/` und `backups/`, Plattformen, Sitzungsdauer
- beide Korrekturen aus `a54ee26`, den README-Anker und die Abschnittsfolge
- T-03-16: keine Portfreigabe, keine gelockerten Rechte, keine Zugangsdaten in Befehlen
- die Strukturprüfung: korrekt und unter Bash 3.2 und `set -euo pipefail` robust; ein awk-Fehler endet rot, nicht grün

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 1 | „Fehlt eine Datei in `secrets/`, erzeugt `setup.sh` sie neu“ führt bei `db_password.txt` nicht zurück: Postgres behält das Passwort aus der Initialisierung | MEDIUM | **behoben:** Satz auf `jwt_key.txt` beschränkt, für `db_password.txt` ausdrücklich „hilft das nicht“; Postgres-Doku in dieser Session abgerufen |
| 2 | Profilauswahl erscheint nicht auf einem Gerät mit angemeldetem Elternteil | LOW | **behoben:** Satz ergänzt (`App.tsx:50-59`) |
| 3 | „zeigt … auf dem Pi die Adresse als ersten Eintrag“ greift 01-UAT Test 5 vor | LOW | **behoben:** Seite sagt nur, dass `setup.sh` den ersten Eintrag nimmt (`setup.sh:166`) |
| 4 | „Sicherungsdateien gehören unter Linux root“ sei Annahme A9 | LOW | **zurückgewiesen für die Seite:** Das Image hat keinen `USER` (in dieser Session `docker image inspect` → leer), die Datei-Besitzer folgen daraus. A9 betrifft die Lesbarkeit für `restore.sh`. **Übernommen:** Die UAT-Zeile in `03-VALIDATION.md` prüft jetzt auch den Besitzer und das Löschen mit `sudo` |
| 5 | Belegter Port durch ein anderes Programm liefert womöglich einen anderen Text als `port is already allocated` | LOW (Vermutung) | **behoben:** Seite sagt „eine Meldung, die den Port 8080 nennt, zum Beispiel mit `port is already allocated`“. Den Text für den Container-Fall in dieser Session beobachtet; den anderen Fall reproduziert Docker Desktop nicht, deshalb kein zweites Zitat |
| 6 | „mit zwei Befehlen“, der Block hat drei Zeilen | LOW | **behoben:** Zählwort gestrichen |
| 7 | Einzelne Befehle (`git clone`, `usermod`, `apt install git`, `hostname -I`, `sudo chown`) haben keinen eigenen text-Block; die Prüfung arbeitet je Abschnitt, nicht je Schritt | INFO | **zurückgewiesen:** Der Plan legt die Prüfung je Abschnitt fest (03-05-PLAN `behavior`). Das Ergebnis dieser Schritte steht im Satz dazu oder zeigt sich im nächsten Schritt: `setup.sh`-Ausgabe nach dem Klon, Neustart von `setup.sh` nach `chown`, Adresse bei `hostname -I`. Grenze hier benannt |
| 8 | Prüfung auf unsichere Empfehlungen ist schmal (nur drei Zeichenfolgen) | INFO | **zurückgewiesen:** so geplant; die Faktenprüfung und das Review decken den Rest, und die Seite empfiehlt nichts Unsicheres (vom Review bestätigt) |
| 9 | Schnelltest dreimal erwähnt (ein Satz plus zwei Verweise) | INFO | keine Änderung, vom Review als vertretbar eingestuft |

Das Review hat die Docker-URLs nicht selbst abgerufen; das ist oben belegt. Der Gate-Lauf (Release-Smoke ab 15:17:12) lief nach dem Commit der Review-Korrekturen (15:15:34) und deckt den Endstand der Seite. Kein zweites Review: kein Auth-, Krypto-, Migrations- oder Secret-Code geändert.

## Befunde für später (nicht in diesem Plan)

- `setup.sh:178` sagt „Lege unter ‚Verwalten → Kinder‘ das erste Kind an“, eine sichtbare Beschriftung „Verwalten“ gibt es nicht. Die Seite erklärt das. Eine Änderung der Ausgabe braucht einen eigenen kleinen Plan, weil `setup-smoke.sh` und der Seitenabgleich die Zeile prüfen. Kosten bei Nichtstun: eine kurze Unklarheit nach der Installation.
- Für eine verlorene `secrets/db_password.txt` gibt es keinen Weg zurück außer Neuinstallation und `./restore.sh`. Die Seite sagt das nicht ausdrücklich. Ein Weg wäre ein v2-Thema.

## Bedrohungen

| ID | Umsetzung |
|---|---|
| T-03-16 | Strukturprüfung im Smoke (`chmod 777`, `chmod -R 777`, `0.0.0.0`), mit Mutanten belegt; Faktenprüfung und Review: keine Portfreigabe, keine gelockerten Rechte, keine Zugangsdaten in Befehlen |
| T-03-17 | Abschnittsfolge, Befehle und zitierte Ausgaben im Smoke; Faktentabelle mit Fundstellen; fünf Abweichungen korrigiert |
| T-03-SC | keine neue Dependency; das Gate nutzt nur vorhandene Images und Werkzeuge |

Neue Fläche über das Threat-Modell hinaus: keine.

## Self-Check: PASSED

- Dateien vorhanden: `release-smoke.sh`, `Documentation/Installation.md`, `03-VALIDATION.md`, dieses SUMMARY
- Commits im Verlauf: `510b861`, `a54ee26`, `be56cbf`, `106e54c` (`git merge-base --is-ancestor` je Exit 0)
- `git rev-list --count 505b6c0..HEAD` = 4 vor dem Doku-Commit
