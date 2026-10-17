---
status: testing
phase: 01-safe-home-network-install
source: [01-VERIFICATION.md]
started: 2026-10-17T12:00:00Z
updated: 2026-10-17T12:00:00Z
---

## Current Test

number: 1
name: Aktiver Tab der Tab-Leiste im Elternbereich ohne Farbwahrnehmung (z. B. Graustufen-Filter) bei 320 px und 640 px
expected: |
  Aktiver Tab an eigener Fläche bzw. Form erkennbar, nicht nur an der Farbe
awaiting: user response

## Tests

### 1. Aktiver Tab der Tab-Leiste im Elternbereich ohne Farbwahrnehmung (z. B. Graustufen-Filter) bei 320 px und 640 px
expected: Aktiver Tab an eigener Fläche bzw. Form erkennbar, nicht nur an der Farbe
result: [pending]

### 2. Leere Zustände ansehen: frische Installation, /verwalten und /verwalten/kinder ohne Sets und Kinder, Set ohne Einträge
expected: EmptyState im Token-Design, optisch stimmig
result: [pending]

### 3. Liquid-Glass-Effekt auf einem echten Tablet (Safari/Chrome) und mit „Transparenz reduzieren“
expected: Glasflächen lesbar, kein Ruckeln am Ziffernfeld; bei reduzierter Transparenz deckender Fallback
result: [pending]

### 4. Kind mit 100-Zeichen-Namen anlegen und die Anmelde-Kachel auf / ansehen, auch bei 200 % Zoom
expected: Name bricht in der Kachel um, wird nie abgeschnitten, Kachel bleibt bedienbar
result: [pending]

### 5. Raspberry Pi 5: ./setup.sh auf frischem Klon ausführen
expected: Abschlusszeile nennt http://<LAN-IP>:8080 (Ausgabe von hostname -I), Login dort mit dem eingegebenen Konto klappt
result: [pending]

### 6. Raspberry Pi 5: Backup-Dienst über mindestens einen Tageswechsel laufen lassen
expected: backups/daily/wordquest-<Datum>.sql.gz entsteht automatisch, gzip -t ok, Rotation 14/8/6 greift später
result: [pending]

### 7. FIX-07: dieselbe Lernantwort zweimal senden (gleiche clientAnswerId) und Stack neu starten
expected: Antwort zählt einmal; Lernstand nach docker compose restart unverändert
result: [pending]

### 8. Prohibitions (judgment-tier) bestätigen: PIN-Länge nie verraten; neue Kindertexte ohne „PIN“; falsche Antworten ohne Alarm-Optik; Reset-Passwort nur einmal ausgegeben, nie geloggt; Kind bearbeiten ändert keine Lerndaten; Kind anlegen fragt keine weiteren Personendaten ab
expected: Alle sechs Verbote halten
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
