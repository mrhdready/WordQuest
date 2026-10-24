---
status: testing
phase: 01-safe-home-network-install
source: [01-VERIFICATION.md]
started: 2026-10-17T12:00:00Z
updated: 2026-10-24T21:30:00Z
---

## Current Test

number: 6
name: Raspberry Pi 5: Backup-Dienst über mindestens einen Tageswechsel laufen lassen
awaiting: Tageslauf um 02:00 MESZ (Container-Zeitzone UTC)

## Tests

### 1. Aktiver Tab der Tab-Leiste im Elternbereich ohne Farbwahrnehmung (z. B. Graustufen-Filter) bei 320 px und 640 px
expected: Aktiver Tab an eigener Fläche bzw. Form erkennbar, nicht nur an der Farbe
result: pass
note: Agent-UAT 2026-10-24 per Playwright mit Graustufen-Filter bei 320 und 640 px; der aktive Tab hat eine eigene weisse Kapsel und bleibt ohne Farbe erkennbar.

### 2. Leere Zustände ansehen: frische Installation, /verwalten und /verwalten/kinder ohne Sets und Kinder, Set ohne Einträge
expected: EmptyState im Token-Design, optisch stimmig
result: pass
note: Agent-UAT 2026-10-24 auf frischer Installation (Debian 13 arm64 als Ersatz fuer den Pi). Kosmetisch: Die Kinderwahl ohne Kinder zeigt reinen Text statt einer Karte; bei Telefonbreite bricht die Tab-Leiste mit dem Plus-Knopf in zwei Zeilen um.

### 3. Liquid-Glass-Effekt auf einem echten Tablet (Safari/Chrome) und mit „Transparenz reduzieren“
expected: Glasflächen lesbar, kein Ruckeln am Ziffernfeld; bei reduzierter Transparenz deckender Fallback
result: pass
note: Nur emuliert (CDP prefers-reduced-transparency, CPU-Drosselung): undurchsichtiger Fallback greift. Ruckeln auf einem echten Tablet ist nicht gemessen und bleibt fuer Dennis offen.

### 4. Kind mit 100-Zeichen-Namen anlegen und die Anmelde-Kachel auf / ansehen, auch bei 200 % Zoom
expected: Name bricht in der Kachel um, wird nie abgeschnitten, Kachel bleibt bedienbar
result: pass
note: Agent-UAT 2026-10-24 bei 1024 px, 200 % Zoom und 320 px: Name bricht um, nichts laeuft ueber; bei 320 px Trennung mitten im Wort.

### 5. Raspberry Pi 5: ./setup.sh auf frischem Klon ausführen
expected: Abschlusszeile nennt http://<LAN-IP>:8080 (Ausgabe von hostname -I), Login dort mit dem eingegebenen Konto klappt
result: pass
note: Ersatz fuer den Pi: Debian 13 aarch64 VM. setup.sh nennt als Adresse den ersten Eintrag aus hostname -I (http://10.0.2.15:8080), Anmeldung darueber klappt.

### 6. Raspberry Pi 5: Backup-Dienst über mindestens einen Tageswechsel laufen lassen
expected: backups/daily/wordquest-<Datum>.sql.gz entsteht automatisch, gzip -t ok, Rotation 14/8/6 greift später
result: [pending]

### 7. FIX-07: dieselbe Lernantwort zweimal senden (gleiche clientAnswerId) und Stack neu starten
expected: Antwort zählt einmal; Lernstand nach docker compose restart unverändert
result: pass
note: Agent-UAT 2026-10-24: doppelte Antwort einmal gezaehlt, Stand nach Neustart unveraendert. LOW: Die Wiederholungs-Antwort liefert retryItem und message leer und 0 XP (bewusst, LearningService).

### 8. Prohibitions (judgment-tier) bestätigen: PIN-Länge nie verraten; neue Kindertexte ohne „PIN“; falsche Antworten ohne Alarm-Optik; Reset-Passwort nur einmal ausgegeben, nie geloggt; Kind bearbeiten ändert keine Lerndaten; Kind anlegen fragt keine weiteren Personendaten ab
expected: Alle sechs Verbote halten
result: pass
note: Agent-UAT 2026-10-24: alle PINs vierstellig, Kindertexte ohne „PIN“ ausser dem geplanten Servertext „Die PIN stimmt nicht.“, falsche Antwort ruhig („Fast!“), Kind bearbeiten laesst Lerndaten unveraendert, Anlegen fragt nur Name, Avatar, Karten pro Tag und PIN. Nicht eigens geprueft: Reset-Passwort nicht im Log.

## Summary

total: 8
passed: 7
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
