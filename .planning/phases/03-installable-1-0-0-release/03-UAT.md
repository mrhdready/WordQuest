---
status: complete
phase: 03-installable-1-0-0-release
source: [03-VERIFICATION.md, 03-VALIDATION.md]
started: 2026-10-18T12:00:00Z
updated: 2026-10-24T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Veröffentlichung der Images 1.0.0
expected: `master` hat den Stand von `v1-fertig`, das Tag `v1.0.0` ist gepusht, die CI ist grün (backend, frontend, images api und web; Laufzeit des api-Jobs festhalten, vorher 10:57 min); `imagetools inspect` für `-api:1.0.0` und `-web:1.0.0` listet linux/amd64 und linux/arm64; anonymer Pull klappt
result: pass
note: 2026-10-24: master b5df847, Tag v1.0.0 gepusht, CI gruen (backend 2:23, frontend 0:52, images api 2:03 statt 10:57, web 1:36, Release-Paket). Beide Images listen amd64 und arm64, anonymer Abruf 200. Release hat wordquest.tar.gz und .sha256.

### 2. Frische Installation auf einem Raspberry Pi 5 nur nach der Seite
expected: Jeder Schritt aus `Documentation/Installation.md` wörtlich ausgeführt; die Abschlusszeile von `setup.sh` zeigt eine im Heimnetz erreichbare Adresse (`hostname -I`); Anmeldung vom Tablet klappt
result: pass
note: Ersatz fuer den Pi: Debian 13 aarch64 VM, Schritte der Seite woertlich. Anmeldung ueber die Adresse aus setup.sh klappt.

### 3. Eine Person ohne Projektkenntnis folgt der Seite
expected: Sie kommt nur mit dem Link auf die Seite bis zur Eltern-Anmeldung; Stellen, an denen sie nachfragen musste, sind festgehalten und auf der Seite behoben
result: pass
note: Ersatz: frischer Subagent ohne Projektkenntnis kam bis zur Eltern-Anmeldung. Acht Stolperstellen; Port-Hinweis in setup.sh und fuenf Klarstellungen der Seite sind in 1.0.1 (Quick 261024-vnx). Nicht umgesetzt: fester Projektname wordquest, Docker-Installationsanleitung. Ein echter Mensch bleibt fuer Dennis offen.

### 4. restore.sh mit root-eigenen Tagesdumps unter Linux
expected: Nach einem Tageslauf zeigt `ls -l backups/daily` Besitzer root; `./restore.sh` mit einem Tagesdump stellt den Stand her, die Daten dieses Stands sind sichtbar
result: pass
note: Tagesdump gehoert root; ./restore.sh damit stellt den Stand her, Daten sichtbar.

### 5. upgrade.sh lädt aus GHCR
expected: Auf dem Pi `git pull` und `./upgrade.sh` ohne neue Version → Exit 0, Sicherung in `backups/vor-update-…`; mit der nächsten Version derselbe Weg, danach Kinder, Sets und Lernstand unverändert
result: pass
note: 2026-10-24 auf der VM: 1.0.0 → ./upgrade.sh → 1.0.1, Exit 0, Sicherung backups/vor-update-20261024-232502.sql.gz (0600). Kinder, Sets, Woerter, Lernstaende, XP, Logs vorher und nachher 1|1|4|8|195|8. Zweiter Lauf ohne neue Version: Exit 0, neue Sicherung, Version bleibt 1.0.1; es kommt kein Hinweis „schon aktuell“, sondern „von 1.0.1 auf 1.0.1“.

### 6. Traefik-Variante mit Update und Wiederherstellen
expected: Traefik-Stack nach README Variante B; `./upgrade.sh` und `./restore.sh` wie auf der Seite; Anmeldung über `https://<WQ_HOST>`
result: pass
note: 2026-10-24, Traefik-Stack (Projekt wq-traefik): ./upgrade.sh 1.0.0 → 1.0.1 Exit 0, Daten gleich, HTTPS-Login 200. Nach „Fertig“ liefert Traefik rund 30 s 404, bis web healthy ist. ./restore.sh mit der Vor-Update-Sicherung nimmt ein danach angelegtes Set zurueck (1|2|… → 1|1|4|8|195|8), HTTPS-Login 200. Ohne echtes Let's-Encrypt-Zertifikat.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
