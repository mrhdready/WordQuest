---
phase: quick-261025-fpi
plan: "03"
subsystem: ops
status: complete
tags: [https, ca, setup, docker-compose, smoke, docs]
requires: ["261025-fpi-01", "261025-fpi-02"]
provides:
  - "Dienst certs im Betriebs-Stack (docker-compose.quick.yml), Ports 80/443 bzw. WQ_HTTP_PORT/WQ_HTTPS_PORT, Volumes tls-ca und tls"
  - "setup.sh: Namensliste WQ_TLS_NAMES, Portpruefung per Docker-Bind, Warten auf tls show und TLS-Handshake, Fingerabdruecke und CA-Download am Ende"
  - "setup-functions-check.sh (31 Faelle auf macOS)"
  - "Install-Smoke mit Block TLS, Release-Smoke per HTTPS mit der CA"
  - "Doku: Installation.md (Zertifikat pruefen, CA neu anlegen), Konzept ADR-008, README, AGENTS.md, .env.example"
affects: [261025-fpi-04, 261025-fpi-05]
tech-stack:
  added: []
  patterns:
    - "Spalte-0-Funktionen in setup.sh, per awk geladen und mit Stubs geprueft"
    - "Portprobe: docker run --rm --entrypoint true -p PORT:8080 <db-Image>"
key-files:
  created:
    - .planning/phases/01-safe-home-network-install/smoke/setup-functions-check.sh
  modified:
    - docker-compose.quick.yml
    - docker-compose.build.yml
    - setup.sh
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - .planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh
    - .env.example
    - Documentation/Installation.md
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - README.md
    - AGENTS.md
decisions:
  - "setup.sh startet certs nur neu, wenn docker compose up den Container unveraendert liess (Review 1): ein neuer Container prueft ohnehin sofort, ein Neustart mitten im Anlegen der CA hinterliesse sie unvollstaendig"
  - "Proxy-Gate prueft docker-compose.build.yml zusammen mit docker-compose.quick.yml; allein ist das Overlay kein lauffaehiger Stack"
  - "Standard- und Ausweichports als Variablen (http_default, https_default, http_alt, https_alt); Meldungen nennen die Variablen, damit die Funktionspruefung ohne 80/443/8080/8443 auskommt"
metrics:
  duration: 41min
  completed: 2026-10-25
estimate:
  tokens: 230000
  tasks: 3
actuals:
  tokens: 30129
  tasks: 3
  commits: 4
plan_head_before: a277dfc20ea3f6c7033b8ed4e130692207a9bff3
plan_head_after: 75b0a195efe99d17a3cfb38d27460e3822ab6d9a
---

# Phase quick-261025-fpi Plan 03: HTTPS mit eigener CA im Betriebs-Stack Summary

`./setup.sh` bestimmt Namen und Adressen fuer das Zertifikat, prueft die Ports 80/443 per echtem Docker-Bind (Ausweich 8080/8443 nur nach Rueckfrage am Terminal), startet den Dienst certs als einzigen Schreiber und meldet Erfolg erst nach `tls show` und einem TLS-Handshake gegen die eigene CA; am Ende stehen https-Adresse, beide Fingerabdruecke und der CA-Download.

## Commits

| Task | Commit | Inhalt |
|------|--------|--------|
| 1 (Tracer) | 92870a5 | certs in docker-compose.quick.yml/build.yml, setup.sh mit set_env, start_stack, wait_cert, wait_https, Abschluss; Install-Smoke per HTTPS |
| 2 (TDD) | 8023b08 | valid_label, bridge_gateways, tls_names, own_port, port_free, port_usable, choose_ports; setup-functions-check.sh; TLS-Block im Install-Smoke; Release-Smoke auf HTTPS |
| 3 | e9091dc | Doku (Installation.md, Konzept mit ADR-008, README, .env.example, AGENTS.md), Proxy-Gate fuer das Build-Overlay |
| Review | 75b0a19 | certs-Neustart nur bei unveraendertem Container, HANDGRIFFE-Verweis |

`actuals.tokens` = chars/4 ueber `git diff a277dfc..HEAD` (12 Dateien, +799/−102).

## Tracer-Nachweis (Task 1)

Verify des Plans: `bash -n setup.sh` gruen, `config --services` = `api backup certs db web`, Install-Smoke `SMOKE OK`. Lauf 1 endete mit `Fertig. WordQuest läuft unter: https://localhost:18441 …`, „✓ Zertifikat ist bereit.“, „✓ WordQuest antwortet über HTTPS.“, beiden Fingerabdruck-Zeilen und `http://localhost:18081/wordquest-ca.crt`; Login per HTTPS mit der CA als einzigem Anker 200; Lauf 2 liess .env und Secrets bytegleich. Der Smoke lief auf dem Stand, der danach unveraendert committet wurde; erneut nicht separat gelaufen, aber in jedem spaeteren Smoke-Lauf mit enthalten.

## TDD-Nachweis (Task 2)

- **Rot:** `setup-functions-check.sh` vor den Funktionen: Exit 1, `FUNKTIONEN FEHLER: Funktion valid_label fehlt in setup.sh (Spalte 0).`
- **Gruen:** `Faelle: 31`, `FUNKTIONEN OK`. Auf macOS mit benanntem Skip `SKIP 127.0.0.1-Listener (macOS)`; unter Linux waeren es 32 Faelle (Lauf auf der VM in Plan 05).
- Faelle: valid_label 10, tls_names 4, set_env 3, port_free 4 (Dual-Stack `::`, nur IPv6, Docker-Port, frei), choose_ports 9, start_stack (TOCTOU per docker-Stub) 1.

## Gate (Endstand, nach den Review-Fixes)

| Teil | Befehl | Ergebnis |
|------|--------|----------|
| Backend Build | `dotnet build backend/WordQuest.slnx -c Release /warnaserror --no-incremental` (SDK-Container) | 0 Warnungen, 0 Fehler |
| Backend Tests | `dotnet test … --no-build`, `WQ_TEST_DB` mit `Host=192.168.65.254` | Learning 166/166, Api 388/388 (erster Lauf, keine Verbindungsfehler) |
| Frontend | `npm ci && lint && typecheck && build && test && design:check && design:classes` (node:22) | Exit 0; Vitest 16 Dateien, 332 Tests; design:lint 0 Fehler, 0 Warnungen; „keine alten Klassen“ |
| e2e mit axe | `npm run e2e:stack && npx playwright test`, danach `down -v` | 67 passed, 1 skipped (first-run.spec, laeuft in den Smokes); axe-Specs Konto, Kinder (3), Login, /verwalten, Set-Detail, Set-/Vokabel-Dialoge, Fortschritt gruen |
| Proxy-Gate | `proxy-xff-check.sh` | `PROXY-XFF OK` (nach Abweichung 1) |
| Funktionspruefung | `setup-functions-check.sh` | `FUNKTIONEN OK`, 31 Faelle |
| Install-Smoke | `setup-smoke.sh` | `SMOKE OK` mit `TLS OK` (TLS-NAME, TLS-ERNEUERUNG, TLS-KAPUTT, TLS-CA) |
| Release-Smoke | `release-smoke.sh` | `RELEASE-SMOKE OK`, `SEITE OK` |
| Doku-Pruefungen Task 3 | grep-Kette aus dem Plan | OK (AGENTS.md mit Marker-Pruefung, siehe Abweichung 4) |

Verlauf ehrlich:
- Proxy-Gate Lauf 1: **rot**, `docker-compose.build.yml: Dienst certs hat Netz (network_mode ist nicht none).` Ursache: dieser Plan gab certs im Build-Overlay einen build-Block; das Gate prueft jede Datei allein. Behoben (Abweichung 1), Lauf 2 gruen. Negativkontrolle: `tls-ca:/certs/ca:ro` im Dienst web von docker-compose.quick.yml → `PROXY-XFF FEHLER: docker-compose.build.yml: Dienst web bindet das CA-Volume tls-ca ein.`; Datei danach zurueckgesetzt (`git diff` leer).
- Install-Smoke: 3 Laeufe gruen (Task 1, Task 2, Gate vor den Review-Fixes) und 1 Lauf gruen nach den Review-Fixes.
- Release-Smoke Lauf 1: **rot** im Abschnitt UPDATE-ABBRUCH, `release-smoke.sh: line 946: e-bereit.log: command not found`. Ursache: Ich habe die laufende Skriptdatei (HANDGRIFFE, Review 2) waehrend des Laufs geaendert; Bash liest Skripte stueckweise und las danach an verschobener Stelle. Kein Produktfehler; die Abschnitte bis UPDATE OK waren gruen. Aufraeumen per trap lief (keine Container, Volumes, Images uebrig), roten Installationsordner geloescht. Lauf 2 ohne Aenderungen waehrend des Laufs: gruen.
- Alle gestarteten Stacks per `down -v` entfernt (dev-DB, e2e; die Smokes raeumen selbst auf). Ports 80/443 auf dem Mac waren frei, wurden aber nicht gebraucht; Ports 8080/18090, wq-preview, wq-p2-db und fremde Container nicht angefasst (8080 ist von einem fremden Container belegt, deshalb pruefen die Tests nur Testports 18491-18497).

## Review (claude -p, nur lesende Werkzeuge, gegen PLAN, Plan 01, Diff und AGENTS.md)

Kein Subagent-Werkzeug in dieser Sitzung, deshalb `claude -p` mit Read/Grep/Glob und lesenden git-/grep-/sed-/cat-Befehlen, Edit/Write gesperrt. Ergebnis: 0 HIGH, 1 MEDIUM, 3 LOW; Einzelschreiber, stdin, Portfaelle, Namensregel, Isolation und Doku-Treue ohne Befund.

| # | Schwere | Befund | Verbleib |
|---|---------|--------|----------|
| 1 | MEDIUM | `restart certs` direkt nach `up -d` kann bei der Erstinstallation `tls watch` zwischen dem Schreiben von ca.key und ca.crt beenden → CA unvollstaendig, Eltern muessten den Ausweg gehen | Behoben: Neustart nur, wenn `docker compose ps -q certs` vor und nach `up` dieselbe Container-ID zeigt (75b0a19). Install-Smoke danach gruen (Lauf 1 ohne, Lauf 2 mit Neustart, Namensaenderung mit neu erzeugtem Container) |
| 2 | LOW | HANDGRIFFE nennt „setup.sh:56“, die Zeile hat sich verschoben | Behoben: ohne Zeilennummer (75b0a19) |
| 3 | LOW | Beispiel „schon belegt: 443.“ passt zu keinem der beschriebenen Faelle | Behoben: „schon belegt: 80 und 8080.“ (e9091dc) |
| 4 | LOW | „Die Warnung bleibt bei jedem neuen Besuch“ ist unbelegtes Browserverhalten | Behoben: „kann der Browser bei einem späteren Besuch erneut warnen“ (e9091dc); Browserverhalten belegt Plan 04 |

## AGENTS.md – adversariale Selbst-Review

Diff: nur Zeile 32 (Standard-Betriebsweg) von „Heimnetz über HTTP“ auf „Heimnetz über HTTPS mit eigener Zertifizierungsstelle (`docker-compose.quick.yml`, Dienst `certs`)“; der Satz zum Service Worker sagt jetzt „Ohne installierte Zertifizierungsstelle …“ und haelt die Regel „reine Browser-App vollständig funktionsfähig“. Geprueft: keine andere Regel in AGENTS.md nennt HTTP-Betrieb (Treffer nur localhost-Entwicklungsadressen 168-169); der Satz stimmt mit docker-compose.quick.yml (certs, 443) und Konzept §13/ADR-008 ueberein. Keine GSD-Abschnittsmarker (`! grep -q '<!-- GSD:[a-z-]*-start' AGENTS.md`). Rueckweg: git-Historie (e9091dc).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Proxy-Gate rot fuer docker-compose.build.yml allein**
- Found during: Task 3 (Gate). Issue: certs hat im Overlay nur einen build-Block; allein geprueft fehlen network_mode und Volumes.
- Fix: Das Gate prueft das Overlay zusammen mit docker-compose.quick.yml (so wird es benutzt). Files: proxy-xff-check.sh. Commit: e9091dc.

**2. [Rule 1 - Bug] Review-Befunde 1–4** – siehe Review-Tabelle (75b0a19, e9091dc). Befund 1 aendert den Plan-Wortlaut „danach `docker compose restart certs`“: der Neustart entfaellt, wenn up certs neu erzeugt hat.

**3. Funktionspruefung mit Testports statt 8080/8443**
- Plan: „.env mit WQ_HTTP_PORT=8080 und WQ_HTTPS_PORT=8443“. 8080 ist auf diesem Rechner von einem fremden Container belegt und darf nicht angefasst werden. Standard und Ausweich sind deshalb Variablen; die Pruefung setzt sie auf 18491-18497 und erwartet in .env die Ausweich-Testports. Die Meldungstexte nennen die Variablen; in setup.sh stehen 80/443/8080/8443.

**4. Plan-Pruefung `! grep -q 'GSD:' AGENTS.md` ist immer rot** (wie in Plan 02): AGENTS.md:220 nennt die Marker im Regeltext. Stattdessen `! grep -q '<!-- GSD:[a-z-]*-start' AGENTS.md` → kein Marker.

**5. Kleinere Abweichungen ohne Regelbezug**
- tls_names nimmt nur `hostname` und schneidet am ersten Punkt (statt `hostname -s` bzw. `hostname`); gleiches Ergebnis, ein Aufruf weniger.
- Install-Smoke laedt wait_https per awk in eine Datei und bindet sie mit `.` ein; ein Hook blockiert `eval` auf dynamischer Eingabe.
- Das Fingerabdruck-Paar wird in einem `say` ausgegeben (zwei Zeilen, ein Farbcode).
- Backend-Tests mit `Host=192.168.65.254` (IPv4 von host.docker.internal), wie in Plan 02.
- Installation.md: Hinweis „Starte ./setup.sh nicht zweimal gleichzeitig“ im Installationsabschnitt (Absatz zum zweiten Lauf) statt in der Hilfe; Name-Constraints-Grenze in Laiensprache („nur auf den Geräten deiner Familie“).

## Threat Flags

Keine Angriffsflaeche ausser der geplanten: web veroeffentlicht 80 und 443 auf allen Adressen (T-fpi-16 Vorpruefung), certs ohne Netz mit CA-Volume (T-fpi-17, Smoke und Gate). Die Portprobe startet kurzlebige Container aus dem db-Image ohne Befehl (`--entrypoint true`).

## Offene Punkte fuer Plan 04

- HTTP-Port liefert die App weiter aus; die Umleitung auf HTTPS fehlt. FIRST RUN in beiden Smokes laeuft noch per `http://localhost:${WQ_HTTP_PORT}`; e2e `learn.spec.ts` „ohne Secure Context“ prueft HTTP.
- Installation.md „Zertifikat prüfen“ hat keine Schritte je Browser/Geraet zum Installieren der CA und zum Anzeigen des Fingerabdrucks; Review 4 (erneute Warnung je Browser) dort belegen.
- Service-Worker-Tests mit vertrauter CA (Codex 5).
- Exit-Code von certs bei `docker stop`: weiter UNBEKANNT; kein Smoke wertet ihn aus, `restart certs` funktioniert (TLS-ERNEUERUNG OK).
- 127.0.0.1-Listener-Fall der Portprobe nur unter Linux pruefbar (VM, Plan 05).
- Aus Plan 02 weiter offen: setup.sh prueft vor `docker compose pull` nicht, ob die Datei aus COMPOSE_FILE existiert (dieser Plan hat am pull-Teil nichts gebaut); `.planning/codebase/` nennt noch HTTP/Traefik.
- Konzept §17 O3 („Aufwand fürs TLS-Setup“) unveraendert.

## Self-Check: PASSED

- Datei vorhanden: setup-functions-check.sh.
- Commits 92870a5, 8023b08, e9091dc, 75b0a19 in HEAD; `git rev-list --count a277dfc..HEAD` = 4.
