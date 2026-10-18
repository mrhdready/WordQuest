# Phase 3: Installable 1.0.0 Release - Context

**Gathered:** 2026-10-17. Quellen: Anforderungen, Ergebnisse der Phasen 1 und 2 und Dennis' Vorgaben für den autonomen Lauf vom 2026-10-15. Kein discuss-phase-Lauf, autonomer Lauf.
**Status:** Ready for planning

<domain>
## Phase Boundary

Eine andere Familie installiert WordQuest 1.0.0 im Heimnetz, aktualisiert es und stellt eine Sicherung wieder her, nur anhand einer Installationsseite und ohne besonderes Know-how. Anforderungen: REL-01, REL-02, REL-03, REL-04.

Nicht in dieser Phase:
- Push, Veröffentlichen der Images, GitHub-Release. Das macht Dennis.
- Neue App-Funktionen und alles aus v2.
- Änderungen an der Lern- oder Eltern-Oberfläche.

</domain>

<decisions>
## Implementation Decisions

### Ablauf
- **D-01:** Autonomer Lauf auf Branch `v1-fertig`.
  - Atomare Commits pro Plan, **kein Push**.
  - Das Release wird nur lokal vorbereitet: Workflow, Skripte, Installationsseite und am Ende das lokale Tag `v1.0.0`. Das Tag legt der Orchestrator nach grünem automatischem Phasen-Gate an, nicht ein Plan. Prüfungen mit veröffentlichten Images sind Nach-Release-Abnahme (03-REVIEWS, Codex 03-04 HIGH).
  - Pläne laufen sequenziell im Arbeitsbaum, weil sie Docker-Stacks und Ports teilen.
- **D-02:** Jede Änderung bekommt vor der Fertig-Meldung ein Subagent-Review (AGENTS.md). Shell-Skripte laufen zusätzlich durch `bash -n` und, falls installiert, `shellcheck`. shellcheck wird nicht neu installiert.

### Images und Version (REL-04)
- **D-03 (korrigiert nach 03-RESEARCH):** Kein neuer Workflow: `ci.yml` baut bei Tags `v*` bereits Multi-Arch-Images mit `1.0.0`/`latest` (`ci.yml:3-8,96-144`). Die einzige Änderung ist `FROM --platform=$BUILDPLATFORM` im Build-Abschnitt der Dockerfiles (Cross-Build statt QEMU-Emulation). Ursprüngliche Fassung zum Vergleich: GHCR-Workflow in `.github/workflows/`.
  - Auslöser ist ein Tag `v*`. Er baut `wordquest-api` und `wordquest-web` für `linux/arm64` (Raspberry Pi 5, ARM-NAS) und `linux/amd64` (x86-NAS) und schiebt sie mit dem Tag ohne `v` nach `ghcr.io/<owner>/wordquest-*`, also `1.0.0`.
  - Die bestehende CI (`ci.yml`) bleibt unverändert. Ob es einen Workflow für `master` gibt und wie er heißt, klärt die Recherche (README Zeile 19 nennt Builds auf `master`).
  - Nur Actions aus dem `docker/`- und `actions/`-Namespace, auf Versionen gepinnt.
- **D-04:** Die Installation zieht eine feste Version statt `master`.
  - In `docker-compose.quick.yml` und `docker-compose.yml` wird der Standard für `WQ_VERSION` `1.0.0`.
  - `setup.sh` schreibt `WQ_VERSION=1.0.0` in die `.env`.
  - Das Image-Präfix bekommt den Standard `ghcr.io/mrhdready/wordquest`, die Frage in `setup.sh` lässt sich mit Enter übernehmen. Eltern sollen keinen Registry-Pfad kennen müssen (Einfachheit).

### Update (REL-01)
- **D-05:** `upgrade.sh` im Repo-Root, gleicher Stil wie `setup.sh` (`die`/`warn`, deutsche ganze Sätze, Abbruch ohne halben Zustand).
  - Reihenfolge: Datenbank sichern, prüfen, dass die Sicherung lesbar und nicht leer ist, die neue Version in `.env` setzen, `docker compose pull` und `up -d`, auf Health warten.
  - Ohne geprüfte Sicherung wird nichts gezogen.
  - Die Zielversion ist die, die das ausgecheckte Repo mitbringt. Der Weg für Eltern ist `git pull` und dann `./upgrade.sh`. Die Recherche bestätigt diesen Weg oder schlägt einen einfacheren vor.
- **D-06:** Entscheidung Dennis (2026-10-18): **Kein Umstieg alter Schnelltest-Installationen in 1.0.0.** Hintergrund (03-RESEARCH): Der alte Schnelltest lief als eigenes Compose-Projekt `wordquest-quick` (Volume `wordquest-quick_pgdata`, DB-Passwort `wordquest`, Demo-Konto) ohne Repo-Klon; ein `ALTER ROLE` in der neuen Installation trifft diese Daten nicht. Solche Installationen gelten als Testinstallationen: Die Installationsseite sagt in einem Satz, dass sie neu aufgesetzt werden (alten Test mit `docker compose -p wordquest-quick down` beenden; das Volume bleibt, bis man es selbst löscht). Kein Code, kein Smoke-Teil dafür. `upgrade.sh` gilt für Installationen ab 1.0.0 bzw. aus `setup.sh` seit Phase 1.
- **D-07:** Die bestehende tägliche Sicherung (`prodrigestivill/postgres-backup-local`, `./backups`) bleibt. Die Sicherung von `upgrade.sh` landet ebenfalls unter `./backups/` mit eigenem Präfix, damit `restore.sh` sie in derselben Liste anbietet.

### Wiederherstellen (REL-02)
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

### Installationsseite (REL-03)
- **D-09:** Genau eine Seite: `Documentation/Installation.md`, maßgebliche Doku als Markdown, kein `.docx`, keine eigene Website.
  - Abschnitte: Voraussetzungen, Installation, Update, Sicherung und Wiederherstellung, Hilfe bei Problemen. Jeder Schritt hat einen Befehl und das erwartete Ergebnis.
  - Zielgerät ist ein Raspberry Pi 5, NAS als Variante. Die Traefik-Variante bekommt nur einen kurzen Verweis für Fortgeschrittene.
  - README und `Documentation/README.md` verlinken die Seite. Doppelte Installationsanleitungen im README werden auf den Verweis gekürzt, damit es eine Quelle gibt.
- **D-10:** Jede Faktenaussage der Seite muss dem Code entsprechen (AGENTS.md → Dokumentation).

### Belege
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `setup.sh`: Stil, `die`/`warn`, Secrets unter `secrets/`, `.env`-Erzeugung, Image-Präfix-Abfrage (Zeile 65).
- `docker-compose.quick.yml` / `docker-compose.yml`: `WQ_IMAGE_PREFIX`, `WQ_VERSION` (Standard `master`), Dienst `backup` mit `./backups`.
- `.planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh`: Muster für einen Install-Smoke im Docker.
- `backend/src/WordQuest.Api/Program.cs`: CLI-Verben vor dem Start, `SecretCheck`, `DemoAccountCheck`.

### Integration Points
- README Zeilen 19–48 (Images, Präfix), `Documentation/README.md` (Index), Konzept-Doku (Betrieb).

</code_context>

<specifics>
## Specific Ideas

- Pending Todo aus STATE: „Umstieg alter Schnellstart-Installationen — deren `pgdata`-Volume nutzt `POSTGRES_PASSWORD=wordquest` … `upgrade.sh` braucht dafür einen Weg (Quelle: Review 01-05).“
- Offene manuelle Prüfungen aus Phase 1 (Pi: `hostname -I`, Backup-Dienst) betreffen dieselben Abläufe. Die Installationsseite darf nichts behaupten, was diesen Prüfungen widerspricht.

</specifics>

<deferred>
## Deferred Ideas

- Automatisches Update (Watchtower o. ä.), eine Weboberfläche für Sicherungen, Sicherungen außer Haus: v2, nicht in dieser Phase.

</deferred>
