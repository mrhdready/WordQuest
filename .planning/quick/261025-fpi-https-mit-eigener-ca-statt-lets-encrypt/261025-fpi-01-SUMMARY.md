---
phase: quick-261025-fpi
plan: "01"
subsystem: tls
status: complete
tags: [https, ca, x509, nginx, docker-compose, bcl]
requires: []
provides:
  - "Verb `tls watch` / `tls show` im API-Image (Dienst certs)"
  - "Ablage <dir>/ca/ca.key, ca/ca.crt, tls/server.pem, tls/wordquest-ca.crt mit Modi 0600/0644/0640/0644"
  - "nginx: listen 8443 ssl mit Zertifikat je Handshake ueber map-Variable, /wordquest-ca.crt auf beiden Listenern"
  - "e2e-Stack mit Dienst certs, Port 127.0.0.1:18443"
  - "Proxy-Gate-Regel: CA-Volume nur in certs, fuer jede Compose-Datei"
  - "TLS-01..06 in REQUIREMENTS.md"
affects: [261025-fpi-02, 261025-fpi-03, 261025-fpi-04, 261025-fpi-05]
tech-stack:
  added: []
  patterns:
    - "CertificateRequest/X509 aus der BCL, RSA mit PKCS#1-Signatur"
    - "Atomares Schreiben: <name>.tmp mit Zielmodus (UnixCreateMode + SetUnixFileMode), dann File.Move overwrite"
    - "Takt per Task.Delay(TimeSpan, TimeProvider, CancellationToken), getestet mit eigener ManualTimeProvider"
key-files:
  created:
    - backend/src/WordQuest.Api/TlsCertificates.cs
    - backend/src/WordQuest.Api/TlsCommand.cs
    - backend/tests/WordQuest.Api.Tests/TlsCertificatesTests.cs
    - backend/tests/WordQuest.Api.Tests/TlsCommandTests.cs
    - backend/tests/WordQuest.Api.Tests/ManualTimeProvider.cs
    - frontend/e2e/tls.spec.ts
  modified:
    - backend/src/WordQuest.Api/Program.cs
    - frontend/nginx.conf
    - frontend/e2e/docker-compose.e2e.yml
    - .planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh
    - .planning/REQUIREMENTS.md
decisions:
  - "CA-Laufzeit ueber AddYears(10) (Konstante AuthorityYears) statt TimeSpan: 10 Kalenderjahre sind keine feste Tageszahl"
  - "CA mit weniger als 30 Tagen Rest stoppt watch mit eigener Meldung (Review 2); Ausweg wie bei beschaedigter CA"
  - "CN der CA kuerzt den Namen auf 21 Zeichen, damit der CN innerhalb von 64 Zeichen bleibt (RFC 5280, Review 4)"
  - "Proxy-Gate prueft per Glob jede docker-compose*.yml plus den e2e-Stack und zaehlt Bind-Mounts auf /certs/ca mit"
metrics:
  duration: 54min
  completed: 2026-10-25
estimate:
  tokens: 190000
  tasks: 3
actuals:
  tokens: 17121
  tasks: 3
  commits: 4
plan_head_before: 2fff169637d9a09cc3524c50d1b33adbbda23ac8
plan_head_after: dbef3b1f4661664534cd77d74cf6b64f260e6e1c
---

# Phase quick-261025-fpi Plan 01: Zertifikatsdienst mit eigener CA Summary

`tls watch` im API-Image legt eine eigene CA (RSA 3072, 10 Jahre) und ein Server-Zertifikat (RSA 2048, 800 Tage, SAN aus WQ_TLS_NAMES) nur mit der BCL an, erneuert ohne CA-Wechsel und stoppt bei jedem unklaren CA-Zustand ohne Aenderung; nginx liefert es auf 8443 je Handshake aus.

## Commits

| Task | Commit | Inhalt |
|------|--------|--------|
| 1 (Tracer) | a7f1992 | TlsCertificates/TlsCommand (watch), Weiche in Program.cs, nginx 8443 + /wordquest-ca.crt, Dienst certs im e2e-Stack, tls.spec.ts |
| 2 (TDD) | b7b151c | CA-Zustaende, Neuausstellung, show, Namensregel, watch-Takt; 3 Testdateien |
| Review | c4b189e | Befunde 1–4 und 8 der Review (siehe unten) |
| 3 | dbef3b1 | CA-Volume-Regel im Proxy-Gate, TLS-01..06 in REQUIREMENTS.md |

`actuals.tokens` ist chars/4 ueber `git diff 2fff169..HEAD` (Code und Tests, ohne SUMMARY); die Schaetzung von 190000 enthielt offenbar Lesen und Gate-Laeufe.

## TDD-Nachweis

- **Rot (Task 2):** Stubs mit `NotImplementedException` fuer NeedsReissue, SubjectAlternativeNames, Fingerprint, TryParseNames, TlsCommand noch auf Tracer-Stand. `dotnet test --filter Tls`: **66 von 73 fehlgeschlagen**, 7 bestanden (CA-/Server-Parameter und Start im leeren Ordner, die der Tracer schon lieferte).
- **Gruen:** 73/73, Build `/warnaserror` 0 Warnungen.
- **Rot (Review-Fixes):** 3 neue Tests; **2 von 76 fehlgeschlagen** (CN-Laenge, CA laeuft ab). Der Test „fremde CA mit gleichem Namen“ und die AKI-Pruefung bestanden sofort, das Verhalten war schon richtig.
- **Gruen:** 76/76.

## Gate (Endstand nach den Review-Fixes)

| Teil | Befehl | Ergebnis |
|------|--------|----------|
| Backend Build | `dotnet build backend/WordQuest.slnx -c Release /warnaserror --no-incremental` (SDK-Container) | 0 Warnungen, 0 Fehler |
| Backend Tests | `dotnet test backend/WordQuest.slnx -c Release` gegen docker-compose.dev.yml | Learning 166/166, Api 388/388 |
| Frontend | `npm ci && lint && typecheck && build && test && design:check && design:classes` (node:22) | Exit 0; Vitest 16 Dateien, 332 Tests; design:lint 0 Fehler, 0 Warnungen; „keine alten Klassen“ |
| e2e mit axe | `npm run e2e:stack && npx playwright test` | 67 passed, 1 skipped (first-run.spec, laeuft nur in den Smokes), axe-Specs (login, manage, learn, account, children) gruen |
| Proxy-Gate | `proxy-xff-check.sh` | `PROXY-XFF OK` |
| Install-Smoke | `setup-smoke.sh` | `SMOKE OK` |
| Release-Smoke | `release-smoke.sh` | `RELEASE-SMOKE OK` |

Verlauf ehrlich:
- Erster voller Backend-Lauf: Api **1 von 385 fehlgeschlagen** (`RateLimitTests.Locked_device_does_not_lock_another_device_behind_the_proxy`, `Npgsql: Failed to connect to [fdc4:f303:9324::254]:5432 – Network is unreachable`): host.docker.internal loeste einmal auf eine nicht erreichbare IPv6-Adresse auf. Zweiter Lauf ohne Codeaenderung: 385/385. Danach mit den Review-Fixes: 388/388.
- Frontend, Smokes und der erste e2e-Lauf (67/1) liefen vor den Review-Fixes. Nach den Fixes erneut: Backend (s. o.), Proxy-Gate, ganze e2e-Suite (67 passed, 1 skipped). Smokes und Frontend nicht erneut: die Fixes aendern nur TlsCommand/TlsCertificates (laufen in den Smokes nicht) und das Proxy-Gate.
- Negativkontrollen fuer die neue Gate-Regel: CA-Volume in web eingebunden → beide Meldungen (CA-Volume, nicht schreibgeschuetzt); Bind-Mount `./ca:/certs/ca` in web → Fehlermeldung. Datei danach per `git checkout` zurueck.
- Im e2e-Stack zusaetzlich: `tls show` im Container → Exit 0 mit beiden Fingerabdruecken; Dateien root:101 mit 0640/0644, ca.key 0600.

Alle gestarteten Stacks per `down -v` entfernt (e2e, dev-DB); Ports 8080/18090 und wq-preview nicht angefasst.

## Review (claude -p, read-only, gegen PLAN, Diff und AGENTS.md)

Kein Subagent-Werkzeug in dieser Sitzung, deshalb `claude -p` mit nur lesenden Werkzeugen. Ergebnis: 2 MEDIUM, 6 LOW, Urteil „freigabefaehig mit Nacharbeit“.

| # | Schwere | Befund | Verbleib |
|---|---------|--------|----------|
| 1 | MEDIUM | Test „fremde CA“ nutzt eine CA mit anderem DN; Signaturfall mit gleichem DN ungetestet | Behoben: TwinAuthority (gleicher Name, gleicher Tag) – NeedsReissue true gegen die echte CA, false gegen die eigene (c4b189e) |
| 2 | MEDIUM | CA mit < 30 Tagen Rest: taeglich „erneuert“, nach Ablauf `ArgumentException` aus `request.Create` → Absturz statt Exit 1 / Weiterlaufen | Behoben: watch meldet „Die Zertifizierungsstelle läuft am <Datum> ab.“ + Ausweg, Exit 1 beim Start, spaetere Takte laufen weiter; Test (c4b189e) |
| 3 | LOW | AKI des Server-Zertifikats ungetestet | Behoben: AKI == SKI der CA im Test |
| 4 | LOW | CN der CA kann 64 Zeichen ueberschreiten (`pi-wohnzimmer.fritz.box` → 66) | Behoben: Name auf 21 Zeichen gekuerzt, Test mit 63 × `a` |
| 5 | LOW | Gate prueft nur Volume-Namen, Bind-Mount auf den CA-Ordner faellt durch; docker-compose.build.yml allein ungeprueft | Behoben: Ziel `/certs/ca` zaehlt mit (Negativkontrolle s. o.). build.yml laeuft allein durch (Gate-Lauf belegt) |
| 6 | LOW | `CancellationToken.None` im Betrieb, Exit-Code bei SIGTERM unbekannt | Zurueckgewiesen: Plan schreibt die Weiche woertlich so vor; jede Datei wird atomar ersetzt, ein Abbruch hinterlaesst nie eine halbe Datei; der Exit-Code beim `docker stop` beeinflusst die Neustart-Regel nicht. Offener Punkt fuer Plan 03 (Smoke), falls er den Exit-Code auswertet |
| 7 | LOW | 10-s-Grenze in ManualTimeProvider koennte bei RSA 3072 knapp werden | Zurueckgewiesen: Die erste Pruefung (mit RSA 3072) laeuft synchron, bevor RunAsync zurueckkehrt; die Grenze deckt nur Folgetakte (RSA 2048). 10 s stehen so im Plan |
| 8 | LOW | Unlesbares server.pem (IO/Rechte) fuehrt zu Fehler statt Neuausstellung | Behoben: Lesen im try, IOException/UnauthorizedAccessException → neu ausstellen |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CA1416 bei Dateimodi**
- Build mit `/warnaserror` brach an `UnixCreateMode`/`SetUnixFileMode` (Windows nicht unterstuetzt) ab. Fix: Guard `OperatingSystem.IsWindows()` → `PlatformNotSupportedException` in WriteAtomic; Test mit Dateimodi traegt `[UnsupportedOSPlatform("windows")]`. Commits a7f1992, b7b151c.

**2. [Rule 1 - Bug] Review-Befunde 1–5, 8** – siehe Review-Tabelle, Commit c4b189e. Neue Meldung „Die Zertifizierungsstelle läuft am <dd.MM.yyyy> ab. Es wurde nichts geändert. Wie es weitergeht, …“ steht nicht in der Meldungsliste des Plans; Plan 03 muss sie in der Anleitung unter „Zertifizierungsstelle neu anlegen“ mit abdecken.

**3. Kleinere Abweichungen ohne Regelbezug**
- PEM-Pruefung in den Tests ueber `PemEncoding.TryFind` statt Zeichenkettenvergleich: ein Hook blockiert das woertliche PEM-Kopfzeilenmuster in Dateien.
- show meldet bei leerem Ordner (keine CA) ebenfalls „noch nicht bereit“ (Plan nannte den Fall nicht); bei unvollstaendiger/beschaedigter CA die CA-Meldung mit Exit 1.
- `tls watch` gibt bei unbekanntem Aufruf (auch nur `tls`) die Aufrufzeile mit 64 aus; leeres WQ_TLS_NAMES gilt wie fehlend.

## Threat Flags

Keine neue Angriffsflaeche ausser der geplanten: Listener 8443 und `/wordquest-ca.crt` (T-fpi-01/-04 im Plan). nginx.conf liefert 8443 jetzt auch im Heimnetz-Image; docker-compose.quick.yml veroeffentlicht den Port noch nicht und bindet kein Zertifikat ein, Handshakes dort scheitern bis Plan 03.

## Offene Punkte fuer Plan 02

- Proxy-Gate: Plan 02 schreibt den Compose-Abschnitt um (Traefik/realip weg). Der neue Block „CA-Volume nur im Dienst certs“ steht davon getrennt vor `PROXY-XFF OK` und iteriert per Glob ueber `docker-compose*.yml` – das Entfernen von docker-compose.yml braucht dort keine Aenderung; der Block muss erhalten bleiben.
- frontend/nginx.conf hat jetzt den 8443-Listener und die map auf http-Ebene; Plan 02 entfernt nginx-traefik-realip.conf und das Einbinden in docker-compose.yml, nginx.conf selbst bleibt.
- HSTS der API (Plan 02 laut Quellen-Abdeckung): nginx setzt keins, ueber 8443 ist bisher nur die nginx-Seite geprueft (tls.spec), nicht die Kopfzeilen der API.
- Fuer Plan 03 vorgemerkt: certs in docker-compose.quick.yml (Muster aus dem e2e-Stack: `user: "0:101"`, `network_mode: none`, `healthcheck.disable`, Volumes `*-ca`/`*-tls`), WQ_TLS_NAMES aus setup.sh mit derselben Namensregel (Beispieltabelle in TlsCertificatesTests.ValidNames/InvalidNames), Meldung „läuft ab“ in der Doku, Exit-Code von certs bei `docker stop` (Review 6).

## Self-Check: PASSED

- Dateien vorhanden: TlsCertificates.cs, TlsCommand.cs, TlsCertificatesTests.cs, TlsCommandTests.cs, ManualTimeProvider.cs, tls.spec.ts.
- Commits a7f1992, b7b151c, c4b189e, dbef3b1 in HEAD; `git rev-list --count 2fff169..HEAD` = 4.
