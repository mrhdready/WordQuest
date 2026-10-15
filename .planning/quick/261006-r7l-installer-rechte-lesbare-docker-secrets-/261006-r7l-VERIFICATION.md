---
task: 261006-r7l
status: partial
date: 2026-10-06
---

# Verifikation des Teilstands

## Regressionen

| Prüfung | Vor dem Fix | Nach dem Fix |
|---------|-------------|--------------|
| `node smoke.mjs --installer` | Exit 1: Ausführungsbit fehlt, neue und bestehende Secrets nicht 0644 | Exit 0: fünf Checks wahr; Ausführung, neue/bestehende Rechte, Verzeichnis 0700, Inhaltserhalt |
| `node smoke.mjs --secrets` | Exit 1: tatsächlicher Non-Root-API-Container kann Secrets nicht lesen | Exit 0: beide read-only Mounts lesbar, nicht schreibbar, Benutzer nicht root |

Aufrufverzeichnis für beide Befehle: dieses Quick-Verzeichnis.
Der Secret-Test benötigt Docker und das lokale Image
`wordquest-quickfix-api:local`, gebaut mit
`docker build -f backend/Dockerfile -t wordquest-quickfix-api:local .`
aus dem Repository-Root (Exit 0).

## Projekt-Gate

Die Befehle liefen in frischen Containern mit read-only Quellmount und
temporärer Arbeitskopie. Backend: `mcr.microsoft.com/dotnet/sdk:10.0`;
Frontend: `node:22-alpine`. Auf dem Host fehlt das .NET-SDK.

| Befehl | Beobachtung |
|--------|-------------|
| `dotnet build backend/WordQuest.slnx -c Release /warnaserror` | Exit 0, 0 Warnungen, 0 Fehler |
| `dotnet test backend/WordQuest.slnx -c Release` | Exit 0, 104 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| `npm ci` im Frontend | Exit 0; Registry meldet weiterhin 2 bekannte Dev-Dependency-Befunde, keine Dependency geändert |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0 |
| `bash -n setup.sh` | Exit 0 |
| `node --check smoke.mjs` | Exit 0 |
| `git diff --check` | Exit 0 |
| `git diff --summary` | Moduswechsel für setup.sh: 100644 → 100755 |

Zusätzliche Dokumentprüfung mit Python-Standardbibliothek: 8 geänderte/neue
Markdown-Dateien, 5 relative Links gültig; Whitespace und Code-Fences gültig,
Exit 0. Keine neue externe URL oder kein Diagramm ergänzt. Die neuen Aussagen
zu Secret-Rechten sind gegen `setup.sh` und die Regressionen abgeglichen;
Prüfergebnisse gegen die Ausgaben der oben genannten Läufe.

Prüfprotokolle: `/private/tmp/wordquest-quickfix-backend-gate.log`,
`/private/tmp/wordquest-quickfix-frontend-gate.log` und
`/private/tmp/wordquest-quickfix-api-build.log`. Temporäre Logs sind keine
dauerhafte Repo-Quelle; die wiederholbaren Befehle stehen oben.

## Review und offene Gates

Ein unabhängiger Subagent prüfte Installer und Smoke-Test gegen die Kriterien.
Ein Fehler im Testablauf wurde korrigiert: Rechte neuer Dateien werden nun
vor dem Wiederholungsaufruf gemessen. Keine offenen Code-Findings.

Kein Formatter ist im Projekt konfiguriert oder lokal verfügbar;
Whitespace-/Syntax-Prüfung ersetzt keinen Formatter. Eine neue Installation
wurde nicht vorgenommen. Der Formatter-Nachweis bleibt offen.

Keine sichtbare UI wurde geändert. Der HTTP-/Persistenztest und axe,
Tastatur, Zoom sowie DESIGN-Lint/-Export des endgültigen Designs stehen aus.
Der temporäre Bestandsentwurf wurde mit `@google/design.md 0.4.0` geprüft:
0 Fehler, 13 Warnungen, davon 6 blockierende Kontrast-Warnungen.
Die Exit-0-Ausgabe wird deshalb nicht als bestandenes Design-Gate gewertet.

## HTTP-Lernfix (FIX-07), 2026-10-15

Isolierter Teststack (eigenes Compose-Projekt, eigenes Volume, Demo-Daten),
Images aus dem Arbeitsbaum gebaut. Browser: Playwright-Chromium auf dem Host,
Origin `http://192.168.0.158:18080` (LAN-IP, nicht localhost).
`isSecureContext=false`, `typeof crypto.randomUUID === "undefined"`.

| Prüfung | Vor dem Fix | Nach dem Fix |
|---------|-------------|--------------|
| Eltern-Login, `GET /api/v1/sets` | 200 mit `[]`, obwohl 1 Demo-Set mit 32 Vokabeln in der DB | 200, Demo-Set geliefert |
| Kind, `GET /learners/{id}/overview` | 404 | 200, Lernstart zeigt das Set |
| Antwort per Button | Meldung „crypto.randomUUID is not a function“, kein POST | POST 200, Feedback „Fast! Es heißt: Hund“ |
| Falsche Antwort (Retry) | POST 500, `DbUpdateConcurrencyException` | 200, Retry-Karte mit eigener `itemId` angehängt |
| Antwort per Enter | (gleicher Pfad wie Button) | POST 200, „Richtig! +10 XP“ |
| Body | — | `clientAnswerId` = `itemId` (Request-Body gelesen) |
| Dieselbe Antwort erneut senden | — | 200, `xpAwarded` 0, `retryItem` null, XP 10 → 10 |
| Retry-Karte beantworten | — | 200, eigene ID; Runde abgeschlossen (`/complete` 200) |
| Web-Healthcheck | `unhealthy` (wget auf `localhost` → `::1`) | `healthy` |

Datenbank nach der Runde: 6 Review-Logs, 6 beantwortete Items, alle mit
`client_answer_id = id`, 6 verschiedene IDs, XP/Münzen 90/25. Nach
`docker compose restart` ohne Volume-Löschung derselbe Stand (Diff leer);
im Browser nach Neuladen „Noch 190 XP bis Level 2“, 🪙 25, Streak 1 Tag.

Projekt-Gate in Containern (Host ohne .NET-SDK):

| Befehl | Ergebnis |
|--------|----------|
| `dotnet build backend/WordQuest.slnx -c Release /warnaserror` | 0 Warnungen, 0 Fehler |
| `dotnet test backend/WordQuest.slnx -c Release` | 104 bestanden, 0 fehlgeschlagen |
| `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` | jeweils Exit 0 |

Review: unabhängiger Subagent über die Änderungen an `Program.cs`,
`LearningService.cs` und `SessionPage.tsx`; keine blockierenden Befunde.
Hinweise: fehlende Regressionstests (QUAL-01), 500 bei gleichzeitigen
Doppel-Antworten (FIX-04). Die Healthcheck-Zeile entstand nach dem Review.

Offen: axe auf `/lernen` (kein Werkzeug vorhanden, Freigabe nötig).
Tastatur: Enter-Pfad geprüft. 200 % Zoom nicht geprüft; die Seite ist optisch
unverändert.
