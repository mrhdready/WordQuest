---
task: 261006-r7l
status: partial
date: 2026-10-15
requirements_completed: [SETUP-06, FIX-07]
requirements_pending: []
commit: null
---

# Installer und Secrets: geprüfter Teilstand

`setup.sh` ist im Arbeitsbaum ausführbar (Moduswechsel `100644 → 100755`).
Beide Secret-Dateien erhalten nach Erzeugung oder Wiederverwendung `0644`;
das Hostverzeichnis bleibt `0700`. Bestehende Inhalte werden erhalten.

Die wiederholbaren Prüfungen liegen in `smoke.mjs`. Der Installer-Test nutzt
einen temporären Docker-Stub. Der Secret-Test nutzt das aus dem Arbeitsbaum
gebaute API-Image mit dessen tatsächlichem Non-Root-Benutzer und einzelnen
read-only Dateimounts. Er gibt keine Secret-Inhalte aus.

Beide Regressionen waren vor dem Fix rot und sind danach grün.
Das Projekt-Gate ist grün: Backend-Build ohne Warnungen/Fehler,
104 bestandene Tests, Frontend-Lint, Typecheck und Build erfolgreich.
Im unabhängigen Review wurde ein Testbefund behoben; keine offenen Findings.
Der Reviewer konnte den Docker-Test wegen seiner Socket-Sandbox nicht selbst
wiederholen; der Hauptagent hat den roten und grünen Lauf ausgeführt.

## HTTP-Lernfix (FIX-07, 2026-10-15)

`DESIGN.md` liegt seit Commit `490daac` vor. Der Lernfix selbst ändert keine
sichtbare Oberfläche.

- `SessionPage.tsx`: `clientAnswerId` ist die Item-ID statt
  `crypto.randomUUID()`, das bei `isSecureContext=false` fehlt.
- Zwei weitere Defekte blockierten das Lernen auf jeder frischen Installation
  und wurden mit behoben:
  - `Program.cs`: `MapInboundClaims = false`. Ohne das benennt JwtBearer den
    Claim `tid` um, der Mandantenfilter findet nichts, Eltern und Kind sehen
    leere Daten.
  - `LearningService.cs`: Die Retry-Karte wird per `db.SessionItems.Add`
    registriert. Vorher führte jede falsche Antwort zu HTTP 500
    (`DbUpdateConcurrencyException`).
- `frontend/Dockerfile`: Healthcheck auf `127.0.0.1` statt `localhost`; der
  Web-Container war sonst dauerhaft `unhealthy` (IPv6 vs. IPv4).

Alle Fehler waren im echten Browser über `http://192.168.0.158:18080`
(isolierter Teststack) rot und sind grün. Details: Verifikation.

## Offen

- axe auf `/lernen`: kein axe-Werkzeug im Projekt oder lokal; Prüfwerkzeug
  braucht Freigabe. Die Lernseite ist optisch unverändert.
- Formatter: im Projekt keiner konfiguriert.
- Regressionstests für die drei Backend-/Frontend-Fehler fehlen; ein
  Integrationstest-Projekt kommt erst mit QUAL-01 (Phase 2). Gleichzeitige
  Doppel-Antworten enden am Unique-Index mit 500 statt 4xx; das deckt FIX-04.
`SETUP-01` bleibt offen; Konten, HTTP-Installer und Backups gehören nicht zum
hier erledigten Teil. Kein Commit, Push oder Staging für den Quick-Block.

## Abweichungen vom Plan

Der Quick-Block wird nicht als vollständig abgeschlossen markiert.
`README.md` dokumentiert die Secret-Rechte; der Konzepttext zur Antwort-ID
wird erst zusammen mit dem noch offenen HTTP-Fix geändert.
Die Roadmap-Anforderungszuordnung wurde für die beiden freigegebenen IDs
ergänzt. Der nächste Startpunkt ist dieser Teilstand, nicht Task 1 von vorn.

Nachweise: [Verifikation](261006-r7l-VERIFICATION.md),
[unabhängiges Review](261006-r7l-REVIEW.md).
