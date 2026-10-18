---
phase: 03-installable-1-0-0-release
verified: 2026-10-18T13:31:52Z
status: human_needed
score: 3/4 must-haves verified
covered_files: [".env.example",".github/workflows/ci.yml",".planning/phases/03-installable-1-0-0-release/03-01-PLAN.md",".planning/phases/03-installable-1-0-0-release/03-01-SUMMARY.md",".planning/phases/03-installable-1-0-0-release/03-02-PLAN.md",".planning/phases/03-installable-1-0-0-release/03-02-SUMMARY.md",".planning/phases/03-installable-1-0-0-release/03-03-PLAN.md",".planning/phases/03-installable-1-0-0-release/03-03-SUMMARY.md",".planning/phases/03-installable-1-0-0-release/03-04-PLAN.md",".planning/phases/03-installable-1-0-0-release/03-04-SUMMARY.md",".planning/phases/03-installable-1-0-0-release/03-05-PLAN.md",".planning/phases/03-installable-1-0-0-release/03-05-SUMMARY.md",".planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh","Documentation/Installation.md","Documentation/README.md","Documentation/WordQuest_Konzept_und_Architektur.md","README.md","backend/Dockerfile","docker-compose.quick.yml","docker-compose.yml","frontend/Dockerfile","restore.sh","setup.sh","upgrade.sh"]
covered_digest: "v3:sha256:480b64ff9cd6a5c2fbcd834d875b8cdd1a1d3a817c3a9e90d1f192f0a2f3b8af"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Veröffentlichung: Standardbranch master auf den Stand von v1-fertig bringen, lokales Tag v1.0.0 anlegen (D-01, Orchestrator) und pushen; CI-Lauf abwarten; docker buildx imagetools inspect ghcr.io/mrhdready/wordquest-api:1.0.0 und -web:1.0.0; anonymer Pull"
    expected: "CI grün (backend, frontend, images api und web; Laufzeit des api-Jobs festhalten, vorher 10:57 min); beide Images listen linux/amd64 und linux/arm64; Pull ohne Anmeldung klappt; Image-Pfad kleingeschrieben"
    why_human: "REL-04 / Erfolgskriterium 1. Push und Release macht Dennis (03-CONTEXT „Nicht in dieser Phase“, D-12). Heute: git tag -l leer, origin/master = 6a918e8 ohne upgrade.sh, restore.sh und Installation.md (179 Commits hinter v1-fertig)"
  - test: "Leerer Raspberry Pi 5 mit Raspberry Pi OS 64-bit: jeden Schritt von Documentation/Installation.md wörtlich ausführen, Anmeldung vom Tablet"
    expected: "Elternlogin klappt; die Zeile „Fertig.“ von setup.sh zeigt eine im Heimnetz erreichbare Adresse aus hostname -I (offen auch als 01-UAT Test 5)"
    why_human: "REL-03, REL-04, Erfolgskriterium 2. ARM64-Hardware, Pi OS und Heimnetz fehlen lokal; Port 8080 auf dem Entwicklungsrechner belegt; veröffentlichte Images nötig"
  - test: "Eine Person ohne Projektkenntnis bekommt nur den Link auf Documentation/Installation.md und installiert"
    expected: "Sie kommt ohne Rückfrage bis zum Elternlogin; Stellen mit Rückfragen werden festgehalten und auf der Seite behoben"
    why_human: "Erfolgskriterium 2 spricht von einer neuen Person; der Smoke belegt nur, dass Befehle und zitierte Ausgaben stimmen"
  - test: "Auf dem Pi nach einem Tageslauf ls -l backups/daily, danach ./restore.sh mit einem Tagesdump (dazu 01-UAT Test 6, Sicherung über einen Tageswechsel)"
    expected: "Dateien gehören root, wie Installation.md:168 sagt; alte Stände nur mit sudo löschbar; restore.sh listet und liest die root-eigenen Dumps; danach ist der Stand der Sicherung sichtbar"
    why_human: "REL-02, REL-03. Auf Docker Desktop für macOS gehören die Dateien dem Benutzer; unter Linux schreibt der Sicherungsdienst als root (03-RESEARCH A9)"
  - test: "Auf dem Pi git pull und ./upgrade.sh ohne neue Version; später mit der nächsten veröffentlichten Version denselben Weg"
    expected: "Exit 0, Sicherung in backups/vor-update-…; nach dem echten Versionssprung Kinder, Sets und Lernstand unverändert"
    why_human: "REL-01, Erfolgskriterium 3. Im Smoke ersetzt ein Pull-Spy die Registry, und alte und neue Version sind dieselben Images unter zwei Tags; ein echter Versionssprung mit Migration ist erst nach dem Release möglich"
  - test: "Traefik-Stack nach README Variante B, danach ./upgrade.sh und ./restore.sh wie auf der Seite, Anmeldung über https://<WQ_HOST>"
    expected: "Update und Wiederherstellen laufen wie im Heimnetz-Stack; Anmeldung über HTTPS klappt"
    why_human: "REL-01, REL-02. Braucht Domain, Let's Encrypt und Ports 80/443; automatisiert ist nur der Heimnetz-Stack"
---

# Phase 3: Installable 1.0.0 Release — Verifikationsbericht

**Phasenziel:** Eine andere Familie installiert, aktualisiert und stellt WordQuest 1.0.0 in ihrem Heimnetz wieder her, nur anhand einer Installationsseite und ohne besonderes Know-how.
**Verifiziert:** 2026-10-18T13:31:52Z
**Status:** human_needed
**Re-Verifikation:** Nein — Erstverifikation

**Hinweis MVP-Modus:** ROADMAP führt die Phase mit `Mode: mvp`, das Ziel ist aber keine User Story (`user-story.validate` → `false`). Wie bei Phase 1 und 2 lief die normale Goal-Backward-Prüfung gegen die vier Erfolgskriterien.

**Evidenzbasis:**
- Selbst ausgeführt (2026-10-18, HEAD `86e46d8`, nur `bash -n`, Greps, `git` und die GSD-Abfragen; kein Docker nach Auftrag):
  - `bash -n` je Skript einzeln: `setup.sh`, `upgrade.sh`, `restore.sh`, `smoke/release-smoke.sh` → je `ok`.
  - `git ls-files -s setup.sh upgrade.sh restore.sh` → dreimal `100755`.
  - `git diff --stat 892d3de -- .github/workflows/ci.yml` → leer (unverändert).
  - `git tag -l` → leer. `git rev-parse --short origin/master` → `6a918e8`; `git rev-list --count origin/master..v1-fertig` → 179; `origin/master` hat kein `upgrade.sh`, kein `restore.sh`, keine `Documentation/Installation.md` (lokaler Remote-Ref, nicht frisch abgerufen).
  - `git diff --stat be56cbf HEAD` → nur `.planning/`-Dateien. Code, Seite und Smoke sind seit dem Gate-Lauf unverändert.
  - Lektüre: `Documentation/Installation.md` Zeile für Zeile gegen `setup.sh`, `upgrade.sh`, `restore.sh`, `docker-compose.quick.yml`, `docker-compose.yml`, `.env.example`, `.gitignore`, `SecretCheck.cs`, `AuthOptions.cs`, `AccountService.cs`, `ManageLayout.tsx`, `ci.yml`, beide Dockerfiles; `release-smoke.sh` vollständig.
  - `verify.artifacts` / `verify.key-links` über alle 5 Pläne; `check.decision-coverage-verify` (12/12).
- **Übernommen, nicht selbst beobachtet** (Quelle `03-05-SUMMARY.md`, Abschnitt „Automatisches Gate“, Lauf auf `be56cbf`):
  - Backend-Gate: Release-Build `0 Warning(s)`, Learning.Tests 137, Api.Tests 251, je 0 failed.
  - Frontend-Gate in `node:22`: vitest 14 Dateien, 230 passed; DESIGN.md `errors: 0, warnings: 0`.
  - e2e: 48 passed, 1 skipped (`first-run.spec.ts`, läuft im Release-Smoke); 5 axe-Specs mit 0 Verstößen.
  - `setup-smoke.sh` (`SMOKE OK`), `proxy-xff-check.sh` (`PROXY-XFF OK`).
  - Release-Smoke 315 s, Exit 0, Marker `VERSION OK` → `INSTALL OK` → `RESTORE OK` → `RESTORE-FEHLER OK` → `UPDATE OK` → `UPDATE-ABBRUCH OK` → `SEITE OK` → `RELEASE-SMOKE OK`.
  - Buildx-Probe `linux/arm64,linux/amd64` für beide Dockerfiles, Exit 0 (aus dem Cache; Lauf ohne Cache in 03-02).
  - YAML-Parse von `ci.yml` und beiden Compose-Dateien (`parsed 3`).
  - Kein Artefakt dieser Läufe liegt im Repo. Die Zahlen stammen nur aus dem SUMMARY.

## Zielerreichung

### Beobachtbare Wahrheiten (ROADMAP-Erfolgskriterien)

| # | Wahrheit | Status | Beleg |
|---|----------|--------|-------|
| 1 | API- und Web-Image sind mit dem Tag `1.0.0` für die Heimserver-Architektur veröffentlicht, und eine frische Installation zieht dieses Tag statt `master` | ? UNCERTAIN (Nach-Release) | **Lokaler Teil verifiziert:** `.env.example:12` `WQ_IMAGE_PREFIX=ghcr.io/mrhdready/wordquest`, `:16` `WQ_VERSION=1.0.0`; Standardwerte `${WQ_VERSION:-1.0.0}` und `${WQ_IMAGE_PREFIX:-ghcr.io/mrhdready/wordquest}` in `docker-compose.quick.yml:42,70` und `docker-compose.yml:31,60`; `setup.sh:66-75` kopiert `.env.example` mit Enter-Standard. Kein `master` mehr in Compose, Skripten, `.env.example` oder Seite (Grep; einziger Treffer `README.md:25` beschreibt die CI). `ci.yml:3-6` startet bei Tags `v*`, `:126-131` `type=semver,pattern={{version}}` (aus `v1.0.0` wird `1.0.0`), `:139` `linux/amd64,linux/arm64`. `FROM --platform=$BUILDPLATFORM` in `backend/Dockerfile:9` und `frontend/Dockerfile:7`. Smoke `VERSION OK` und Image-Namen der Container (`release-smoke.sh:58-76,157-160`) übernommen. **Offen:** Die Veröffentlichung gibt es noch nicht: kein Tag `v1.0.0`, `origin/master` auf `6a918e8`. → Human-Item 1 |
| 2 | Wer nur der Installationsseite folgt (Installation, Update, Sicherung/Wiederherstellung), kommt als projektfremde Person vom leeren Gerät bis zum Elternlogin im Heimnetz-Modus | ✓ VERIFIED (mechanischer Teil, Lauf übernommen) | Seite `Documentation/Installation.md` mit genau den Abschnitten aus D-09 (`:5`, `:36`, `:99`, `:150`, `:208`). Faktenprüfung selbst, siehe „Faktenabgleich der Installationsseite“: keine Abweichung zwischen Seite und Code gefunden. Der Smoke führt die Seitenbefehle aus oder nennt sie mit Grund als Handgriff (`release-smoke.sh:124-143`). Er prüft jede zitierte Ausgabe gegen die Logs dieses Laufs (`:684-691`) und Abschnittsfolge, Befehl und Ergebnis je Abschnitt (`:654-668`). Installation per `setup.sh` mit Enter beim Präfix, danach Login 200 (`:145-164`). Lauf übernommen. **Offen:** neue Person, echter Pi. Außerdem klont die Seite den Standardbranch (`Installation.md:41`), und `origin/master` hat die Seite und die Skripte noch nicht. → Human-Items 1–3 |
| 3 | `upgrade.sh` schreibt vor dem Laden der neuen Version eine DB-Sicherung, und Kinder, Sets und Lernstand der Familie sind nach dem Update unverändert | ✓ VERIFIED (Lauf übernommen) | Reihenfolge im Code: Sicherung und Prüfung (`upgrade.sh:52-62`: gzip, Endzeile, `COPY public.app_user`, `umask 077`) → Laden mit `WQ_VERSION` aus der Shell (`:69-70`) → erst danach `.env` (`:83-89`) → `up -d` (`:95`) → Health (`:97-106`) → Neustart `web` (`:109`). Ohne Sicherung `die` vor dem Pull (`:58-61`). Smoke: Pull-Spy protokolliert `ziel=1.0.0 env=0.0.0-smoke` (Pull vor `.env`, `release-smoke.sh:525`), Sicherung vorhanden, `-rw-------`, mit Lernstand (`:466-472`). Fingerabdruck über 11 Fachtabellen vor und nach dem Update gleich (`:482,535`). „Keine Sicherung“ → Spy-Zähler unverändert, also kein Pull (`:576-583`). Fehlende Version, Startfehler, Health-Timeout und Weg zurück einzeln geprüft (`:586-641`). Lauf übernommen. **Grenze:** Alte und neue Version sind dieselben Images, eine Migration zwischen Versionen läuft nicht. → Human-Item 5 |
| 4 | `restore.sh` stellt eine gewählte Sicherung wieder her, und danach sieht das Elternteil die Daten dieses Stands | ✓ VERIFIED (Lauf übernommen) | Ablauf nach D-08: Liste neueste zuerst, Hardlinks einmal (`restore.sh:44-57`), Auswahl (`:58-65`), Prüfung vor jeder Änderung (`:69`), `ja` (`:73-75`), Vorher-Sicherung (`:93-105`), `stop api backup` (`:108`), Drop/Create und Einspielen in einer Transaktion mit `ON_ERROR_STOP` und `pipefail` (`:115-129`), Rückfall (`:149-159`), Start und Neustart von `web` (`:133-144,162-165`). Smoke: Kind gelöscht, Wiederherstellung über die Liste, danach Fingerabdruck = S1 und `refresh_token` leer. „Erstes Kind“ steht in `/api/v1/learners` des neu angemeldeten Elternteils (`release-smoke.sh:258-312`). Fehlerpfade `RESTORE-FEHLER OK`. Lauf übernommen. Root-eigene Dumps unter Linux → Human-Item 4 |

**Score:** 3/4 Wahrheiten verifiziert (0 present, behavior-unverified). Kriterium 1 ist lokal belegt; die Veröffentlichung entsteht erst mit dem Tag.

**Einschränkung zu 2–4:** Alle Verhaltensbelege stammen aus dem übernommenen Release-Smoke-Lauf auf `be56cbf`. Selbst geprüft ist nur, dass der Smoke diese Zustände wirklich prüft. Das zeigt die Lektüre: Fingerabdruck, Spy-Protokoll, Zähler und HTTP-Codes, keine bloßen Existenzprüfungen. Code, Seite und Smoke sind seit `be56cbf` unverändert.

### Faktenabgleich der Installationsseite (D-10, selbst geprüft)

| Seite | Aussage | Fundstelle | Ergebnis |
|---|---|---|---|
| :7 | arm64 und x86-64 | `ci.yml:139` | stimmt |
| :51-58 | Präfix, dann E-Mail, Passwort zweimal, ≥ 8, unsichtbar | `setup.sh:68`, `:90-95` (Laden und Start davor), `:120`, `:129-136` (`read -s`, `< 8`) | stimmt |
| :53 | Enter übernimmt `ghcr.io/mrhdready/wordquest` | `setup.sh:66-69`, `.env.example:12` | stimmt |
| :55 | Version 1.0.0 | `.env.example:16` → `.env` per `setup.sh:75` | stimmt |
| :63-68 | Ausgabezeilen | `setup.sh:76`, `:103`, `:149`, `:174`, `:178`, `:179` | wörtlich |
| :71 | erster Eintrag von `hostname -I` | `setup.sh:166` | stimmt |
| :77, :216 | Port 8080, `WQ_PORT` in `.env`, `setup.sh` erneut | `docker-compose.quick.yml:72`, `setup.sh:168-169` | stimmt |
| :85 | vier Dienste `api`, `backup`, `db`, `web` | `docker-compose.quick.yml:23,41,69,77` | stimmt |
| :89 | `secrets/` nur für dich lesbar | `setup.sh:23` (700), `:49` (644 im geschützten Ordner) | stimmt |
| :93 | zweiter Lauf ändert nichts | `setup.sh:36-38`, `:60-61`, `:117`, `:151` | stimmt |
| :95 | Bereiche Vokabeln, Fortschritt, Kinder, Konto | `ManageLayout.tsx:8-11` | stimmt |
| :109 | Zielversion aus `git pull`, Sicherung `vor-update-<Datum>-<Uhrzeit>`, geprüft, dann Laden, `.env`, Start, Warten | `upgrade.sh:25`, `:57`, `:58-62`, `:69`, `:83-89`, `:95`, `:97-106` | stimmt |
| :112-118 | Ausgabezeilen Update | `upgrade.sh:28`, `:62`, `:68`, `:92`, `:97`, `:111`, `:113` | wörtlich |
| :123 | `git pull` lässt `.env`, `secrets/`, `backups/` unverändert | `.gitignore:18,19,24` | stimmt |
| :130 | Meldung „Version … ließ sich nicht laden …“ | `upgrade.sh:70` | wörtlich |
| :133 | Meldung „Die Sicherung vor dem Update ist fehlgeschlagen …“ | `upgrade.sh:60` | wörtlich |
| :137, :140 | Meldung mit Weg zurück; alternativ „Der Start der Version … ist fehlgeschlagen.“ | `upgrade.sh:73-77`, `:95`, `:106`, `:109` | wörtlich |
| :146 | `restore.sh` startet mit der Version aus `.env` | `restore.sh:135` (`docker compose up -d`) | stimmt |
| :152 | täglich, 14/8/6, Ordner nur für dich lesbar | `docker-compose.quick.yml:84-87`, `setup.sh:57` | stimmt |
| :157-166 | `/backup.sh`, `SQL backup created successfully`, `backups/daily/wordquest-<Datum>.sql.gz` | Image-intern; Smoke `:175-181` | übernommen (Smoke) |
| :168 | Dienst als root, Dateien unter Linux root-eigen | Image ohne `USER` laut 03-05-SUMMARY | übernommen → Human-Item 4 |
| :178 | nur `ja` ersetzt | `restore.sh:74-75` | stimmt |
| :181-187 | Ausgabezeilen Wiederherstellen | `restore.sh:52`, `:55` (`%3d)`), `:73`, `:105`, `:162`, `:165` | wörtlich |
| :190 | erst prüfen, dann Vorher-Sicherung; steht danach in der Liste | `restore.sh:69`, `:93-105`, `:47` (`backups/*.sql.gz`) | stimmt |
| :194-196 | abgelehnt / Rückfall / API bleibt gestoppt | `restore.sh:69`, `:149-158`, `:154` | stimmt |
| :198 | Pfad-Argument, Prüfung und Rückfrage gleich | `restore.sh:36-38`, `:69-75` | stimmt |
| :204 | eigene `.sql.gz` in `backups/` gelistet | `restore.sh:47` | stimmt |
| :206 | alle Geräte neu anmelden, spätestens nach rund 15 Minuten | `restore.sh:126` (`DELETE FROM public.refresh_token`), `AuthOptions.cs:15` | stimmt |
| :212 | Meldung Images | `setup.sh:91` | wörtlich |
| :220 | Meldung Ordner `backups` | `setup.sh:56` | wörtlich (Escapes aufgelöst) |
| :231-236 | `reset-password`, nur Geräte dieses Elternkontos | `AccountCommands.cs:22`, `AccountService.cs:95` | stimmt |
| :240 | Meldung API nicht bereit | `setup.sh:108` | wörtlich |
| :250 | „Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt …“ | `SecretCheck.cs:40` | stimmt |
| :252 | fehlende `jwt_key.txt` wird neu erzeugt | `setup.sh:34-46` | stimmt |
| :254 | `docker compose -p wordquest-quick down`, Volume bleibt | D-06; alter Schnelltest `git show 6a918e8:docker-compose.quick.yml` (`name: wordquest-quick`, Dienste `db`, `api`, `web`) | plausibel, nicht ausgeführt (siehe Anti-Patterns) |
| :256 | Anker README Variante B | `README.md:33` | stimmt |

Ergebnis: Keine Faktenaussage widerspricht dem Code. Zwei Aussagen sind nur über den übernommenen Smoke belegt (`:157-168`), eine ist nirgends ausgeführt (`:254`).

### Plan-Must-Haves

- Artefakte 16/16 laut `verify.artifacts` (03-01: 4, 03-02: 3, 03-03: 3, 03-04: 3, 03-05: 3).
- Key-Links 10/11 laut `verify.key-links`. Die eine Abweichung ist ein Werkzeug-Fehlalarm: In 03-05 ist das Ziel eine Liste mit Kommas (`setup.sh, upgrade.sh, restore.sh, docker-compose.quick.yml`), die der Muster-Check nicht auflöst. Manuell: `release-smoke.sh:117` setzt `PAGE=Documentation/Installation.md`, `:126-130` und `:676-691` gleichen die Seite gegen den Lauf ab → WIRED.
- Truths aus 03-05: Abschnittsfolge (selbst geprüft, `^## `-Überschriften in D-09-Reihenfolge), T-03-16 (Grep: kein `chmod 777`, kein `0.0.0.0`, keine Zugangsdaten in Befehlen; nur der Beispiel-Platzhalter `eltern@example.de`). Volles Gate: übernommen. Zweistufige Freigabe: 03-VALIDATION:78-91 und :104-109.
- Keine `prohibitions`, keine `<human-check>`-Blöcke und keine `backstop`-Truths in den Plänen.

### Erforderliche Artefakte

| Artefakt | Erwartung | Status | Details |
|----------|-----------|--------|---------|
| `Documentation/Installation.md` | die eine Seite nach D-09 | ✓ VERIFIED | 256 Zeilen, fünf Abschnitte, verlinkt aus `README.md:20,222` und `Documentation/README.md:7` |
| `upgrade.sh` | REL-01 | ✓ VERIFIED | 113 Zeilen, `100755`, `bash -n` ok |
| `restore.sh` | REL-02 | ✓ VERIFIED | 165 Zeilen, `100755`, `bash -n` ok |
| `setup.sh` | Enter übernimmt das Präfix, Version 1.0.0 | ✓ VERIFIED | `:66-75` |
| `.env.example`, `docker-compose.quick.yml`, `docker-compose.yml` | `1.0.0` und Präfix-Standard | ✓ VERIFIED | s. SK 1 |
| `backend/Dockerfile`, `frontend/Dockerfile` | Build-Stage auf `$BUILDPLATFORM` | ✓ VERIFIED | `:9` bzw. `:7`; Buildx-Probe übernommen |
| `.planning/phases/03-…/smoke/release-smoke.sh` | Release-Smoke mit Markerkette | ✓ VERIFIED | 695 Zeilen, acht Marker (`:76`, `:164`, `:312`, `:433`, `:546`, `:649`, `:692`, `:695`), `bash -n` ok |
| `.planning/phases/03-…/03-VALIDATION.md` | Gate-Status, Nach-Release-Abnahme | ✓ VERIFIED | `:78-91`, `:104-109` |

### Key-Link-Verifikation

| Von | Nach | Via | Status |
|-----|------|-----|--------|
| `setup.sh` | `.env.example` | Präfix-Standard und Version aus einer Quelle (`:66`, `:75`) | WIRED |
| `upgrade.sh` | `.env.example` | Zielversion (`:25`) | WIRED |
| `upgrade.sh` | `restore.sh` | Sicherung `backups/vor-update-*` erscheint in der Liste (`restore.sh:47`); Meldung nennt `./restore.sh <Datei>` (`upgrade.sh:74-75`) | WIRED |
| `restore.sh` / `upgrade.sh` | `frontend/nginx.conf` | `docker compose restart web` nach dem API-Start (`restore.sh:138`, `upgrade.sh:109`) | WIRED |
| `ci.yml` | Dockerfiles | `file: ${{ matrix.dockerfile }}`, `platforms: linux/amd64,linux/arm64` | WIRED |
| `release-smoke.sh` | `Installation.md` | Seitenabgleich `page_cmd`, `page_lines`, Strukturprüfung | WIRED |
| `README.md`, `Documentation/README.md` | `Installation.md` | Links | WIRED |

### Datenfluss (Level 4)

Nicht anwendbar: Die Phase rendert keine dynamischen Daten. Den Datenweg Sicherung → Datenbank → API belegt der Smoke über Fingerabdruck und `/api/v1/learners` (übernommen).

### Verhaltens-Stichproben

| Verhalten | Befehl | Ergebnis | Status |
|-----------|--------|----------|--------|
| Skriptsyntax | `bash -n` je Datei (4) | je `ok` | ✓ PASS |
| Ausführbar | `git ls-files -s setup.sh upgrade.sh restore.sh` | dreimal `100755` | ✓ PASS |
| CI unverändert seit Plan-Review | `git diff --stat 892d3de -- .github/workflows/ci.yml` | leer | ✓ PASS |
| Code seit Gate unverändert | `git diff --stat be56cbf HEAD` | nur `.planning/` | ✓ PASS |
| Release-Smoke, Gate | — | laut 03-05-SUMMARY alle 16 Schritte Exit 0 | ? übernommen (Docker nach Auftrag nicht gestartet) |

### Probe-Ausführung

Keine `scripts/*/tests/probe-*.sh` vorhanden, keine Probes in PLAN oder SUMMARY deklariert. Der Release-Smoke ist das Prüfskript der Phase; er braucht Docker und wurde nach Auftrag nicht ausgeführt (s. Evidenzbasis).

### Anforderungsabdeckung

| Anforderung | Plan | Status | Beleg |
|-------------|------|--------|-------|
| REL-01 | 03-04, 03-05 | ✓ SATISFIED (Lauf übernommen; echter Versionssprung offen) | SK 3 |
| REL-02 | 03-03, 03-05 | ✓ SATISFIED (Lauf übernommen; Linux-Rechte offen) | SK 4 |
| REL-03 | 03-01, 03-03, 03-04, 03-05 | ✓ SATISFIED (Seite und Faktenabgleich; neue Person offen) | SK 2, Faktenabgleich |
| REL-04 | 03-01, 03-02, 03-05 | ? NEEDS HUMAN (lokal belegt, Veröffentlichung offen) | SK 1; `REQUIREMENTS.md:51,117` führt sie zu Recht als `Pending` |

Keine verwaisten Anforderungen: alle vier Phase-3-IDs (`REQUIREMENTS.md:114-117`) stehen in mindestens einem Plan.

### Entscheidungen D-01 bis D-12

| Entscheidung | Status | Beleg |
|--------------|--------|-------|
| D-01 Branch `v1-fertig`, kein Push, Tag durch den Orchestrator nach grünem Gate | ⚠️ teilweise | kein Push (`origin/master` = `6a918e8`); Gate laut SUMMARY grün; Tag `v1.0.0` **noch nicht gesetzt** (`git tag -l` leer) |
| D-02 Review, `bash -n` | ✓ | `bash -n` selbst; Reviews in den SUMMARYs; shellcheck nicht installiert |
| D-03 nur `$BUILDPLATFORM`, `ci.yml` unverändert | ✓ | Dockerfiles `:9`/`:7`; `git diff 892d3de` leer |
| D-04 Version 1.0.0, Präfix mit Enter | ✓ | SK 1 |
| D-05 Ablauf `upgrade.sh` | ✓ (bewusst geänderte Reihenfolge) | Pull vor dem Schreiben der `.env` statt danach (`upgrade.sh:65-70`, 03-RESEARCH Pitfall 9). Strenger als D-05: Eine fehlende Version ändert nichts |
| D-06 kein Umstieg alter Schnelltests (Dennis) | ✓ | Seite ein Satz (`Installation.md:148`, `:254`), Verweis bei belegtem Port (`:216`); kein Code; Smoke nur Handgriff (`release-smoke.sh:137`); `grep -c 'demo@'` auf der Seite → 0 |
| D-07 Sicherung unter `./backups/` mit eigenem Präfix | ✓ | `upgrade.sh:57`, `restore.sh:47` |
| D-08 Ablauf `restore.sh` | ✓ | SK 4 |
| D-09 genau eine Seite, fünf Abschnitte, Traefik nur als Verweis | ✓ | `Installation.md:256`; README auf Verweis gekürzt (`README.md:17-31`) |
| D-10 Seite = Code | ✓ | Faktenabgleich oben |
| D-11 Belege per lokalem Smoke | ✓ (soweit D-06 sie nicht ersetzt) | Smoke; der Teil „Altinstallation mit Passwort `wordquest`“ ist durch D-06 entfallen |
| D-12 SK 1 lokal teilweise | ✓ | YAML-Parse und Buildx übernommen; Veröffentlichung → Human-Item 1 |

Decision Coverage (`check.decision-coverage-verify`): 12/12 Entscheidungen in den Artefakten wiedergefunden.

### Test-Qualität

| Testdatei | Anforderung | Aktiv | Übersprungen | Zirkulär | Stärke | Urteil |
|-----------|-------------|-------|--------------|----------|--------|--------|
| `smoke/release-smoke.sh` | REL-01..04 | 8 Marker | 0 | nein (Fingerabdruck vorher/nachher aus der DB, Spy-Protokoll, HTTP-Codes) | Verhalten | ok |
| `frontend/e2e/first-run.spec.ts` | REL-03 (echter Lernstand) | 1 | bedingt (`:8`, nur mit `WQ_E2E_FIRST_RUN`, läuft im Smoke) | nein | Verhalten | ok |

Keine deaktivierten Tests ohne Ersatz. Grenze: Das Update testet dieselben Images unter zwei Tags (`release-smoke.sh:439-451`), also keine Migration zwischen Versionen.

### Anti-Patterns und Befunde

| Datei | Zeile | Befund | Schwere | Auswirkung |
|-------|-------|--------|---------|------------|
| 12 geänderte Dateien + Smoke | — | TBD/FIXME/XXX/TODO/HACK/Platzhalter | — | keine Treffer |
| Repo (Tags) | — | Tag `v1.0.0` fehlt; D-01 (`03-CONTEXT.md:24`) sieht ihn nach grünem Gate durch den Orchestrator vor | ⚠️ Warning | Ohne Tag kein CI-Lauf für `1.0.0`; Voraussetzung für Human-Item 1 |
| `Documentation/Installation.md` | 41 | Die Seite klont den Standardbranch; `origin/master` = `6a918e8` hat keine `Installation.md`, kein `upgrade.sh`, kein `restore.sh`, und `docker-compose.quick.yml` heißt dort noch `wordquest-quick` (Schnelltest per `curl`) | ⚠️ Warning | Bis `master` auf `v1-fertig` steht, landet eine neue Familie auf dem alten Stand. Schritt vor dem Push (03-05-SUMMARY:179-180), in Human-Item 1 |
| `Documentation/Installation.md` | 254 | `docker compose -p wordquest-quick down` lief nirgends: Der Smoke führt ihn nur als Handgriff (`release-smoke.sh:137`), 03-RESEARCH hat nur `stop` geprobt (`:233`, `:428`) | ℹ️ Info | Plausibel: Im Ordner `wordquest` sind die alten Dienste `db`, `api`, `web` eine Teilmenge der heutigen Datei, `down` ohne `-v` lässt das Volume stehen. Beim Pi-Lauf mitprüfen, falls ein alter Schnelltest vorhanden ist |
| `.planning/phases/03-…/03-CONTEXT.md` | 69 | D-11 beschreibt noch die Altinstallation „Schnellstart mit Passwort `wordquest` und Demo-Account“ als Smoke-Teil | ℹ️ Info | Durch D-06 (`:43`) überholt; Code und Smoke folgen D-06. Nur Planungsdoku |
| `Documentation/README.md` | 7 | Beschreibung „Installation, Sicherung und Hilfe im Heimnetz“ nennt Update und Wiederherstellung nicht | ℹ️ Info | Index-Text hinter dem Seiteninhalt (seit 03-03/03-04) |
| `Documentation/Installation.md` | 121 | „lädt höchstens neuere Images für die Datenbank und den Sicherungsdienst“; `upgrade.sh:69` lädt alle Dienste (auch `api`/`web` mit gleichem Tag, in Variante B `proxy`) | ℹ️ Info | Für den Heimnetz-Stack bei unverändertem Tag zutreffend; keine Fehlaussage für Eltern |
| `restore.sh` | 12, 37 | `cd "$(dirname "$0")"` vor dem Pfad-Argument: Relative Pfade gelten ab dem Installationsordner | ℹ️ Info | Die Seite ruft immer im Ordner `wordquest` auf (`Installation.md:172`, `:198`); aus einem anderen Ordner endet es mit „gibt es nicht. Es wurde nichts geändert.“ |
| `setup.sh` | 178 | „Verwalten → Kinder“ ist keine sichtbare Beschriftung | ℹ️ Info | Bekannt (03-05-SUMMARY:247), die Seite erklärt es (`Installation.md:95`) |

Keine Blocker.

### Menschliche Prüfung erforderlich (Nach-Release-Abnahme aus 03-VALIDATION)

1. **Veröffentlichung (REL-04)**: Davor `master` auf `v1-fertig` bringen und das Tag `v1.0.0` setzen. Dann pushen und den CI-Lauf abwarten. `imagetools inspect` für `-api:1.0.0` und `-web:1.0.0` muss arm64 und amd64 listen, ein anonymer Pull muss klappen.
2. **Frische Installation auf dem Raspberry Pi 5** nur nach der Seite; Abschlusszeile mit Heimnetz-Adresse aus `hostname -I` (01-UAT Test 5).
3. **Projektfremde Person folgt der Seite**; Stellen mit Rückfragen festhalten und auf der Seite beheben.
4. **Root-eigene Tagesdumps unter Linux**: Besitzer root, Löschen mit `sudo`, danach `./restore.sh` mit einem Tagesdump (dazu 01-UAT Test 6).
5. **`upgrade.sh` lädt wirklich aus GHCR**: zuerst ohne neue Version; später mit der nächsten Version, danach Kinder, Sets und Lernstand prüfen.
6. **Traefik-Variante** mit Update und Wiederherstellen.

### Zusammenfassung

Keine Lücken im Code. `upgrade.sh` und `restore.sh` setzen D-05, D-07 und D-08 vollständig um. Jeder Fehlerpfad gibt seinen Fehler ausdrücklich weiter, auch innerhalb von `if`-Aufrufen. Die Sicherung liegt vor dem Laden. Die `.env` wird erst nach erfolgreichem Laden geschrieben. Ein gescheitertes Einspielen spielt den Stand von vorher zurück. Die Installationsseite hat die fünf Abschnitte aus D-09. Jede Faktenaussage, die sich am Code prüfen lässt, stimmt mit `setup.sh`, `upgrade.sh`, `restore.sh`, den Compose-Dateien und den zitierten C#-Stellen überein; Meldungstexte stimmen wörtlich. D-06 ist eingehalten: ein Satz auf der Seite, kein Code, kein Smoke-Teil.

Die Verhaltensbelege für die Kriterien 2–4 sind übernommen (Release-Smoke und Gate auf `be56cbf`, Code seitdem unverändert), nicht selbst beobachtet. Kriterium 1 ist nur lokal belegt: Das Tag `v1.0.0` fehlt noch, und `origin/master` steht auf `6a918e8`. Bis `master` nachgezogen ist, führt die Seite eine neue Familie auf den alten Stand. Offen sind die sechs Prüfungen der Nach-Release-Abnahme.

---

_Verifiziert: 2026-10-18T13:31:52Z_
_Verifier: Claude (gsd-verifier)_
