---
status: testing
phase: 03-installable-1-0-0-release
source: [03-VERIFICATION.md, 03-VALIDATION.md]
started: 2026-10-18T12:00:00Z
updated: 2026-10-18T12:00:00Z
---

## Current Test

number: 1
name: Veröffentlichung der Images 1.0.0
expected: |
  `master` hat den Stand von `v1-fertig`, das Tag `v1.0.0` ist gepusht, die CI ist grün (backend, frontend, images api und web); `docker buildx imagetools inspect ghcr.io/mrhdready/wordquest-api:1.0.0` und `-web:1.0.0` listen linux/amd64 und linux/arm64; anonymer Pull klappt
awaiting: user response

## Tests

### 1. Veröffentlichung der Images 1.0.0
expected: `master` hat den Stand von `v1-fertig`, das Tag `v1.0.0` ist gepusht, die CI ist grün (backend, frontend, images api und web; Laufzeit des api-Jobs festhalten, vorher 10:57 min); `imagetools inspect` für `-api:1.0.0` und `-web:1.0.0` listet linux/amd64 und linux/arm64; anonymer Pull klappt
result: [pending]

### 2. Frische Installation auf einem Raspberry Pi 5 nur nach der Seite
expected: Jeder Schritt aus `Documentation/Installation.md` wörtlich ausgeführt; die Abschlusszeile von `setup.sh` zeigt eine im Heimnetz erreichbare Adresse (`hostname -I`); Anmeldung vom Tablet klappt
result: [pending]

### 3. Eine Person ohne Projektkenntnis folgt der Seite
expected: Sie kommt nur mit dem Link auf die Seite bis zur Eltern-Anmeldung; Stellen, an denen sie nachfragen musste, sind festgehalten und auf der Seite behoben
result: [pending]

### 4. restore.sh mit root-eigenen Tagesdumps unter Linux
expected: Nach einem Tageslauf zeigt `ls -l backups/daily` Besitzer root; `./restore.sh` mit einem Tagesdump stellt den Stand her, die Daten dieses Stands sind sichtbar
result: [pending]

### 5. upgrade.sh lädt aus GHCR
expected: Auf dem Pi `git pull` und `./upgrade.sh` ohne neue Version → Exit 0, Sicherung in `backups/vor-update-…`; mit der nächsten Version derselbe Weg, danach Kinder, Sets und Lernstand unverändert
result: [pending]

### 6. Traefik-Variante mit Update und Wiederherstellen
expected: Traefik-Stack nach README Variante B; `./upgrade.sh` und `./restore.sh` wie auf der Seite; Anmeldung über `https://<WQ_HOST>`
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
