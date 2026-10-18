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
| **Framework** | Bash-Smoke im Docker nach dem Muster von `setup-smoke.sh` (Arbeitskopie, eigenes Compose-Projekt `wq-release`, Port 18082, lokal gebaute Images als `ghcr.io/mrhdready/wordquest-{api,web}:1.0.0`, ab dem Update-Abschnitt ohne Build-Overlay mit Pull-Spy); `bash -n` je Skript einzeln (shellcheck und actionlint sind nicht installiert und werden nicht installiert, D-02); YAML-Parse mit `python3` und PyYAML (D-12); `docker buildx` mit dem Builder `desktop-linux` für `linux/arm64,linux/amd64` (D-12); Playwright-Spec `first-run.spec.ts` für echten Lernstand; bestehende xUnit-, vitest- und Playwright-Suiten im Gate |
| **Config file** | `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` (entsteht in 03-01 Task 1); Gate-Hilfe `.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` (Bestand) |
| **Quick run command** | `(for f in setup.sh upgrade.sh restore.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh; do [ -e "$f" ] \|\| continue; bash -n "$f" \|\| exit 1; done) && python3 -c 'import sys,yaml;[yaml.safe_load(open(f)) for f in sys.argv[1:]]' .github/workflows/ci.yml docker-compose.quick.yml docker-compose.yml` (Schleife, weil `bash -n a b` nur `a` prüft; Skripte, die es noch nicht gibt, werden übersprungen) |
| **Plan-Gate** | in jedem Plan: `backend-test.sh` (Build mit `/warnaserror`, alle Tests), Frontend-Gate in `node:22` (`npm ci`, lint, typecheck, build, test, design:check, design:classes), `backend-test.sh down`; dazu der Release-Smoke. e2e (mit axe) in 03-02 (Dockerfiles bauen die e2e-Images) und 03-05 |
| **Full suite command** | Gate aus 03-05 Task 2 (Vorphasen-Gate mit e2e, `setup-smoke.sh`, `proxy-xff-check.sh`, Release-Smoke, Buildx-Probe, `bash -n` je Skript, `100755`, YAML-Parse, `ci.yml` unverändert seit `892d3de`) |
| **Estimated runtime** | Release-Smoke ca. 15-20 min (Image-Build, Installation, Playwright-Erstdurchlauf, Wiederherstellen mit Fehlerpfaden, Update mit Startfehlern, davon ca. 2 min Health-Timeout); Buildx-Probe ca. 5-10 min; volles Gate ca. 35 min |

---

## Sampling Rate

- **After every task commit:** der `<automated>`-Befehl des Tasks (Release-Smoke bzw. Buildx-Probe)
- **After every plan:** Plan-Gate (siehe oben) aus dem `verify` des letzten Tasks; Release-Smoke mit allen bis dahin vorhandenen Markern
- **Before `/gsd-verify-work`:** 03-05 Task 2, also das volle automatische Gate. Grün ist es die Voraussetzung für das lokale Tag `v1.0.0`, das der Orchestrator setzt
- **Max feedback latency:** ca. 15-20 min für den Release-Smoke; `bash -n` und YAML-Parse unter 2 s

**Markerkette des Release-Smokes** (jeder Plan ergänzt seine Marker, frühere bleiben grün): `VERSION OK` → `INSTALL OK` (03-01) → `RESTORE OK` → `RESTORE-FEHLER OK` (03-03) → `UPDATE OK` → `UPDATE-ABBRUCH OK` (03-04) → `SEITE OK` (ab 03-01, erweitert in 03-05) → `RELEASE-SMOKE OK`. 03-02 ändert den Smoke nicht, lässt ihn aber im Gate laufen.

**Anmelde-Limit:** 10 Auth-Anfragen pro Minute je Absender, im Speicher der API. `auth_budget` im Smoke zählt je API-Start (`StartedAt`) und bricht vor der elften ab. Erstes API-Leben: Installation 1, Erstdurchlauf 3, Token 1 = 5; jede weitere Anmeldung folgt einem Neustart durch `restore.sh` oder `upgrade.sh`.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | REL-04 | T-03-01, T-03-03 | Frische Installation zieht `1.0.0` aus `ghcr.io/mrhdready/wordquest`, Enter übernimmt das Präfix aus `.env.example`; Version gleich an drei Stellen; Container mit genau diesen Image-Namen; Tags vor dem Build in der Aufräumliste, Gegenprobe Teil-Build ohne Reste; Zähler für Auth-Anfragen | smoke | `(for f in setup.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh; do bash -n "$f" \|\| exit 1; done) && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && git diff --quiet -- frontend/Dockerfile` | ❌ W0 (`release-smoke.sh` entsteht im Task) | ⬜ pending |
| 3-01-02 | 01 | 1 | REL-03 | T-03-04 | Seite Voraussetzungen/Installation/Sicherung/Hilfe; jeder Seitenbefehl ausgeführt oder begründet, jede zitierte Ausgabe beobachtet; README nur Verweis; Schnelltest ein Satz (D-06), keine Demo-Konto-Meldung; Plan-Gate | smoke + gate | Befehl aus 03-01 Task 2 (Smoke, Greps, `setup-smoke.sh`, Backend- und Frontend-Gate) | ❌ W0 (`Documentation/Installation.md` entsteht im Task) | ⬜ pending |
| 3-02-01 | 02 | 2 | REL-04 | T-03-02 | Build-Stage auf `$BUILDPLATFORM`, beide Plattformen bauen, amd64-API startet bis zur Secret-Prüfung; `ci.yml` unverändert | build | Buildx-Probe beider Dockerfiles, YAML-Parse, `git diff --quiet HEAD -- .github/workflows/ci.yml` (03-02 Task 1) | ✅ | ⬜ pending |
| 3-02-02 | 02 | 2 | REL-04 | T-03-02 | Konzept §14 auf dem umgesetzten Stand; Plan-Gate mit e2e gegen die neu gebauten Images | gate | Befehl aus 03-02 Task 2 (Backend, Frontend, e2e, `setup-smoke.sh`, Release-Smoke) | ✅ | ⬜ pending |
| 3-03-01 | 03 | 3 | REL-02 | T-03-05, T-03-07, T-03-10 | Wiederherstellen über die Liste: gelöschtes Kind wieder da, Fingerabdruck = S1, Hardlinks einmal, Vorher-Sicherung geprüft; `refresh_token` leer, Refresh mit altem Token 401, alter Access-Token bis Ablauf 200 | smoke | `(for f in restore.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh; do bash -n "$f" \|\| exit 1; done) && test -x restore.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ❌ W0 (`restore.sh` entsteht im Task) | ⬜ pending |
| 3-03-02 | 03 | 3 | REL-02 | T-03-06, T-03-08, T-03-09 | Falsche Eingaben und kaputte Datei ändern nichts; Import- und Lesefehler spielen die Vorher-Sicherung zurück (nie Erfolg gemeldet); Drop-Fehler mit gescheitertem Rückfall lässt die API gestoppt und die Vorher-Sicherung geprüft liegen | smoke | `bash -n restore.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-03-03 | 03 | 3 | REL-02, REL-03 | T-03-10 | Seitenabschnitt Sicherung und Wiederherstellung belegt, mit „neu anmelden“ und „spätestens nach rund 15 Minuten“; README und Konzept ohne „geplant“ für das Wiederherstellen; Plan-Gate | smoke + gate | Befehl aus 03-03 Task 3 | ✅ | ⬜ pending |
| 3-04-01 | 04 | 4 | REL-01 | T-03-12, T-03-13, T-03-14, T-03-18 | Update von älterer Version ohne Build-Overlay: Spy belegt Zielversion und Pull vor `.env`; geprüfte Sicherung vor dem Laden; `.env` auf `1.0.0`; Daten unverändert; Sicherung in der Liste von `restore.sh` | smoke | `(for f in upgrade.sh .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh; do bash -n "$f" \|\| exit 1; done) && test -x upgrade.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ❌ W0 (`upgrade.sh` entsteht im Task) | ⬜ pending |
| 3-04-02 | 04 | 4 | REL-01 | T-03-11, T-03-12, T-03-18 | Ohne Sicherung kein Pull; fehlende Version ändert weder `.env` noch Container; `up -d`-Fehler und Health-Timeout melden alte Version, Sicherung und Weg zurück, der Weg führt zurück; zweiter Aufruf harmlos | smoke | `bash -n upgrade.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-04-03 | 04 | 4 | REL-01, REL-03 | T-03-15 | Seitenabschnitt Update belegt; README ohne eigene Update-Anleitung und ohne Demo-Anleitung für ältere Installationen; Konzept ohne „geplant“; Plan-Gate | smoke + gate | Befehl aus 03-04 Task 3 | ✅ | ⬜ pending |
| 3-05-01 | 05 | 5 | REL-03 | T-03-16, T-03-17 | Abschnittsfolge nach D-09, je Abschnitt Befehl und Ergebnis, keine unsicheren Empfehlungen, Faktentabelle mit Fundstellen, voller Smoke aus sauberem Zustand | smoke + Review | `bash -n .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` | ✅ | ⬜ pending |
| 3-05-02 | 05 | 5 | REL-01, REL-02, REL-03, REL-04 | T-03-SC | Volles automatisches Gate; `bash -n` je Skript inkl. Release-Smoke; dreimal `100755`; YAML-Parse; `ci.yml` unverändert seit `892d3de`; kein Tag | gate | Befehl aus 03-05 Task 2 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Kein Framework fehlt. Die fehlenden Dateien entstehen jeweils im ersten Schritt des Tasks, der sie braucht (Smoke-Teil zuerst, rot belegt), nicht in einer eigenen Welle:

- [ ] `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` — Gerüst, Installation, Seitenabgleich, Aufräumliste, `auth_budget` (03-01 Task 1 und 2)
- [ ] `Documentation/Installation.md` — die eine Seite (03-01 Task 2, erweitert in 03-03, 03-04, geprüft in 03-05)
- [ ] `restore.sh` — REL-02 (03-03 Task 1)
- [ ] `upgrade.sh` — REL-01 (03-04 Task 1)

Bestehende Dateien, die genutzt werden: `frontend/e2e/first-run.spec.ts` (Lernstand im Smoke), `setup-smoke.sh` (Phase 1, nach der Änderung an `setup.sh` und den Dockerfiles), `backend-test.sh` und `proxy-xff-check.sh` (Phase 2, Gate).

---

## Nach-Release-Abnahme (UAT)

Diese Prüfungen brauchen veröffentlichte Images. Die Veröffentlichung entsteht erst durch das Tag, deshalb sind sie **keine Vorbedingung für das Tag** (Review 03-04 HIGH, Entscheidung Orchestrator 2026-10-18). Ergebnisse mit Datum, Gerät und Ergebnis hier bzw. später in `03-UAT.md`.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Images mit dem Tag `1.0.0` sind veröffentlicht, für arm64 und amd64 | REL-04 | Push und GitHub-Release macht Dennis (CONTEXT „Nicht in dieser Phase“, D-12); lokal belegt sind Standardwerte und Buildx-Probe | Standardbranch auf den Stand von `v1-fertig` bringen, lokales Tag `v1.0.0` pushen; CI-Lauf grün (Jobs backend, frontend, images api und web; Laufzeit des api-Jobs festhalten, vorher 10:57 min); `docker buildx imagetools inspect ghcr.io/mrhdready/wordquest-api:1.0.0` und `-web:1.0.0` listen `linux/amd64` und `linux/arm64`; anonymer Pull klappt |
| Frische Installation auf einem Raspberry Pi 5 nur nach der Seite | REL-03, REL-04 | Echte ARM64-Hardware, Raspberry Pi OS und Heimnetz stehen lokal nicht bereit; Port 8080 ist auf dem Entwicklungsrechner belegt | Leerer Pi mit Raspberry Pi OS 64-bit; jeden Schritt der Seite wörtlich ausführen; die Abschlusszeile von `setup.sh` zeigt eine im Heimnetz erreichbare Adresse (`hostname -I`, offene Prüfung aus 01-UAT); Anmeldung vom Tablet |
| Eine Person ohne Projektkenntnis folgt der Seite | REL-03 | Erfolgskriterium 2 spricht von einer neuen Person; der Smoke belegt nur, dass die Befehle stimmen | Person ohne Vorwissen bekommt nur den Link auf `Documentation/Installation.md`; Stellen, an denen sie nachfragen musste, festhalten und auf der Seite beheben |
| `restore.sh` liest die root-eigenen Tagesdumps unter Linux | REL-02 | Auf Docker Desktop für macOS gehören die Dateien dem Benutzer; unter Linux schreibt der Backup-Dienst als root (03-RESEARCH A9) | Auf dem Pi nach einem Tageslauf `ls -l backups/daily` prüfen, dann `./restore.sh` mit einem Tagesdump; Daten des Stands sichtbar |
| `upgrade.sh` lädt wirklich aus GHCR | REL-01 | Im Smoke ersetzt ein Pull-Spy den Registry-Zugriff (Review 03-03 MEDIUM) | Auf dem Pi `git pull` und `./upgrade.sh` ohne neue Version → Exit 0, Sicherung in `backups/vor-update-…`; mit der nächsten veröffentlichten Version denselben Weg und danach Kinder, Sets, Lernstand prüfen |
| Traefik-Variante mit Update und Wiederherstellen | REL-01, REL-02 | Braucht Domain, Let's Encrypt und Ports 80/443; geprüft ist nur der Heimnetz-Stack | Traefik-Stack nach README Variante B; `./upgrade.sh` und `./restore.sh` wie auf der Seite; Anmeldung über `https://<WQ_HOST>` |

Automatisiert statt manuell (seit dem Replan): „API startet nach dem Update nicht, Weg zurück aus der Meldung“ belegt 03-04 Task 2 mit `WQ_SEED_DEMO_DATA=true` und einer Zielversion ohne Image.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (vitest über `npm test` mit `vitest run`, Playwright ohne UI-Modus)
- [ ] Feedback latency < 2s — nicht erreichbar: der Release-Smoke baut Images und startet einen Stack (ca. 15-20 min); `bash -n` und YAML-Parse liegen darunter
- [x] `nyquist_compliant: true` set in frontmatter

**Zwei getrennte Status:**

- **Automatisches Gate:** pending — grün erst mit 03-05 Task 2 (Befehl und Exit-Code je Schritt im 03-05-SUMMARY). Grün und mit Subagent-Review ist es die Voraussetzung für das lokale Tag `v1.0.0`, das der Orchestrator setzt (D-01).
- **Nach-Release-Abnahme (UAT):** offen — braucht veröffentlichte Images, keine Vorbedingung für das Tag; abgeschlossen, wenn jede Zeile oben mit Datum, Gerät und Ergebnis belegt ist.

**Approval:** pending
