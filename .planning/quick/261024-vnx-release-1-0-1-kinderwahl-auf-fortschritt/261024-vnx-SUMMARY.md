---
phase: quick-261024-vnx
plan: "01"
subsystem: frontend-manage, setup, release
tags: [wcag-1.4.1, setup, installation, release-1.0.1]
status: complete
requires: []
provides:
  - "Haken an der gewaehlten Kind-Kapsel auf /verwalten/fortschritt"
  - "Deutscher Port-Hinweis in setup.sh (Heimnetz-Variante)"
  - "Version 1.0.1 an allen Stellen"
affects: [ProgressPage, setup.sh, setup-smoke.sh, release-smoke.sh, Installation.md, README.md, Konzept]
tech-stack:
  added: []
  patterns: ["lucide Check als Nicht-Farb-Merkmal (Muster LearnHomePage)", "docker compose up | tee <tmp> >&2 fuer live Ausgabe plus Mustersuche"]
key-files:
  created: []
  modified:
    - frontend/src/features/manage/ProgressPage.tsx
    - frontend/src/features/manage/ProgressPage.test.tsx
    - frontend/e2e/manage.spec.ts
    - setup.sh
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - Documentation/Installation.md
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - README.md
    - .env.example
    - docker-compose.quick.yml
    - docker-compose.yml
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
decisions:
  - "setup.sh schreibt die Ausgabe von docker compose up per tee in eine Temp-Datei statt sie in eine Variable zu fangen: Fortschritt bleibt live sichtbar (Review R-1); tee /dev/stderr verworfen, weil Linux eine nach Datei umgeleitete stderr dabei neu oeffnet und kuerzt"
  - "Andere Startfehler enden mit Dockers eigenem Exit-Code (exit \"$up_status\"), nicht fest mit 1"
  - "Playwright-Browser per npx playwright install chromium (Build 1248) statt Symlink-Workaround (Freigabe Orchestrator)"
requirements: [DESIGN-01, SETUP-01, REL-03, REL-04]
metrics:
  started: 2026-10-24T20:58:33Z
  completed: 2026-10-24T21:17:38Z
  duration: 19min
actuals:
  tokens: 8475
  tasks: 3
  commits: 5
plan_head_before: 07e2b2869c85854e8dcec2efb5b78ee41d0bcc25
plan_head_after: 457e3390f76d3e1d787fc116b2320c0d69b1c17f
---

# Quick 261024-vnx Plan 01: Release 1.0.1 Summary

Kind-Kapsel auf der Fortschritt-Seite traegt bei Auswahl einen Haken (WCAG 1.4.1), setup.sh bricht bei belegtem Port in der Heimnetz-Variante mit deutschem Hinweis auf `WQ_PORT` ab, die Installationsseite beantwortet die Stolperstellen aus dem Anfaenger-Test, README Variante B sagt „ändern“, Version ueberall 1.0.1.

## Commits

| Hash | Message |
|------|---------|
| 870df10 | fix: Fortschritt zeigt das gewaehlte Kind mit Haken statt nur per Farbe |
| b8f9659 | fix: setup.sh nennt bei belegtem Port den Ausweg ueber WQ_PORT |
| 952a309 | docs: README Variante B aendert vorhandene .env-Zeilen statt sie anzuhaengen |
| 3a419c7 | chore: Version 1.0.1 |
| 457e339 | fix: Review-Befunde zu setup.sh und Installationsseite eingearbeitet |

Kein Push, kein Tag.

## Task 1: vitest rot → gruen

- Rot (vor dem Fix, node:22-Container, `npx vitest run src/features/manage/ProgressPage.test.tsx`): **1 failed / 7 passed (8)**. Ursache: `AssertionError: expected null not to be null` in Zeile 113 — die gedrueckte Kapsel „Mia“ enthielt kein `svg`.
- Gruen (nach dem Fix): **8 passed (8)**, `npm run design:classes` → „keine alten Klassen“.

## Gate

| Schritt | Befehl | Stand | Exit | Ergebnis |
|---|---|---|---|---|
| Backend | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` (SDK-Container, /warnaserror) | 3a419c7 | 0 | Build 0 Warnungen; Learning.Tests 166 passed / 0 failed; Api.Tests 312 passed / 0 failed |
| Frontend | node:22-Container: `npm ci && lint && typecheck && build && npm test && design:check && design:classes` | 3a419c7 und erneut 457e339 | 0 / 0 | vitest 16 Dateien, 325 passed; DESIGN.md lint „errors: 0, warnings: 0“ (keine Kontrast-Warnung); „keine alten Klassen“ |
| e2e + axe | `npm run e2e:stack && npx playwright test` (danach `docker compose -f e2e/docker-compose.e2e.yml down -v`) | 3a419c7 | 0 | **66 passed, 1 skipped** (bekannter skip `first-run`); „Fortschritt: axe 0“ und „Fortschritt mit zwei Kindern: Haken nur an der Auswahl, axe 0“ gruen; e2e-API-Log 0 Zeilen `fail:`/`crit:` |
| Install-Smoke | `bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh` | 457e339 | 0 | IMAGE OK, STARTLOG OK, LOGIN OK, **PORT-HINWEIS OK**, RESET OK, STARTABBRUCH OK, BACKUP OK, DEMO-ABBRUCH OK, RATE-LIMIT OK, **SMOKE OK**; PAR-05 first-run.spec 1 passed |
| Release-Smoke | `bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | 457e339 | 0 | VERSION OK, DUMP-PRUEFUNG OK, PAKET OK, INSTALL OK, RESTORE OK, RESTORE-FEHLER OK, UPDATE OK, UPDATE-ABBRUCH OK, PAKETPRUEFUNG OK, KLON OK, **SEITE OK** (Seitenabgleich der geaenderten Installation.md), **RELEASE-SMOKE OK**; EXPECTED_VERSION=1.0.1 |
| Tag-Pruefung | `bash .github/release-package.sh <tmp> v1.0.1` / `… v1.0.0` | 3a419c7 | 0 / 1 | v1.0.1 baut `wordquest.tar.gz` + `.sha256`; v1.0.0 lehnt ab („passt nicht zur Version 1.0.1“) |

Stand der Laeufe: Backend und e2e liefen auf 3a419c7. Der Review-Commit 457e339 aendert weder Backend noch gebaute Frontend-Dateien (nur eine Leerzeile in `ProgressPage.test.tsx`, setup.sh und Doku); vitest/Frontend-Gate und beide Smokes liefen auf 457e339.

Install-Smoke, Abschnitt „Port belegt“ (Auszug aus dem Log): Dockers Meldung `Bind for …:18081 failed: port is already allocated` bleibt sichtbar, danach `Der Port 18081 ist schon belegt. Trage in .env eine Zeile WQ_PORT=9000 ein (oder ändere die vorhandene Zeile WQ_PORT=) und starte ./setup.sh noch einmal.`; der Stack wq-smoke antwortet danach weiter mit HTTP 200.

Zusaetzlicher Stub-Test der Verzweigung in setup.sh (falsches `docker` im PATH, Scratchpad): Erfolg → Exit 0 mit „Fertig.“; Heimnetz + belegter Port → Exit 1 mit deutschem Hinweis; Traefik-Variante + belegter Port → Exit 1 ohne deutschen Hinweis, nur Dockers Meldung; anderer Fehler (Exit 17) → Exit 17 ohne neuen Text.

## A11y-Beleg

- axe: `@axe-core/playwright` 4.13.0 / axe-core 4.13.0, Tags wcag2a/aa, wcag21a/aa, wcag22aa, ueber `checkPage` (axe + Glas-Kontrast + opaker Rueckfall + Reflow). Seiten: `/verwalten/fortschritt` mit einem Kind und mit zwei Kindern — **0 Verstoesse**; Gesamtlauf 66 passed.
- Tastatur (Playwright-Skript gegen den e2e-Stack, zweites Kind „Lena“ per Route-Umschreibung, ihre Uebersicht aus den Daten des echten Kindes): 3 Tab-Schritte bis „Lena“, `:focus-visible` aktiv mit `outline: solid 3px`; Enter waehlt „Lena“ (aria-pressed true, 1 svg; „Max“ false, 0 svg); Shift+Tab + Leertaste waehlt „Max“ zurueck, Haken wandert mit.
- 200 % (Viewport 640 x 400 = 1280 x 800 bei Zoom 200): gleicher Ablauf identisch, `scrollWidth` 640 = Viewport, beide Kapseln ganz sichtbar; Screenshot geprueft (Haken neben „Max“, Fokusring sichtbar).
- Commit-Trailer in 870df10: `A11y-Check: @axe-core/playwright 4.13.0 0 Verstoesse /verwalten/fortschritt (ein und zwei Kinder)`.

## Playwright-Weg (Verifikation Schritt 3)

`npx playwright install chromium` (Freigabe des Orchestrators) hat die von @playwright/test 1.64.0 erwarteten Builds `chromium-1248`, `chromium_headless_shell-1248` und `ffmpeg-1013` nach `~/Library/Caches/ms-playwright` geladen. Kein Symlink-Workaround, keine Aenderung an package.json/package-lock.json.

## Verbliebene 1.0.0-Fundstellen

`git grep -n '1\.0\.0' -- . ':!.planning' ':!**/package-lock.json'`:
- `.github/release-package.sh:8` — Kommentar-Beispiel „(CI: v1.0.0)“; das Skript bleibt laut Plan unveraendert.

Im Release-Smoke (unter `.planning`): `release-smoke.sh:865` `serve_pkg '1.0.0|x'` — absichtlich ungueltiger Versionswert fuer den Fall „ungueltige Zielversion“. Ohne feste Version: setup.sh, upgrade.sh (liest WQ_VERSION aus .env.example), restore.sh, setup-smoke.sh (Tag `smoke-<zeit>-<pid>`).

## Review (unabhaengige Instanz)

In dieser Ausfuehrungsumgebung gibt es kein Subagent-Werkzeug; das Review lief deshalb als zweite, unabhaengige Instanz `claude -p` mit nur lesenden Werkzeugen gegen den Diff `07e2b28..HEAD` und die must_haves (AGENTS.md erlaubt das fuer Werkzeuge ohne Subagenten). Ergebnis: 0 BLOCKER, 0 HIGH, 0 MEDIUM, 4 LOW, 3 INFO.

| ID | Schwere | Befund | Entscheidung |
|---|---|---|---|
| R-1 | LOW | Gefangene Ausgabe von `docker compose up` laesst Eltern bis zu einer Minute ohne Fortschritt | Behoben (457e339): `| tee "$up_log" >&2` in eine Temp-Datei, Mustersuche danach, Datei sofort geloescht |
| R-2 | LOW | Hinweis nennt immer 9000; Hauptabschnitt sagt nur „anhaengen“ | Behoben im Hauptabschnitt: vorhandene `WQ_PORT=`-Zeile aendern, z. B. auf `9001`. Meldungstext in setup.sh bleibt (woertlich vom Plan vorgegeben, nennt „oder ändere die vorhandene Zeile“) |
| R-3 | LOW | „als ersten Eintrag“ widerspricht dem neuen 192.168.-Hinweis | Behoben: „zeigt dir derselbe Befehl sie“. Ergaenzung um `10.`-Netze zurueckgewiesen: Planvorgabe „meist mit 192.168.“, Router-Standard im Zielpublikum |
| R-4 | LOW | „andere Startfehler wie bisher“ nicht belegt; Exit-Code jetzt fest 1 | Teilweise behoben: `exit "$up_status"` behaelt Dockers Code; Stub-Test belegt alle vier Zweige. Smoke-Lauf der Traefik-Variante zurueckgewiesen: braucht die festen Ports 80/443 auf dem Host |
| R-5 | INFO | Absatz zweiter Lauf gilt nur nach fertiger Einrichtung | Behoben: „nach einer fertigen Einrichtung“ |
| R-6 | INFO | Konzept sagt „von Hand eingetragen“, README jetzt „ändern“ | Behoben: „in den vorhandenen Zeilen von `.env` geändert“ |
| R-7 | INFO | Neuer vitest-Fall kopiert das Kennzahl-Objekt; Leerzeile fehlt | Leerzeile ergaenzt. Wiederverwendung von `stubOverview` zurueckgewiesen: es routet feste Pfade nur fuer `kind-1`, der Fall braucht zwei Kinder mit beliebiger ID; eine Erweiterung wuerde den bestehenden Helfer umbauen |
| offen | — | Schreibt der backup-Container des Port-Projekts beim Start eine Sicherung in das gemeinsame `backups/`? | Geprueft: Image `prodrigestivill/postgres-backup-local:17` hat `BACKUP_ON_START=FALSE`; kein Risiko |

## Deviations from Plan

- **[Rule 1 - Bug] Live-Ausgabe und Exit-Code von `docker compose up`** — Plan sah Fangen in eine Variable und `exit 1` vor; das verschluckt den Fortschritt und aendert Dockers Exit-Code. Fix in 457e339 (Review R-1/R-4).
- **Review per `claude -p` statt Subagent** — kein Agent-Werkzeug in dieser Umgebung verfuegbar.
- **Playwright-Browser per `npx playwright install chromium`** statt Symlink (Orchestrator-Entscheidung, bindend).

## Known Stubs

Keine.

## Threat Flags

Keine neue Angriffsflaeche. T-261024-vnx-01: Die Docker-Ausgabe geht wie bisher ans Terminal, jetzt zusaetzlich kurz in eine `mktemp`-Datei (Rechte 600), die direkt nach der Mustersuche geloescht wird; sie enthaelt keine Secrets.

## Self-Check: PASSED

Dateien vorhanden (ProgressPage.tsx, setup.sh, .env.example, SUMMARY); Commits 870df10, b8f9659, 952a309, 3a419c7, 457e339 sind Vorfahren von HEAD; `git rev-list --count 07e2b28..HEAD` = 5; keine geloeschten Dateien in 07e2b28..HEAD; untracked nur die fremden Dateien milestone.lock, state.json, 03.1.1-.gitkeep und dieser Quick-Ordner.
