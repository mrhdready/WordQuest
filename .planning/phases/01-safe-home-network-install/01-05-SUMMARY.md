---
phase: 01-safe-home-network-install
plan: 05
subsystem: infra
tags: [cli, reset-password, secrets, startup-check, backup, docker-compose, setup-sh, xunit]
status: complete

requires:
  - phase: 01-02
    provides: AccountService/AccountCommands (has-owner, create-owner), ApiFactory mit eigener DB je Instanz, setup-smoke.sh, docker-compose.quick.yml mit Secret-Dateien
provides:
  - CLI-Verb reset-password <E-Mail> (AccountService.ResetPasswordAsync, Widerruf aller Refresh-Tokens)
  - SecretCheck.Problem / ConnectionStringProblem und Startabbruch ausserhalb von Development in Program.cs
  - backup-Dienst in docker-compose.quick.yml, backups/ mit 0700 und Abschlusszeile in setup.sh
  - Smoke-Schritte RESET OK, STARTABBRUCH OK, BACKUP OK; Reset-Passwort in $owner_password fuer 01-07
affects: [01-06, 01-07, 01-08]

estimate:
  tokens: 130000
actuals:
  tokens: 8800
  tasks: 3
  commits: 3
plan_head_before: ca2e76bc6af8397adb4dfef018e836e49d937a4f
plan_head_after: 3b1d12241ec7196069322585d92949ce9d1668a1

tech-stack:
  added: []
  patterns:
    - "Startpruefung als reine Funktion (SecretCheck) direkt nach CreateBuilder, Ausgabe auf stderr, Environment.ExitCode = 1, return"
    - "Smoke prueft den Startabbruch mit der Image-ID des laufenden api-Containers und unerreichbarem DB-Host"

key-files:
  created:
    - backend/src/WordQuest.Api/SecretCheck.cs
    - backend/tests/WordQuest.Api.Tests/ResetPasswordCommandTests.cs
    - backend/tests/WordQuest.Api.Tests/SecretCheckTests.cs
  modified:
    - backend/src/WordQuest.Infrastructure/AccountService.cs
    - backend/src/WordQuest.Api/AccountCommands.cs
    - backend/src/WordQuest.Api/Program.cs
    - docker-compose.quick.yml
    - setup.sh
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - README.md
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Reset: Passwort-Hash und Widerruf der Refresh-Tokens in einem SaveChanges (gelten zusammen oder gar nicht), nicht per ExecuteUpdate wie RevokeAllAsync"
  - "Konto-Suche beim Reset wie der Login (Email.ToLower() == normalisiert), nur Rollen Owner/Guardian"
  - "README nennt 'unter Konto aendern' noch nicht, weil die Seite erst mit 01-06 kommt; die CLI-Zeile folgt woertlich der UI-SPEC"

requirements-completed: [SETUP-01, SETUP-04, SETUP-05]

coverage:
  - id: D1
    description: "reset-password: Passwort einmal ausgegeben, nur Hash in der DB, altes Refresh-Token 401, neues Passwort 200, altes 401; unbekannt/Kind Exit 1"
    requirement: SETUP-04
    verification:
      - kind: integration
        ref: "dotnet test backend/WordQuest.slnx (ResetPasswordCommandTests 4/4)"
        status: pass
      - kind: e2e
        ref: "setup-smoke.sh RESET OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Startabbruch ausserhalb von Development bei fehlenden/bekannten Secrets, auch ueber expliziten ConnectionStrings__Default, vor jedem DB-Zugriff"
    requirement: SETUP-05
    verification:
      - kind: unit
        ref: "SecretCheckTests (15 Faelle)"
        status: pass
      - kind: e2e
        ref: "setup-smoke.sh STARTABBRUCH OK (Image-ID des laufenden api-Containers)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Taeglicher Dump nach ./backups, Ordner 0700, Abschlusszeile nennt den Pfad"
    requirement: SETUP-01
    verification:
      - kind: e2e
        ref: "setup-smoke.sh BACKUP OK"
        status: pass
    human_judgment: false

duration: 135min
completed: 2026-10-16
---

# Phase 1 Plan 05: Passwort-Reset, Secret-Startprüfung und tägliche Sicherung Summary

**`reset-password <E-Mail>` erzeugt ein 16-Zeichen-Passwort per `RandomNumberGenerator.GetString`, speichert nur den Hash und widerruft alle Refresh-Tokens; die API bricht außerhalb von Development mit fehlenden oder bekannten Standard-Secrets (auch im expliziten Connection-String) vor jedem DB-Zugriff ab; der Heimnetz-Stack sichert täglich nach `./backups` (0700).**

## Task Commits

1. **Task 1 (Tracer): reset-password** — `d9c0647` (feat)
2. **Task 2: Startabbruch bei Standard-Secrets** — `369de2c` (feat)
3. **Task 3: tägliche Sicherung, setup.sh, Doku** — `3b1d122` (feat)

`commits: 3` gemessen mit `git rev-list --count ca2e76b..HEAD`.

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Tests:** `dotnet test` → `Failed!  - Failed: 4, Passed: 18, Total: 22 - WordQuest.Api.Tests.dll` (alle 4 ResetPasswordCommandTests: `Assert.Equal() Failure: Values differ`, Verb unbekannt → Exit 64).
- **Task 1, Smoke:** Exit 1, `SMOKE FEHLER: reset-password: Exit 134 statt 0.` (Verb unbekannt, die API startete als Server und stürzte ab, weil der Port belegt war).
- **Task 2, Tests:** `Build FAILED`, `5 Error(s)`, `SecretCheckTests.cs(20,13): error CS0103: The name 'SecretCheck' does not exist in the current context` (u. a.).
- **Task 2, Smoke:** Exit 1, `SMOKE FEHLER: Start mit Standard-Secret (Start abgebrochen: WQ_DB_PASSWORD): Exit 139 statt 1.` (die API lief bis zum Verbindungsversuch und stürzte ab).

## Verify-Ergebnisse (beobachtet)

- Task 1: Build `0 Warning(s)`; `WordQuest.Api.Tests: Failed 0, Passed 22, Total 22`, `WordQuest.Learning.Tests: Failed 0, Passed 104, Total 104`. Smoke Exit 0: `IMAGE OK`, `LOGIN OK`, `RESET OK`, `SMOKE OK`; das Reset-Passwort steht nicht im Smoke-Log. Tracer-Gate (interaktiv, end-of-phase, rein automatischer Verify): Verify auf dem committeten Stand grün, kein Checkpoint.
- Task 2: Build `0 Error(s)`, `0 Warning(s)`; `WordQuest.Api.Tests: Failed 0, Passed 37, Total 37`, Learning 104/104. Smoke Exit 0: `… RESET OK`, `STARTABBRUCH OK`, `SMOKE OK`; 0 Treffer der Standardwerte im Smoke-Log.
- Task 3: `bash -n setup.sh` ok; `docker compose -f docker-compose.quick.yml config -q` ohne Ausgabe; Smoke Exit 0: `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `SMOKE OK`, Lauf 1 und 2 zeigen `Tägliche Sicherungen liegen in: …/backups`; SETUP-06-Smoke `{"installer":{"executable":true,"newSecretsReadable":true,"existingSecretsReadable":true,"privateDirectory":true,"contentsPreserved":true}}`, Exit 0.
- Alle grep-Akzeptanzkriterien der drei Tasks: PASS (u. a. `SecretCheck.Problem` Zeile 21 < `BuildConnectionString(builder.Configuration)` Zeile 48).

## Deviations from Plan

### Sonstige Abweichungen

- **Test-PostgreSQL:** wie in 01-02, Host-Port 5432 ist von `thebrain-postgres-1` belegt. Eigener Container `wq-0105-db` im Netz `wq-0105`, SDK-Container im selben Netz mit `WQ_TEST_DB=Host=wq-0105-db;…`. Container, Netz und NuGet-Volume danach entfernt.
- **README „Passwort vergessen“:** ohne „und unter ‚Konto‘ ändern“, weil es die Seite erst mit 01-06 gibt (Doku muss dem Code entsprechen). Die CLI-Ausgabe nennt „Konto“ wörtlich laut UI-SPEC.
- **Zusätzlicher Testfall** `Reset_finds_account_regardless_of_case_and_spaces` (Normalisierung wie beim Login).
- **Commits:** einer pro Task (Auftrag des Orchestrators) statt einem pro Plan (D-02).
- **Task 3 ohne roten Vorlauf:** der Plan verlangt für Task 3 keinen; der Smoke wurde direkt mit dem Code grün gefahren.

## Issues Encountered

- **Laufzeit:** Ein `dotnet build` im SDK-Container meldete `Time Elapsed 01:54:18`, die Docker-Container zeigten „Up 2 hours“ nach Minuten. Wahrscheinlich ruhte die Docker-VM bzw. der Rechner zwischendurch. `duration: 135min` ist Wanduhrzeit, nicht Arbeitszeit.
- **Frontend-Gate** nicht gelaufen: dieser Plan berührt `frontend/` nicht, und dort liegen gerade nicht committete Änderungen des Orchestrators.
- **Review durch Subagent** (AGENTS.md): in diesem Executor nicht möglich (kein Subagent-Werkzeug); laut Orchestrator läuft ein Reviewer parallel.

## Offene Punkte

- 01-06: README-Abschnitt „Passwort vergessen“ um „und unter ‚Konto‘ ändern“ ergänzen, sobald die Seite existiert.
- Smoke räumt `$WORK` mit `rm -rf` auf. Unter Docker Desktop gehören die Dumps dem Nutzer. Auf einem Linux-Host legt der root-Container sie als root an, dann kann das Aufräumen scheitern. Bisher nur auf macOS gelaufen.
- Restrisiko T-01-41 (accept): Access-Tokens bleiben nach einem Reset bis zu 15 Minuten gültig; README und Konzept nennen das.
- `UNBEKANNT:` ob der Backup-Dienst auf einem Raspberry Pi 5 (arm64) läuft; das Image `prodrigestivill/postgres-backup-local:17` ist dasselbe wie in `docker-compose.yml`, hier nur auf macOS/Docker Desktop belegt.

## Self-Check: PASSED
