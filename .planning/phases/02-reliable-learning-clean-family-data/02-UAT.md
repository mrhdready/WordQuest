---
status: testing
phase: 02-reliable-learning-clean-family-data
source: [02-VERIFICATION.md, 02-VALIDATION.md]
started: 2026-10-17T22:00:00Z
updated: 2026-10-17T22:00:00Z
---

## Current Test

number: 1
name: Dialoge auf dem Tablet und bei 200 % Browser-Zoom nur mit der Tastatur
expected: |
  Je Dialog (Kind löschen, Set umbenennen, Set löschen, Vokabel bearbeiten, Vokabel löschen): Tab-Reihenfolge stimmt, Fokus sichtbar, Esc schließt, Enter auf „Abbrechen“ löscht nicht, Fehlerfall lesbar, Fokus bleibt nach einem Fehler im Dialog
awaiting: user response

## Tests

### 1. Dialoge auf dem Tablet und bei 200 % Browser-Zoom nur mit der Tastatur
expected: Je Dialog (Kind löschen, Set umbenennen, Set löschen, Vokabel bearbeiten, Vokabel löschen): Tab-Reihenfolge stimmt, Fokus sichtbar, Esc schließt, Enter auf „Abbrechen“ löscht nicht, Fehlerfall lesbar, Fokus bleibt nach einem Fehler im Dialog; mit langen Namen
result: [pending]

### 2. Zwei echte Geräte im Heimnetz (Schnellstart-Stack)
expected: Gerät A gibt elfmal ein falsches Elternpasswort ein → „Zu viele Versuche. Bitte in einer Minute nochmal probieren.“; Gerät B meldet sich in derselben Minute an → klappt
result: [pending]

### 3. Traefik-Stack mit Zertifikat
expected: Wie Test 2 über `docker-compose.yml` mit Domain; zusätzlich von Gerät A `curl` mit `X-Forwarded-For: 10.9.9.9` → weiterhin 429
result: [pending]

### 4. Migration auf einem Raspberry Pi 5 mit bestehender Phase-1-Installation
expected: Sicherung vorhanden, Images neu gebaut, `docker compose up -d`; API startet, Log zeigt die Migration `ReferentialIntegrity` ohne Fehler, Kinder lernen weiter, ein Testkind lässt sich löschen
result: [pending]

### 5. Serie über einen echten Tageswechsel
expected: Kind lernt an Tag 1, setzt Tag 2 und 3 aus (ohne Retter im Monat) → Kind sieht „Starte heute deine Serie!“, Eltern sehen „Keine laufende Serie“
result: [pending]

### 6. Bewertung und Terminierung nur durch den Server
expected: Beim Lernen im Browser (DevTools → Netzwerk) schickt das Frontend nur die Antwort; Bewertung, XP und nächster Termin kommen aus der Server-Antwort
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

[none yet]
