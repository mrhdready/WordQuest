---
phase: quick-261025-fd0
plan: "01"
subsystem: docs
tags: [installation, heimnetz, dhcp, mdns, rel-03]
status: complete
requires: []
provides: ["Documentation/Installation.md: ### Feste Adresse im Heimnetz, Verweis nach hostname -I, Hilfe-Eintrag „Die Adresse geht nicht mehr.“"]
affects: [Documentation/Installation.md]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified: [Documentation/Installation.md]
decisions:
  - "Unterabschnitt als ### am Ende von ## Installation (vor ## Update), damit die D-09-##-Liste des Release-Smokes gleich bleibt und die Absätze nach hostname -I nicht unter den neuen Abschnitt rutschen; direkt nach hostname -I steht ein Verweis-Satz."
  - "Review-Befund LOW 2 übernommen: nach der Reservierung das Gerät einmal neu starten, dann hostname -I prüfen (alle vier Dienste in docker-compose.quick.yml haben restart: unless-stopped)."
requirements: [REL-03]
metrics:
  completed: 2026-10-25
actuals:
  tokens: 650
  tasks: 2
  commits: 1
plan_head_before: bf0ab063671622bdf206f4953a8c4b37912a22b1
plan_head_after: 2d605da12e0baee7b2cda7e175fa375af2febb97
---

# Quick 261025-fd0: Installationsseite – feste Adresse im Heimnetz Summary

Die Installationsseite erklärt jetzt, wie WordQuest nach einem Router-Neustart erreichbar bleibt: DHCP-Reservierung im Router (FRITZ!Box-Weg plus Begriffe anderer Router), Alternative per `<Gerätename>.fritz.box` bzw. `.local` mit Grenzen, Anmeldung je Adresse, dazu ein Hilfe-Eintrag „Die Adresse geht nicht mehr.“

## Commit

- `2d605da` docs: Installationsseite erklärt feste Adresse im Heimnetz (nur `Documentation/Installation.md`, +13/−1; Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; kein Push)

## Änderungen (Documentation/Installation.md)

- Zeile 81: Verweis-Satz mit `[Feste Adresse im Heimnetz](#feste-adresse-im-heimnetz)` am Ende des `hostname -I`-Absatzes.
- Zeile 105–113: `### Feste Adresse im Heimnetz` mit vier Absätzen (Warum/DHCP, Router-Reservierung + keine feste Adresse am Gerät, Name per `.fritz.box`/`.local` ohne Garantie + Port, Anmeldung gilt nur für die Adresse).
- Zeile 243: `**Die Adresse geht nicht mehr.**` unter „Hilfe bei Problemen“ mit `hostname -I`, Port, Lesezeichen und Link.
- README.md, setup.sh, release-smoke.sh, DESIGN.md unberührt.

## Checks

Task-1-Check (Befehl aus dem Plan, nach den Review-Korrekturen erneut):

```
ADRESSE-DOKU OK
exit=0
```

Commit-Check aus Task 2:

```
COMMIT OK
```

Release-Smoke, Seitenabgleich (`release-smoke.sh` 1077–1113): Der Abschnitt lässt sich nicht isoliert ausführen, weil er `.smoke/page-cmds` und `.smoke/*.log` aus dem vollständigen Docker-Lauf braucht. Die statischen Prüfungen daraus (Zeilen 1077–1094) wurden wörtlich gegen die Seite ausgeführt; für den Teil, der Logs braucht (1095–1112), wurde belegt, dass alle Zeilen in Codeblöcken identisch zu `bf0ab06` sind (dort war der Lauf grün):

```
D09 sections OK
bash/text per section OK
unsafe strings checked
block languages OK
code block lines identical to bf0ab06 (88 lines)
SEITE (statisch) OK
exit=0
```

Code-Gate nicht ausgeführt: Der Diff berührt nur eine Markdown-Datei unter `Documentation/` (letzte Bedingung des Task-1-Checks: außerhalb `.planning` nur diese Datei geändert). `dotnet build/test`, das Frontend-Gate und `npm run design:check` lesen `Documentation/` nicht. Keine UI-Änderung, daher kein axe-Lauf.

## Review

Weg: kein Subagent-Werkzeug in der Ausführungsumgebung, daher unabhängige Instanz `claude -p` mit nur lesenden Werkzeugen (Read, Grep, Glob, `git diff/show`, `sed -n`, `grep`; Edit/Write gesperrt). Eingabe: must_haves, „Anforderung des Eigentümers“ und „Faktenprüfung“ wörtlich aus dem Plan, Prüfauftrag (a)–(f), Diff `git diff bf0ab06 -- Documentation/Installation.md`. Ergebnis: kein BLOCKER/HIGH/MEDIUM; (b), (d), (e), (f) ohne Befund, (a) alle Codefakten bestätigt.

| # | Schwere | Ort | Befund | Entscheidung |
|---|---------|-----|--------|--------------|
| 1 | LOW | Installation.md:243 | „Eintrag, der mit `192.168.` beginnt“ ohne „meist“, widerspricht Zeile 81 bei Netzen wie `10.x` | Behoben: „der meist mit `192.168.` beginnt“ |
| 2 | LOW | Installation.md:109 | `hostname -I` direkt nach der Reservierung prüft wenig, manche Router übernehmen die Reservierung erst bei der nächsten Vergabe | Behoben: „Starte das Gerät danach einmal neu und prüfe mit `hostname -I` …“ (Neustart unkritisch, `restart: unless-stopped` in docker-compose.quick.yml:39/67/75/95) |
| 3 | LOW | Installation.md:81 | Wortstellung „nicht später ändert“ holprig | Behoben: „später nicht ändert“ |
| 4 | INFO | Installation.md:111 | `.fritz.box`-Name entspricht dem Namen in der FRITZ!Box, nicht zwingend `hostname` | Keine Änderung: Abschnitt sagt ausdrücklich „nicht auf jedem Gerät garantiert“ |
| 5 | INFO | Installation.md:113 | Profilauswahl ohne Anmeldung gilt laut Kommentar in AuthEndpoints.cs nur bei einem Mandanten | Keine Änderung: Heimbetrieb hat einen Mandanten; Aussage stimmt |

Reviewer-Hinweis: Android/VPN und der FRITZ!Box-Optionstext wurden vom Reviewer nicht gegen eine Quelle geprüft, sondern decken sich wörtlich mit der Faktenprüfung des Plans (Websuche in der Planungssitzung).

## Faktenbelege

- Keine Host-Beschränkung: `frontend/nginx.conf:3` `server_name _;`, `backend/src/WordQuest.Api/appsettings.json:9` `"AllowedHosts": "*"`.
- `docker-compose.quick.yml:71-72` nur `"${WQ_PORT:-8080}:8080"`, keine Host-Regel.
- Adresse in „Fertig.“: `setup.sh:182-184` (erster Eintrag `hostname -I`, sonst `hostname`, Port `WQ_PORT`/8080).
- Anmeldung je Herkunft: `frontend/src/lib/api.ts:37-60` (tokenStore im localStorage).
- Profilauswahl ohne Anmeldung: `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs:19`.
- mDNS auf Raspberry Pi OS (Avahi), FRITZ!Box-Option, Android-`.local`: Quellen aus der Planungssitzung, keine URL in der Doku.

## Deviations from Plan

- Review per `claude -p` statt Subagent (im Plan als Fallback vorgesehen).
- Review-Befund 2 ergänzt einen Neustart vor der `hostname -I`-Prüfung; über den Plantext hinaus, aber in der Anforderung („Danach Lesezeichen neu setzen, falls die Adresse sich geändert hat“) gedeckt.

## Known Stubs

Keine.

## Self-Check: PASSED

- FOUND: Documentation/Installation.md (`### Feste Adresse im Heimnetz` Zeile 105)
- FOUND: 2d605da (Vorfahre von HEAD)
