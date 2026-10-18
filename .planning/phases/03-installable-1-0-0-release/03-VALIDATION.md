---
phase: "3"
slug: "installable-1-0-0-release"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-18"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash-Smoke im Docker nach dem Muster von `setup-smoke.sh` (Arbeitskopie, eigenes Compose-Projekt `wq-release`, Port 18082, lokal gebaute Images als `ghcr.io/mrhdready/wordquest-{api,web}:1.0.0`); `bash -n` für alle Skripte (shellcheck und actionlint sind nicht installiert und werden nicht installiert, D-02); YAML-Parse mit `python3` und PyYAML (D-12); `docker buildx` mit dem Builder `desktop-linux` für `linux/arm64,linux/amd64` (D-12); Playwright-Spec `first-run.spec.ts` für echten Lernstand; bestehende xUnit-, vitest- und Playwright-Suiten im Phasen-Gate |
| **Config file** | `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` (entsteht in 03-01 Task 1); Gate-Hilfe `.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` (Bestand) |
| **Quick run command** | `bash -n setup.sh upgrade.sh restore.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && python3 -c 'import sys,yaml;[yaml.safe_load(open(f)) for f in sys.argv[1:]]' .github/workflows/ci.yml docker-compose.quick.yml docker-compose.yml` (vor 03-02 bzw. 03-03 nur die Skripte, die es schon gibt) |
| **Full suite command** | `bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` und das Gate aus 03-04 Task 2 (Backend im SDK-Container, Frontend in `node:22`, e2e, `setup-smoke.sh`, `proxy-xff-check.sh`, Buildx-Probe) |
| **Estimated runtime** | Release-Smoke ca. 10-15 min (Image-Build, Installation, Playwright-Erstdurchlauf, Wiederherstellen, Update); Buildx-Probe beider Dockerfiles ca. 5-10 min (Runtime-Stage für amd64 unter Emulation); volles Gate ca. 30 min |

---

## Sampling Rate

- **After every task commit:** der `<automated>`-Befehl des Tasks (Release-Smoke bzw. Buildx-Probe)
- **After every plan wave:** volles Plan-Gate aus dem Abschnitt `<verification>` des Plans (Release-Smoke mit allen bis dahin vorhandenen Markern; bei 03-01 zusätzlich `setup-smoke.sh` und Buildx-Probe)
- **Before `/gsd-verify-work`:** 03-04 Task 2, also das volle Gate aus AGENTS.md (wie 02-07 Task 3) plus Release-Smoke, Buildx-Probe, `bash -n`, Ausführbar-Bits, YAML-Parse. Das ist der Status „Automatisches Gate“; die „Phasenabnahme (manuell)“ hat einen eigenen Status (siehe Sign-Off)
- **Max feedback latency:** ca. 10-15 min für den Release-Smoke; `bash -n` und YAML-Parse unter 2 s

**Markerkette des Release-Smokes** (jeder Plan ergänzt seine Marker, frühere bleiben grün): `VERSION OK` → `INSTALL OK` (03-01) → `RESTORE OK` → `RESTORE-FEHLER OK` (03-02) → `UPDATE OK` → `UPDATE-ABBRUCH OK` (03-03) → `SEITE OK` (ab 03-01, erweitert in 03-04) → `RELEASE-SMOKE OK`.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | REL-04 | T-03-01, T-03-03 | Frische Installation zieht `1.0.0` aus `ghcr.io/mrhdready/wordquest`, Enter übernimmt das Präfix aus `.env.example`; Version gleich an drei Stellen; Container mit genau diesen Image-Namen; Smoke überdeckt kein echtes lokales Image | smoke | `bash -n setup.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ❌ W0 (`release-smoke.sh` entsteht im Task) | ⬜ pending |
| 3-01-02 | 01 | 1 | REL-03 | T-03-04 | Seite Voraussetzungen/Installation/Sicherung/Hilfe; jeder Seitenbefehl ausgeführt oder begründet, jede zitierte Ausgabe beobachtet; README nur Verweis; Schnelltest ein Satz (D-06) | smoke | `bash -n .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && grep -q 'Installation.md' README.md && grep -q 'Installation.md' Documentation/README.md` | ❌ W0 (`Documentation/Installation.md` entsteht im Task) | ⬜ pending |
| 3-01-03 | 01 | 1 | REL-04 | T-03-02 | Build-Stage auf `$BUILDPLATFORM`, beide Plattformen bauen, amd64-API startet bis zur Secret-Prüfung; `ci.yml` unverändert | build + smoke | `docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 -f backend/Dockerfile --output type=cacheonly . && docker buildx build --builder desktop-linux --platform linux/arm64,linux/amd64 -f frontend/Dockerfile --output type=cacheonly . && python3 -c 'import sys,yaml;[yaml.safe_load(open(f)) for f in sys.argv[1:]]' .github/workflows/ci.yml docker-compose.quick.yml docker-compose.yml && git diff --quiet HEAD -- .github/workflows/ci.yml && bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 2 | REL-02 | T-03-05, T-03-07, T-03-10 | Wiederherstellen über die Liste: gelöschtes Kind wieder da, Fingerabdruck = S1, Hardlinks einmal, Vorher-Sicherung geprüft, Refresh-Tokens widerrufen | smoke | `bash -n restore.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && test -x restore.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ❌ W0 (`restore.sh` entsteht im Task) | ⬜ pending |
| 3-02-02 | 02 | 2 | REL-02 | T-03-06, T-03-08, T-03-09 | Falsche Nummer, `nein`, Ende der Eingabe, fehlender Pfad, kaputte Datei ändern nichts; gescheitertes Einspielen spielt die Vorher-Sicherung zurück, API läuft, Meldung nennt beide Dateien | smoke | `bash -n restore.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-02-03 | 02 | 2 | REL-02, REL-03 | T-03-10 | Seitenabschnitt Sicherung und Wiederherstellung belegt; README und Konzept ohne „geplant“ für das Wiederherstellen | smoke | `grep -q './restore.sh' Documentation/Installation.md && grep -q 'restore.sh' README.md && grep -q 'REL-02' Documentation/WordQuest_Konzept_und_Architektur.md && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 3 | REL-01 | T-03-12, T-03-13, T-03-14 | Update von älterer Version: geprüfte Sicherung vor dem Laden, `.env` auf `1.0.0`, Daten unverändert, Sicherung in der Liste von `restore.sh`; kein Demo-Zweig (L2 kommt nicht vor) | smoke | `bash -n upgrade.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && test -x upgrade.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ❌ W0 (`upgrade.sh` entsteht im Task) | ⬜ pending |
| 3-03-02 | 03 | 3 | REL-01 | T-03-11, T-03-12 | Ohne Sicherung kein Pull; fehlende Version ändert weder `.env` noch Container; zweiter Aufruf harmlos | smoke | `bash -n upgrade.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-03-03 | 03 | 3 | REL-01, REL-03 | T-03-15 | Seitenabschnitt Update belegt; README ohne eigene Update-Anleitung; Konzept ohne „geplant“ | smoke | `grep -q './upgrade.sh' Documentation/Installation.md && grep -q 'REL-01' Documentation/WordQuest_Konzept_und_Architektur.md && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-04-01 | 04 | 4 | REL-03 | T-03-16, T-03-17 | Abschnittsfolge nach D-09, je Abschnitt Befehl und Ergebnis, keine unsicheren Empfehlungen, Faktentabelle mit Fundstellen, voller Smoke aus sauberem Zustand | smoke + Review | `bash -n .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-04-02 | 04 | 4 | REL-01, REL-02, REL-03, REL-04 | T-03-SC | Volles Gate aus AGENTS.md plus Release-Smoke, Buildx-Probe, `bash -n`, `100755`, YAML-Parse, `ci.yml` unverändert; kein Tag | gate | Befehl aus 03-04 Task 2 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Kein Framework fehlt. Die fehlenden Dateien entstehen jeweils im ersten Schritt des Tasks, der sie braucht (Smoke-Teil zuerst, rot belegt), nicht in einer eigenen Welle:

- [ ] `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` — Gerüst, Installation, Seitenabgleich (03-01 Task 1 und 2)
- [ ] `Documentation/Installation.md` — die eine Seite (03-01 Task 2, erweitert in 03-02, 03-03, geprüft in 03-04)
- [ ] `restore.sh` — REL-02 (03-02 Task 1)
- [ ] `upgrade.sh` — REL-01 (03-03 Task 1)

Bestehende Dateien, die genutzt werden: `frontend/e2e/first-run.spec.ts` (Lernstand im Smoke), `setup-smoke.sh` (Phase 1, nach der Änderung an `setup.sh`), `backend-test.sh` und `proxy-xff-check.sh` (Phase 2, Gate).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Images mit dem Tag `1.0.0` sind veröffentlicht, für arm64 und amd64 | REL-04 | Push und GitHub-Release macht Dennis (CONTEXT „Nicht in dieser Phase“, D-12); lokal sind nur Buildx-Probe und Standardwerte belegt | Standardbranch auf den Stand von `v1-fertig` bringen, Tag `v1.0.0` pushen; CI-Lauf grün (Jobs backend, frontend, images api und web, Laufzeit des api-Jobs festhalten, vorher 10:57 min); `docker buildx imagetools inspect ghcr.io/mrhdready/wordquest-api:1.0.0` und `-web:1.0.0` listen `linux/amd64` und `linux/arm64`; anonymer Pull klappt |
| Frische Installation auf einem Raspberry Pi 5 nur nach der Seite | REL-03, REL-04 | Echte ARM64-Hardware, Raspberry Pi OS und Heimnetz stehen lokal nicht bereit; Port 8080 ist auf dem Entwicklungsrechner belegt | Leerer Pi mit Raspberry Pi OS 64-bit; jeden Schritt der Seite wörtlich ausführen; die Abschlusszeile von `setup.sh` zeigt eine im Heimnetz erreichbare Adresse (`hostname -I`, offene Prüfung aus 01-UAT); Anmeldung vom Tablet unter dieser Adresse; Ergebnis mit Datum festhalten |
| Eine Person ohne Projektkenntnis folgt der Seite | REL-03 | Erfolgskriterium 2 spricht von einer neuen Person; der Smoke belegt nur, dass die Befehle stimmen | Person ohne Vorwissen bekommt nur den Link auf `Documentation/Installation.md`; Stellen, an denen sie nachfragen musste, festhalten und auf der Seite beheben |
| `restore.sh` liest die root-eigenen Tagesdumps unter Linux | REL-02 | Auf Docker Desktop für macOS gehören die Dateien dem Benutzer; unter Linux schreibt der Backup-Dienst als root (03-RESEARCH A9) | Auf dem Pi nach einem Tageslauf `ls -l backups/daily` prüfen (lesbar für den Benutzer), dann `./restore.sh` mit einem Tagesdump; Daten des Stands sichtbar |
| Update auf dem Pi von `1.0.0` auf die nächste Version | REL-01 | Eine zweite veröffentlichte Version gibt es erst später; der Smoke belegt den Ablauf mit lokal benannten Images | Bis dahin: `git pull` und `./upgrade.sh` auf dem Pi ohne neue Version → Exit 0, Sicherung in `backups/vor-update-…`; mit der nächsten Version denselben Weg und danach Kinder, Sets, Lernstand prüfen |
| API startet nach dem Update nicht, Weg zurück aus der Meldung | REL-01 | Ein kaputtes Release lässt sich im Smoke nicht ohne eigenes Defekt-Image nachstellen | Optional mit einem absichtlich kaputten lokalen Image: Meldung von `upgrade.sh` lesen, alte Version in `.env` eintragen, `./restore.sh <vor-update-Datei>`; WordQuest läuft mit altem Stand |
| Traefik-Variante mit Update und Wiederherstellen | REL-01, REL-02 | Braucht Domain, Let's Encrypt und Ports 80/443; die Skripte lesen `COMPOSE_FILE` aus `.env`, geprüft ist nur der Heimnetz-Stack | Traefik-Stack nach README Variante B; `./upgrade.sh` und `./restore.sh` wie auf der Seite; Anmeldung über `https://<WQ_HOST>` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (vitest über `npm test` mit `vitest run`, Playwright ohne UI-Modus)
- [ ] Feedback latency < 2s — nicht erreichbar: der Release-Smoke baut Images und startet einen Stack (ca. 10-15 min); `bash -n` und YAML-Parse liegen darunter
- [x] `nyquist_compliant: true` set in frontmatter

**Zwei getrennte Status:**

- **Automatisches Gate:** pending — grün erst mit 03-04 Task 2 (Befehl und Exit-Code je Schritt im 03-04-SUMMARY).
- **Phasenabnahme (manuell):** offen — abgeschlossen erst, wenn jede Zeile aus „Manual-Only Verifications“ mit Datum, Gerät und Ergebnis belegt ist. Das Tag `v1.0.0` setzt der Orchestrator erst nach grünem Gate und Abnahme (D-01).

**Approval:** pending
