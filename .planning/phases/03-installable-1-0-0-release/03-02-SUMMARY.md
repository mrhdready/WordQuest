---
phase: 03-installable-1-0-0-release
plan: 02
subsystem: release
tags: [release, docker, buildx, multi-arch, docs]
status: complete

requires:
  - phase: 03-01
    provides: "Standard WQ_VERSION=1.0.0 und Präfix ghcr.io/mrhdready/wordquest; Installationsseite; release-smoke.sh"
provides:
  - "Build-Stage beider Dockerfiles auf $BUILDPLATFORM: Multi-Arch-Build ohne .NET unter QEMU"
  - "Konzept §14 auf dem umgesetzten Stand (Tag 1.0.0, Präfix mit Enter, CI bei master und v*, Cross-Build, Verweis auf Installation.md)"
affects: [03-03, 03-04, 03-05]

actuals:
  tokens: 1800
  tasks: 2
  commits: 2
plan_head_before: deef7143900dee7553f171c9c7b2ff9663cdaa19
plan_head_after: 28e49b9f3445a6e92cc8dcce0dab48c9dea1ec96

tech-stack:
  added: []
  patterns:
    - "Cross-Build: nur der Build-Stage auf $BUILDPLATFORM, Runtime-Stage je Zielplattform"

key-files:
  created: []
  modified:
    - backend/Dockerfile
    - frontend/Dockerfile
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Eine FROM-Zeile je Dockerfile reicht; kein TARGETARCH/-a, weil die API framework-abhängig ohne RID veröffentlicht wird"
  - "ci.yml bleibt unverändert; QEMU bleibt dort für apk add/addgroup im Runtime-Stage nötig"

requirements-completed: []

duration: 30min
completed: 2026-10-18
---

# Phase 3 Plan 02: Cross-Build für arm64 und amd64 – Zusammenfassung

**Beide Dockerfiles bauen den Build-Stage jetzt auf der Build-Plattform (`FROM --platform=$BUILDPLATFORM`). Der Multi-Arch-Build für Raspberry Pi und x86-NAS läuft ohne .NET unter Emulation. Das amd64-Image der API startet auf dem arm64-Host bis zur Secret-Prüfung. Konzept §14 beschreibt Version, Präfix und Images, wie sie umgesetzt sind. Das Plan-Gate mit allen e2e-Specs gegen die neu gebauten Images ist grün.**

## Leistung

- **Dauer:** ca. 30 min (2026-10-18T11:17Z bis 11:47Z), Buildx-Proben, Gate und Review eingeschlossen
- **Tasks:** 2 von 2
- **Dateien:** 3 geändert, +10 / −4 Zeilen

## Task-Commits

1. **Task 1: Tracer – Build-Stage auf der Build-Plattform** – `a30ae5d` (feat)
2. **Task 2: Konzept §14** – `28e49b9` (docs)

Zwei Commits statt „ein atomarer Commit“ (Plan-Ziel), weil der Ausführungsauftrag atomare Commits je Anliegen verlangt; gleiche Handhabung wie 03-01. Kein Push, kein Tag.

## TDD-Belege (Task 1)

Host: `uname -m` → `arm64`, Builder `desktop-linux` (BuildKit v0.33.1).

**Vorher (rot), `backend/Dockerfile` ohne `--platform`:**
`docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 --progress=plain -f backend/Dockerfile --output type=cacheonly .` → Exit 0 nach 3:09 min. Im Log läuft der Build-Stage für amd64 unter Emulation:
- `#38 [linux/amd64 build 11/13] RUN dotnet restore src/WordQuest.Api/WordQuest.Api.csproj` → `DONE 30.8s`
- `#40 [linux/amd64 build 13/13] RUN dotnet publish …` → `DONE 133.5s`

**Nachher (grün):**

| Probe | Exit | Dauer | Stage-Zeilen im Log |
|---|---|---|---|
| Backend, mit Cache | 0 | 1,9 s | 13× `linux/arm64 build`, 0× `linux/amd64 build`, 4× je Runtime |
| Backend, `--no-cache` | 0 | 28,6 s | 14× `linux/arm64 build`, 0× `linux/amd64 build`, 5× je Runtime; `dotnet restore`/`publish` nur als `[linux/arm64 build 11/13]`/`13/13` |
| Frontend | 0 | 18,0 s | 7× `linux/arm64 build`, 0× `linux/amd64 build` |

Der Lauf mit Cache übernahm `COPY --from=build` für amd64 aus dem Cache, die IL des arm64-Build-Stages ist also inhaltsgleich mit der früher emuliert gebauten.

**Startprobe amd64:**
- `docker buildx build --builder desktop-linux --platform linux/amd64 --load -t wq-cross-probe-api:local -f backend/Dockerfile .` → Exit 0; `docker image inspect` → `linux/amd64`
- `docker run --rm wq-cross-probe-api:local` → Exit 1, Ausgabe:
  `Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt oder ist ein bekannter Standardwert. Führe `setup.sh` aus oder trage einen eigenen Wert ein.`
- `docker image rm wq-cross-probe-api:local` → Exit 0

**Tracer-Gate:** `<verify>` aus Task 1 wörtlich (beide Proben, YAML-Parse von `ci.yml`, `docker-compose.quick.yml`, `docker-compose.yml`, `git diff --quiet HEAD -- .github/workflows/ci.yml`) → Exit 0, erst danach Task 2.

## Belege je Akzeptanzkriterium

| Kriterium | Beleg |
|---|---|
| `FROM --platform=$BUILDPLATFORM` je 1× | `grep -cF` → `backend/Dockerfile:1`, `frontend/Dockerfile:1`; der Planbefehl wörtlich in `alpine` (busybox grep) ebenfalls je 1 (siehe Abweichungen) |
| `ci.yml` unverändert, Tags `v*` | `git diff --quiet HEAD -- .github/workflows/ci.yml` Exit 0; `grep -q 'tags: \["v\*"\]'` Exit 0 |
| Probe vorher, Proben nachher, Startausgabe | Abschnitt TDD-Belege |
| Konzept nennt `WQ_VERSION:-1.0.0` | `grep -q` Exit 0 (Gate-Schritt `konzept`) |
| Kein „für v1.0 geplant (`REL-04`)“ mehr | `grep -c` → 0 |
| Gate je Schritt mit Exit-Code, e2e-Anzahl, beide Smokes | Tabelle unten |

## Automatisches Gate

**Status: grün.** Ein Lauf auf dem Endstand (Dockerfiles committet, Konzept im Arbeitsbaum, Inhalt = `28e49b9`).

| Schritt | Befehl | Exit | Dauer | Ergebnis |
|---|---|---|---|---|
| Konzept | `grep -q 'WQ_VERSION:-1.0.0' Documentation/WordQuest_Konzept_und_Architektur.md` | 0 | 0 s | – |
| Backend | `bash .planning/phases/02-…/gate/backend-test.sh` (Release, `/warnaserror`) | 0 | 121 s | `0 Warning(s)`, `0 Error(s)`; Learning.Tests **137 passed**, Api.Tests **251 passed**, je 0 failed, 0 skipped |
| Frontend | `docker run … node:22 sh -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'` | 0 | 87 s | vitest **14 Dateien, 230 passed**; DESIGN.md `errors: 0, warnings: 0` |
| e2e-Stack | `npm --prefix frontend run e2e:stack` (baut die Images aus den geänderten Dockerfiles) | 0 | 37 s | – |
| e2e | `npm --prefix frontend run e2e` | 0 | 121 s | 49 Tests in 7 Specs: **48 passed, 1 skipped**, 0 failed; axe-Tests darunter (u. a. „Login: Token-Design, axe 0“, „Kinder barrierefrei“, „Konto barrierefrei“) |
| e2e-Abbau | `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v` | 0 | 2 s | – |
| Install-Smoke Phase 1 | `bash .planning/phases/01-…/smoke/setup-smoke.sh` | 0 | 115 s | `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `FIRST RUN OK` (1 passed), `DEMO-ABBRUCH OK`, `RATE-LIMIT OK`, `SMOKE OK` |
| Aufräumen | `bash .planning/phases/02-…/gate/backend-test.sh down` | 0 | 0 s | – |
| Release-Smoke | `bash .planning/phases/03-…/smoke/release-smoke.sh` | 0 | 67 s | `VERSION OK`, `INSTALL OK`, `SEITE OK`, `RELEASE-SMOKE OK` |

Der übersprungene e2e-Test ist `first-run.spec.ts:13` („Erste Installation bis zur ersten Lernantwort“), absichtlich per `test.skip(!process.env.WQ_E2E_FIRST_RUN, …)`; er läuft im Install-Smoke Phase 1 (`FIRST RUN OK`). Keine sichtbare UI-Änderung, deshalb kein A11y-Trailer. Keine neue Dependency. Nach dem Gate keine `wq-`/e2e-Container übrig.

## Abweichungen vom Plan

### Automatisch behoben

Keine Code-Abweichung.

### Hinweise

**1. Akzeptanz-Grep auf macOS:** `grep` auf diesem Host ist ugrep 7.8.4; `grep -c 'FROM --platform=$BUILDPLATFORM'` liefert dort 0, weil `$` als Anker gilt. Belegt mit `grep -cF` (je 1) und mit dem wörtlichen Planbefehl in `alpine` (busybox grep, je 1). Der Plan selbst bleibt unverändert.

**2. Zusätzliche Probe `--no-cache`:** Die Backend-Probe nachher kam vollständig aus dem Cache (1,9 s). Für einen Beleg, dass `dotnet restore`/`publish` wirklich nur auf arm64 laufen, zusätzlich ein Lauf mit `--no-cache` (28,6 s, 0× `linux/amd64 build`).

**3. Konzept, Verweis:** Der Verweis auf `Documentation/Installation.md` steht als eigener Satz direkt nach der Aufzählung des Zielbilds, nicht im Satz zur Präfix-Frage; dort steht „Image-Präfix mit dem Standard … aus `.env.example`, den Enter übernimmt“.

## Review (AGENTS.md „Review“, D-02)

Unabhängiges Review per `claude -p`, nur lesend (erlaubt: Read/Grep/Glob und lesende git-/grep-/sed-/cat-Befehle; Edit/Write verboten), gegen `03-02-PLAN.md`, `03-CONTEXT.md` (D-03, D-10, D-12), AGENTS.md und `git diff deef714`. Ergebnis: **0 BLOCKER, 0 HIGH, 0 MEDIUM, 1 LOW, 3 INFO.** Bestätigt u. a.: kein RID/SelfContained/AOT/ReadyToRun, keine Pakete mit nativen Teilen, ins Web-Image gelangt nur `dist/` und `nginx.conf`, Runtime-Stages unverändert, jede geänderte Aussage in §14 stimmt mit dem Code.

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 1 | Zwei Commits statt „ein atomarer Commit“ | LOW | **begründet zurückgewiesen:** der Ausführungsauftrag verlangt atomare Commits je Anliegen; oben dokumentiert |
| 2 | SUMMARY und Gate-Belege fehlten zum Review-Zeitpunkt | INFO | **erledigt:** dieses SUMMARY |
| 3 | `$BUILDPLATFORM` braucht BuildKit; der Legacy-Builder (`DOCKER_BUILDKIT=0`) scheitert | INFO | **keine Änderung:** BuildKit ist seit Docker 23 Standard, Eltern ziehen fertige Images; nur Selbstbauer betroffen |
| 4 | Kleinschreibung des Image-Namens aus `github.repository` | INFO | **keine Änderung:** vor diesem Diff schon so und belegt (03-RESEARCH Befund 1: Log Run 36879858849 schob `ghcr.io/mrhdready/wordquest-api:master`); Tag `1.0.0` ist Nach-Release-Abnahme |

## Bedrohungen

| ID | Umsetzung |
|---|---|
| T-03-02 | Nur Build-Stage auf `$BUILDPLATFORM`, Runtime-Stage je Plattform; Buildx-Probe beider Plattformen Exit 0; amd64-Image startet auf arm64 bis zur Secret-Prüfung. Pi-Pull bleibt Nach-Release-Abnahme |
| T-03-SC | Keine neue Dependency, kein neues Basis-Image |

Keine neue Angriffsfläche über das Threat-Modell hinaus.

## Self-Check: PASSED

- Dateien geändert vorhanden: `backend/Dockerfile`, `frontend/Dockerfile`, `Documentation/WordQuest_Konzept_und_Architektur.md`
- Commits im Verlauf: `a30ae5d`, `28e49b9` (`git merge-base --is-ancestor` je Exit 0)
- `git rev-list --count deef714..HEAD` = 2 vor dem Doku-Commit
