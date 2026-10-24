---
status: complete
phase: 02-reliable-learning-clean-family-data
source: [02-VERIFICATION.md, 02-VALIDATION.md]
started: 2026-10-17T22:00:00Z
updated: 2026-10-24T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dialoge auf dem Tablet und bei 200 % Browser-Zoom nur mit der Tastatur
expected: Je Dialog (Kind löschen, Set umbenennen, Set löschen, Vokabel bearbeiten, Vokabel löschen): Tab-Reihenfolge stimmt, Fokus sichtbar, Esc schließt, Enter auf „Abbrechen“ löscht nicht, Fehlerfall lesbar, Fokus bleibt nach einem Fehler im Dialog; mit langen Namen
result: pass
note: Agent-UAT 2026-10-24 bei Tablet-Breite und 200 % mit langen Namen, Fehlerfall und nur Tastatur.

### 2. Zwei echte Geräte im Heimnetz (Schnellstart-Stack)
expected: Gerät A gibt elfmal ein falsches Elternpasswort ein → „Zu viele Versuche. Bitte in einer Minute nochmal probieren.“; Gerät B meldet sich in derselben Minute an → klappt
result: pass
note: Zwei Absender-Adressen auf der VM: 10.0.2.15 bekam 429, 172.21.0.1 gleichzeitig 200.

### 3. Traefik-Stack mit Zertifikat
expected: Wie Test 2 über `docker-compose.yml` mit Domain; zusätzlich von Gerät A `curl` mit `X-Forwarded-For: 10.9.9.9` → weiterhin 429
result: pass
note: Ersatz ohne echtes Let's-Encrypt-Zertifikat (Traefik-Standardzertifikat). Geraet A 429, gefaelschtes X-Forwarded-For weiter 429, Geraet B 200. Echtes Zertifikat bleibt fuer Dennis offen.

### 4. Migration auf einem Raspberry Pi 5 mit bestehender Phase-1-Installation
expected: Sicherung vorhanden, Images neu gebaut, `docker compose up -d`; API startet, Log zeigt die Migration `ReferentialIntegrity` ohne Fehler, Kinder lernen weiter, ein Testkind lässt sich löschen
result: pass
note: Phase-1-Stand c3534f1 auf der VM gebaut, dann v1.0.0: Migrationen ReferentialIntegrity und VocabularyPictures ohne Fehler; 8 Karten, 8 Lernstaende, 8 Logs erhalten; Anna lernt weiter (120 → 150 XP); Testkind loeschen 204.

### 5. Serie über einen echten Tageswechsel
expected: Kind lernt an Tag 1, setzt Tag 2 und 3 aus (ohne Retter im Monat) → Kind sieht „Starte heute deine Serie!“, Eltern sehen „Keine laufende Serie“
result: pass
note: Tageswechsel per Datenbank simuliert (last_active = heute − 3, keine Schoner): Kind sieht „Starte heute deine Serie!“, Eltern „Keine laufende Serie“. Echter Tageswechsel nicht abgewartet.

### 6. Bewertung und Terminierung nur durch den Server
expected: Beim Lernen im Browser (DevTools → Netzwerk) schickt das Frontend nur die Antwort; Bewertung, XP und nächster Termin kommen aus der Server-Antwort
result: pass
note: Anfragen tragen nur givenAnswer, answerMs und IDs; Bewertung, XP und richtige Antwort kommen vom Server.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
