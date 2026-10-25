---
phase: quick-261025-fpi
plan: "05"
subsystem: release
status: complete
tags: [release, version, requirements, review, https, ca]
requires: ["261025-fpi-04"]
provides:
  - "Version 1.1.0 in docker-compose.quick.yml (api, certs, web), .env.example, Release-Smoke, Installation.md, Konzept"
  - "REQUIREMENTS.md: TLS-01..06 automatisch belegt (END 6fac063), VM- und Geraeteabnahme offen; SETUP-01/FIX-07 mit Anmerkung; QA2-06"
  - "PROJECT.md: HTTP-Betrieb superseded, Key Decision HTTPS mit eigener CA (Pending owner device acceptance)"
  - "e2e: Lernrunde im vertrauten Pfad mit aktivem Service Worker (children.spec)"
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - docker-compose.quick.yml
    - .env.example
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - Documentation/Installation.md
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - frontend/e2e/children.spec.ts
    - frontend/e2e/learn.spec.ts
decisions:
  - "Test fuer den randomUUID-Ersatz als QA2-06 statt QA2-05: QA2-05 war seit 2fff169 schon vergeben (Testabdeckung > 90 %)"
  - "setup.sh-Pruefung auf die Datei aus COMPOSE_FILE bleibt offen: Review fordert sie nicht, Folge waere nur eine irrefuehrende Meldung bei einer alten .env"
  - "Kein Tag v1.1.0, kein Push: erst nach der Owner-Abnahme auf VM und Geraeten"
metrics:
  duration: 30min
  completed: 2026-10-25
estimate:
  tokens: 110000
  tasks: 2
actuals:
  tokens: 6033
  tasks: 2
  commits: 3
plan_head_before: c066d1667343e443900c2220032d120dbca65607
plan_head_after: 0507995c59d83aa56ad900179c9941c90f8ee934
---

# Phase quick-261025-fpi Plan 05: Release 1.1.0 vorbereiten Summary

WordQuest steht ueberall auf 1.1.0. Das Paket entsteht nur mit Tag v1.1.0, und der Release-Smoke laeuft damit gruen. REQUIREMENTS.md und PROJECT.md bilden HTTPS mit eigener CA ab. Das volle Gate ist gruen. Ein Review des gesamten Diffs ist eingearbeitet. Offen ist nur noch die Abnahme durch den Owner auf VM und Geraeten, erst danach folgen Tag und Push.

## Commits

| Task | Commit | Inhalt |
|------|--------|--------|
| 1 (Tracer) | dbc0da0 | 1.1.0 in Compose (3 Images), .env.example, Release-Smoke, Installation.md (Version, Satz „1.0.x neu aufsetzen“), Konzept (Tag-Standard, Release-Stand mit ADR-008) |
| Review | 6fac063 | children.spec: Serien-Runde mit aktivem Service Worker; learn.spec: Verweis QA2-06 |
| 2 | 0507995 | REQUIREMENTS.md (TLS-01..06, SETUP-01, FIX-07, QA2-06, Last updated), PROJECT.md (Superseded, neue Key Decision) |

`actuals.tokens` = chars/4 ueber `git diff c066d16..HEAD` (9 Dateien, +33/−21).

## Tracer-Nachweis (Task 1)

- `release-package.sh <ordner> v1.1.0` → `wordquest.tar.gz` und `.sha256`. Mit `v1.0.1` bricht das Skript ab (Exit ≠ 0).
- `grep 1.0.1` in docker-compose.quick.yml, .env.example und Installation.md liefert keinen Treffer. `EXPECTED_VERSION=1.1.0` steht im Release-Smoke. Im Konzept bleibt „Bis 1.0.1“ in ADR-007 stehen, weil es Historie ist.
- `release-smoke.sh` → Exit 0. VERSION OK, DUMP-PRUEFUNG OK, PAKET OK, INSTALL OK, RESTORE OK, RESTORE-FEHLER OK, UPDATE OK („WordQuest läuft jetzt mit Version 1.1.0“), UPDATE-ABBRUCH OK, PAKETPRUEFUNG OK, KLON OK, SEITE OK, **RELEASE-SMOKE OK**. Damit ist das Tracer-Gate (Auto-Modus) bestanden.
- Den Fehlertext im neuen Satz der Installation.md habe ich gegen upgrade.sh geprueft, und zwar in der alten (`git show 2fff169:upgrade.sh`, Zeile 128) und in der neuen Fassung: Er ist wortgleich.

## Gate

| Teil | Befehl | Ergebnis |
|------|--------|----------|
| Backend Build | `dotnet build backend/WordQuest.slnx -c Release /warnaserror` (SDK-Container) | 0 Warnungen, 0 Fehler |
| Backend Tests | `dotnet test … --no-build`, `WQ_TEST_DB` mit `Host=192.168.65.254` | Lauf 1 **rot**: Learning 166/166, Api 387/388. Fehlgeschlagen ist `AccountCommandTests.CreateOwner_valid_allows_login_with_exactly_these_credentials` mit `Npgsql: Failed to connect to 192.168.65.254:5432 — Timeout during connection attempt` in `ApiFactory.InitializeAsync`, also Infrastruktur. Lauf 2 (Build + Test): **Learning 166/166, Api 388/388** |
| Frontend | `npm ci && lint && typecheck && build && test && design:check && design:classes` (node:22) | Exit 0. Vitest: 16 Dateien, 332 Tests. design:lint: 0 Fehler, 0 Warnungen. design:classes: „keine alten Klassen“ |
| e2e mit axe | `npm run e2e:stack && npx playwright test`, danach `down -v` | Vor dem Review **70 passed, 1 skipped**. Nach dem Review-Fix **70 passed, 1 skipped** (children.spec:103 gruen) |
| Proxy-Gate | `proxy-xff-check.sh` | `PROXY-XFF OK` |
| Install-Smoke | `setup-smoke.sh` | `SMOKE OK` (darunter TLS-NAME, TLS-ERNEUERUNG, TLS-KAPUTT, TLS-CA, TLS, PORT-HINWEIS, FIRST RUN, RATE-LIMIT) |
| Release-Smoke | `release-smoke.sh` | `RELEASE-SMOKE OK` (siehe Tracer) |

Zur Reihenfolge: Backend, Frontend, Proxy-Gate und beide Smokes liefen auf dbc0da0. Danach haben sich nur zwei e2e-Testdateien geaendert (6fac063) und zwei Planungsdokumente (0507995). Auf 6fac063 habe ich deshalb die ganze e2e-Suite, `npm run lint` (Exit 0) und `npm run typecheck` (Exit 0) erneut laufen lassen. Die uebrigen Gate-Teile betrifft die Aenderung nicht.

Aufgeraeumt ist alles: dev-DB und e2e-Stack per `down -v`, Smokes und Gate raeumen selbst auf. `docker ps -a` und `docker volume ls` zeigen danach keine Reste von wq-smoke, wq-release, wordquest-e2e, wordquest-dev oder wq-xff. Nicht angefasst habe ich die Ports 8080 und 18090, wq-preview, wq-p2-db und den Zertifikatsspeicher des Macs.

## Gesamt-Review (Plaene 01–05, Diff 2fff169..HEAD plus Task-2-Arbeitsstand)

Ein Subagent-Werkzeug gab es nicht. Deshalb lief das Review als zweite Instanz per `claude -p`. Erlaubt waren nur Read, Grep und Glob sowie lesende git-, grep-, sed-, cat- und wc-Befehle; Edit, Write und NotebookEdit waren gesperrt. Geprueft wurde gegen OD-1..OD-6, OU-1, OU-2, TLS-01..06, die Codex-Befunde 1–11, AGENTS.md und die Gate-Zahlen. Ergebnis: **0 HIGH, 0 MEDIUM, 2 LOW.**

| # | Schwere | Befund | Verbleib |
|---|---------|--------|----------|
| 1 | LOW | `frontend/e2e/learn.spec.ts:355` verweist fuer den randomUUID-Test auf QA2-05; das ist aber die Abdeckungs-Anforderung | Behoben: QA2-06 (6fac063) |
| 2 | LOW | Punkt (a): Kein e2e-Test prueft das Lernen unter aktivem Service Worker | Behoben: children.spec „Serie startet bei 0 …“ wartet jetzt vor der Runde per `expect.poll`, bis `navigator.serviceWorker.controller` gesetzt ist (Muster aus login.spec), und spielt die Runde danach im vertrauten Pfad (6fac063). e2e erneut: 70 passed, 1 skipped |

Ohne Befund blieben laut Review: Codex 1 (setup.sh ruft nur `tls show`, `cat ca.crt` und `restart certs` auf, `watch` ist der einzige Schreiber), Codex 2 (eine neue CA entsteht nur, wenn keine der drei Dateien da ist; die anderen Zustaende enden mit Exit 1), 3, 5, 6, 8, 10, OD-1..OD-6, OU-1, OU-2, „CA-Schluessel verlaesst das Volume nicht“, Einfachheit (keine neue Abhaengigkeit), Doku-Treue, Sprache und C#-Konventionen sowie der uncommittete Stand von REQUIREMENTS und PROJECT.

Eine Einschraenkung zu Befund 2: Dass die neue Zusicherung rot wird, wenn der Worker fehlt, habe ich nicht eigens mit einem roten Lauf belegt. Sie ist wortgleich mit der Pruefung in login.spec. Dort zeigte der Tracer in Plan 04, dass der vertraute Pfad greift, und im Warnpfad bleibt `controller` nachweislich null.

## Offene technische Punkte aus Plan 04

| Punkt | Status | Grund |
|-------|--------|-------|
| Lern-Durchlauf mit aktivem Service Worker im e2e | **behoben** (6fac063) | Review Befund 2 |
| Test fuer den randomUUID-Ersatz ohne Secure Context | **bewusst offen**, als v2 **QA2-06** in REQUIREMENTS.md | Owner OU-2 (2026-10-25): Der Ersatz bleibt, getestet wird spaeter |
| setup.sh prueft vor `docker compose pull` nicht, ob die Datei aus COMPOSE_FILE existiert | **bewusst offen** | Das Review fordert die Pruefung nicht: `.env` entsteht immer aus `.env.example` mit `COMPOSE_FILE=docker-compose.quick.yml`, und das Paket enthaelt genau diese Datei. Fehlen kann sie nur bei einer alten `.env` aus 1.0.x, und nach OU-1 gibt es keine solchen Installationen. Die Folge waere nur eine irrefuehrende Meldung („Stimmt WQ_IMAGE_PREFIX …“), kein Datenverlust |
| Exit-Code von certs bei `docker stop` | **bewusst offen**, UNBEKANNT | Kein Smoke wertet ihn aus; `restart certs` funktioniert (TLS-ERNEUERUNG OK) |
| 127.0.0.1-Listener der Portprobe | **offen**, Teil der VM-Abnahme | Laesst sich nur unter Linux pruefen |
| `.planning/codebase/` und PROJECT.md-Context nennen noch HTTP/Traefik | **bewusst offen** | Snapshot-Dokumente; die Auffrischung per `/gsd-map-codebase` ist eine eigene Aufgabe |
| Konzept §17 O3 („Aufwand fürs TLS-Setup“) | **bewusst offen** | Offene Frage im Konzept, nicht Teil dieses Plans |

## Owner-Abnahme (offen, vor Tag und Push)

Tag v1.1.0 und Push folgen **erst nach dieser Abnahme durch den Owner**. Danach werden die TLS-Zeilen in REQUIREMENTS.md auf Complete gesetzt, und in PROJECT.md bekommt die Key Decision ihr Outcome. Abweichungen kommen als Befund zurueck, mit Geraet, Systemversion und angezeigtem Text, und werden vor dem Release behoben.

**A. VM im Heimnetz (frisches Linux mit Docker)**
1. Paket mit `bash .github/release-package.sh <Ordner> v1.1.0` aus diesem Stand bauen. Images api und web aus dem Arbeitsbaum auf der VM als `ghcr.io/mrhdready/wordquest-api:1.1.0` und `-web:1.1.0` bauen. Paket entpacken, das Build-Overlay wie in release-smoke.sh daneben legen, dann `./setup.sh`.
2. Ausgabe pruefen: https-Adresse, beide Fingerabdruecke (CA und Server), Download-Zeile.
3. `http://<Adresse>` leitet auf https um.
4. Portprobe mit einem Dienst, der nur auf 127.0.0.1:80 oder 127.0.0.1:443 lauscht: setup.sh muss den Port als belegt erkennen (der Fall ist nur unter Linux pruefbar).

**B. iPhone oder iPad**
1. `http://<Adresse>/wordquest-ca.crt` in Safari laden: Laedt Safari die Datei als Profil („Profil geladen“)? *(Installation.md: noch am Gerät zu prüfen)*
2. Profil installieren. Wo zeigt das Geraet den SHA-256-Fingerabdruck? Mit der CA-Zeile aus setup.sh vergleichen. *(noch am Gerät zu prüfen)*
3. Volles Vertrauen einschalten, dann `https://<Adresse>` in Safari: keine Warnung. Anmelden, App zum Home-Bildschirm hinzufuegen und von dort starten.

**C. Android**
1. CA nach Installation.md installieren: Wie heisst der Menue-Eintrag fuer die Zertifizierungsstelle unter „Ein Zertifikat installieren“? Gehen die Folgeschritte wie beim WLAN-Zertifikat? *(noch am Gerät zu prüfen)*
2. Wo zeigt Android den SHA-256-Fingerabdruck vor dem Installieren? Mit setup.sh vergleichen. *(noch am Gerät zu prüfen)*
3. Vertraut Chrome auf Android der Nutzer-CA? `https://<Adresse>` ohne Warnung aufrufen, anmelden.

**D. Geraet ohne installierte CA**
1. Die Warnung erscheint. Wo zeigt der Browser das Zertifikat und den SHA-256-Fingerabdruck? Pruefen fuer Chrome/Edge, Firefox und Safari (Mac, iPhone, iPad). *(Installation.md Zeilen 132–134: noch am Gerät zu prüfen)*
2. Der Server-Fingerabdruck im Browser stimmt mit der Server-Zeile aus setup.sh ueberein. Weiterklicken, Lernen funktioniert.
3. Wie oft warnen Safari und Firefox nach dem Weiterklicken erneut? *(Zeile 128: noch am Gerät zu prüfen; Chrome ist per Quellcode belegt: hoechstens eine Woche, je Zertifikat)*

**E. Optional: Windows und macOS**
1. Windows: Wie heissen die Schritte im Zertifikatimport-Assistenten auf Deutsch? Nutzt Edge die Systemzertifikate? Welches Ausgabeformat hat `certutil -hashfile wordquest-ca.crt SHA256`? *(noch am Gerät zu prüfen)*
2. Mac: Zeigen die Zertifikatsangaben in der Schluesselbundverwaltung den SHA-256-Fingerabdruck? Wie heisst die Vertrauenseinstellung genau (vermutlich „Immer vertrauen“, unbelegt)? *(noch am Gerät zu prüfen)*
3. Firefox: Wie installiert man die CA in Firefox selbst? support.mozilla.org war nicht abrufbar. *(noch am Gerät zu prüfen)*

**F. Danach**
- Jede Markierung „(noch am Gerät zu prüfen)“ in Installation.md durch den belegten Schritt ersetzen oder streichen.
- TLS-01..06 auf Complete setzen und das Outcome der Key Decision in PROJECT.md nachtragen.
- Tag v1.1.0 setzen und pushen (Owner).

## Deviations from Plan

**1. [Rule 1 – Konflikt im Plan] QA2-06 statt QA2-05.** Der Plan hat fuer den randomUUID-Test `QA2-05` vorgesehen. Diese ID war seit 2fff169 schon vergeben („Measured test coverage > 90 %“). Eine doppelte ID haette die Traceability gebrochen. Der Eintrag heisst deshalb QA2-06, ebenso die Verweise in FIX-07 und learn.spec. Die Plan-Pruefung `grep -q 'QA2-05'` trifft weiter, naemlich auf die bestehende Zeile.

**2. Review-Fix in e2e (6fac063).** Die Datei steht nicht in `files_modified` des Plans. Sie kam aus Schritt 4 (Review-Befunde beheben) und deckt den offenen Punkt (a) aus Plan 04 ab.

**3. Plan-Verify nennt `host.docker.internal`.** Benutzt habe ich `192.168.65.254` (IPv4), wie in den Plaenen 02–04.

**4. STATE.md und ROADMAP.md nicht fortgeschrieben.** Das ist laut Auftrag Sache des Orchestrators. PLAN, SUMMARY und STATE sind nicht committet.

Formatter: Das Projekt fuehrt fuer das Frontend keinen Formatter im Gate (QA2-02). Die beiden e2e-Dateien waren schon vor der Aenderung nicht prettier-konform. ESLint auf beiden Dateien und `npm run lint`: Exit 0.

## Known Stubs

Keine im Code. Die Doku enthaelt bewusst Stellen mit „(noch am Gerät zu prüfen)“, die Abnahme folgt oben.

## Threat Flags

Keine neue Angriffsflaeche. Der Plan aendert Versionsnummern, Doku, Planungsdokumente und eine e2e-Zusicherung. T-fpi-27 ist abgedeckt durch die Tag-Pruefung (v1.0.1 abgelehnt) und VERSION OK. T-fpi-28 und T-fpi-29: Die TLS-Zeilen bleiben Pending, und die Abnahme ist oben aufgefuehrt. T-fpi-SC: keine neue Abhaengigkeit, keine CI-Aenderung.

## Self-Check: PASSED

- Commits dbc0da0, 6fac063, 0507995 sind in HEAD; `git rev-list --count c066d16..HEAD` = 3.
- `docker-compose.quick.yml` enthaelt dreimal `${WQ_VERSION:-1.1.0}`, `.env.example` enthaelt `WQ_VERSION=1.1.0`, REQUIREMENTS.md enthaelt `QA2-06` und sechsmal `END 6fac063`, PROJECT.md enthaelt `own CA per install`.
