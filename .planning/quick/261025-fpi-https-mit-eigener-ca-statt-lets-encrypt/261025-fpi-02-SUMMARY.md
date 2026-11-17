---
phase: quick-261025-fpi
plan: "02"
subsystem: ops
status: complete
tags: [docker-compose, release-package, upgrade, hsts, proxy-gate, docs]
requires: ["261025-fpi-01"]
provides:
  - "Ein Betriebsweg: docker-compose.quick.yml (docker-compose.yml und frontend/nginx-traefik-realip.conf geloescht)"
  - "Paketliste mit fuenf Dateien in einem Ordner, gleich in release-package.sh, upgrade.sh und Release-Smoke"
  - "API ohne HSTS (TLS-03)"
  - "Proxy-Gate fuer einen Stack, CA-Volume-Regel erhalten, neue Regel: kein Mount unter /etc/nginx/conf.d"
  - "ADR-007 im Konzept, OPS2-01 in Out of Scope"
affects: [261025-fpi-03, 261025-fpi-04, 261025-fpi-05]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .github/release-package.sh
    - upgrade.sh
    - setup.sh
    - .env.example
    - docker-compose.quick.yml
    - docker-compose.build.yml
    - frontend/e2e/docker-compose.e2e.yml
    - backend/src/WordQuest.Api/Program.cs
    - .planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - README.md
    - Documentation/Installation.md
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - AGENTS.md
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md
  deleted:
    - docker-compose.yml
    - frontend/nginx-traefik-realip.conf
decisions:
  - "Proxy-Gate: statt der entfallenen realip-Negativpruefung verbietet eine Regel jeden Mount unter /etc/nginx/conf.d (Review 1)"
  - "Paketliste ohne Uebergangsversion geaendert (OU-1); Konzept dokumentiert die Ablehnung durch eine 1.0.x-upgrade.sh"
metrics:
  duration: 40min
  completed: 2026-10-25
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 17712
  tasks: 3
  commits: 4
plan_head_before: dbef3b1f4661664534cd77d74cf6b64f260e6e1c
plan_head_after: a277dfc20ea3f6c7033b8ed4e130692207a9bff3
---

# Phase quick-261025-fpi Plan 02: Domain-Variante entfernt Summary

Traefik/Let's Encrypt samt Compose-Datei, realip-Datei, Variablen, Gate-Teilen und Doku entfernt; Paket mit fuenf Dateien in einem Ordner, gleich in allen drei Pruefern; API ohne HSTS; ADR-007.

## Commits

| Task | Commit | Inhalt |
|------|--------|--------|
| 1 (Tracer) | d3f3e3b | Dateien geloescht, Paketliste in release-package.sh/upgrade.sh/Release-Smoke, setup.sh ohne Zweig |
| 2 | 9f926bb | Program.cs ohne HSTS, Proxy-Gate fuer einen Stack, .env.example, Compose-Kommentare |
| 3 | c368edf | README, Installation.md, Konzept (ADR-007), AGENTS.md, PROJECT.md, REQUIREMENTS.md |
| Review | a277dfc | conf.d-Regel im Proxy-Gate, Gate-Texte, Kommentar-Umbruch |

`actuals.tokens` = chars/4 ueber `git diff dbef3b1..HEAD`.

## Tracer-Nachweis (Task 1)

Verify aus dem Plan Exit 0: gebautes Paket = `- wordquest/.env.example`, `- wordquest/docker-compose.quick.yml`, `- wordquest/restore.sh`, `- wordquest/setup.sh`, `- wordquest/upgrade.sh`, `d wordquest/` = PKG_LISTING aus upgrade.sh = PKG_EXPECTED des Release-Smokes; beide Dateien weg; `bash -n` fuer alle vier Skripte gruen.

## Gate (Endstand nach den Review-Fixes)

| Teil | Befehl | Ergebnis |
|------|--------|----------|
| Backend Build | `dotnet build backend/WordQuest.slnx -c Release /warnaserror --no-incremental` (SDK-Container) | 0 Warnungen, 0 Fehler |
| Backend Tests | `dotnet test … --no-build` gegen docker-compose.dev.yml | Learning 166/166, Api 388/388 |
| Frontend | `npm ci && lint && typecheck && build && test && design:check && design:classes` (node:22) | Exit 0; Vitest 16 Dateien, 332 Tests; design:lint 0 Fehler, 0 Warnungen; „keine alten Klassen“ |
| e2e mit axe | `npm run e2e:stack && npx playwright test`, danach `down -v` | 67 passed, 1 skipped (first-run.spec, laeuft in den Smokes); axe-Specs login, /verwalten, Set-Detail, Fortschritt (3), Startseite gruen |
| Proxy-Gate | `proxy-xff-check.sh` | `PROXY-XFF OK` |
| Install-Smoke | `setup-smoke.sh` | `SMOKE OK` (inkl. Portmeldung WQ_PORT=9000) |
| Release-Smoke | `release-smoke.sh` | `RELEASE-SMOKE OK`, `SEITE OK` |
| Doku-Pruefungen Task 3 | grep-Kette aus dem Plan (siehe Abweichung 2) | OK |

Verlauf ehrlich (Backend-Tests):
- Lauf 1 (Task 2, `Host=host.docker.internal`): Api **1 von 388 fehlgeschlagen**, Name nicht erfasst (Ausgabe gekuerzt), Verbindungsfehler.
- Lauf 2 (gleich, ohne Codeaenderung): Api **1 von 388 fehlgeschlagen**, `AccountCommandTests.HasOwner_is_10_on_empty_database_and_0_after_create_owner`: `Failed to connect to [fdc4:f303:9324::254]:5432 – Network is unreachable` (host.docker.internal loest auch auf IPv6 auf, wie schon in Plan 01).
- Lauf 3 mit `Host=192.168.65.254` (IPv4 von host.docker.internal): 388/388.
- Lauf 4 (Endgate, parallel zum Frontend-Container): Api **1 von 388 fehlgeschlagen**, `AuthEndpointTests.Kinder_Login_mit_unbekannter_Kind_Id_ergibt_401`: `Timeout during connection attempt` zu 192.168.65.254:5432 (Last durch den parallelen npm-Lauf).
- Lauf 5 allein: 388/388. Lauf 6 nach den Review-Fixes (Build + Tests): 388/388.
- Alle Fehlschlaege waren Verbindungsfehler zur Test-DB, kein Test lief rot wegen einer Assertion.

Negativkontrolle der neuen Gate-Regel: Mount `./realip.conf:/etc/nginx/conf.d/realip.conf:ro` im Dienst web von docker-compose.quick.yml → `PROXY-XFF FEHLER: docker-compose.quick.yml: Dienst web bindet /etc/nginx/conf.d/realip.conf ein; …`. Datei danach per `git checkout -- docker-compose.quick.yml` zurueck.

Gestartete Stacks abgebaut (e2e, dev-DB jeweils `down -v`; die Smokes raeumen selbst auf). Ports 8080/18090, wq-preview und wq-p2-db nicht angefasst.

## Review (claude -p, nur lesende Werkzeuge, gegen PLAN, Diff und AGENTS.md)

Kein Subagent-Werkzeug in dieser Sitzung, deshalb `claude -p` mit Read/Grep/Glob und lesenden git-/grep-Befehlen, Edit/Write gesperrt. Ergebnis: 0 HIGH, 0 MEDIUM, 5 LOW, Urteil „freigabefaehig“.

| # | Schwere | Befund | Verbleib |
|---|---------|--------|----------|
| 1 | LOW | Mit der realip-Negativpruefung faellt jeder Schutz gegen eine per Compose eingebundene nginx-Konfiguration weg (z. B. `set_real_ip_from`), die XFF-Pruefung testet nur nginx.conf (T-fpi-12) | Behoben: Regel „kein Mount unter /etc/nginx/conf.d“ im bestehenden node-Block, Negativkontrolle s. o. (a277dfc) |
| 2 | LOW | setup.sh: eine alte .env mit `COMPOSE_FILE=docker-compose.yml` oder ganz ohne COMPOSE_FILE (vor 1.0.0) laeuft in `docker compose pull` auf eine irrefuehrende Meldung zum Image-Praefix | Zurueckgewiesen: OU-1, es gibt keine 1.0.x-Installationen; Plan 03 baut setup.sh ohnehin fuer HTTPS um. Als offener Punkt fuer Plan 03 notiert |
| 3 | LOW | upgrade.sh:153 `mkdir -p "$(dirname "$f")"` wirkt ohne Unterordner nicht mehr | Zurueckgewiesen: schadet nicht, Plan sagt „Rest unveraendert“ |
| 4 | LOW | Gate-Texte „Heimnetz-Variante“, „(Variante $2)“ | Behoben: „Heimnetz-Stack“, „Stack $2“ (a277dfc) |
| 5 | LOW | Program.cs: Kommentarzeile mit ~100 Zeichen nach dem Umbruch | Behoben: neu umbrochen (a277dfc) |

Hinweis des Reviews ohne Aenderung: veraltete Stellen in `.planning/codebase/` (ARCHITECTURE.md:18, INTEGRATIONS.md:14-15/32, STACK.md:18/93, STRUCTURE.md:78, CONCERNS.md:123-125) – ausserhalb des Plans, siehe Offene Punkte.

## AGENTS.md – adversariale Selbst-Review

Diff: nur der Satz „Die Variante mit Traefik + Let's Encrypt (`docker-compose.yml`) ist für Fortgeschrittene.“ in Zeile 32 entfernt. Geprueft: keine andere Regel in AGENTS.md nennt docker-compose.yml oder die Variante (Gate nennt nur dev- und e2e-Compose); „Standard-Betriebsweg … docker-compose.quick.yml“ stimmt mit .env.example (`COMPOSE_FILE=docker-compose.quick.yml`) und setup.sh ueberein; der Satz zu Service Worker ohne HTTPS bleibt bis Plan 03 richtig. Keine GSD-Abschnittsmarker eingefuegt. Rueckweg: git-Historie (c368edf).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Review-Befunde 1, 4, 5** – siehe Review-Tabelle, Commit a277dfc. Befund 1 fuegt dem Proxy-Gate eine Regel hinzu, die der Plan nicht nannte; sie ersetzt die vom Plan gestrichene realip-Negativpruefung in allgemeiner Form.

**2. [Rule 3 - Blocking] Plan-Pruefung `! grep -q 'GSD:' AGENTS.md` ist immer rot**
- AGENTS.md:220 enthaelt schon vor diesem Plan die Regel „… solange sie keine `<!-- GSD:…-start -->`-Marker enthalten“ (auch in dbef3b1). Die Pruefung trifft diesen Regeltext, nicht einen Marker.
- Stattdessen geprueft: `! grep -q '<!-- GSD:[a-z-]*-start' AGENTS.md` → kein Marker. AGENTS.md:220 unveraendert.

**3. Backend-Tests mit IPv4-Adresse der Test-DB**
- `WQ_TEST_DB` mit `Host=192.168.65.254` statt `host.docker.internal`, weil Npgsql sonst teils die nicht erreichbare IPv6-Adresse nimmt (Verlauf oben). Nur die Testumgebung, kein Code.

**4. Kleinere Abweichungen ohne Regelbezug**
- Proxy-Gate: der Abschnitt „Einbindung in den Compose-Dateien“ entfaellt vollstaendig (Plan: Pruefungen der geloeschten Datei, git-diff-Check und realip-Negativpruefung); die Gueltigkeit von docker-compose.quick.yml prueft weiter der CA-Block (`docker compose config` je Datei).
- Konzept 664 („Zu TLS im Heimnetz“): neben dem Satz zum Weg fuer Fortgeschrittene auch der Folgesatz „Das vermeidet Zertifikatswarnungen …“ entfernt, weil er sich nur auf diesen Weg bezog.
- Kein neuer Test fuer „kein HSTS“: Die API sieht nur HTTP von nginx, `UseHsts` haette dort ohnehin keinen Kopf gesetzt; ein Test ueber HTTP wuerde den Aufruf nicht erkennen. Abgedeckt per grep im Verify von Task 2.

## Threat Flags

Keine neue Angriffsflaeche; nur Entfernen. T-fpi-12 (X-Forwarded-For nach Wegfall der zweiten Stufe) durch Proxy-Gate (Absender, gefaelschter Kopf, /api/ und /health/) und die neue conf.d-Regel abgedeckt.

## Offene Punkte fuer Plan 03

- setup.sh: Pruefung vor `docker compose pull`, ob die Datei aus COMPOSE_FILE existiert, sonst eigene deutsche Meldung (Review 2) – nur wenn Plan 03 ohnehin daran baut; sonst bleibt es bei OU-1.
- Release-Smoke: Meldung „hat nicht genau zwei Standardwerte (api und web)“ bleibt bis Plan 03 certs ergaenzt (Plan 02, Task 1 Punkt 5).
- Konzept „Zu TLS im Heimnetz“ und AGENTS.md „Standard-Betriebsweg“ beschreiben noch HTTP; Plan 03 stellt auf HTTPS mit eigener CA um.
- Proxy-Gate: die neue Regel verbietet jeden Mount unter /etc/nginx/conf.d. Wenn Plan 03 nginx-Konfiguration per Mount statt im Image liefern will, muss die Regel angepasst werden (Zertifikate unter /etc/nginx/tls sind nicht betroffen).
- `.planning/codebase/` nennt Traefik und docker-compose.yml noch (Liste im Review-Abschnitt); Auffrischung per `/gsd-map-codebase` ist eine eigene Aufgabe.

## Self-Check: PASSED

- Geloescht: docker-compose.yml, frontend/nginx-traefik-realip.conf (nicht vorhanden).
- Commits d3f3e3b, 9f926bb, c368edf, a277dfc in HEAD; `git rev-list --count dbef3b1..HEAD` = 4.
