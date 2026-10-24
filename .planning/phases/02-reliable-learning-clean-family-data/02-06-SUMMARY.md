---
phase: 02-reliable-learning-clean-family-data
plan: 06
subsystem: auth
tags: [rate-limit, forwarded-headers, nginx, traefik, realip, refresh, integration-tests, vitest]
status: complete

requires:
  - phase: 02-05
    provides: "Stand nach Vokabel-Korrektur; ApiFactory, TestData, Gate-Skript backend-test.sh"
provides:
  - "Anmelde-Limit pro echter Client-IP: nginx setzt X-Forwarded-For auf $remote_addr, API mit ForwardLimit 1 und KnownIPNetworks 10/8, 172.16/12, 192.168/16, UseForwardedHeaders vor UseRateLimiter"
  - "POST /auth/refresh und /auth/logout ohne Rate-Limit"
  - "frontend/nginx-traefik-realip.conf, nur in docker-compose.yml eingebunden"
  - "gate/proxy-xff-check.sh: beide nginx-Varianten gegen gefälschte und vorangestellte Köpfe, Compose-Einbindung"
  - "refreshAccessToken: Abmeldung nur bei 400/401, sonst ApiError(GENERIC, status bzw. 0)"
  - "AuthEndpointTests (9 Fälle) und SiblingIsolationTests (1 Fall, 6 Endpunkte)"
affects: [02-07, 03]

actuals:
  tokens: 11754
  tasks: 3
  commits: 4
plan_head_before: 5aaf2f71fd373da4bec94fd270c860b95170d6ba
plan_head_after: 8d080d8b4eebd0a0ec84d6271b82071a4595585f

tech-stack:
  added: []
  patterns:
    - "TestServer.SendAsync mit Connection.RemoteIpAddress; dazu ContentLength und IHttpRequestBodyDetectionFeature (CanHaveBody), sonst sieht Minimal API keinen Body"
    - "Geschwister-Trennung per JSON-Snapshot aller Lerndaten des Kindes vor und nach den verbotenen Aufrufen"
    - "Gate-Skript mit Echo-Upstream aus dem Basis-Image des Web-Containers"

key-files:
  created:
    - frontend/nginx-traefik-realip.conf
    - .planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh
    - backend/tests/WordQuest.Api.Tests/AuthEndpointTests.cs
    - backend/tests/WordQuest.Api.Tests/SiblingIsolationTests.cs
  modified:
    - backend/src/WordQuest.Api/Program.cs
    - backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs
    - backend/tests/WordQuest.Api.Tests/RateLimitTests.cs
    - frontend/nginx.conf
    - frontend/src/lib/api.ts
    - frontend/src/lib/api.test.ts
    - frontend/e2e/docker-compose.e2e.yml
    - docker-compose.yml
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "nginx überschreibt X-Forwarded-For mit $remote_addr; die API wertet genau einen Wert aus (ForwardLimit 1) und vertraut nur privaten Netzen"
  - "realip nur im Traefik-Stack, real_ip_recursive off; zusätzlicher Prüffall mit privater Geräteadresse, weil recursive on dort den vorangestellten Wert nähme"
  - "Refresh und Abmelden ohne Limit (Tokens 256 Bit Zufall); Restrisiko n×10 Passwortversuche bei mehreren Adressen akzeptiert und im Konzept benannt"

requirements-completed: [FIX-01]
requirements-partial: [QUAL-01]

duration: 24min
completed: 2026-10-17
---

# Phase 2 Plan 06: Anmeldung ohne Aussperrung – Zusammenfassung

**Ein Gerät sperrt nur sich selbst aus: nginx setzt X-Forwarded-For selbst, die API zählt pro Geräteadresse (ForwardLimit 1, nur private Proxys); Refresh und Abmelden verbrauchen kein Login-Budget; ein Refresh-Fehler durch Limit, Server oder Netz meldet niemanden mehr ab. Dazu Integrationstests für Anmeldung, Refresh-Rotation und Geschwister-Trennung gegen echtes PostgreSQL.**

## Leistung

- **Dauer:** ca. 24 min (2026-10-17T20:04Z bis 20:28Z), Wartezeiten der Smoke-Läufe eingeschlossen
- **Tasks:** 3 von 3, dazu ein Commit für die Review-Befunde
- **Dateien:** 14 (4 neu, 10 geändert)

## Task-Commits

1. **Task 1: Tracer zwei Geräte hinter nginx** – `10fa425` (fix)
2. **Task 2: Traefik-Stack mit realip, Prüfskript, Konzept** – `88f3804` (fix)
3. **Task 3: Refresh-Fehler im Frontend, AuthEndpointTests, SiblingIsolationTests** – `4ec7820` (fix)
4. **Review-Befunde** – `8d080d8` (fix)

Vier Commits statt „ein atomarer Commit“ (Plan-Ziel, D-01): Der Ausführungsauftrag verlangt einen Commit je Task. Kein Push.

## TDD-Belege

**Task 1, Schritt 1 (RateLimitTests, vor dem Code):** `Failed: 4, Passed: 4`.
- Rot: `Locked_device_does_not_lock_another_device_behind_the_proxy` für 172.18.0.3 und 192.168.240.3 (Gerät B bekam 429), `Device_with_exhausted_login_budget_can_still_refresh` (429 statt 401), `Refresh_and_logout_are_never_rate_limited` („Refresh 6: 429“).
- Grün schon vorher: die beiden Bestandsfälle sowie `Forwarded_header_from_untrusted_sender…` und `Prepended_forwarded_value…`. Ohne ForwardedHeaders zählte nur die Verbindungs-IP, ein Kopf konnte gar nichts wählen. Diese zwei Fälle sichern ab, dass die neue Kopf-Auswertung keine Fälschung zulässt.
- Erster Anlauf: alle neuen Fälle 500. Ursache im Test, nicht im Code: TestServer meldet bei `SendAsync` ohne `IHttpRequestBodyDetectionFeature` „kein Body“ („Implicit body inferred … but no body was provided“). Behoben mit `ContentLength` und einem kleinen `HasBody`-Feature in der Testklasse.
- Danach: `Passed: 8, Failed: 0`, Build ohne Warnung (kein ASPDEPR005).

**Task 1, Schritt 2 (Install-Smoke, vor dem Code):** Lauf bis `DEMO-ABBRUCH OK`, dann `SMOKE FEHLER: Der zweite Absender bekommt kein 401: … HTTP/1.1 429 Too Many Requests`. Host-Sperre und gefälschter Kopf (429) waren schon vorher erfüllt, weil alle Absender einen Topf teilten.
- Danach grün: `RATE-LIMIT OK`, `SMOKE OK`.
- Tracer-Gate: Verify (Tests und Smoke) end-to-end grün, erst danach Task 2.

**Task 2, Schritt 1 (proxy-xff-check.sh, vor der Datei):**
- `Heimnetz: Absender 172.28.0.4, die API sieht 172.28.0.4` (grün nach Task 1, erwarteter Beleg)
- `PROXY-XFF FEHLER: frontend/nginx-traefik-realip.conf fehlt.`
- Danach: `Traefik: die API sieht 198.51.100.7`, `Traefik (private Geräteadresse): die API sieht 192.168.178.20`, `PROXY-XFF OK`.
- Mutation `real_ip_recursive on`: `PROXY-XFF FEHLER: … sieht die API '203.0.113.9' statt genau 192.168.178.20`. Zurückgesetzt.

**Task 3, Schritt 1 (vitest `api`, vor dem Code):** `4 failed | 10 passed (14)`.
- Rot: Refresh 429, Refresh 503, Netzfehler, gleichzeitige Anfragen. Bei 429 und 503 kam `Received: "Sitzung abgelaufen. Bitte neu anmelden."` (das detail der 401-Antwort). Beim Netzfehler warf `api()` einen TypeError statt eines ApiError.
- Danach: `14 passed`, lint und typecheck Exit 0.

**Task 3, Schritt 3 (Backend, Bestandsverhalten):** `AuthEndpointTests` 9 passed, `SiblingIsolationTests` 1 passed (zusammen `Passed: 10, Failed: 0`), sofort grün wie im Plan erwartet. Kein Defekt gefunden.

## Gate-Ergebnisse

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Backend Build + Tests (Stand `4ec7820`) | `bash .planning/phases/02-…/gate/backend-test.sh` (voll) | Build ohne Warnung (`/warnaserror`); Learning.Tests 110 passed, Api.Tests 211 passed, 0 failed |
| Frontend (Stand `4ec7820`) | `npm ci`, `lint`, `typecheck`, `build`, `test`, `design:check`, `design:classes` | alle Exit 0; Vitest 14 Dateien, 206 Tests; DESIGN.md `errors: 0, warnings: 0`; „keine alten Klassen“ |
| e2e (Stand `4ec7820`) | `npm run e2e:stack && npx playwright test`, danach `down -v` | 44 passed, 1 skipped (`first-run.spec.ts`, nur im Install-Smoke); kein 429 |
| Install-Smoke (Stand `8d080d8`) | `bash .planning/phases/01-…/smoke/setup-smoke.sh` | … `DEMO-ABBRUCH OK`, `RATE-LIMIT OK`, `SMOKE OK`, Exit 0 |
| Proxy-Kette (Stand `8d080d8`) | `bash .planning/phases/02-…/gate/proxy-xff-check.sh` | `PROXY-XFF OK` |
| Keine neue Dependency | `git diff --quiet 5aaf2f7 -- frontend/package.json frontend/package-lock.json backend/**/*.csproj` | Exit 0 |

Der Review-Commit `8d080d8` ändert nur Skripte, Doku und einen Compose-Kommentar. Smoke und Prüfskript liefen danach erneut.

Akzeptanz-Greps:
- `ForwardLimit = 1` vorhanden, `IPNetwork.Parse(` = 3, `KnownNetworks` = 0
- Reihenfolge `UseStatusCodePages` (175) → `UseForwardedHeaders` (177) → `UseRateLimiter` (189)
- `proxy_set_header X-Forwarded-For $remote_addr;` vorhanden, `proxy_add_x_forwarded_for` = 0, `DisableRateLimiting` = 2
- Smoke: `RATE-LIMIT OK`, `X-Forwarded-For: 10.9.9.9` und `web:8080/api/v1/auth/login` vorhanden, `|| true` = 4
- `set_real_ip_from` = 3, `real_ip_recursive off;` vorhanden, Volume-Zeile in `docker-compose.yml` vorhanden, `docker-compose.quick.yml` unverändert
- Konzept: `bekannter Fehler` = 0, `nginx-traefik-realip.conf` vorhanden; `Auth__RequestsPerMinute: "1000"` bleibt
- `describe('Token-Refresh'`, `new ApiError(GENERIC, response.status)`, `new ApiError(GENERIC, 0)`, `response.status === 401`, „Zu viele Versuche. Bitte in 15 Minuten nochmal probieren.“ und `sessions/sync` vorhanden

Container danach entfernt: Smoke (`wq-smoke`: 0), Prüfnetz (`wq-xff`: 0), e2e-Stack (`down -v`). `wq-p2-db` lief schon vor diesem Lauf und bleibt für das Backend-Gate stehen.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Regel 3 – blockierend] TestServer-Anfragen mit Body**
- **Gefunden bei:** Task 1, Schritt 1. Das Muster aus 02-RESEARCH („Integrationstest mit echter Client-IP“) führt mit Minimal APIs zu 500.
- **Fix:** `ContentLength` setzen und `IHttpRequestBodyDetectionFeature` mit `CanHaveBody = true` (private Klasse `HasBody` in `RateLimitTests`). Nur Testcode.
- **Commit:** `10fa425`

**2. [Regel 2 – Sicherheit] Zusätzlicher Prüffall „private Geräteadresse“ im Traefik-Prüfskript**
- Der Planfall (`203.0.113.9, 198.51.100.7`) ergibt mit `real_ip_recursive on` dasselbe Ergebnis, prüft die Einstellung also nicht. Im Heimnetz ist die Geräteadresse aber privat; mit `on` würde nginx sie überspringen und den vorangestellten Wert nehmen.
- **Fix:** zweiter Fall `203.0.113.9, 192.168.178.20` → genau `192.168.178.20`, per Mutation rot belegt.
- **Commit:** `88f3804`

**3. [Doku = Code] Token-Zeile im Konzept**
- Der Plan nennt das Konzept nur in Task 2. Das geänderte Frontend-Verhalten bei Refresh-Fehlern steht jetzt auch in der Token-Zeile (`api.ts`, FIX-01). Grundlage ist die AGENTS.md-Regel, dass Doku und Code in derselben Änderung übereinstimmen.
- **Commit:** `4ec7820`

**4. Testnamen**
- In `RateLimitTests` sind die Testnamen englisch, wie im Bestand der Klasse. Die neuen Klassen nutzen deutsche Namen wie `SessionEndpointTests` und `LearnerDeleteTests`.

## Review (AGENTS.md „Review“, D-02)

Geprüft hat eine unabhängige zweite Instanz (`claude -p`, nur Lesen: Read/Grep/Glob, `git diff/show/log`). Grundlage war der Diff `5aaf2f7..4ec7820` gegen FIX-01, QUAL-01 und AGENTS.md, Schwerpunkt Header-Spoofing und Vertrauensgrenzen. Der Reviewer hat nichts ausgeführt.

Ergebnis: kein HIGH. Ohne Befund geprüft:
- Spoofing in beiden Topologien und die Reihenfolge der Middleware
- `X-Real-IP` (die API wertet ihn nicht aus)
- Frontend-Refresh mit `refreshInFlight`
- Tests (kein falsch-grüner Fall gefunden), keine neue Dependency, Kommentarsprache

| # | Schwere | Befund | Umgang |
|---|---|---|---|
| 1 | MEDIUM | Der Smoke-Block belegt nicht, dass nginx zwei echte Heimnetz-Geräte unterscheidet: Host-Anfragen kommen über docker-proxy, der zweite Absender ist ein Container. | Behoben (`8d080d8`): Der Kommentar nennt, was der Block belegt (je Absenderadresse ein eigener Topf über nginx). Zwei echte Geräte bleiben manuelle Prüfung (siehe unten). |
| 2 | MEDIUM | `git diff --quiet HEAD -- docker-compose.quick.yml` erkennt nur nicht committete Änderungen; ein committeter realip-Mount im Heimnetz-Stack käme durch. | Behoben (`8d080d8`): zusätzlich `docker compose -f docker-compose.quick.yml config` ohne `realip`. Mit einem mutierten Compose-File findet `grep -c realip` 2 Treffer, das Skript würde scheitern. |
| 3 | LOW | Die Grenze „userland-proxy“ im Konzept war ungenau: Bei IPv4 aus dem LAN bleibt die Absenderadresse per DNAT erhalten. | Behoben: Die Grenze nennt jetzt Docker Desktop, Rootless Docker und IPv6 auf ein Compose-Netz nur mit IPv4. |
| 4 | LOW | Mit mehreren Adressen hat ein Angreifer n×10 Passwortversuche pro Minute; für das Elternpasswort gibt es keine Sperre pro Konto. | Als Restrisiko akzeptiert (folgt aus der Anforderung „pro Gerät“), im Konzept benannt. |
| 5 | LOW | `traefik:v3` ist ein fließender Tag; der Spoofing-Schutz hängt am Traefik-Standard ohne `trustedIPs`. | Kommentar an `proxy` in `docker-compose.yml`, die Optionen nie zu setzen. Eine feste Version wird zurückgewiesen: Das ist eine Betriebsentscheidung außerhalb von FIX-01 und eine Frage für Phase 3. |
| 6 | LOW | Refresh und Abmelden ohne Limit erlauben beliebig viele DB-Abfragen pro Gerät. | Ohne Änderung akzeptiert (T-02-24): nur aus dem Heimnetz bzw. hinter Traefik erreichbar, je Aufruf ein SHA256 und ein Index-Lookup. |

## Nur manuell prüfbar (02-VALIDATION Manual-Only)

- **Traefik-Stack mit Zertifikat:** Dass Traefik v3 ohne `forwardedHeaders.trustedIPs` eingehende X-Forwarded-For-Köpfe verwirft und die Geräteadresse setzt, ist eine Annahme. `proxy-xff-check.sh` simuliert Traefik nur durch einen Absender im Prüfnetz. UNBEKANNT: Verhalten im echten Traefik-Stack mit Let's-Encrypt-Zertifikat.
- **Zwei echte Geräte im Heimnetz:** Gerät A mit 10 Fehlversuchen gesperrt, Gerät B meldet sich in derselben Minute an. Belegt sind TestServer-Fälle, der Smoke mit zwei Absendern und das Prüfskript, nicht die Adressen echter Tablets hinter Docker auf dem Heimserver. UNBEKANNT: Ergebnis am Raspberry Pi bzw. NAS.

## Bekannte Grenzen und Hinweise

- **Phase 3:** Der Traefik-Stack braucht `frontend/nginx-traefik-realip.conf` neben `docker-compose.yml`. Fehlt die Datei, legt Docker ein Verzeichnis an, und nginx startet nicht. Das ist ein lauter Fehler, kein stiller Rückfall.
- **Smoke-Fenster:** Das Limit ist ein festes Fenster von einer Minute. Fällt der Fensterwechsel genau in die Schleife des FIX-01-Blocks (11 Anfragen in unter einer Sekunde), bräuchte der Host mehr als 11 Versuche, und der Smoke scheitert. Geschätzt (nicht gemessen) liegt die Wahrscheinlichkeit bei etwa 1–2 %. Bewusst nicht abgefangen, weil der Plan „spätestens beim 11. Versuch“ verlangt.
- **Außerhalb des Auftrags gesehen:** Im TestServer ergab eine POST-Anfrage, die als „ohne Body“ gilt, an einen Endpunkt mit Body-Parameter über `UseExceptionHandler` eine 500 (`BadHttpRequestException`). UNBEKANNT: ob eine echte Anfrage mit `Content-Length: 0` im Betrieb ebenso 500 statt 400 ergibt. Nicht geändert, als Kandidat für eine spätere Prüfung vermerkt.

## Bedrohungen

Keine neue Angriffsfläche außerhalb des `<threat_model>`. T-02-22, T-02-23, T-02-26, T-02-27 und T-02-36 sind durch Tests, Smoke und Prüfskript abgedeckt. T-02-24 und T-02-25 sind wie geplant akzeptiert. Neu benannt und akzeptiert ist Review-Befund 4 (mehrere Adressen).

## Self-Check: PASSED
