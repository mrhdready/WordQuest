# Phase 3: Installable 1.0.0 Release – Research

**Researched:** 2026-10-18
**Domain:** GitHub Actions + GHCR (Multi-Arch-Images), Docker Compose v2, PostgreSQL 17 (pg_dump/psql), Bash-Betriebsskripte, Installationsdoku für Laien
**Confidence:** HIGH für Code- und Laufzeitbefunde (Datei:Zeile gelesen, Docker-Proben in dieser Session), MEDIUM für das Verhalten auf einem echten Raspberry Pi (nicht verfügbar), eine Annahme in D-06 ist widerlegt (siehe Open Question 1)

> **Stand nach dem Replan (2026-10-18):** Open Question 1 ist durch D-06 entschieden (kein Umstieg). Damit sind überholt: Umstieg Option A/B, Demo-Fall und PIN-Hinweis in `upgrade.sh`, gemeinsame Shell-Datei, Altinstallation im Smoke (Abschnitte 2 und 6, Code-Beispiele „Demo-Abbruch erkennen“ und „Altes Schnelltest-Volume sichern“, Test-Map-Zeile „Altinstallation“). Maßgeblich sind die Pläne 03-01 bis 03-05; die Nummern 03-03 (Wiederherstellen) und 03-04 (Update) gelten seit der Teilung des früheren 03-01.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ablauf
- **D-01:** Autonomer Lauf auf Branch `v1-fertig`.
  - Atomare Commits pro Plan, **kein Push**.
  - Das Release wird nur lokal vorbereitet: Workflow, Skripte, Installationsseite und am Ende das lokale Tag `v1.0.0`. Das Tag legt der Orchestrator erst nach grünem Gate und Abnahme an, nicht ein Plan.
  - Pläne laufen sequenziell im Arbeitsbaum, weil sie Docker-Stacks und Ports teilen.
- **D-02:** Jede Änderung bekommt vor der Fertig-Meldung ein Subagent-Review (AGENTS.md). Shell-Skripte laufen zusätzlich durch `bash -n` und, falls installiert, `shellcheck`. shellcheck wird nicht neu installiert.

#### Images und Version (REL-04)
- **D-03:** GHCR-Workflow in `.github/workflows/`.
  - Auslöser ist ein Tag `v*`. Er baut `wordquest-api` und `wordquest-web` für `linux/arm64` (Raspberry Pi 5, ARM-NAS) und `linux/amd64` (x86-NAS) und schiebt sie mit dem Tag ohne `v` nach `ghcr.io/<owner>/wordquest-*`, also `1.0.0`.
  - Die bestehende CI (`ci.yml`) bleibt unverändert. Ob es einen Workflow für `master` gibt und wie er heißt, klärt die Recherche (README Zeile 19 nennt Builds auf `master`).
  - Nur Actions aus dem `docker/`- und `actions/`-Namespace, auf Versionen gepinnt.
- **D-04:** Die Installation zieht eine feste Version statt `master`.
  - In `docker-compose.quick.yml` und `docker-compose.yml` wird der Standard für `WQ_VERSION` `1.0.0`.
  - `setup.sh` schreibt `WQ_VERSION=1.0.0` in die `.env`.
  - Das Image-Präfix bekommt den Standard `ghcr.io/mrhdready/wordquest`, die Frage in `setup.sh` lässt sich mit Enter übernehmen. Eltern sollen keinen Registry-Pfad kennen müssen (Einfachheit).

#### Update (REL-01)
- **D-05:** `upgrade.sh` im Repo-Root, gleicher Stil wie `setup.sh` (`die`/`warn`, deutsche ganze Sätze, Abbruch ohne halben Zustand).
  - Reihenfolge: Datenbank sichern, prüfen, dass die Sicherung lesbar und nicht leer ist, die neue Version in `.env` setzen, `docker compose pull` und `up -d`, auf Health warten.
  - Ohne geprüfte Sicherung wird nichts gezogen.
  - Die Zielversion ist die, die das ausgecheckte Repo mitbringt. Der Weg für Eltern ist `git pull` und dann `./upgrade.sh`. Die Recherche bestätigt diesen Weg oder schlägt einen einfacheren vor.
- **D-06:** Umstieg alter Schnellstart-Installationen. Pflicht, offen aus Phase 1, steht in STATE „Pending Todos“.
  - Das `pgdata`-Volume alter Installationen nutzt `POSTGRES_PASSWORD=wordquest`, und die API verweigert diesen Wert seit 01-05. `upgrade.sh` erkennt den Fall und setzt das Rollenpasswort auf das Secret aus `setup.sh`, per `ALTER ROLE` im laufenden DB-Container. Danach startet die API.
  - Der Demo-Account aus alten Installationen bricht den Start in Production ab (`DemoAccountCheck`), ebenso das Demo-Kind mit PIN `1234`. `upgrade.sh` erkennt beides und führt mit einer klaren Frage und vorhandenen CLI-Verben der API durch die Lösung, ohne Lerndaten zu löschen.
  - Welche CLI-Verben es schon gibt, klärt die Recherche (`Program.cs`, `DemoAccountCheck.cs`).
- **D-07:** Die bestehende tägliche Sicherung (`prodrigestivill/postgres-backup-local`, `./backups`) bleibt. Die Sicherung von `upgrade.sh` landet ebenfalls unter `./backups/` mit eigenem Präfix, damit `restore.sh` sie in derselben Liste anbietet.

#### Wiederherstellen (REL-02)
- **D-08:** `restore.sh` im Repo-Root.
  - Ablauf:
    1. Verfügbare Sicherungen nummeriert auflisten, die neueste zuerst.
    2. Eine auswählen lassen.
    3. Ausdrücklich bestätigen lassen.
    4. Vorher automatisch den Ist-Stand sichern.
    5. API stoppen.
    6. Datenbank leeren und aus der Sicherung einspielen.
    7. API starten, auf Health warten.
  - Ein optionaler Dateipfad als Argument ist für Fortgeschrittene erlaubt.
  - Schlägt das Einspielen fehl, bleibt die Vorher-Sicherung, und die Meldung nennt sie.

#### Installationsseite (REL-03)
- **D-09:** Genau eine Seite: `Documentation/Installation.md`, maßgebliche Doku als Markdown, kein `.docx`, keine eigene Website.
  - Abschnitte: Voraussetzungen, Installation, Update, Sicherung und Wiederherstellung, Hilfe bei Problemen. Jeder Schritt hat einen Befehl und das erwartete Ergebnis.
  - Zielgerät ist ein Raspberry Pi 5, NAS als Variante. Die Traefik-Variante bekommt nur einen kurzen Verweis für Fortgeschrittene.
  - README und `Documentation/README.md` verlinken die Seite. Doppelte Installationsanleitungen im README werden auf den Verweis gekürzt, damit es eine Quelle gibt.
- **D-10:** Jede Faktenaussage der Seite muss dem Code entsprechen (AGENTS.md → Dokumentation).

#### Belege
- **D-11:** Die Erfolgskriterien 2 bis 4 werden mechanisch belegt, im Muster von `.planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh`, also lokal gebauter Images im Docker:
  - Installation nach der Seite.
  - Altinstallation (Schnellstart mit Passwort `wordquest` und Demo-Account) mit Kindern, Sets und Lernstand, dann `upgrade.sh`, dann sind die Daten unverändert.
  - `restore.sh` auf einen früheren Stand zeigt die Daten dieses Stands.
  - Die Images sind nicht veröffentlicht. Der Smoke baut sie lokal und taggt sie als `1.0.0`.
- **D-12:** Erfolgskriterium 1 (veröffentlichte Images) lässt sich lokal nur teilweise belegen.
  - Lokal belegt: Der Workflow ist syntaktisch gültig (`actionlint`, falls vorhanden, sonst YAML-Parse), und `docker buildx build --platform linux/arm64,linux/amd64` läuft lokal durch, ohne Push, soweit der Builder das kann.
  - Das echte Veröffentlichen ist Teil der manuellen Abnahme durch Dennis.

### Claude's Discretion
- Wie die Skripte die Compose-Datei erkennen (Schnellstart oder Traefik), der Name der Sicherungsdateien, die Wartezeiten.
- Ob `upgrade.sh` und `restore.sh` gemeinsame Funktionen in eine kleine Shell-Datei auslagern oder ob Kopien kleiner sind. Die kleinere Lösung gewinnt.

### Deferred Ideas (OUT OF SCOPE)
- Automatisches Update (Watchtower o. ä.), eine Weboberfläche für Sicherungen, Sicherungen außer Haus: v2, nicht in dieser Phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Operator updates with `upgrade.sh`, which takes a DB backup before pulling the new version | Sicherung per `docker compose exec -T db pg_dump` (Format = täglicher Dump), Prüfung `gzip -t` + Endzeile `PostgreSQL database dump complete`; Zielversion aus `.env.example`; erst `pull` mit Zielversion, dann `.env` schreiben. Demo-Fall über Logmeldung + `reset-password`. Abschnitt „REL-01“ |
| REL-02 | Operator restores a backup with `restore.sh` | Liste aus `backups/` (Hardlinks per Inode entdoppeln), Datei vor dem Drop prüfen, `DROP DATABASE … WITH (FORCE)` + `CREATE DATABASE`, `psql -v ON_ERROR_STOP=1 -1`; alles in dieser Session gegen `postgres:17-alpine` geprobt. Abschnitt „REL-02“ |
| REL-03 | One install page explains home-network setup step by step for non-experts (install, update, backup/restore) | Bestandsaufnahme aller Anleitungen (README Z. 17–249, 329–341; Konzept §14), Faktenliste mit Fundstellen. Abschnitt „REL-03“ |
| REL-04 | Images are published with a version tag (e.g. `1.0.0`) and the install uses that tag instead of `master` | `ci.yml` baut schon bei Tag `v*` Multi-Arch nach `ghcr.io/mrhdready/wordquest-*:1.0.0`; Dockerfiles bauen heute unter QEMU (api 11 min) → `--platform=$BUILDPLATFORM` im Build-Stage, lokal geprobt. Abschnitt „REL-04“ |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Projektsprache Deutsch (Doku, Commits, Kommentare, Nutzertexte), Umlaute in Code-Kommentaren als `ae/oe/ue` wie im Bestand; Nutzertexte der Skripte mit echten Umlauten wie in `setup.sh` (z. B. `setup.sh:19`, `:56`).
- Kein Commit/Push ohne Freigabe; hier durch D-01 atomare Commits pro Plan freigegeben, Push nicht. Tag `v1.0.0` nur durch den Orchestrator.
- Keine neuen Dependencies. Werkzeuge (shellcheck, actionlint) werden nicht installiert (D-02).
- Einfachheit für Laien: jede Ergänzung muss Installation und Betrieb machbar halten; im Zweifel weglassen.
- Genau eine API-Instanz; Migration beim Start (`Program.cs:236-237`).
- Secrets nur als Dateien (`ReadSecret()`, `Program.cs:259-269`), keine Zugangsdaten im Code; keine personenbezogenen Daten in Logs (gilt auch für Skript-Ausgaben: Passwort von `reset-password` nicht in Logdateien schreiben).
- Doku muss dem Code entsprechen; ändert Code Verhalten, wird Doku in derselben Änderung angepasst (README, Konzept §14).
- Jede Änderung: Subagent-Review vor Fertig-Meldung (AGENTS.md „Review“).
- Gate aus AGENTS.md vollständig (Backend im SDK-Container, Frontend `npm ci … design:classes`), auch wenn diese Phase vermutlich keinen C#-Code ändert.
- Chirurgische Änderungen: `ci.yml` bleibt unverändert (D-03); Formatter/Linter nur auf berührte Dateien.

## Summary

Der wichtigste Befund zu REL-04: Den verlangten Tag-Workflow gibt es schon. `ci.yml` reagiert auf Push nach `master` **und** auf Tags `v*` (`.github/workflows/ci.yml:3-8`), der Job `images` baut nach grünen Backend- und Frontend-Jobs beide Images für `linux/amd64,linux/arm64` und erzeugt über `type=semver,pattern={{version}}` aus `v1.0.0` das Tag `1.0.0` (`:125-144`). Die Namen werden automatisch kleingeschrieben: Der Lauf vom 2026-10-01 hat `ghcr.io/mrhdready/wordquest-api:master` geschoben (Log von Run 36879858849), und beide Pakete sind öffentlich (anonymer Pull-Token funktioniert, Tags `master`, `sha-233ccd9`, `sha-4ce32da`, `sha-6a918e8`). Ein zweiter Workflow würde dieselben Tags doppelt schieben. Zu tun bleibt nur, die Dockerfiles für den Cross-Build vorzubereiten: Heute läuft `dotnet publish` für arm64 unter QEMU (api-Job 10:57 min), Microsoft unterstützt .NET unter QEMU nicht. Eine Zeile `FROM --platform=$BUILDPLATFORM` im Build-Stage reicht, weil das Backend framework-abhängig und ohne RID veröffentlicht wird. Ein amd64-Image aus einem arm64-Build lief in dieser Session bis zur Secret-Prüfung.

Der wichtigste Befund zu REL-01: Die Annahme in D-06 stimmt so nicht. Das Passwort `wordquest` gab es nur im alten Schnelltest (`git show 4ce32da:docker-compose.quick.yml`, Z. 26). Der lief als Compose-Projekt `wordquest-quick` (Z. 18) und wurde per `curl` ohne Repo-Klon gestartet (Z. 3). Seine Daten liegen im Volume `wordquest-quick_pgdata`. Die heutige Installation heißt `wordquest` (`docker-compose.quick.yml:20`) und legt ein neues Volume `wordquest_pgdata` an. Kein `pgdata`-Volume des Projekts `wordquest` hat je das Passwort `wordquest` gehabt: Die alte Traefik-Variante nutzte schon Secret-Dateien (`git show 4ce32da:docker-compose.yml`). `ALTER ROLE` allein bringt die Daten also nicht in die neue Installation. Der kleinste sichere Weg ist ein Dump aus dem alten Volume, der in die neue Installation eingespielt wird, mit derselben Einspiel-Funktion wie in `restore.sh`. Das alte Volume bleibt unberührt als Rückweg. Das muss Dennis entscheiden (Open Question 1).

REL-02 ist gut abgesichert: Das Backup-Image schreibt `pg_dump -d wordquest -f <datei> -Z1`, also Plain-SQL mit gzip, ohne `--clean` und ohne `--create` (Image-Env `POSTGRES_EXTRA_OPTS=-Z1`, `/backup.sh:39`). Eingespielt wird das in eine frisch angelegte Datenbank mit `psql -v ON_ERROR_STOP=1 -1`. Der Weg wurde in dieser Session mit `postgres:17-alpine` geprobt; ein zweites Einspielen in eine nicht leere Datenbank bricht mit Exit 3 ab. Die Rolle `wordquest` ist Superuser, und lokale Socket-Verbindungen im DB-Container brauchen kein Passwort (`pg_hba.conf`: `local all all trust`). Deshalb funktionieren `pg_dump`, `DROP/CREATE DATABASE` und `ALTER ROLE` per `docker compose exec -T db`, ohne das Passwort zu kennen.

**Primary recommendation:** Kein neuer Workflow. Vier Pläne, nacheinander: (1) Version und Images: Standardwerte `1.0.0` und `ghcr.io/mrhdready/wordquest`, `--platform=$BUILDPLATFORM` in beiden Dockerfiles, Buildx-Probe mit beiden Plattformen. (2) `restore.sh` zuerst, weil `upgrade.sh` und der Umstieg seine Einspiel-Funktion brauchen. (3) `upgrade.sh` mit Demo-Fall und dem Schnelltest-Umstieg nach der Entscheidung zu Open Question 1. (4) `Documentation/Installation.md`, README kürzen, Konzept §14 anpassen, Release-Smoke und Phasen-Gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Images bauen und veröffentlichen | CI (`ci.yml` Job `images`) | Dockerfiles (Cross-Build) | Existiert für Tags `v*`; Dockerfiles bestimmen die Bauzeit |
| Version festlegen | Konfiguration (`.env.example` → `.env`) | Compose-Standardwerte | `.env` pinnt die Version; `git pull` allein ändert den laufenden Stand nicht |
| Sicherung vor dem Update | Datenbank-Container (`pg_dump` per `exec`) | Host-Skript (`upgrade.sh`) | `pg_dump` im DB-Container läuft ohne Passwort über den lokalen Socket |
| Prüfen der Sicherung | Host-Skript (`gzip -t`, Endzeile) | — | Billig und unabhängig vom Container |
| Wiederherstellen | Datenbank (`DROP/CREATE DATABASE`, `psql -1`) | Host-Skript (`restore.sh`), Compose (API stoppen/starten) | Atomarität gehört in die DB-Transaktion |
| Schema nach dem Einspielen aktualisieren | API (Migration beim Start, `Program.cs:236-237`) | — | Unverändert; ein älterer Dump wird beim Start vorwärts migriert |
| Demo-Konto entschärfen | API-CLI (`reset-password`) | Host-Skript (Erkennen an der Abbruchmeldung) | Vorhandenes Verb, kein neuer Code im Backend |
| Installationsanleitung | Doku (`Documentation/Installation.md`) | README (nur Verweis) | Eine Quelle (D-09) |

## Standard Stack

### Core (alles schon im Projekt oder auf dem Host)
| Werkzeug | Version | Purpose | Beleg |
|---------|---------|---------|--------------|
| Docker Engine / Compose v2 | 29.8.2 / v5.6.0 (lokal) | Stack, `exec`, `run`, `-p <projekt> stop` ohne Compose-Datei | [VERIFIED: `docker version`, `docker compose version`, Probe in dieser Session] |
| `postgres:17-alpine` | 17.11 (lokal) | DB-Server, `pg_dump`/`psql` im Container | [VERIFIED: Dump-Kopf „Dumped by pg_dump version 17.11“] |
| `prodrigestivill/postgres-backup-local:17` | PG 17.6 im Image | tägliche Sicherung | [VERIFIED: `docker image inspect`, `PG_VERSION=17.6-2.pgdg13+1`] |
| Bash | auf dem Mac 3.2.57, auf dem Pi die Bash von Raspberry Pi OS | Skripte | [VERIFIED: `bash --version`; Smoke führt `setup.sh` auf dem Mac-Host aus] |
| gzip, git, openssl | vorhanden | Prüfung, Update, Secrets | [VERIFIED: `command -v`] |
| python3 + PyYAML | 3.14.5 / 6.0.3 | YAML-Parse als Ersatz für actionlint (D-12) | [VERIFIED: `python3 -c 'import yaml'`] |

### GitHub Actions in `ci.yml` (bleibt unverändert, D-03)
| Action | In `ci.yml` | Aktuellste Version | Beleg |
|--------|------------|----------------|-------|
| `actions/checkout` | `@v5` (`ci.yml:37,79,114`) | v7.0.1 (2026-07-20) | [VERIFIED: `gh api repos/actions/checkout/releases/latest`] |
| `docker/setup-qemu-action` | `@v3` (`:116`) | v4.4.0 (2026-09-15) | [VERIFIED: gh api] |
| `docker/setup-buildx-action` | `@v3` (`:117`) | v4.4.1 (2026-09-16) | [VERIFIED: gh api] |
| `docker/login-action` | `@v3` (`:119`) | v4.6.0 (2026-07-29) | [VERIFIED: gh api] |
| `docker/metadata-action` | `@v5` (`:126`) | v6.2.0 (2026-07-02) | [VERIFIED: gh api] |
| `docker/build-push-action` | `@v6` (`:134`) | v7.4.0 (2026-09-15) | [VERIFIED: gh api] |

Die älteren Majors laufen noch: Der CI-Lauf auf `master` vom 2026-10-01 war mit genau diesen Versionen grün (Run 36879858849), obwohl GitHub Node 20 am 2026-09-23 von den Runnern entfernen wollte [CITED: github.blog/changelog/2026-09-23-deprecation-of-node-20-on-github-actions-runners]. Ein Anheben ist nicht nötig und würde D-03 („ci.yml bleibt unverändert“) brechen.

**Installation:** keine.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bestehender Job `images` in `ci.yml` | neue `release.yml` für Tags `v*` | Doppelte Pushes derselben Tags, zwei Stellen für dieselbe Logik. Nur sinnvoll, wenn `ci.yml` Tags nicht mehr bauen soll – das widerspräche D-03 |
| nur `--platform=$BUILDPLATFORM` | Microsoft-Muster mit `ARG TARGETARCH` + `dotnet restore/publish -a $TARGETARCH` | RID-spezifische Ausgabe; nötig erst bei nativen Abhängigkeiten. Heute: framework-abhängig, `UseAppHost=false`, kein RID (`backend/Dockerfile:22-23`), keine `runtimes/`-Ordner in der Ausgabe |
| Dump + Einspielen für den Schnelltest-Umstieg | `ALTER ROLE` und Weiterbetrieb des alten Volumes (D-06 wörtlich) | Braucht `COMPOSE_PROJECT_NAME=wordquest-quick` dauerhaft in `.env` oder ein `external`-Volume und einen anderen Ablauf in `setup.sh`; verändert die alten Daten an Ort und Stelle (Open Question 1) |
| Abbruchmeldung der API erkennen | neues CLI-Verb `has-demo-password` | D-06 verlangt vorhandene Verben; die Meldung ist stabil und wird schon im Phase-1-Smoke geprüft (`setup-smoke.sh:172`) |
| Einspiel-Funktion als Kopie in zwei Skripten | kleine gemeinsame Datei (z. B. `scripts/wq-db.sh`) | Kopie ist kleiner, solange nur `restore.sh` einspielt; mit dem Umstieg (Open Question 1, Option A) spielt auch `upgrade.sh` ein → dann ist eine gemeinsame Datei kleiner als zwei Kopien |

## Package Legitimacy Audit

Diese Phase installiert keine Pakete.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | keine neue Installation |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
Container-Images, die der Smoke zusätzlich zieht: die eigenen alten Images `ghcr.io/mrhdready/wordquest-{api,web}:sha-4ce32da` (öffentlich, amd64 + arm64, [VERIFIED: GHCR-Manifest in dieser Session]). Keine fremden Images außer den schon genutzten (`postgres:17-alpine`, `prodrigestivill/postgres-backup-local:17`).

## Befunde je Frage (mit Belegen)

### 1. Workflows und Images (REL-04)

**Bestand:** Es gibt genau `.github/workflows/ci.yml` [VERIFIED: `ls .github/workflows/`].
- Auslöser: `push` auf `master` und `tags: ["v*"]`, `pull_request` auf `master` (`ci.yml:3-8`).
- Job `images` (`ci.yml:96-144`): `if: github.event_name == 'push'` (`:100`), `needs: [backend, frontend]` (`:101`), `permissions: packages: write` (`:103-105`), Matrix `api`/`web` (`:106-112`), QEMU + Buildx + Login mit `GITHUB_TOKEN` (`:116-123`), Metadata mit `images: ghcr.io/${{ github.repository }}-${{ matrix.name }}` und Tags `type=ref,event=branch`, `type=semver,pattern={{version}}`, `type=sha,format=short` (`:125-132`), Build mit `platforms: linux/amd64,linux/arm64`, `push: true`, GHA-Cache (`:134-144`).
- Für Tag `v1.0.0` erzeugt das `1.0.0`, `sha-<kurz>` und – wegen `flavor latest=auto` bei `type=semver` – zusätzlich `latest` [CITED: github.com/docker/metadata-action README, Abschnitte „latest tag“ und „semver“]. Das `branch`-Tag entfällt beim Tag-Event.
- Der Name wird kleingeschrieben: `github.repository` ist `mrhdready/WordQuest`, geschoben wurde `ghcr.io/mrhdready/wordquest-api:master` [VERIFIED: Log Run 36879858849]. Dass metadata-action Image-Namen kleinschreibt, steht auch in deren README [CITED: ebd.].

**README Z. 19ff. geprüft:**
| Zeile | Aussage | Befund |
|---|---|---|
| 19–20 | CI baut bei jedem Push auf `master` zwei Images nach GHCR | wahr (`ci.yml:4-5,96-144`; Run 36879858849, Jobs „Container images (api|web)“ grün). Unerwähnt: auch bei Tags `v*` |
| 22–25 | `ghcr.io/<account>/wordquest-api` / `-web` | wahr (kleingeschrieben, s. o.) |
| 27–28 | `linux/amd64` und `linux/arm64` | wahr: Manifest `master` und `sha-4ce32da` listen amd64 + arm64 [VERIFIED: GHCR-Manifest] |
| 30–33 | Pakete stehen nach dem ersten Lauf auf privat | für `mrhdready` überholt: beide Pakete sind öffentlich (anonymer Token liefert die Tag-Liste). Gilt nur noch für Forks → gehört nicht auf die Elternseite |
| — | Stand der Images | `master` stammt vom 2026-10-01 (`6a918e8`, App-Stand vor Phase 1). Wer heute mit `WQ_VERSION=master` installiert, bekommt den alten Stand – genau das löst REL-04 |

**Dockerfiles und arm64:**
- `backend/Dockerfile:5` `FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build` ohne `--platform` → für `linux/arm64` laufen `dotnet restore` und `publish` (`:19`, `:22-23`) auf dem amd64-Runner unter QEMU. Der api-Job brauchte 10:57 min, der web-Job 4:05 min [VERIFIED: `gh run view 36879858849 --json jobs`].
- Microsoft: .NET unterstützt QEMU nicht, Empfehlung ist der Build-Stage auf `$BUILDPLATFORM` [CITED: devblogs.microsoft.com/dotnet/improving-multiplatform-container-support]; offizielles Muster `FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:…-alpine AS build`, `ARG TARGETARCH`, `dotnet restore -a $TARGETARCH`, `dotnet publish -a $TARGETARCH --no-restore` [CITED: github.com/dotnet/dotnet-docker/blob/main/samples/AspNetCoreRazorApp/Dockerfile.alpine-icu Z. 3-13].
- Für WordQuest reicht die erste Zeile: Die Veröffentlichung ist framework-abhängig ohne RID (`backend/Dockerfile:22-23`, `/p:UseAppHost=false`), keine Paketreferenz mit nativen Teilen (nur ASP.NET/EF/Npgsql/JWT, aus `src/*/*.csproj`), keine `runtimes/`-Ordner in `bin/Release`. **Probe in dieser Session:** Dockerfile-Kopie mit `FROM --platform=$BUILDPLATFORM …` → `docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 --output type=cacheonly .` Exit 0; im Log läuft der Build-Stage nur als `[linux/arm64 build …]`, die Runtime-Stages für beide Plattformen. Danach das amd64-Image mit `--load` gebaut und unter Emulation gestartet: Ausgabe `Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt …` – die IL läuft auf amd64 [VERIFIED: Probe, Image danach gelöscht].
- `frontend/Dockerfile:5` `FROM node:22-alpine AS build`: Ausgabe ist statisches `dist/`, also gleiche Änderung `FROM --platform=$BUILDPLATFORM node:22-alpine AS build`. Nicht geprobt [ASSUMED: unkritisch, Vite-Ausgabe ist plattformunabhängig].
- Lokaler Builder kann Multi-Plattform: Docker Desktop mit containerd-Snapshotter, Plattformen `linux/arm64, linux/amd64, …` [VERIFIED: `docker info`, `docker buildx inspect desktop-linux`].

**Minimaler Tag-Workflow** (nur zur Einordnung; er existiert schon als `ci.yml:96-144`): `actions/checkout` → `docker/setup-qemu-action` (nur nötig für `RUN`-Schritte im Runtime-Stage, z. B. `apk add` in `backend/Dockerfile:30`) → `docker/setup-buildx-action` → `docker/login-action` (`registry: ghcr.io`, `GITHUB_TOKEN`) → `docker/metadata-action` (`type=semver,pattern={{version}}`) → `docker/build-push-action` (`platforms: linux/amd64,linux/arm64`, `push: true`). QEMU bleibt auch nach der Dockerfile-Änderung nötig, aber nur noch für `apk add` und `addgroup`, nicht für den .NET-Build.

### 2. Altinstallationen (REL-01, D-06)

**Startprüfungen** (`Program.cs:18-42`, außerhalb von Development, vor jedem DB-Zugriff und vor jedem CLI-Verb):
- `SecretCheck.SigningKeyProblem` für `WQ_JWT_SIGNING_KEY` (leer, bekannter Wert, < 32 Zeichen) und `SecretCheck.Problem("WQ_DB_PASSWORD", …)` bzw. bei explizitem Connection-String `ConnectionStringProblem` (`Program.cs:20-25`).
- Bekannte Werte (`SecretCheck.cs:18-28`, wörtlich): `"devpassword"`, `"wordquest"`, `"nur-zum-ausprobieren-bitte-nicht-im-echtbetrieb-verwenden"`, `"entwicklungsschluessel-bitte-nur-lokal-verwenden-32+"`.
- Meldung (`SecretCheck.cs:40`): `Start abgebrochen: {name} fehlt oder ist ein bekannter Standardwert. Führe \`setup.sh\` aus oder trage einen eigenen Wert ein.`
- `DemoAccountCheck.SeedProblem` bricht ab, wenn `WQ_SEED_DEMO_DATA` true ist (`Program.cs:35-41`, `DemoAccountCheck.cs:18-22`).
- Nach der Migration, nur wenn kein CLI-Verb läuft: `DemoAccountCheck.AccountProblemAsync` (`Program.cs:246-252`) sucht Konten mit `Email == "demo@wordquest.local" && Role != UserRole.Learner` und prüft den Hash gegen `"demo1234"` (`DemoAccountCheck.cs:35-40`, Konstanten `DemoDataSeeder.cs:19-21`). Meldung (`DemoAccountCheck.cs:41-43`): `Start abgebrochen: Das Demo-Elternkonto demo@wordquest.local hat noch sein bekanntes Passwort. Setze es zurück mit \`docker compose run --rm api reset-password demo@wordquest.local\` und starte WordQuest danach mit \`docker compose up -d\`.`
- **Das Demo-Kind mit PIN `1234` bricht den Start nicht ab.** `DemoAccountCheck` prüft nur Nicht-Learner (`DemoAccountCheck.cs:36`). Die Aussage in D-06 („ebenso das Demo-Kind“) trifft auf den Code nicht zu. Die PIN lässt sich nur in der App ändern (`PATCH /api/v1/learners/{id}/settings`, `LearnerEndpoints.cs:24`), es gibt kein CLI-Verb dafür.

**CLI-Verben** (`AccountCommands.cs:21-22`, wörtlich `args is ["has-owner", ..] or ["create-owner", ..] or ["reset-password", ..]`):
- `has-owner` → Exit 0, wenn ein Konto mit `Role == UserRole.Owner` existiert, sonst 10 (`AccountCommands.cs:42-43`, `AccountService.cs:22-23`).
- `create-owner <E-Mail>` (Passwort über stdin) → 0 angelegt, 2 Eingabe falsch, 3 existiert schon (`AccountCommands.cs:45-48,70-84`).
- `reset-password <E-Mail>` → erzeugt ein Passwort und gibt es genau einmal aus, Exit 0; ohne passendes Owner/Guardian-Konto Exit 1 (`AccountCommands.cs:50-61`, `AccountService.cs:79-91`).
- Die Verben laufen vor dem Start-Block und migrieren nicht (`Program.cs:181-189`). Wenn die API wegen des Demo-Kontos nicht läuft, ist `docker compose run --rm -T api reset-password …` der Weg; der Phase-1-Smoke belegt das (`setup-smoke.sh:163-195`).
- Das Demo-Elternkonto ist `Role = UserRole.Owner` (`DemoDataSeeder.cs:45`, `Role = UserRole.Owner`). Rollen stehen als Text in `app_user.role` (`IdentityConfigurations.cs:22,28`; Enum-Werte `Owner = 0`, `Guardian = 1`, `Learner = 2` in `User.cs:5-15`, in der DB also `'Owner'`, `'Guardian'`, `'Learner'` [ASSUMED: EF `HasConversion<string>()` speichert den Enum-Namen; der Smoke-Fixture belegt es]).
- Es gibt keinen Endpoint, um die E-Mail-Adresse zu ändern (`AccountEndpoints.cs:20` hat nur `POST /password`).

**Welche Altinstallationen es gibt** (Git-Historie):
| Typ | Quelle | Projekt/Volume | DB-Passwort | Demo | `.env` | Pfad zu 1.0.0 |
|---|---|---|---|---|---|---|
| L1 Schnelltest | `git show 4ce32da:docker-compose.quick.yml`: per `curl` geladen (Z. 3), `name: wordquest-quick` (Z. 18), `POSTGRES_PASSWORD: ${WQ_DB_PASSWORD:-wordquest}` (Z. 26), JWT-Standardwert (Z. 48), `WQ_SEED_DEMO_DATA: "true"` fest (Z. 51), Port `${WQ_PORT:-8080}` (Z. 66), kein Backup-Dienst | `wordquest-quick` / `wordquest-quick_pgdata` | `wordquest` | ja (Konto + Max/PIN 1234) | keine, kein Repo-Klon | neu klonen, `setup.sh`, Daten übernehmen (Open Question 1) |
| L2 alte Dauerinstallation | `git show 4ce32da:setup.sh` (Secrets per Zufall, `.env` aus `.env.example`), `docker-compose.yml` mit `name: wordquest` (Z. 9) und Seed-Standard `true` (Z. 45), `.env.example` mit `WQ_VERSION=master` (Z. 11) und `WQ_SEED_DEMO_DATA=true` (Z. 23), kein `COMPOSE_FILE` | `wordquest` / `wordquest_pgdata` | Zufall aus `secrets/` | ja | vorhanden | `git pull`, `./upgrade.sh`: Seed auf false, Version setzen, Demo-Passwort zurücksetzen |
| L3 Stand nach Phase 1/2 (Entwicklung) | heutiger Stand | `wordquest` | Zufall | nein | mit `COMPOSE_FILE` | regulärer Update-Weg |

- README Z. 68-71 sagt heute ausdrücklich, dass die Schnelltest-Daten **nicht** übernommen werden. D-06 und das STATE-Todo verlangen den Umstieg; die README-Aussage muss mit der Entscheidung zu Open Question 1 angepasst werden.
- Auf Dennis' Mac gibt es weder ein Volume `wordquest-quick_pgdata` noch `wordquest_pgdata` [VERIFIED: `docker volume ls`].

**Kleinster sicherer Weg je Fall** (Empfehlung):
- **L2 / Seed an:** `upgrade.sh` liest `WQ_SEED_DEMO_DATA` wie `setup.sh:77` (Groß-/Kleinschreibung, Anführungszeichen) und setzt den Wert in `.env` auf `false`, mit Hinweis. Kein Datenverlust: Der Seed legt nur auf einer leeren DB etwas an (`DemoDataSeeder.cs:29-33`).
- **L2 / Demo-Passwort:** nach `up -d` auf Health warten; wird die API nicht bereit und steht in `docker compose logs api` der Satz `Start abgebrochen: Das Demo-Elternkonto`, dann klare Frage stellen, danach `docker compose run --rm -T api reset-password demo@wordquest.local </dev/null`, Ausgabe nur auf das Terminal (nicht in eine Datei), `docker compose restart api` (nicht `up -d`, siehe `setup-smoke.sh:185`), erneut auf Health warten. Danach unbedingt der Hinweis, dem Kind „Max“ unter „Verwalten → Kinder“ eine neue PIN zu geben (kein Code kann die PIN prüfen, also immer ausgeben, wenn das Demo-Konto zurückgesetzt wurde).
- **L1 / Schnelltest:** siehe Open Question 1. Empfohlene Option A: (1) `docker compose -p wordquest-quick stop` – funktioniert ohne Compose-Datei [VERIFIED: Probe mit Projekt `wq-res-probe`]; das gibt auch Port 8080 frei, den der alte `web`-Container sonst belegt (alte Datei Z. 66) und an dem `setup.sh` scheitern würde. (2) `git clone`, `./setup.sh`. (3) `./upgrade.sh` erkennt `docker volume inspect wordquest-quick_pgdata` und dass die neue Installation noch kein Kind hat (`select count(*) from app_user where role = 'Learner'` = 0), fragt nach und startet dann einen Wegwerf-Container `postgres:17-alpine` auf dem alten Volume. Dessen `pg_dump` braucht kein Passwort (lokaler Socket, `trust`) [VERIFIED: Probe]. Die Sicherung wird geprüft und mit derselben Funktion wie in `restore.sh` eingespielt. Danach greift der Demo-Fall wie bei L2. Das alte Volume bleibt unverändert. `ALTER ROLE` ist in diesem Weg nicht nötig, weil ein Dump einer einzelnen Datenbank keine Rollenpasswörter enthält.
- `ALTER ROLE` funktioniert, falls Option B gewählt wird: `\set pw \`cat /run/secrets/db_password\`` und `ALTER ROLE wordquest PASSWORD :'pw';` per stdin an `docker compose exec -T db psql -U wordquest -d postgres -v ON_ERROR_STOP=1` → Exit 0 [VERIFIED: Probe]. Das Secret steht dabei nicht in der Prozessliste. Psql-Variablen werden in `-c` nicht ersetzt [ASSUMED], deshalb stdin.

### 3. Sicherung (D-07)

**Format der täglichen Sicherung** [VERIFIED: `docker image inspect` + `docker run --entrypoint cat … /backup.sh`]:
- Image-Env: `POSTGRES_EXTRA_OPTS=-Z1`, `BACKUP_DIR=/backups`, `BACKUP_SUFFIX=.sql.gz`, `BACKUP_LATEST_TYPE=symlink`, `BACKUP_KEEP_MINS=1440`; Compose überschreibt `BACKUP_KEEP_DAYS: 14`, `BACKUP_KEEP_WEEKS: 8`, `BACKUP_KEEP_MONTHS: 6` (`docker-compose.quick.yml:84-87`).
- Dateinamen (`/backup.sh:25-28`): `last/wordquest-YYYYMMDD-HHMMSS.sql.gz`, `daily/wordquest-YYYYMMDD.sql.gz`, `weekly/wordquest-GGGGVV.sql.gz` (ISO-Woche), `monthly/wordquest-YYYYMM.sql.gz`.
- Dump: `pg_dump -d "${DB}" -f "${FILE}" ${POSTGRES_EXTRA_OPTS}` (`/backup.sh:39`) → Plain-SQL, gzip-komprimiert, **ohne** `--clean`, **ohne** `--create`. Die Datei in `last/` wird per Hardlink nach `daily/`, `weekly/`, `monthly/` verlinkt (`:67-71`), dazu Symlinks `wordquest-latest.sql.gz` je Ordner (`:80-86`). Aufräumen nur in diesen vier Ordnern per `find … -mtime` (`:92-95`).
- Folge: Dateien direkt in `backups/` (eigenes Präfix) räumt der Dienst nie auf. Weekly und Monthly haben beide sechs Ziffern – die Liste in `restore.sh` muss den Ordner oder das Datum zeigen.
- Inhalt (Probe, `pg_dump` 17.11): Kopf mit `\restrict <token>`, `SET …`, `SELECT pg_catalog.set_config('search_path', '', false);`, Besitzer `OWNER TO wordquest`, Endzeilen `-- PostgreSQL database dump complete` und `\unrestrict <token>` [VERIFIED: Probe]. `\restrict` setzt psql ≥ 17.6 voraus; eingespielt wird mit dem psql im DB-Container (17.11), deshalb unkritisch.
- Kein Extension-Objekt im Schema (keine `CREATE EXTENSION` in den Migrationen, nur `UseIdentityByDefaultColumns`) → `CREATE DATABASE` ohne Zusätze reicht [VERIFIED: grep `Migrations/`].

**Sicherung durch `upgrade.sh`** (kompatibel zum Tagesformat):
```bash
ts="$(date +%Y%m%d-%H%M%S)"
file="backups/vor-update-wordquest-${ts}.sql.gz"
docker compose up -d db </dev/null
docker compose exec -T db pg_dump -U wordquest -d wordquest </dev/null | gzip > "$file"
```
Danach prüfen: `gzip -t "$file"` und Endzeile `-- PostgreSQL database dump complete` (siehe Pitfall 4 zu `grep -q` mit `pipefail`). `docker compose exec backup /backup.sh` ist ungeeignet: Es schreibt in `daily/`, und der nächste Tageslauf überschreibt die Datei desselben Tages (`ln -vf`, `/backup.sh:67`).

### 4. Wiederherstellen (REL-02)

Geprobter Ablauf gegen `postgres:17-alpine` [VERIFIED: Probe in dieser Session]:
```bash
docker compose exec -T db psql -U wordquest -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE wordquest WITH (FORCE)' -c 'CREATE DATABASE wordquest OWNER wordquest' </dev/null
gunzip -c "$file" | docker compose exec -T db psql -U wordquest -d wordquest -v ON_ERROR_STOP=1 -1 -q
```
- Exit 0, Daten danach vorhanden. Derselbe Dump in eine nicht leere DB: `ERROR: relation "t" already exists`, Exit 3, Transaktion zurückgerollt.
- Rechte: `wordquest` ist Superuser (`rolsuper = t`), `pg_hba.conf` erlaubt lokal `trust` → kein Passwort nötig [VERIFIED: Probe].
- Vorher die API **und** den Dienst `backup` stoppen (`docker compose stop api backup </dev/null`); `WITH (FORCE)` trennt verbliebene Verbindungen.
- Danach `docker compose up -d </dev/null` und auf `/health/ready` warten wie `setup.sh:95-104`. Die API migriert einen älteren Dump beim Start vorwärts (`Program.cs:236-237`; `OrphanCleanup` löscht nur Waisen, `OrphanCleanup.cs:26-37`).
- nginx löst `api` nur beim Start auf (`frontend/nginx.conf:40,53`, kein `resolver`). Bekommt der neu gestartete api-Container eine andere IP, liefert `web` 502 → nach dem Health-Check `docker compose restart web` [ASSUMED: IP-Wechsel bei stop/start möglich, in `.planning/research/PITFALLS.md:110` als bekannte Falle].

**Liste der Sicherungen** (neueste zuerst, Hardlinks entdoppelt, Symlinks raus; GNU/BSD-kompatibel, Bash 3.2):
```bash
ls -1ti backups/*.sql.gz backups/*/*.sql.gz 2>/dev/null \
  | awk '!seen[$1]++ { print $2 }' | grep -v -- '-latest\.sql\.gz$'
```
[ASSUMED: Formel nicht geprobt; der Release-Smoke muss sie mit echten Dateien belegen. Dateinamen enthalten keine Leerzeichen.]

**Fehlerpfad:** Gewählte Datei **vor** dem Drop prüfen (`gzip -t` + Endzeile), sonst ist die DB weg und die Datei kaputt. Schlägt das Einspielen trotzdem fehl, ist die DB leer (Transaktion zurückgerollt). Empfehlung: dann automatisch die Vorher-Sicherung mit derselben Funktion einspielen, API starten und beide Dateinamen nennen. Die API darf nicht auf eine leere DB starten: Sie würde das Schema anlegen, `has-owner` meldet dann 10, und das sieht wie eine Neuinstallation aus.

### 5. Update-Weg (D-05)

- **`git pull` + `./upgrade.sh` bestätigt.** Lokale Betriebsdateien sind von Git ausgenommen: `secrets/`, `.env`, `backups/`, `pgdata/` (`.gitignore`, Abschnitte „Secrets & lokale Konfiguration“ und „Betriebsdaten“). Ein `git pull` fasst sie nicht an. Hat jemand eine versionierte Datei geändert (z. B. Port in der Compose-Datei statt `WQ_PORT` in `.env`), bricht `git pull` ab, ohne etwas zu ändern [ASSUMED: Standardverhalten von Git].
- **Nicht** `upgrade.sh` selbst `git pull` ausführen lassen: Bash liest Skripte während der Ausführung nach; ändert der Pull die laufende Datei, führt Bash Teile der neuen Fassung aus [ASSUMED: bekanntes Bash-Verhalten]. Zwei Befehle sind einfacher als ein Umweg über `exec`.
- **Nicht mit `--branch v1.0.0` klonen:** Ein Tag-Checkout hat einen detached HEAD, `git pull` scheitert dann [ASSUMED]. Die Seite klont den Standardbranch.
- **Zielversion:** `setup.sh` erzeugt `.env` aus `.env.example` (`setup.sh:71`) → steht dort `WQ_VERSION=1.0.0`, schreibt `setup.sh` die Version ohne neuen Code (D-04). `upgrade.sh` liest die Zielversion aus derselben Zeile in `.env.example`. Das ist eine Quelle, die die Compose-Standardwerte (D-04) ergänzt. Die drei Stellen müssen gleich sein → Smoke prüft das.
- **Reihenfolge gegen halben Zustand:** erst `WQ_VERSION="$ziel" docker compose pull </dev/null` (eine Variable in der Shell schlägt `.env`), erst bei Erfolg `.env` schreiben, dann `up -d`. Grund: Nach einem neuen Tag braucht die CI 5–15 min für die Images. Wer in diesem Fenster aktualisiert, bekäme sonst eine `.env` mit einer Version ohne Image. `setup.sh:86` nutzt `pull --ignore-buildable`; das gleiche in `upgrade.sh` erlaubt den Smoke mit `docker-compose.build.yml`.
- `.env` ändern wie `setup.sh:70-71` (temporäre Datei statt `sed -i`, BSD/GNU). Fehlt die Zeile `WQ_VERSION`, anhängen.
- Compose-Erkennung ist unnötig: `COMPOSE_FILE` steht in `.env` (`.env.example:7`) und wird von `docker compose` gelesen; alte L2-`.env` ohne `COMPOSE_FILE` fallen auf `docker-compose.yml` zurück (Kommentar `setup.sh:157-158`). Die Skripte brauchen die Variante nur für die Abschlusszeile (URL), dafür gibt es die Logik in `setup.sh:157-166`.
- `backups/` muss dem aufrufenden Benutzer gehören: L2 hatte keinen `mkdir backups` im alten `setup.sh`, Docker legt den Ordner dann als root an. Gleiche Prüfung wie `setup.sh:54-57` (`[[ -O backups ]]`) mit demselben `chown`-Hinweis.

### 6. Smoke-Design (D-11)

**Empfehlung:** eigenes Skript `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` mit demselben Gerüst wie `setup-smoke.sh` (Arbeitskopie per `tar`, `:32-35`; eigener Projektname; `trap cleanup`, `:25-30`; Image-ID-Vergleich, `:67-70`). Den Phase-1-Smoke nicht erweitern: Er belegt Phase-1-Kriterien, läuft schon minutenlang, und ein Fehler im Release-Teil wäre dort schwer zuzuordnen.

**Wichtige Unterschiede zum Phase-1-Muster:**
- `WQ_VERSION` und `WQ_IMAGE_PREFIX` **nicht** exportieren (Phase 1 tut das, `setup-smoke.sh:18-21`). Shell-Variablen schlagen `.env`, dann würde der Smoke die Versionsänderung von `upgrade.sh` gar nicht prüfen. Exportieren nur `COMPOSE_PROJECT_NAME`, `WQ_PORT` und `COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml`.
- Images lokal bauen und als `ghcr.io/mrhdready/wordquest-{api,web}:1.0.0` taggen, dann bei `setup.sh` die Präfix-Frage mit Enter beantworten. Damit ist der Standard aus D-04 Teil des Belegs. `pull --ignore-buildable` zieht api/web nicht. Am Ende diese lokalen Tags löschen, damit sie später kein echtes Image verdecken.
- Für den Update-Fall braucht der Smoke zwei Versionen: die gebauten Images zusätzlich als `1.0.0-alt` taggen oder `.env` vorher auf `master` setzen. Der Smoke prüft danach `WQ_VERSION=1.0.0` in `.env` und die Image-ID des laufenden Containers.

**Ablauf (Vorschlag):**
1. **Installation nach der Seite:** Befehle der Seite in der Arbeitskopie (`printf '\n' eltern@… pw pw | ./setup.sh`), Login 200, `WQ_VERSION=1.0.0` in `.env`, Versionsgleichheit `.env.example` = beide Compose-Standardwerte.
2. **Altinstallation L1:** alte Datei aus Git (`git show 4ce32da:docker-compose.quick.yml > alt/docker-compose.quick.yml`) mit `-p <altprojekt>`, `WQ_IMAGE_PREFIX=ghcr.io/mrhdready/wordquest`, `WQ_VERSION=sha-4ce32da`, `WQ_PORT=18083`. Die alten Images sind öffentlich und haben arm64 [VERIFIED]. Ergebnis: echtes altes Schema (nur Migration `Initial`) mit Demo-Seed. Zusätzliche Kinder, Sets und Lernstand per SQL einfügen, nicht über die alte API: Die alte Version hatte den Mandanten-Claim-Fehler, der erst mit `96329c3` behoben wurde („JWT: MapInboundClaims=false, sonst findet HttpTenantContext "tid" nicht“) [CITED: Commit-Nachricht `96329c3`]. Der Name des alten Projekts muss im Skript überschreibbar sein (z. B. Umgebungsvariable mit Standard `wordquest-quick`), damit der Smoke nie eine echte Altinstallation auf dem Entwicklungsrechner trifft.
3. **Fingerabdruck** vor und nach dem Upgrade, z. B. `md5(string_agg(…))` über `tenant(id,name)`, `app_user(id,display_name,role)` (ohne `password_hash`/`email`, die der Reset ändert), `learner_profile`, `vocabulary_set`, `vocabulary_entry`, `card`, `review_state`, `review_log`, `gamification_profile`. `refresh_token` auslassen (Reset widerruft Tokens). Die Migration `ReferentialIntegrity` ändert nur FKs und Indizes, `OrphanCleanup` löscht nur Waisen (`OrphanCleanup.cs:26-37`); das Smoke-Fixture enthält keine Waisen.
4. **Upgrade/Umstieg:** `docker compose -p <altprojekt> stop`, `./setup.sh`, `./upgrade.sh` mit Antworten über stdin. Prüfen: Fingerabdruck gleich, Demo-Login 401, Login mit dem einmal angezeigten Passwort 200 (Passwort nur in eine Datei, nie ins Log, wie `setup-smoke.sh:94-101`), `backups/vor-update-*.sql.gz` bzw. `schnelltest-*.sql.gz` besteht `gzip -t`, Hinweis auf die PIN von „Max“ in der Ausgabe.
5. **L2-Seed:** `.env` mit `WQ_SEED_DEMO_DATA=true` und `WQ_VERSION=master` → `upgrade.sh` setzt `false` und `1.0.0` und meldet das.
6. **Restore:** Stand S1 festhalten (Fingerabdruck + `docker compose exec -T backup /backup.sh`), dann ändern (z. B. Kind über die API löschen), `restore.sh` mit Auswahl der S1-Datei → Fingerabdruck = S1, `backups/vor-wiederherstellung-*.sql.gz` besteht, API bereit, Login 200. Fehlerpfad: `printf 'kaputt' | gzip > backups/kaputt.sql.gz` (`gzip -t` ok, Endzeile fehlt) → `restore.sh backups/kaputt.sql.gz` endet mit Exit ≠ 0, bevor die DB angefasst wird, Fingerabdruck unverändert.
7. **Abbruchpfad Update:** nicht vorhandene Zielversion (z. B. `.env.example` in der Arbeitskopie auf `9.9.9`) → `upgrade.sh` endet mit Exit ≠ 0, `.env` unverändert, Stack läuft weiter.

**Ports/Netze:** Belegt sind 8080 (fremder Container `veldera-aura-reverb-1`) und 5432 (`thebrain-postgres-1`) [VERIFIED: `lsof`, `docker ps`]. Frei: 18080–18085, 5433. Phase 1 nutzt 18081; Vorschlag Phase 3: 18082 (neue Installation) und 18083 (alter Schnelltest). Compose legt je Projekt ein eigenes Netz an; feste Subnetze sind nicht nötig. Port 8080 belegt bedeutet auch: Die Seite darf nicht behaupten, dass der Smoke den Standardport geprüft hat.

### 7. Werkzeuge

| Tool | Vorhanden | Folge |
|---|---|---|
| `shellcheck` | ✗ | Nur `bash -n` (D-02). Nicht installieren, auch nicht als Docker-Image ohne Freigabe |
| `actionlint` | ✗ | YAML-Parse mit `python3` + PyYAML (D-12). Ohne neuen Workflow betrifft das nur die unveränderte `ci.yml` |
| `yamllint` | ✗ | — |
| Bash | 3.2.57 auf dem Mac | Skripte müssen Bash-3.2-tauglich sein: kein `mapfile`/`readarray`, keine assoziativen Arrays, kein `${var,,}` (Pitfall 1) |

[VERIFIED: `command -v` in dieser Session]

### 8. Doku (REL-03)

Bestehende Anleitungen, die auf die neue Seite zusammengeführt werden:
- `README.md:17-249` – Abschnitt „Installation“ mit Images (19-33), Variante A Heimnetz (35-84), Sicherung (86-96), Passwort vergessen (98-112), „Wenn die API nicht startet“ (114-125), Variante B Traefik (127-168), Demo-Daten (170-191), Aktualisieren (193-204), Variante C Entwicklung (206-248).
- `README.md:329-341` – „Betrieb“ inkl. „Die Wiederherstellung … kommt mit `restore.sh` (Phase 3)“.
- `Documentation/WordQuest_Konzept_und_Architektur.md` §14 Deployment (Z. 622-641), besonders Z. 633 („Versionierte Tags … geplant (`REL-04`)“) und Z. 635 („Geplant: Update und Wiederherstellung über `upgrade.sh` und `restore.sh`“); §10.1 Z. 488 (Backup-Dienst).
- `Documentation/README.md:5-8` – Index, dort fehlt die neue Seite.
- `.env.example:9-16` – Kommentare zu Präfix und `master`.
- Kopfkommentare in `docker-compose.quick.yml:1-18` und `docker-compose.yml:1-7`.

Empfehlung zur einen Quelle: `Documentation/Installation.md` enthält Voraussetzungen, Installation, Update, Sicherung und Wiederherstellung, Hilfe bei Problemen (Passwort vergessen, Startabbruch, Demo-Konto, Umstieg vom Schnelltest). Das README behält einen Satz mit Verweis, Variante B als kurzen Verweis für Fortgeschrittene und Variante C (Entwicklung) – die ist keine Elternanleitung. Konzept §14 ersetzt „geplant“ durch den umgesetzten Stand.

Fakten für die Seite (Belege für D-10):
- Standardport 8080, änderbar mit `WQ_PORT` in `.env` (`docker-compose.quick.yml:72`).
- `setup.sh` fragt Präfix (künftig mit Enter), E-Mail, Passwort zweimal, mindestens 8 Zeichen (`setup.sh:65,116,125-131`); zweiter Lauf ändert nichts (`:36-38,60-61,113`).
- Sicherung täglich, 14/8/6 (`docker-compose.quick.yml:84-87`); sofort: `docker compose exec backup /backup.sh` (README Z. 94).
- Passwort vergessen: `docker compose exec api dotnet WordQuest.Api.dll reset-password <E-Mail>` (README Z. 103, `AccountCommands.cs:50-61`).
- Raspberry Pi OS 64-bit: Docker nach der Debian-Anleitung installieren; ohne Eintrag in die Gruppe `docker` braucht jeder Befehl `sudo` [CITED: docs.docker.com/engine/install/raspberry-pi-os]. Die Skripte sollen ohne `sudo` laufen (`setup.sh:56` prüft den Besitzer von `backups`).
- Offene manuelle Prüfungen aus Phase 1 (`hostname -I` auf dem Pi, Backup-Dienst auf dem Pi, STATE „Pending Todos“): Die Seite nennt die Adresse so, wie `setup.sh:162-165` sie ausgibt, und verspricht nichts darüber hinaus.

## Architecture Patterns

### System Architecture Diagram

```
Eltern (Terminal auf dem Pi)
   │ git pull            │ ./upgrade.sh                         │ ./restore.sh [datei]
   ▼                     ▼                                       ▼
Repo-Klon ──▶ .env.example (Zielversion)            backups/ (Liste, neueste zuerst)
                         │                                       │ Auswahl + Bestätigung
                         ▼                                       ▼
              db läuft? ─▶ pg_dump (exec -T db) ─▶ backups/vor-update-…sql.gz
                         │                                       │ Vorher-Sicherung
                         ▼ Prüfung gzip -t + Endzeile            ▼ Prüfung der gewählten Datei
              [fehlgeschlagen → Abbruch, nichts geändert]   stop api+backup
                         │                                       │
                         ▼                                       ▼
              WQ_VERSION=ziel compose pull                 DROP/CREATE DATABASE
              [fehlgeschlagen → Abbruch, .env unverändert]  psql -1 ON_ERROR_STOP
                         │                                       │ [Fehler → Vorher-Sicherung einspielen]
                         ▼                                       ▼
              .env schreiben → compose up -d ──────────────▶ API-Start: Migration vorwärts
                                                                 │
                                         ┌───────────────────────┴───────────┐
                                         ▼                                   ▼
                                 /health/ready ok                 Abbruchmeldung in logs api
                                 restart web, fertig              „Demo-Elternkonto“ → Frage →
                                                                  run --rm api reset-password →
                                                                  restart api → Health → PIN-Hinweis

Umstieg Schnelltest (Option A): Volume wordquest-quick_pgdata ─▶ Wegwerf-postgres ─▶ pg_dump
  ─▶ backups/schnelltest-…sql.gz ─▶ gleiche Einspiel-Funktion ─▶ API-Start wie oben

Release (Dennis): git tag v1.0.0 + push ─▶ ci.yml (backend, frontend) ─▶ images (amd64+arm64)
  ─▶ ghcr.io/mrhdready/wordquest-{api,web}:1.0.0, latest, sha-…
```

### Recommended Project Structure (nur neue/geänderte Orte)
```
upgrade.sh                     # neu, Repo-Root, 100755
restore.sh                     # neu, Repo-Root, 100755
scripts/wq-db.sh               # optional, nur wenn Einspielen in beiden Skripten gebraucht wird (Discretion)
setup.sh                       # Präfix-Standard mit Enter
.env.example                   # WQ_VERSION=1.0.0, WQ_IMAGE_PREFIX=ghcr.io/mrhdready/wordquest
docker-compose.quick.yml       # Standardwerte 1.0.0 / Präfix
docker-compose.yml             # dto.
backend/Dockerfile             # FROM --platform=$BUILDPLATFORM … AS build
frontend/Dockerfile            # dto.
Documentation/Installation.md  # neu, eine Quelle
Documentation/README.md        # Index-Zeile
README.md                      # Installationsteil auf Verweis kürzen
Documentation/WordQuest_Konzept_und_Architektur.md  # §14
.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
```

### Pattern 1: Skript-Gerüst wie `setup.sh`
`set -euo pipefail`, `cd "$(dirname "$0")"`, `say`/`warn`/`die` (`setup.sh:7-13`), `env_value` (`:16`), Docker-Befehle mit `</dev/null`, damit sie die Antworten auf stdin nicht verbrauchen (`:83`), Health-Schleife (`:95-104`), `cli()` per `exec -T` (`:107`). Exit-Codes von Unterbefehlen in eine Variable holen statt sie `set -e` zu überlassen (`:110-111`).

### Pattern 2: Erst prüfen, dann ändern
Jeder Schritt, der etwas ändert, kommt nach einer Prüfung, die ohne Änderung abbrechen kann: Sicherung prüfen → Pull mit Zielversion → `.env` schreiben → `up -d`. Bei `restore.sh`: gewählte Datei prüfen → Vorher-Sicherung prüfen → erst dann `DROP`.

### Pattern 3: Prüfung einer Sicherung
```bash
# Source: Probe in dieser Session (pg_dump 17.11 Endzeile), setup-smoke.sh:150-151
check_dump() {
  gzip -t "$1" 2>/dev/null || return 1
  gunzip -c "$1" | tail -n 5 | grep -q 'PostgreSQL database dump complete'
}
```
`tail` liest den ganzen Strom, deshalb kein SIGPIPE bei `pipefail` (Pitfall 4). Für den Update-Fall zusätzlich `gunzip -c "$1" | grep -c 'COPY public.app_user'` > 0 (Konten vorhanden; `-c` liest bis zum Ende).

### Anti-Patterns to Avoid
- **Zweiter Release-Workflow neben `ci.yml`:** doppelte Pushes, zwei Wahrheiten.
- **`docker compose exec backup /backup.sh` als Update-Sicherung:** landet in der Rotation und wird am selben Tag überschrieben.
- **`.env` vor dem erfolgreichen Pull ändern:** halber Zustand, wenn das Image noch fehlt.
- **API auf leerer DB starten nach fehlgeschlagenem Einspielen:** sieht aus wie eine Neuinstallation.
- **Reset-Passwort mit `tee` loggen:** Das Passwort steht genau einmal auf dem Terminal, nie in einer Datei.
- **`upgrade.sh` macht selbst `git pull`:** ändert das laufende Skript.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Datenbank sichern | eigenes Export-Format, Tabellen per `COPY` | `pg_dump` im DB-Container | Gleiches Format wie die tägliche Sicherung, `restore.sh` kann beides |
| Wiederherstellen | Tabellen leeren, `TRUNCATE`-Listen | `DROP DATABASE … WITH (FORCE)` + `CREATE DATABASE` + `psql -1` | Keine Reste, atomar |
| Images veröffentlichen | neuer Workflow | `ci.yml` Job `images` | Existiert, baut bei `v*` |
| arm64 schneller bauen | eigene Runner, Matrix pro Plattform | `--platform=$BUILDPLATFORM` | Eine Zeile je Dockerfile |
| Demo-Konto entschärfen | SQL-Update am Passwort-Hash | `reset-password` | Vorhandenes Verb, widerruft Refresh-Tokens (README Z. 110-112) |
| Altes Projekt stoppen | `docker ps | grep` + `docker stop` | `docker compose -p wordquest-quick stop` | Compose findet die Container über das Label, geprobt |

**Key insight:** Alles, was diese Phase braucht, gibt es schon als Werkzeug im Stack (`pg_dump`, `psql`, Compose, Buildx, CLI-Verben). Neu sind nur die Abläufe und die Prüfungen dazwischen.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `wordquest_pgdata` (L2/L3, Projekt `wordquest`); `wordquest-quick_pgdata` (L1, alter Schnelltest, Passwort `wordquest`, Demo-Seed); auf Dennis' Mac keines davon vorhanden (`docker volume ls`) | L1: Datenübernahme per Dump (Option A) oder Volume-Übernahme (Option B); L2: keine Datenmigration, nur `reset-password` |
| Live service config | `.env` alter Installationen: `WQ_VERSION=master`, `WQ_SEED_DEMO_DATA=true`, kein `COMPOSE_FILE` (alte `.env.example` Z. 11, 23); L1 hat keine `.env` | `upgrade.sh` setzt `WQ_VERSION` und `WQ_SEED_DEMO_DATA=false`; `COMPOSE_FILE` nicht anfassen (Standard = Traefik-Datei, wie bisher) |
| OS-registered state | Container des Projekts `wordquest-quick` mit `restart: unless-stopped` belegen Port 8080 (alte Datei Z. 66) | `docker compose -p wordquest-quick stop` vor `setup.sh` (Seite + Umstieg) |
| Secrets/env vars | `secrets/db_password.txt`, `secrets/jwt_key.txt` (`docker-compose.quick.yml:100-104`); L1 hat keine Secrets, nur Standardwerte | Keine Umbenennung; Dumps enthalten keine Rollenpasswörter |
| Build artifacts | GHCR-Tags `master`, `sha-*` (Stand 2026-10-01); lokale Images aus Smoke-Läufen (`wordquest-e2e-*`, `wq-e2e-*`) | `1.0.0` entsteht erst beim Tag-Push (Dennis); der Smoke räumt seine lokalen `ghcr.io/mrhdready/…:1.0.0`-Tags wieder ab |

## Common Pitfalls

### Pitfall 1: Bash 3.2 auf dem Mac
**What goes wrong:** Der Smoke führt die Skripte auf dem Mac-Host aus (`setup-smoke.sh:59-60`); `mapfile`, `declare -A`, `${x,,}` brechen dort ab.
**How to avoid:** Nummerierte Liste mit `while read` in ein indiziertes Array oder mit dem Builtin `select`; Kleinschreibung mit `tr` wie `setup.sh:77`.
**Warning signs:** „command not found: mapfile“ nur auf dem Mac.

### Pitfall 2: Docker-Befehle verbrauchen die Antworten auf stdin
**What goes wrong:** `docker compose exec`/`run` ohne `</dev/null` liest die gepipten Antworten des Smokes (`setup.sh:83`).
**How to avoid:** Jeder Docker-Befehl ohne eigene Eingabe bekommt `</dev/null`; Ausnahme ist das Einspielen (`gunzip | exec -T db psql`).

### Pitfall 3: Shell-Variable schlägt `.env`
**What goes wrong:** Exportiert der Smoke `WQ_VERSION` wie in Phase 1, prüft er die Versionsänderung von `upgrade.sh` nicht.
**How to avoid:** Im Release-Smoke nur `COMPOSE_PROJECT_NAME`, `WQ_PORT`, `COMPOSE_FILE` exportieren; gezielt `WQ_VERSION=… docker compose pull` nur im Skript.

### Pitfall 4: `pipefail` + `grep -q`
**What goes wrong:** `gunzip -c f | grep -q x` beendet `grep` früh, `gunzip` bekommt SIGPIPE, die Pipeline meldet unter `pipefail` einen Fehler. Bei kleinen Dumps fällt das nicht auf, bei großen schon [ASSUMED: Standardverhalten; der Phase-1-Smoke hat das Muster in `setup-smoke.sh:151` mit kleinem Dump].
**How to avoid:** `tail -n 5 | grep -q` oder `grep -c`.

### Pitfall 5: Einspielen in eine nicht leere DB
**What goes wrong:** Ohne Drop liefert `psql` ohne `ON_ERROR_STOP` Fehler und läuft weiter → halb eingespielter Stand (`.planning/research/PITFALLS.md:343`).
**How to avoid:** Immer Drop/Create, `-v ON_ERROR_STOP=1 -1` (geprobt: Exit 3, nichts geändert).

### Pitfall 6: Kaputte Datei erst nach dem Drop bemerkt
**How to avoid:** Datei vor jeder Änderung prüfen (Pattern 3).

### Pitfall 7: nginx hält die alte API-Adresse
**What goes wrong:** `proxy_pass http://api:8080` ohne `resolver` (`frontend/nginx.conf:40,53`) → nach Neustart der API 502.
**How to avoid:** Nach erfolgreichem Health-Check `docker compose restart web`. Beim Update erzeugt `up -d` mit neuem Image auch `web` neu.

### Pitfall 8: `backups/` gehört root
**What goes wrong:** Alte Installationen ohne `mkdir backups` → Docker legt den Ordner als root an, `upgrade.sh` kann nicht schreiben.
**How to avoid:** Prüfung und Hinweis wie `setup.sh:54-57`.

### Pitfall 9: Image fehlt noch nach dem Tag
**What goes wrong:** Zwischen Tag-Push und fertigem CI-Lauf (bisher bis 11 min) gibt es kein `1.0.0`-Image.
**How to avoid:** Pull vor dem Schreiben der `.env`; Meldung „Die neue Version ist noch nicht verfügbar. Versuche es in einer Viertelstunde erneut.“

### Pitfall 10: Ausführbar-Bit fehlt
**What goes wrong:** Neue Skripte ohne `100755` im Git → `./upgrade.sh` → „Permission denied“ beim Klon (`setup.sh` ist `100755`, `git ls-files -s`).
**How to avoid:** `chmod +x` vor `git add`; Smoke prüft `git ls-files -s upgrade.sh restore.sh`.

### Pitfall 11: Zwei Postgres-Prozesse auf einem Datenverzeichnis
**What goes wrong:** Beim Umstieg (Option A) läuft der alte `db`-Container noch, während ein Wegwerf-Container dasselbe Volume öffnet.
**How to avoid:** Erst `docker compose -p wordquest-quick stop`, dann prüfen, dass kein laufender Container das Volume nutzt (`docker ps -q --filter volume=wordquest-quick_pgdata` leer).

## Code Examples

### Zielversion lesen und Pull vor `.env`
```bash
# Source: setup.sh:16 (env_value-Muster), setup.sh:70-71 (sed ohne -i), setup.sh:86 (--ignore-buildable)
target="$(grep -E '^WQ_VERSION=' .env.example | tail -n 1 | cut -d= -f2-)"
current="$(env_value WQ_VERSION)"
WQ_VERSION="$target" docker compose pull --ignore-buildable </dev/null \
  || die "Die Version ${target} ließ sich nicht laden. Es wurde nichts geändert."
if grep -qE '^WQ_VERSION=' .env; then
  sed -e "s|^WQ_VERSION=.*|WQ_VERSION=${target}|" .env > .env.tmp && mv .env.tmp .env
else
  printf 'WQ_VERSION=%s\n' "$target" >> .env
fi
```

### Demo-Abbruch erkennen
```bash
# Source: DemoAccountCheck.cs:41, setup-smoke.sh:172-186
if docker compose logs api </dev/null 2>&1 | grep -qF 'Start abgebrochen: Das Demo-Elternkonto'; then
  # Frage stellen, dann:
  docker compose run --rm -T api reset-password demo@wordquest.local </dev/null
  docker compose restart api </dev/null >/dev/null
fi
```

### Altes Schnelltest-Volume sichern (Option A)
```bash
# Source: Probe in dieser Session (Volume einer gestoppten Compose-Instanz, pg_dump ohne Passwort)
docker compose -p wordquest-quick stop </dev/null
docker run -d --rm --name wq-umstieg -v wordquest-quick_pgdata:/var/lib/postgresql/data postgres:17-alpine
until docker exec wq-umstieg pg_isready -U wordquest -d wordquest >/dev/null 2>&1; do sleep 1; done
docker exec wq-umstieg pg_dump -U wordquest -d wordquest | gzip > "backups/schnelltest-wordquest-${ts}.sql.gz"
docker stop wq-umstieg >/dev/null
```
Die Warteschleife braucht im Skript eine Obergrenze (Discretion).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| .NET-SDK unter QEMU für arm64 | Build-Stage auf `$BUILDPLATFORM`, SDK versteht Docker-`TARGETARCH` | .NET 8 [CITED: devblogs.microsoft.com/dotnet/improving-multiplatform-container-support] | api-Build ohne Emulation |
| `pg_dump`-Ausgabe ohne Meta-Befehle | `\restrict`/`\unrestrict` im Dump | PG 17.6 [VERIFIED: Dump in dieser Session; Version als Zeitpunkt ASSUMED] | Einspielen mit psql ≥ 17.6, hier der Container |
| Node-20-Actions | Node 24 auf den Runnern | 2026-06-16 Standard, Entfernung 2026-09-23 angekündigt [CITED: github.blog/changelog/2026-09-23-…] | Lauf vom 2026-10-01 trotzdem grün; kein Handlungsbedarf in dieser Phase |

**Deprecated/outdated:**
- README Z. 30–33 (Pakete auf öffentlich stellen): für `mrhdready` erledigt.
- README Z. 193–204 (Aktualisieren mit `pull && up -d`, Tag `v0.1.0`): ersetzt durch `upgrade.sh` und `1.0.0`.
- README Z. 68–71 („Schnelltest-Daten werden nicht übernommen“): hängt an Open Question 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `frontend/Dockerfile` baut mit `--platform=$BUILDPLATFORM` dasselbe `dist/` | Befund 1 | Gering; Buildx-Probe im Plan deckt es auf |
| A2 | psql-Variablen werden in `-c` nicht ersetzt | Befund 2 (nur Option B) | Nur relevant für Option B; stdin-Weg ist geprobt |
| A3 | API-Container bekommt nach stop/start ggf. eine neue IP → `restart web` nötig | Befund 4 | Ohne Restart sporadische 502; mit Restart kein Schaden |
| A4 | Listenformel `ls -1ti … | awk` entdoppelt Hardlinks korrekt auf GNU und BSD | Befund 4 | Doppelte Einträge in der Liste; Smoke prüft |
| A5 | `git pull` bricht bei geänderten versionierten Dateien ohne Änderung ab; Tag-Klon → detached HEAD | Befund 5 | Seite empfiehlt falschen Klonbefehl |
| A6 | Bash liest laufende Skripte nach (Grund gegen `git pull` im Skript) | Befund 5 | Nur Begründung; Empfehlung bleibt gleich |
| A7 | `pipefail` + `grep -q` kann bei großen Dumps fehlschlagen | Pitfall 4 | Fehlalarm bei echten Sicherungen |
| A8 | Raspberry Pi OS Lite bringt `git` nicht mit → Voraussetzung `sudo apt install git` | Doku | Ein überflüssiger Schritt auf der Seite |
| A9 | Dateien des Backup-Dienstes sind auf Linux für den Benutzer lesbar (root, 0644) | Befund 3/4 | `restore.sh` kann tägliche Sicherungen nicht lesen; nur auf echtem Linux prüfbar (manuelle Abnahme) |

## Open Questions

1. **Frage an Dennis: Umstieg vom alten Schnelltest – Dump oder `ALTER ROLE`?**
   - What we know: Der Schnelltest lief als Projekt `wordquest-quick` mit Volume `wordquest-quick_pgdata` und Passwort `wordquest` (`git show 4ce32da:docker-compose.quick.yml` Z. 18, 26). Die neue Installation ist Projekt `wordquest` mit eigenem Volume (`docker-compose.quick.yml:20`). `ALTER ROLE` im laufenden DB-Container der neuen Installation trifft die alten Daten also nicht. README Z. 68-71 sagt heute „werden nicht übernommen“.
   - Option A (Empfehlung): `docker compose -p wordquest-quick stop` → `git clone` → `./setup.sh` → `./upgrade.sh` erkennt das alte Volume und eine neue Installation ohne Kinder, fragt nach, sichert das alte Volume per Wegwerf-Container und spielt es mit der `restore.sh`-Funktion ein; danach Demo-Fall wie bei L2. Kein `ALTER ROLE`. Altes Volume bleibt als Rückweg. Nachteil: Das in `setup.sh` angelegte Konto wird durch das alte Demo-Konto ersetzt; Anmeldung danach mit `demo@wordquest.local` und dem einmal angezeigten Passwort (E-Mail ist nicht änderbar).
   - Option B (D-06 wörtlich): neue Installation übernimmt das alte Volume (`COMPOSE_PROJECT_NAME=wordquest-quick` in `.env` oder `external`-Volume) und setzt per `ALTER ROLE` das Secret. Braucht einen anderen Ablauf in `setup.sh` (die API darf vor dem `ALTER ROLE` nicht starten), behält den alten Projektnamen dauerhaft und ändert die alten Daten an Ort und Stelle.
   - Recommendation: Option A. Sie ist kleiner, ändert `setup.sh` nicht und hat einen Rückweg.
   - RESOLVED durch D-06 (Dennis 2026-10-18: kein Umstieg). Alte Schnelltest-Installationen werden neu aufgesetzt; die Installationsseite sagt das in einem Satz (`docker compose -p wordquest-quick down`, das Volume bleibt). Weder Option A noch Option B wird umgesetzt.

2. **Neuer Workflow nötig? (D-03)**
   - What we know: `ci.yml:3-8,96-144` baut bei Tag `v*` Multi-Arch und schiebt `1.0.0`, `latest`, `sha-…` nach `ghcr.io/mrhdready/wordquest-*`.
   - RESOLVED: Kein neuer Workflow, `ci.yml` bleibt unverändert. REL-04 braucht nur die Standardwerte (D-04) und die `$BUILDPLATFORM`-Zeile in beiden Dockerfiles. Lokaler Beleg nach D-12: YAML-Parse von `ci.yml` und Buildx-Probe mit beiden Plattformen.

3. **Demo-Kind mit PIN `1234`**
   - What we know: `DemoAccountCheck.cs:36` prüft nur Nicht-Learner; die PIN bricht nichts ab, und es gibt kein CLI-Verb dafür.
   - ÜBERHOLT (gilt nicht mehr): `upgrade.sh` gibt nach jedem Demo-Reset den Hinweis aus, dem Kind „Max“ unter „Verwalten → Kinder“ eine neue PIN zu geben. Kein neues CLI-Verb.
   - Ersetzt durch 03-04 (Update): `upgrade.sh` hat keinen Demo-Zweig, weil der Fall bei Installationen aus `setup.sh` nicht vorkommt (Begründung in 03-04 Flagged Assumptions). Der Demo-Hinweis in `upgrade.sh` entfällt; das README behält Demo-Daten nur als Entwickler-Option.

4. **Automatisches Zurückspielen, wenn das Einspielen scheitert?**
   - RESOLVED (Claude's Discretion, D-08 erlaubt es): ja, mit derselben Funktion; die Meldung nennt beide Dateien. Andernfalls bliebe eine leere DB, und ein Laie startet daraus eine scheinbare Neuinstallation.

5. **Gemeinsame Shell-Datei oder Kopien?**
   - ÜBERHOLT (gilt nicht mehr): Hängt an Frage 1. Bei Option A spielen beide Skripte ein → eine kleine gemeinsame Datei (Prüfung, Einspielen, Health-Schleife). Bei Option B reichen Kopien der Health-Schleife.
   - Ersetzt durch 03-03 (Wiederherstellen): Nach D-06 spielt nur `restore.sh` ein; `restore.sh` und `upgrade.sh` haben Kopien der kleinen Funktionen (03-03 Flagged Assumptions).

6. **Alte Images im Smoke aus GHCR ziehen?**
   - RESOLVED: ja, `sha-4ce32da` ist öffentlich und hat arm64. Fallback ohne Netz: Images aus einem `git worktree` auf `4ce32da` bauen.
   - Ersetzt durch 03-04 (Update): Kein Smoke-Teil für Altinstallationen (D-06). Der Update-Smoke nutzt lokale Tags `0.0.0-smoke` und `1.0.0` ohne Build-Overlay und einen Pull-Spy; der echte Pull aus GHCR ist Nach-Release-Abnahme (03-VALIDATION).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Desktop (containerd, Multi-Plattform) | Smoke, Buildx-Probe | ✓ | 29.8.2, aarch64 | — |
| Docker Compose | Skripte, Smoke | ✓ | v5.6.0 | — |
| `postgres:17-alpine`, `prodrigestivill/postgres-backup-local:17`, `mcr.microsoft.com/dotnet/sdk:10.0`, `node:22-alpine`, `nginxinc/nginx-unprivileged:alpine` | Stack, Builds | ✓ lokal | — | — |
| `mcr.microsoft.com/dotnet/sdk:10.0-alpine`, `aspnet:10.0-alpine` | Buildx-Probe | ✓ (Probe lief) | — | — |
| `ghcr.io/mrhdready/wordquest-{api,web}:sha-4ce32da` | Altinstallation im Smoke | ✓ öffentlich (nicht lokal) | — | Build aus `git worktree` |
| Host-Port 8080 | Standardport | ✗ belegt (`veldera-aura-reverb-1`) | — | Smoke: 18082/18083 |
| Host-Port 5432 | `docker-compose.dev.yml` | ✗ belegt (`thebrain-postgres-1`) | — | eigenes Docker-Netz ohne Host-Port (wie Phase 2) |
| shellcheck / actionlint | D-02 / D-12 | ✗ | — | `bash -n` / PyYAML |
| .NET SDK lokal | Gate | ✗ | — | SDK-Container (wie Phase 2) |
| Raspberry Pi 5 | echte Abnahme | ✗ | — | manuelle Abnahme durch Dennis |

**Missing dependencies with no fallback:** keine für die lokale Arbeit. Echter Pi und echtes Veröffentlichen bleiben manuelle Abnahme (D-12).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash-Smoke im Docker (Muster `setup-smoke.sh`), `bash -n`, PyYAML-Parse, `docker buildx`; bestehende xUnit-/Vitest-/Playwright-Suiten als Gate |
| Config file | `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` (Wave 0) |
| Quick run command | `(for f in setup.sh upgrade.sh restore.sh; do bash -n "$f" \|\| exit 1; done) && python3 -c 'import sys,yaml;[yaml.safe_load(open(f)) for f in sys.argv[1:]]' .github/workflows/ci.yml docker-compose.quick.yml docker-compose.yml` |
| Full suite command | `bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` + Gate aus AGENTS.md |

Buildx-Probe (D-12), ohne Push:
```bash
docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 -f backend/Dockerfile --output type=cacheonly .
docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 -f frontend/Dockerfile --output type=cacheonly .
```
Backend-Gate wie Phase 2 im SDK-Container mit eigenem Netz (Port 5432 belegt):
```bash
docker network create wq-p3 2>/dev/null; \
docker run -d --rm --name wq-p3-db --network wq-p3 -e POSTGRES_DB=wordquest -e POSTGRES_USER=wordquest -e POSTGRES_PASSWORD=devpassword postgres:17-alpine; \
docker run --rm --network wq-p3 -v "$PWD":/src -w /src -v wq-nuget:/root/.nuget/packages \
  -e WQ_TEST_DB='Host=wq-p3-db;Port=5432;Username=wordquest;Password=devpassword' \
  mcr.microsoft.com/dotnet/sdk:10.0 sh -c 'dotnet build backend/WordQuest.slnx -c Release /warnaserror && dotnet test backend/WordQuest.slnx -c Release'
# danach: docker rm -f wq-p3-db; docker network rm wq-p3
```

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-04 | `ci.yml` gültig und baut bei `v*` | statisch | PyYAML-Parse + `grep -n 'tags: \["v\*"\]' .github/workflows/ci.yml` | ✅ |
| REL-04 | beide Images bauen für arm64 und amd64 | build | Buildx-Probe oben, Exit 0 | ✅ (Befehl) |
| REL-04 | Version überall `1.0.0`, Präfix-Standard | smoke | Versionsvergleich `.env.example` ↔ Compose-Standardwerte; Enter bei der Präfixfrage → `.env` enthält `ghcr.io/mrhdready/wordquest` | ❌ Wave 0 |
| REL-04 | Images wirklich veröffentlicht | manuell | Dennis: Tag pushen, `docker pull ghcr.io/mrhdready/wordquest-api:1.0.0` auf dem Pi | manuell |
| REL-01 | Update sichert vorher, Sicherung geprüft, Version gesetzt, API bereit | smoke | `release-smoke.sh` Schritt 4/5 | ❌ Wave 0 |
| REL-01 | Altinstallation: Daten gleich, Demo-Login 401, neues Passwort 200, PIN-Hinweis | smoke | `release-smoke.sh` Schritt 2–4 (Fingerabdruck) | ❌ Wave 0 |
| REL-01 | Zielversion fehlt → Abbruch, `.env` unverändert | smoke | `release-smoke.sh` Schritt 7 | ❌ Wave 0 |
| REL-02 | Restore auf früheren Stand → Fingerabdruck = S1, Vorher-Sicherung vorhanden | smoke | `release-smoke.sh` Schritt 6 | ❌ Wave 0 |
| REL-02 | kaputte Datei → Abbruch vor dem Drop, Daten unverändert | smoke | `release-smoke.sh` Schritt 6 | ❌ Wave 0 |
| REL-03 | jeder Befehl der Seite existiert und läuft im Smoke; Fakten = Code | smoke + Review | Smoke führt die Seitenbefehle aus; Doc-Review gegen die Faktenliste („Befund 8“) | ❌ Wave 0 |
| REL-01/02 | Skripte syntaktisch gültig, ausführbar | statisch | `bash -n …`; `git ls-files -s upgrade.sh restore.sh` zeigt `100755` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run command; bei Skriptänderungen zusätzlich der passende Smoke-Teil.
- **Per wave merge:** `release-smoke.sh` vollständig.
- **Phase gate:** `release-smoke.sh`, `setup-smoke.sh` aus Phase 1 (gemeinsamer Code in `setup.sh`), Buildx-Probe, volles Gate aus AGENTS.md. Manuelle Abnahme durch Dennis: Tag pushen, CI-Lauf grün, Pull auf dem Pi, Phase-1-Prüfungen auf dem Pi (`hostname -I`, Backup-Dienst, Lesbarkeit der Dumps für `restore.sh`, A9).

### Wave 0 Gaps
- [ ] `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` (Gerüst aus `setup-smoke.sh:10-45`, ohne Export von `WQ_VERSION`/`WQ_IMAGE_PREFIX`)
- [ ] SQL-Fixture für die Altinstallation (Kinder, Set, Einträge, `review_state` gegen das Schema der Migration `Initial`) und die Fingerabdruck-Abfrage
- [ ] Umgebungsvariable für den alten Projektnamen in `upgrade.sh` (nur nötig bei Option A)

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Demo-Konto mit bekanntem Passwort wird per `reset-password` entschärft; Passwort nur einmal auf dem Terminal |
| V3 Session Management | yes | `reset-password` widerruft Refresh-Tokens (README Z. 110-112, Konzept Z. 635); kein neuer Code |
| V4 Access Control | no | keine Endpoints |
| V5 Input Validation | yes | `restore.sh`-Argument und Listenauswahl: nur existierende Dateien unter `backups/` bzw. vorhandener Pfad, immer in Anführungszeichen; Nummer gegen die Liste prüfen |
| V6 Cryptography | no | keine Änderung; Secrets bleiben aus `setup.sh` |
| V8 Data Protection | yes | Dumps enthalten Familiendaten und Hashes: Ablage in `backups/` (0700, `setup.sh:54-57`); keine Dumps oder Passwörter in Smoke-Logs |
| V14 Configuration | yes | Actions in `ci.yml` auf Major-Tags, `packages: write` nur bei Push (`ci.yml:100-105`); unverändert |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Demo-Konto mit bekanntem Passwort nach Update weiter aktiv | Spoofing | API-Startabbruch (vorhanden) + geführter Reset in `upgrade.sh` |
| Secret in der Prozessliste (`ALTER ROLE`, nur Option B) | Information Disclosure | Secret per `\set pw \`cat /run/secrets/db_password\`` über stdin, nie als Argument |
| Reset-Passwort in Logdatei | Information Disclosure | nur Terminal; Smoke schreibt es in eine Datei der Arbeitskopie und gibt es nicht aus (`setup-smoke.sh:94-101`) |
| Restore einer manipulierten Datei | Tampering | Nur Dateien aus dem eigenen `backups/` (0700) anbieten; Pfad-Argument ist eine bewusste Entscheidung des Betreibers |
| Halber Zustand nach Abbruch | Denial of Service | Erst prüfen, dann ändern; Vorher-Sicherung; automatisches Zurückspielen |
| Fork-PR schiebt Images | Elevation | `if: github.event_name == 'push'` (`ci.yml:100`), unverändert |

## Sources

### Primary (HIGH confidence)
- Codebasis, in dieser Session gelesen: `.github/workflows/ci.yml`, `README.md`, `setup.sh`, `docker-compose.quick.yml`, `docker-compose.yml`, `docker-compose.build.yml`, `.env.example`, `.gitignore`, `.dockerignore`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` (grep), `Program.cs`, `SecretCheck.cs`, `DemoAccountCheck.cs`, `AccountCommands.cs`, `AccountService.cs` (Ausschnitte), `DemoDataSeeder.cs` (Ausschnitte), `User.cs`, `IdentityConfigurations.cs`, `OrphanCleanup.cs` (grep), Migrationen (grep), `setup-smoke.sh`, `Documentation/README.md`, Konzept §14 (grep), `.planning/research/PITFALLS.md` (Pitfall 4, 15)
- Git-Historie: `git show 4ce32da:{docker-compose.quick.yml,docker-compose.yml,setup.sh,.env.example,README.md}`, `git log --follow`, Commit `96329c3`
- GitHub: `gh run view 36879858849` (Jobs, Log), `gh api …/releases/latest` für alle Actions, GHCR-Tag-Listen und Manifeste (anonym)
- Docker-Proben in dieser Session: `pg_hba.conf`, `rolsuper`, Dump-Kopf/-Ende, Drop/Create + `psql -1`, Doppel-Import, `compose -p … stop` ohne Datei, Dump aus fremdem Volume, `ALTER ROLE` per stdin, Buildx Multi-Plattform mit `$BUILDPLATFORM`, amd64-Image gestartet
- `prodrigestivill/postgres-backup-local:17`: Image-Env und `/backup.sh` aus dem lokalen Image
- [dotnet-docker Sample Dockerfile.alpine-icu](https://github.com/dotnet/dotnet-docker/blob/main/samples/AspNetCoreRazorApp/Dockerfile.alpine-icu) – `$BUILDPLATFORM`/`TARGETARCH`-Muster (per `gh api`)

### Secondary (MEDIUM confidence)
- [Microsoft .NET Blog: Improving multi-platform container support](https://devblogs.microsoft.com/dotnet/improving-multiplatform-container-support/) – QEMU nicht unterstützt
- [docker/metadata-action README](https://github.com/docker/metadata-action) – `latest=auto`, Kleinschreibung, semver
- [GitHub Changelog: Deprecation of Node 20 on GitHub Actions runners](https://github.blog/changelog/2026-09-23-deprecation-of-node-20-on-github-actions-runners/)
- [Docker Docs: Install Docker Engine on Raspberry Pi OS](https://docs.docker.com/engine/install/raspberry-pi-os/) – 64-bit → Debian-Anleitung, `docker`-Gruppe
- [prodrigestivill/docker-postgres-backup-local backup.sh](https://raw.githubusercontent.com/prodrigestivill/docker-postgres-backup-local/main/backup.sh) – mit dem lokalen Image abgeglichen

### Tertiary (LOW confidence)
- Git-/Bash-Verhalten (A5, A6), Pi-OS-Lieferumfang (A8): Trainingswissen

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH – keine neuen Pakete, Versionen per Befehl gelesen
- Architecture: HIGH für Sicherung/Wiederherstellung und Cross-Build (geprobt), MEDIUM für den Umstieg (hängt an Open Question 1)
- Pitfalls: HIGH für Bash 3.2, stdin, `.env`-Vorrang, Ports (beobachtet); MEDIUM für nginx-IP und Linux-Dateirechte (A3, A9)

**Research date:** 2026-10-18
**Valid until:** 2026-11-17; Codebefunde gelten bis zur nächsten Änderung der genannten Dateien, die Actions-Versionen ändern sich schneller.
