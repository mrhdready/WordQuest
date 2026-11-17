---
phase: quick-261025-fpi
plan: "04"
subsystem: tls
status: complete
tags: [https, ca, nginx, redirect, service-worker, playwright, docs]
requires: ["261025-fpi-01", "261025-fpi-03"]
provides:
  - "nginx.conf als envsubst-Template: HTTP nur 301 auf https://$host:WQ_HTTPS_PORT und /wordquest-ca.crt, HTTPS mit der App, kein HSTS"
  - "Web-Image: Template, ENV WQ_HTTPS_PORT=443, EXPOSE 8080 8443, Healthcheck ueber HTTPS"
  - "e2e ueber HTTPS: vertrauter Pfad (SPKI-Liste + NODE_EXTRA_CA_CERTS) mit Service Worker, Warnpfad learn.spec ohne Service Worker"
  - "CA-Download mit aktivem Service Worker (Denylist in vite.config.ts)"
  - "Proxy-Gate und beide Smokes ueber HTTPS mit Umleitungspruefung"
  - "Installation.md: Abschnitt Zertifizierungsstelle auf dem Geraet installieren, Hilfe-Eintraege"
affects: [261025-fpi-05]
tech-stack:
  added: []
  patterns:
    - "Chromium-Vertrauen per --ignore-certificate-errors-spki-list fuer genau einen Schluessel, Wert aus globalSetup ueber process.env an die Worker"
    - "nginx-unprivileged envsubst mit NGINX_ENVSUBST_FILTER=WQ_"
key-files:
  created: []
  modified:
    - frontend/e2e/global-setup.ts
    - frontend/playwright.config.ts
    - frontend/e2e/learn.spec.ts
    - frontend/e2e/login.spec.ts
    - frontend/e2e/headers.spec.ts
    - frontend/vite.config.ts
    - frontend/nginx.conf
    - frontend/nginx-security-headers.conf
    - frontend/Dockerfile
    - frontend/e2e/docker-compose.e2e.yml
    - docker-compose.quick.yml
    - .planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
    - Documentation/Installation.md
    - Documentation/WordQuest_Konzept_und_Architektur.md
decisions:
  - "Warnpfad prueft die Ablehnung direkt: eigene navigator.serviceWorker.register('/sw.js') muss mit 'SSL certificate error' scheitern, danach gepollt keine Registrierung und kein controller (getRegistrations zaehlt eine laufende Registrierung mit)"
  - "Zweiter Absender im Rate-Limit-Block des Install-Smokes ist 127.0.0.1 im web-Container (busybox-wget mit HTTPS), wie im Plan"
  - "Proxy-Gate verbietet Mounts auch unter /etc/nginx/templates (Template liegt jetzt dort)"
  - "Geraete-Doku nur aus in dieser Session abgerufenen Herstellerseiten; jeder nicht belegte Schritt steht als '(noch am Gerät zu prüfen)' in der Anleitung"
metrics:
  duration: 56min
  completed: 2026-10-25
estimate:
  tokens: 210000
  tasks: 3
actuals:
  tokens: 17982
  tasks: 3
  commits: 6
plan_head_before: 75b0a195efe99d17a3cfb38d27460e3822ab6d9a
plan_head_after: c066d1667343e443900c2220032d120dbca65607
---

# Phase quick-261025-fpi Plan 04: Browser-Pfade und Umleitung Summary

HTTP leitet jeden Pfad ausser `/wordquest-ca.crt` per 301 auf HTTPS um, ohne HSTS. Die e2e-Suite laeuft komplett ueber HTTPS: Im vertrauten Pfad vertraut Chromium per SPKI-Liste genau dem Schluessel des ausgelieferten, CA-signierten Zertifikats, und der Service Worker registriert sich. Im Warnpfad lehnt Chromium den Worker ab, Lernen geht trotzdem. Die Geraete-Anleitung stuetzt sich nur auf abgerufene Herstellerseiten.

## Commits

| Task | Commit | Inhalt |
|------|--------|--------|
| 1 (Tracer) | 6894dbb | global-setup (SPKI, CA-PEM, NODE_EXTRA_CA_CERTS), playwright.config https://localhost:18443, learn.spec Warnpfad, login.spec CA-Download, Denylist |
| Fix (in Task 2 gefunden) | c6771d9 | Warnpfad: abgelehnte Registrierung statt Zeitpunkt-Pruefung |
| 2 (TDD) | e54b1ab | nginx-Template mit zwei server-Bloecken, Dockerfile, Compose (WQ_HTTPS_PORT), headers.spec |
| Fix (im Gate gefunden) | 37366dd | Warnpfad laedt die Profilwahl neu (openPicker) statt page.reload |
| 3 | 1f69138 | Proxy-Gate, Install-/Release-Smoke, Installation.md, Konzept |
| Review | c066d16 | SPKI-Wortlaut in Kommentaren, Header-Kommentar (zwei server-Bloecke) |

`actuals.tokens` = chars/4 ueber `git diff 75b0a19..HEAD` (16 Dateien, +355/−71).

## Tracer-Nachweis (Task 1)

- **Rot (CA-Download ohne Denylist):** `npx playwright test e2e/login.spec.ts` → 4 passed, 1 failed: `CA-Download mit aktivem Service Worker` mit `TimeoutError: page.waitForEvent: Timeout 10000ms exceeded while waiting for event "download"`; der Page-Snapshot zeigt die App-Seite (`heading "Wer lernt heute?"`, Profil „Max“) statt eines Downloads. Der Abmelde-Test mit aktivem Worker war im selben Lauf gruen, der vertraute Pfad griff also.
- **Gruen:** Denylist ergaenzt, web neu gebaut → login.spec 5/5.
- **Plan-Verify Task 1:** typecheck, lint, `e2e:stack`, ganze Suite → **68 passed, 1 skipped**, danach `down -v`. Tracer-Gate (Auto-Modus) damit bestanden.
- Keine Abbruchbedingung griff: Handshake und Registrierung im vertrauten Pfad ok; im Warnpfad keine Registrierung (Chromium-Konsole: „An SSL certificate error occurred when fetching the script.“); Chromium startet den Download.

## TDD-Nachweis (Task 2)

- **Rot:** neue Faelle in headers.spec gegen das Image aus Task 1 → 5 passed, 1 failed: `HTTP leitet mit 301 auf HTTPS um…` mit `Expected: 301, Received: 200`. Der CA-Fall war schon gruen: Den Download gab es seit Plan 01 auf beiden Ports.
- **Gruen:** nginx-Template, Dockerfile, Compose. Web-Container `healthy` (Healthcheck ueber HTTPS), im Container `return 301 https://$host:18443$request_uri;`.
- **Verify Lauf 1: rot**, 67 passed, 3 failed, 1 skipped. Alle drei Fehler im Warnpfad: `registrations: 1` statt 0 nach dem Neuladen. Eine Probe ausserhalb der Suite (Chromium ohne SPKI, ignoreHTTPSErrors, 8× pollen vor und nach Reload) zeigte durchgehend `regs: []` und die Konsolenmeldung zum Zertifikatsfehler. Ursache: `getRegistrations()` zaehlt eine noch laufende Registrierung mit. Es ist also ein Testfehler und keine echte Registrierung, die Abbruchbedingung greift nicht. Fix c6771d9. Drei Wiederholungen je Warnpfad-Test (`--repeat-each 3`): 7 gruen. 2 rot, weil „Lernen ohne vertrautes Zertifikat“ das Tagesbudget von Max verbraucht; das ist erwartet, der Test ist nicht wiederholbar.
- **Verify Lauf 2:** 70 passed, 1 skipped.
- Abweichung: headers.spec und nginx.conf liegen im selben Commit (e54b1ab); der rote Lauf ist oben belegt (Review 7).

## Gate (Endstand)

| Teil | Befehl | Ergebnis |
|------|--------|----------|
| Backend Build | `dotnet build backend/WordQuest.slnx -c Release /warnaserror` (SDK-Container) | 0 Warnungen, 0 Fehler |
| Backend Tests | `dotnet test … --no-build`, `WQ_TEST_DB` mit `Host=192.168.65.254` | Learning 166/166, Api 388/388 (erster Lauf) |
| Frontend | `npm ci && lint && typecheck && build && test && design:check && design:classes` (node:22) | Exit 0; Vitest 16 Dateien, 332 Tests; design:lint 0 Fehler, 0 Warnungen; „keine alten Klassen“ |
| e2e mit axe | `npm run e2e:stack && npx playwright test`, danach `down -v` | Lauf 1 **rot**: 69 passed, 1 failed, 1 skipped. „Lernen ohne vertrautes Zertifikat“: `Hallo, Max!` fehlte. Ursache: Nach `page.reload` tippte loginByKeyboard, bevor die Profile geladen waren. Fix 37366dd. Lauf 2: **70 passed, 1 skipped** (first-run.spec laeuft in den Smokes) |
| axe | in der e2e-Suite (`checkPage`/`expectNoAxeViolations`) | alle axe-Specs gruen, 0 Verstoesse (login, Profilwahl/Ziffernfeld/Lernen im Warnpfad, /verwalten, Konto, Kinder, Dialoge, Fortschritt, 200 %-Zoom) |
| Proxy-Gate | `proxy-xff-check.sh` | `PROXY-XFF OK` (XFF /api/ und /health/ ueber HTTPS, Umleitung 8443 und 443) |
| Install-Smoke | `setup-smoke.sh` | `SMOKE OK` mit `TLS OK`, `FIRST RUN OK` per HTTPS, `RATE-LIMIT OK` |
| Release-Smoke | `release-smoke.sh` | `RELEASE-SMOKE OK`, `INSTALL OK` (mit Umleitung), Erstdurchlauf per HTTPS 1 passed, `SEITE OK` |
| Doku-Pruefungen | `grep -q '^### Zertifizierungsstelle auf dem Gerät installieren'`, `! grep -q '0\.0\.0\.0'` | OK; weiter genau 5 `##`-Abschnitte |

Negativkontrolle Proxy-Gate: `add_header Strict-Transport-Security …` in nginx-security-headers.conf → `PROXY-XFF FEHLER: Heimnetz /: Strict-Transport-Security gesetzt.`; Datei danach per `git checkout --` zurueck.

Reihenfolge ehrlich: Proxy-Gate und Install-Smoke liefen vor den Review-Fixes. Die Fixes aendern danach nur Kommentare (global-setup.ts, playwright.config.ts, nginx-security-headers.conf) und Doku-Saetze. Der Release-Smoke lief danach auf dem committeten Stand: Er baut die Images neu, faehrt den Erstdurchlauf per HTTPS und prueft die Seite (SEITE OK). Die e2e-Suite lief zuletzt vor diesen Kommentar-Aenderungen; typecheck und lint danach Exit 0.

Aufgeraeumt: dev-DB und e2e-Stack per `down -v`, die Smokes und das Gate raeumen selbst auf. Danach `docker ps -a` und `docker volume ls` ohne Reste von wq-smoke, wordquest-e2e, wordquest-dev oder wq-xff. Ports 8080/18090, wq-preview und wq-p2-db nicht angefasst. Am System-Zertifikatsspeicher nichts geaendert: Vertrauen nur ueber die SPKI-Liste in den Playwright-Browsern.

## Quellen der Geraete-Doku (in dieser Session abgerufen)

| URL | Abruf | Wofuer |
|-----|-------|--------|
| https://support.apple.com/de-de/102400 | curl 200 | iPhone/iPad: „Profil geladen“, Einstellungen, „Installieren“, 8 Minuten, Schutz fuer gestohlene Geraete |
| https://support.apple.com/de-de/102390 | curl 200 | „Einstellungen“ > „Allgemein“ > „Info“ > „Zertifikatsvertrauenseinstellungen“, „Volles Vertrauen für Root-Zertifikate aktivieren“ |
| https://support.google.com/pixelphone/answer/2844832?hl=de | curl 200 | Android-Pfad bis „Ein Zertifikat installieren“, Folgeschritte nur fuer WLAN-Zertifikat, Android 14 |
| https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil | curl 200 | `certutil -hashfile InFile [HashAlgorithm]`, SHA256 in der Algorithmenliste (Quelle MicrosoftDocs certutil.md) |
| https://learn.microsoft.com/en-us/skype-sdk/sdn/articles/installing-the-trusted-root-certificate | curl 200 (auch de-de, Inhalt englisch) | Install Certificate…, Place all certificates in the following store, Trusted Root Certification Authorities, Finish |
| https://support.google.com/chrome/answer/95617?hl=de | Headless-Chromium 200 | Chrome nutzt die Root-Zertifikate des Betriebssystems; Warntext „Dies ist keine sichere Verbindung“ |
| https://support.apple.com/de-de/guide/keychain-access/kyca2431/mac | curl 200 | Mac: Datei auf die Schluesselbundverwaltung bewegen, Schluesselbund „Anmeldung“ oder „System“ |
| https://support.apple.com/de-de/guide/keychain-access/kyca15178/mac | curl 200 | Doppelklick zeigt die Angaben des Zertifikats |
| https://support.apple.com/de-de/guide/keychain-access/kyca11871/mac | curl 200 | „Vertrauen“, Einblendmenue |
| https://wiki.mozilla.org/CA/AddRootToFirefox | curl 200 | Firefox nutzt die Zertifikate des Betriebssystems nicht von sich aus |

Nur Beleg, nicht in der Doku verlinkt: Chromium `components/security_interstitials/content/stateful_ssl_host_state_delegate.cc` (raw.githubusercontent.com, 200). Darin `kCertErrorBypassExpirationInSeconds = 604800` („remembered for one week“), und `GetKey` bildet den Schluessel aus Fehler plus SHA-256 der Zertifikatskette. Daraus der Satz zu Chrome: Das Weiterklicken gilt hoechstens eine Woche und nur fuer genau dieses Zertifikat.

Nicht abrufbar, deshalb weggelassen: support.mozilla.org (Captcha, per curl und per Headless-Browser). Firefox-Schritte zur Warnung und zum Import stehen deshalb als „noch am Gerät zu prüfen“ in der Anleitung.

## Review (claude -p, nur lesende Werkzeuge, gegen PLAN, Diff, AGENTS.md und die Quellen)

Es gab kein Subagent-Werkzeug, deshalb lief die Review ueber `claude -p` mit Read/Grep/Glob und lesenden git-, grep-, sed- und cat-Befehlen; Edit und Write waren gesperrt. Ergebnis: 0 HIGH, 3 MEDIUM, 4 LOW. Ohne Befund blieben nginx, Image und Compose, Proxy-Gate, Smokes, Quellentreue und Barrierefreiheit.

| # | Schwere | Befund | Verbleib |
|---|---------|--------|----------|
| 1 | MEDIUM | Android-Folgeschritte unmarkiert als Weg fuer die CA, belegt nur fuer WLAN | Behoben: „Für das WLAN-Zertifikat geht es laut Google so weiter … ob das für die Zertifizierungsstelle genauso ist, ist noch am Gerät zu prüfen“ (1f69138) |
| 2 | MEDIUM | iPhone/iPad und Android ohne Ausweg, wenn der SHA-256-Wert nicht auffindbar ist (T-fpi-21) | Behoben: je Geraet „findest du den Fingerabdruck nicht, … nicht einschalten/installieren, im Browser nutzen und bei der Warnung pruefen“ (1f69138). Den Satz des Reviews „Auf Android heißt Installieren schon Vertrauen“ habe ich nicht uebernommen, weil die Quelle das nicht belegt |
| 3 | MEDIUM | Kein e2e-Test prueft mehr das Lernen eines Kindes unter aktivem Service Worker (learn.spec ist komplett Warnpfad) | Offen, als Punkt fuer Plan 05 gefuehrt (siehe unten). Der Plan legt learn.spec als Warnpfad fest. children.spec „Serie startet bei 0 …“ faehrt im vertrauten Pfad eine ganze erste Runde, prueft aber nicht, dass der Worker die Seite steuert |
| 4 | LOW | SPKI pinnt den Schluessel, nicht das Zertifikat | Behoben: Wortlaut in global-setup.ts, playwright.config.ts und Konzept (c066d16, 1f69138) |
| 5 | LOW | Konzept §15 Headers und nginx-security-headers.conf sprechen von „dem server-Block“, /wordquest-ca.crt fehlt | Behoben (1f69138, c066d16) |
| 6 | LOW | `toContain('SSL certificate error')` haengt am Chromium-Wortlaut | Zurueckgewiesen: Der Wortlaut belegt die Ursache (Zertifikat), nicht nur irgendeine Ablehnung, etwa ein 404 des Skripts. Playwright ist auf 1.64.0 gepinnt, ein Update ist eine bewusste Aenderung, und dann zeigt der Test die neue Meldung |
| 7 | LOW | Rot-Belege fuer CA-Download und headers.spec fehlten | Behoben in diesem SUMMARY (Tracer- und TDD-Nachweis) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Warnpfad-Pruefung war zeitabhaengig** (c6771d9, 37366dd)
- Gefunden im Verify von Task 2 bzw. im Gate. `getRegistrations()` zaehlte die laufende, spaeter scheiternde Registrierung mit. Nach `page.reload` fehlten die Profile, als der Test weitertippte.
- Fix: Die eigene Registrierung muss am Zertifikat scheitern. Danach wird gepollt, dass keine Registrierung und kein controller da sind, vor und nach erneutem `openPicker`.

**2. [Rule 2] Proxy-Gate-Regel auf /etc/nginx/templates erweitert** (1f69138)
- Die Konfiguration liegt jetzt als Template dort. Ein Mount dorthin umginge die XFF-Pruefung genauso wie einer unter conf.d.

**3. Plan-Abweichungen ohne Regelbezug**
- learn.spec: Neben Test 396 heisst auch „Lernen mit Bild über HTTP“ jetzt „… ohne vertrautes Zertifikat“, die Kommentarverweise sind angepasst.
- Die Warnpfad-Pruefung laedt per `openPicker` neu statt per `page.reload` (Fix 1).
- Installation.md: Den bestehenden Beispieltext „Diese Verbindung ist nicht privat“ habe ich durch den belegten Chrome-Text „Dies ist keine sichere Verbindung“ ersetzt.
- Plan-Verify Task 3 nennt `host.docker.internal`; benutzt wurde `192.168.65.254` (IPv4, wie in Plan 02/03).
- STATE.md/ROADMAP.md nicht fortgeschrieben: Quick-Task, kein Phasenplan, und STATE nennt 261025-fpi nicht. Das macht der Abschluss in Plan 05 bzw. der Orchestrator.

## Known Stubs

Keine Code-Stubs. Die Doku enthaelt bewusst Stellen mit „(noch am Gerät zu prüfen)“, Abnahme in Plan 05 (siehe unten).

## Threat Flags

Keine Angriffsflaeche ausser der geplanten. Port 80 liefert nur noch 301 und das oeffentliche CA-Zertifikat (T-fpi-22). headers.spec prueft, dass der Download kein „PRIVATE KEY“ enthaelt und auf beiden Ports bytegleich ist. Kein HSTS (T-fpi-23): headers.spec prueft das an jeder Antwort, das Proxy-Gate an jedem Pfad und am 301.

## Offene Punkte fuer Plan 05

Owner am Geraet bestaetigen (jede Stelle in Installation.md mit „noch am Gerät zu prüfen“):
- **Chrome/Edge, Firefox, Safari (Mac, iPhone, iPad):** wo die Warnung das Zertifikat und den SHA-256-Fingerabdruck zeigt. Dazu: wie oft Safari und Firefox nach dem Weiterklicken erneut warnen. Chrome ist per Quellcode belegt: hoechstens eine Woche, je Zertifikat.
- **iPhone/iPad:** ob Safari `http://<Adresse>/wordquest-ca.crt` als Profil laedt („Profil geladen“) und wo der SHA-256-Wert vor dem Vertrauen steht.
- **Android:** der Menue-Eintrag fuer die Zertifizierungsstelle unter „Ein Zertifikat installieren“, ob die Folgeschritte wie beim WLAN-Zertifikat sind, wo der SHA-256-Wert steht, und ob Chrome auf Android der Nutzer-CA vertraut.
- **Windows:** deutsche Bezeichnungen im Zertifikatimport-Assistenten, ob Edge die Systemzertifikate nutzt, Ausgabeformat von `certutil -hashfile`.
- **Mac:** ob die Zertifikatsangaben den SHA-256-Fingerabdruck zeigen, genauer Name der Vertrauenseinstellung (vermutlich „Immer vertrauen“, unbelegt).
- **Firefox:** Import-Weg in Firefox selbst (support.mozilla.org war nicht abrufbar).
- Danach die Markierungen „(noch am Gerät zu prüfen)“ aus Installation.md entfernen bzw. durch belegte Schritte ersetzen.

Technisch:
- Review 3: Ein Lern-Durchlauf im vertrauten Pfad mit Pruefung „Service Worker steuert die Seite“ (NetworkFirst auf Sitzungs-Endpunkten) fehlt.
- Ersatz fuer crypto.randomUUID (FIX-07) ist ohne Test, seit kein e2e-Test mehr ohne Secure Context laeuft (QA2-05, laut Plan in Plan 05).
- Aus Plan 02/03 weiter offen: setup.sh prueft vor `docker compose pull` nicht, ob die Datei aus COMPOSE_FILE existiert. Dieser Plan deckt das nicht ab. Ebenfalls offen: Exit-Code von certs bei `docker stop` (UNBEKANNT), der 127.0.0.1-Listener der Portprobe (nur Linux/VM) und `.planning/codebase/` mit HTTP/Traefik.

## Self-Check: PASSED

- Commits 6894dbb, c6771d9, e54b1ab, 37366dd, 1f69138, c066d16 in HEAD; `git rev-list --count 75b0a19..HEAD` = 6.
- Dateien vorhanden: frontend/e2e/global-setup.ts (enthaelt NODE_EXTRA_CA_CERTS), frontend/nginx.conf (enthaelt `return 301 https://$host:${WQ_HTTPS_PORT}$request_uri`), frontend/vite.config.ts (enthaelt wordquest-ca).
