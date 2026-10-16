---
phase: 01-safe-home-network-install
plan: 02
subsystem: infra
tags: [setup-sh, docker-compose, docker-secrets, cli, postgres, xunit, webapplicationfactory]
status: complete

requires: []
provides:
  - AccountRules (MinPasswordLength, NormalizeEmail, IsValidEmail, IsValidPassword) als eine Autoritaet fuer Konto-Regeln
  - AccountService (HasOwnerAsync, CreateOwnerAsync) und OwnerCreation
  - CLI-Verben has-owner / create-owner im API-Binary (Exit 0/1/2/3/64)
  - docker-compose.quick.yml als Heimnetz-Betrieb (Projekt wordquest, Secret-Dateien, Demo-Seed aus)
  - setup.sh fuer den Heimnetz-Betrieb (Image-Praefix, E-Mail, Passwort)
  - Testprojekt WordQuest.Api.Tests mit ApiFactory (eigene DB je Instanz), CI mit Postgres-Dienst
  - Smoke .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
affects: [01-05, 01-06, 01-07, 01-08]

estimate:
  tokens: 150000
actuals:
  tokens: 14200
  tasks: 3
  commits: 4
plan_head_before: 9b859d412edf394fdc6ca67ef75197db3861520a
plan_head_after: 650538e0e190c3eb3ec9cc13c74f598041e37af4

tech-stack:
  added:
    - "Microsoft.AspNetCore.Mvc.Testing 10.0.12 (nur Testprojekt)"
  patterns:
    - "Wartungsverben im API-Binary: Verzweigung direkt nach builder.Build(), AsyncServiceScope + SystemTenantContext"
    - "Integrationstests: je Testfall new ApiFactory() mit eigener Datenbank, wenn die Erwartung vom DB-Stand abhaengt"
    - "Smoke gegen frisch gebaute Images: eindeutiger WQ_VERSION-Tag, Image-ID-Vergleich (IMAGE OK)"

key-files:
  created:
    - backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs
    - backend/src/WordQuest.Infrastructure/AccountService.cs
    - backend/src/WordQuest.Infrastructure/OwnerCreation.cs
    - backend/src/WordQuest.Api/AccountCommands.cs
    - backend/tests/WordQuest.Api.Tests/WordQuest.Api.Tests.csproj
    - backend/tests/WordQuest.Api.Tests/ApiFactory.cs
    - backend/tests/WordQuest.Api.Tests/AccountRulesTests.cs
    - backend/tests/WordQuest.Api.Tests/AccountCommandTests.cs
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
  modified:
    - backend/src/WordQuest.Api/Program.cs
    - backend/WordQuest.slnx
    - docker-compose.quick.yml
    - docker-compose.yml
    - .env.example
    - setup.sh
    - .github/workflows/ci.yml
    - AGENTS.md
    - README.md
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Npgsql-Verbindung aus WQ_DB_* mit GSS Encryption Mode=Disable: sonst schreibt jeder Verbindungsaufbau im Alpine-Image einen libgssapi-Fehler nach stderr, sichtbar in setup.sh"
  - "ApiFactory migriert selbst in InitializeAsync: WebApplicationFactory haelt Program.cs bei builder.Build() an, der Start-Block (Migration) laeuft im Test nicht"
  - "setup.sh zeigt fuer COMPOSE_FILE=docker-compose.yml die https://WQ_HOST-Adresse statt http://host:port"

patterns-established:
  - "Test zuerst: Smoke rot vor dem Umbau (Task 1), Api.Tests rot per Kompilierfehler vor den Regeln (Task 2)"
  - "Isolationsregel fuer Api.Tests als XML-Doku an ApiFactory (gilt fuer 01-05 bis 01-08)"

# SETUP-01 nur teilweise (Secrets ja, taegliche Sicherung folgt in 01-05), deshalb nicht hier.
requirements-completed: [SETUP-02, SETUP-06]

coverage:
  - id: D1
    description: "setup.sh auf frischer Arbeitskopie: drei Fragen, erzeugte Secrets, Elternkonto; Login neu 200, Demo 401; zweiter Lauf aendert nichts, ein Mandant; zweites create-owner Exit 3"
    requirement: SETUP-02
    verification:
      - kind: e2e
        ref: "bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh"
        status: pass
    human_judgment: false
  - id: D2
    description: "docker-compose.quick.yml liest DB-Passwort und JWT-Schluessel aus ./secrets, keine Klartext-Standardwerte, Seed-Default false (auch docker-compose.yml, .env.example)"
    requirement: SETUP-01
    verification:
      - kind: other
        ref: "grep-Kriterien Task 1/3 + Smoke (API startet nur mit Secret-Dateien)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Kontoregeln und CLI-Zweige gegen echtes PostgreSQL, je Testfall eigene Datenbank"
    requirement: SETUP-02
    verification:
      - kind: integration
        ref: "dotnet test backend/WordQuest.slnx (WordQuest.Api.Tests 18/18)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SETUP-06 bleibt gruen"
    requirement: SETUP-06
    verification:
      - kind: other
        ref: "node .planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/smoke.mjs --installer"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-16
---

# Phase 1 Plan 02: Heimnetz-Installation mit eigenem Elternkonto Summary

**setup.sh fragt nur Image-Präfix, E-Mail und Passwort, erzeugt Secret-Dateien für den Heimnetz-Stack und legt das Elternkonto über das CLI-Verb `create-owner` an (Passwort per stdin); Demo-Seed ist überall aus, Api.Tests läuft gegen echtes PostgreSQL mit eigener Datenbank je Testfall.**

## Paket-Freigabe

`Microsoft.AspNetCore.Mvc.Testing` 10.0.12: auf nuget.org geprüft, Autor Microsoft, veröffentlicht 2026-09-08 (aktuell ist 10.0.13 vom 2026-10-13, 10.0.12 ist also nicht brandneu und passt zu den übrigen 10.0.12-Paketen). Stehende Freigabe von Dennis (2026-10-15/16, D-13). Keine weiteren Dependencies.

## Accomplishments

- `AccountRules` im Identity-Modul: Mindestlänge 8, E-Mail-Prüfung (MailAddress, kein Anzeigename, Punkt in der Domain, ≤ 320), Passwort nicht nur Leerraum und kein Trimmen (deckt die Vorbedingung von `PasswordHasher.Hash`).
- `AccountService` + `OwnerCreation`; Prüfreihenfolge AlreadyExists → InvalidEmail → PasswordBlank → PasswordTooShort.
- CLI `has-owner` (0/1) und `create-owner <email>` (0/2/3, Aufruffehler 64) im API-Binary, Verzweigung vor Migration/Kestrel, DI-Scope über `CreateAsyncScope`.
- `docker-compose.quick.yml`: `name: wordquest`, Secrets aus `./secrets`, `WQ_SEED_DEMO_DATA: ${WQ_SEED_DEMO_DATA:-false}`; `.env.example` mit `COMPOSE_FILE=docker-compose.quick.yml` und Seed `false`; `docker-compose.yml` Seed-Default `false`.
- `setup.sh` neu: keine Hostname-/ACME-Fragen mehr, `pull --ignore-buildable`, alle Docker-Aufrufe ohne Eingabe mit stdin aus `/dev/null`, Passwort mit `IFS= read -rsp`, Abschlusszeile laut UI-SPEC, kein Demo-Block.
- `WordQuest.Api.Tests` (Solution, CI-Postgres-Dienst, `WQ_TEST_DB`), Gate-Hinweis in AGENTS.md.
- README (Variante A Heimnetz, Hinweis `wordquest-quick`, Variante B für Fortgeschrittene) und Konzept auf neuem Stand.

## Task Commits

1. **Task 1 (Tracer): setup.sh + create-owner + Heimnetz-Compose** — `d411161` (feat)
2. **Task 2: Kontoregeln und CLI-Zweige test-first, CI mit Postgres** — `439caa1` (feat)
3. **Task 3: Demo-Seed aus, Doku, SETUP-06-Regression** — `650538e` (docs)

Hinweis zur Zählung: `commits: 4` ist gemessen (`git rev-list --count 9b859d4..HEAD`). Darin steckt `b4a542c fix(01-01): Review-Befunde …`, das während dieses Plans von außerhalb auf `v1-fertig` kam und zu 01-01 gehört. Von 01-02 stammen 3 Commits.

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Smoke vor dem Umbau:** `bash …/smoke/setup-smoke.sh` → Exit 1. Images wurden gebaut, dann scheiterte der alte `setup.sh`: er fragte Hostname/ACME/Präfix (Antworten verschoben, `.env angelegt fuer wq-smoke.`), `docker compose pull` ohne `--ignore-buildable` → `pull access denied for wq-smoke-api` → `Images konnten nicht geladen werden. …`.
- **Task 2, Tests vor den Regeln:** `dotnet build` im SDK-Container → `Build FAILED`, `AccountRulesTests.cs(15,45): error CS0117: 'AccountRules' does not contain a definition for 'IsValidEmail'` und `(25,45) … 'IsValidPassword'`.

## Verify-Ergebnisse (beobachtet)

- Task 1: `dotnet build … /warnaserror` → `0 Warning(s) 0 Error(s)`; Smoke → Exit 0 mit `IMAGE OK`, `LOGIN OK`, `SMOKE OK`. Tracer-Gate (interaktiv, end-of-phase, rein automatischer Verify): erneuter Lauf grün, kein Checkpoint.
- Task 2: `dotnet test` → `WordQuest.Api.Tests: Failed 0, Passed 18, Total 18`; `WordQuest.Learning.Tests: Failed 0, Passed 104, Total 104`; nach dem Lauf 0 Datenbanken `wordquest_test_%` übrig. Smoke erweitert → Exit 0, Ausgabe `Es gibt schon ein Elternkonto.`, `SMOKE OK`.
- Task 3: `node …/261006-r7l…/smoke.mjs --installer` → `{"installer":{"executable":true,"newSecretsReadable":true,"existingSecretsReadable":true,"privateDirectory":true,"contentsPreserved":true}}`, Exit 0; `WQ_SEED_DEMO_DATA:-false` in docker-compose.yml, `demo1234` nicht in README.
- Abschluss-Gate: Backend-Build 0 Warnungen/0 Fehler, Tests 18/18 + 104/104; Frontend `npm ci && lint && typecheck && build` Exit 0. `docker compose config -q` für beide Compose-Dateien ohne Ausgabe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] libgssapi-Fehler in der setup.sh-Ausgabe**
- **Found during:** Task 1 (erster grüner Smoke)
- **Issue:** Jeder `docker compose exec … dotnet WordQuest.Api.dll …` schrieb `Error: Error loading shared library libgssapi_krb5.so.2` nach stderr (Npgsql versucht GSS-Verschlüsselung, das Alpine-Image hat die Bibliothek nicht). Für Laien in der Einrichtung irreführend.
- **Fix:** `GSS Encryption Mode=Disable` im Verbindungsstring aus `WQ_DB_*` (`Program.cs`, `BuildConnectionString`). Explizites `ConnectionStrings__Default` (Dev, Tests) unverändert.
- **Beleg:** Smoke danach: 0 Treffer `libgssapi` (vorher 6).
- **Commit:** d411161

**2. [Rule 3 - Blocking] ApiFactory migriert selbst**
- **Found during:** Task 2
- **Issue:** WebApplicationFactory hält `Program.cs` bei `builder.Build()` an; der Start-Block mit `MigrateAsync` läuft im Test nicht, die Test-Datenbank hätte kein Schema.
- **Fix:** `ApiFactory.InitializeAsync` migriert über `CreateSystemDbContext()` (aus dem Verbindungsstring, nicht aus dem Host); `DisposeAsync` beendet erst den Host, dann `EnsureDeletedAsync`.
- **Commit:** 439caa1

### Sonstige Abweichungen

- **Test-PostgreSQL:** Host-Port 5432 ist von einem fremden Container (`thebrain-postgres-1`) belegt, `docker-compose.dev.yml up` hätte nicht starten können. Statt dessen ein eigener Container `wq-apitests-db` im Netz `wq-apitests` (gleiche Werte wie docker-compose.dev.yml, ohne Host-Port), SDK-Container im selben Netz mit `WQ_TEST_DB=Host=wq-apitests-db;…`. Danach Container und Netz entfernt. Inhaltlich gleicher Lauf wie der Plan-Befehl, nur ohne `host.docker.internal`.
- **setup.sh, Domain-Variante:** Abschlusszeile nennt bei `COMPOSE_FILE=docker-compose.yml` `https://<WQ_HOST>` statt `http://<host>:<port>`, damit die README-Aussage „setup.sh legt Secrets und Elternkonto auch dafür an“ stimmt.
- **setup.sh, EOF:** Endet die Eingabe vor dem fertigen Konto, bricht `setup.sh` mit Meldung ab statt endlos zu fragen.
- **.env.example / docker-compose.yml:** Kommentare „(nur docker-compose.yml)“ an Hostname/TLS bzw. Kopfkommentar „Heimnetz … (Standard)“ angepasst, damit die Doku dem Verhalten entspricht.
- **Commits:** Ein Commit pro Task (Auftrag des Orchestrators) statt eines Commits pro Plan (Plan-Objective D-02).

## Issues Encountered

- **Akzeptanzkriterium `! grep -q 'GSD:' AGENTS.md` ist schon vor diesem Plan rot:** AGENTS.md Zeile 220 (Bestand, Abschnitt „Pflege dieser Datei“) erwähnt `<!-- GSD:…-start -->` als Text. Dieser Plan fügt keinen Marker ein (Diff geprüft). Kriterium im Plan ist fehlerhaft formuliert.
- **`grep -q 'WQ_SEED_DEMO_DATA: ${WQ_SEED_DEMO_DATA:-false}'`** schlägt unter BSD-grep fehl (`{` als Intervall gelesen); mit `grep -F` Treffer, Zeile steht wörtlich in docker-compose.quick.yml.
- **Review durch Subagent** (AGENTS.md, Plan-Verification): in diesem Executor nicht möglich (kein Subagent-Werkzeug); laut Orchestrator läuft ein Reviewer parallel. Befunde stehen noch aus.

## Offene Punkte

- Backup-Dienst im Heimnetz-Stack und `{Sicherungsordner}` in der Abschlusszeile: 01-05.
- Startprüfung bekannter Standard-Secrets (SETUP-05): 01-05.
- `create-owner` gibt bei Erfolg „Elternkonto für … angelegt.“ aus, setup.sh danach „✓ Elternkonto angelegt.“ (doppelte Meldung, im Plan so vorgesehen).
- `UNBEKANNT: ob produktive Daten in einem wordquest-quick-Volume liegen` — README nennt den Umgang.
- REQUIREMENTS.md nicht angefasst (Auftrag: nur SUMMARY, STATE, ROADMAP); `requirements.mark-complete` hatte SETUP-01/02 abgehakt, zurückgenommen. SETUP-01 ist erst mit der Sicherung aus 01-05 vollständig; SETUP-02 abhaken überlässt der Plan dem Orchestrator.
- `host.docker.internal` im AGENTS.md-Containerbefehl funktioniert unter Docker Desktop; unter Linux braucht es `--add-host=host.docker.internal:host-gateway`.

## Self-Check: PASSED
