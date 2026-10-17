---
phase: "2"
slug: "reliable-learning-clean-family-data"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-17"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: xUnit 2.9.3 mit `WebApplicationFactory<Program>` (Mvc.Testing 10.0.12) gegen echtes PostgreSQL 17, eigene Datenbank je Factory; Domäne: xUnit in `WordQuest.Learning.Tests`. Frontend: vitest mit Testing Library. e2e: Playwright 1.64.0 mit `@axe-core/playwright` 4.13.0 gegen den gebauten Stack (Development, Demo-Seed). |
| **Config file** | `backend/tests/WordQuest.Api.Tests/ApiFactory.cs`, `frontend/vite.config.ts` (vitest), `frontend/playwright.config.ts`, `frontend/e2e/docker-compose.e2e.yml`; Gate-Hilfe `.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` (entsteht in 02-01 Task 1) |
| **Quick run command** | Backend: `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~<Klasse>'` (eigener Postgres-Container `wq-p2-db` im Netz `wq-p2`, kein Host-Port, D-14). Frontend: `npm --prefix frontend run test -- <Datei>` |
| **Full suite command** | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` und `npm --prefix frontend ci && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run test && npm --prefix frontend run design:check && npm --prefix frontend run design:classes`; bei UI zusätzlich `npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e`, danach `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v` |
| **Estimated runtime** | gefiltertes Backend ca. 2 min (Release-Build im SDK-Container), vitest je Datei unter 30 s, voller Backend-Lauf ca. 5 min, e2e mit Stack-Aufbau ca. 8 min, Install-Smoke ca. 10 min |

---

## Sampling Rate

- **After every task commit:** der `<automated>`-Befehl des Tasks (gefilterter Backend-Lauf der berührten Testklassen, vitest der berührten Datei, betroffene e2e-Spec)
- **After every plan wave:** volles Plan-Gate aus dem Abschnitt `<verification>` des Plans (Backend voll, Frontend-Gate, alle e2e-Specs; bei 02-02, 02-06 und 02-07 zusätzlich der Install-Smoke)
- **Before `/gsd-verify-work`:** 02-07 Task 3, also dieselben Befehle wie `.github/workflows/ci.yml` (Frontend in `node:22`), alle e2e-Specs und der Install-Smoke grün (D-19)
- **Max feedback latency:** ca. 2 min für den gefilterten Backend-Lauf (Container-Build), unter 30 s für vitest

**Filter-Falle:** `dotnet test --filter` ohne Treffer endet mit Exit 0. `backend-test.sh` bricht deshalb mit „KEIN TEST GEFUNDEN“ und Exit 1 ab, wenn keine Zeile `Passed: *[1-9]` erscheint.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | FIX-03, FIX-09, QUAL-01 | T-02-05 | Auswahl und Tageslimit entscheidet der Server; Abbruch verbraucht kein Limit, neue Karten kommen wieder | integration + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SessionEndpointTests' && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- learn.spec.ts` | ❌ W0 (`gate/backend-test.sh`, `TestData.cs`, `SessionEndpointTests.cs` entstehen im Task) | ⬜ pending |
| 2-01-02 | 01 | 1 | FIX-04, QUAL-01 | T-02-01, T-02-02, T-02-03, T-02-04 | Unbekannte/fremde Runde oder Karte 404, `size` 400, gleichzeitige Doppel-Antwort 409, nie 500; Geschwister 403 | integration | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` | ✅ (aus 2-01-01) | ⬜ pending |
| 2-01-03 | 01 | 1 | FIX-04 | T-02-02 | Doppel-Tipp sendet eine Anfrage; Fehleransicht zeigt Server-Text, axe 0 | unit + e2e | `npm --prefix frontend run test -- SessionPage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run design:classes -- src/features/learn && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- learn.spec.ts` | ❌ W0 (`SessionPage.test.tsx` entsteht im Task) | ⬜ pending |
| 2-02-01 | 02 | 2 | PAR-03, FIX-02, FIX-04, QUAL-01 | T-02-06, T-02-07, T-02-08, T-02-09, T-02-10 | Kind löschen nur in der eigenen Familie und nur Rolle Learner; alle Kinddaten per FK weg; gelöschtes Kind 401/404 mit Text; Migration und Demo-Seed überstehen den Start des gebauten Stacks | integration + Stack-Start | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh && npm --prefix frontend run e2e:stack` | ❌ W0 (`LearnerDeleteTests.cs` entsteht im Task) | ⬜ pending |
| 2-02-02 | 02 | 2 | FIX-02, QUAL-01 | T-02-10 | Migration läuft auf Altdaten mit Waisen; Set/Vokabel löschen entfernt Lernstand; Konzept nennt den Endpunkt | integration | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SetDeleteTests\|FullyQualifiedName~MigrationTests\|FullyQualifiedName~LearnerDeleteTests' && grep -q 'DELETE /learners/{id}' Documentation/WordQuest_Konzept_und_Architektur.md` | ❌ W0 (`SetDeleteTests.cs`, `MigrationTests.cs` entstehen im Task) | ⬜ pending |
| 2-03-01 | 03 | 3 | PAR-03 | T-02-11, T-02-32, T-02-33 | Kind löschen nur nach Bestätigung im Dialog; Name nur als Text; keine neue Dependency | e2e | `npm --prefix frontend run design:check && npm --prefix frontend run design:classes -- src/components/ui src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- children.spec.ts` | ✅ (erweitern) | ⬜ pending |
| 2-03-02 | 03 | 3 | PAR-03, FIX-04 | T-02-11 | Bestätigungsdialog: Startfokus Abbrechen, Enter/Esc/Scrim löschen nicht, busy sperrt, eine Anfrage; 404 lesbar, gelöschtes Profil auf der Lern-Startseite | unit | `npm --prefix frontend run test && npm --prefix frontend run design:classes -- src/components/ui src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck` | ❌ W0 (`dialog.test.tsx` entsteht im Task) | ⬜ pending |
| 2-03-03 | 03 | 3 | PAR-03 | T-02-11, T-02-32 | Dialog Kind löschen: axe 0, Glas-Kontrast, Tastatur, 200 %, langer Name bei 320 px | unit + e2e | `npm --prefix frontend run test && npm --prefix frontend run design:classes && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- children.spec.ts keyboard-zoom.spec.ts` | ✅ (aus 2-03-02) | ⬜ pending |
| 2-04-01 | 04 | 4 | PAR-04, QUAL-01 | T-02-12, T-02-13, T-02-14 | Set umbenennen nur in der eigenen Familie, Länge geprüft (400 statt 500), IDs und Lernstand bleiben | integration + unit + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SetEditTests\|FullyQualifiedName~ContentRulesTests\|FullyQualifiedName~SetDeleteTests' && npm --prefix frontend run design:classes -- src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- manage.spec.ts` | ❌ W0 (`SetEditTests.cs`, `ContentRulesTests.cs` entstehen im Task) | ⬜ pending |
| 2-04-02 | 04 | 4 | FIX-02 | T-02-12, T-02-15 | Set löschen nur nach Bestätigung, fremdes Set 404 | integration + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SetDeleteTests\|FullyQualifiedName~SetEditTests' && npm --prefix frontend run design:classes -- src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- manage.spec.ts` | ✅ | ⬜ pending |
| 2-04-03 | 04 | 4 | PAR-04, QUAL-01 | T-02-15, T-02-16 | Matrizen Set umbenennen/löschen, axe 0, Tastatur, 200 %, langer Titel | unit + e2e | `npm --prefix frontend run test && npm --prefix frontend run design:classes && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- manage.spec.ts keyboard-zoom.spec.ts` | ✅ | ⬜ pending |
| 2-05-01 | 05 | 5 | PAR-04, QUAL-01 | T-02-17, T-02-18, T-02-19 | Vokabel korrigieren nur in eigener Familie und eigenem Set, Länge geprüft, IDs und Lernstand bleiben | integration + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SetEditTests' && npm --prefix frontend run design:classes -- src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- manage.spec.ts` | ✅ | ⬜ pending |
| 2-05-02 | 05 | 5 | FIX-02, PAR-04 | T-02-17, T-02-18, T-02-20 | Vokabel löschen nur nach Bestätigung; Hinzufügen mit 201 Zeichen 400 statt 500 | integration + unit + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SetDeleteTests\|FullyQualifiedName~SetEditTests' && npm --prefix frontend run test -- dialog && npm --prefix frontend run design:classes -- src/components/ui src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- manage.spec.ts` | ✅ | ⬜ pending |
| 2-05-03 | 05 | 5 | PAR-04, QUAL-01 | T-02-20, T-02-21 | Matrizen Vokabel bearbeiten/löschen, axe 0, Tastatur, 200 %, lange Vokabel | unit + e2e | `npm --prefix frontend run test && npm --prefix frontend run design:classes && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- manage.spec.ts keyboard-zoom.spec.ts` | ✅ | ⬜ pending |
| 2-06-01 | 06 | 6 | FIX-01, QUAL-01 | T-02-22, T-02-23, T-02-24, T-02-25 | Limit pro echter Client-IP, gefälschter X-Forwarded-For wirkungslos, Refresh ohne Limit; im echten Stack belegt | integration + smoke | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~RateLimitTests' && bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh` | ✅ (erweitern) | ⬜ pending |
| 2-06-02 | 06 | 6 | FIX-01 | T-02-23 | Refresh-Fehler 429/5xx/Netz melden nicht ab, nur 400/401 | unit | `npm --prefix frontend run test -- api && npm --prefix frontend run lint && npm --prefix frontend run typecheck && grep -q 'X-Forwarded-For' Documentation/WordQuest_Konzept_und_Architektur.md` | ✅ (erweitern) | ⬜ pending |
| 2-06-03 | 06 | 6 | QUAL-01 | T-02-26, T-02-27 | Login, PIN-Sperre, Refresh-Rotation, Wiederverwendung widerruft alles; Geschwister 403 auf allen Sitzungs- und Übersichts-Endpunkten | integration | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~AuthEndpointTests\|FullyQualifiedName~SiblingIsolationTests'` | ❌ W0 (`AuthEndpointTests.cs`, `SiblingIsolationTests.cs` entstehen im Task) | ⬜ pending |
| 2-07-01 | 07 | 7 | FIX-05, QUAL-01 | T-02-29 | Serie berechnet der Server beim Lesen, ohne Schreibwirkung | unit + integration + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~StreakRulesTests\|FullyQualifiedName~OverviewTests' && npm --prefix frontend run design:classes -- src/features/learn src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- children.spec.ts` | ❌ W0 (`OverviewTests.cs` entsteht im Task) | ⬜ pending |
| 2-07-02 | 07 | 7 | FIX-06, QUAL-01 | T-02-29, T-02-30 | Eine Meisterschaftsregel; Übersicht == grüne Ampel-Wörter | unit + integration + e2e | `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~MasteryRulesTests\|FullyQualifiedName~OverviewTests\|FullyQualifiedName~LearnerEndpointTests' && npm --prefix frontend run test -- LearnHomePage ProgressPage && npm --prefix frontend run design:classes -- src/features/learn src/features/manage && npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend run build && npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e -- learn.spec.ts manage.spec.ts` | ❌ W0 (`MasteryRulesTests.cs` entsteht im Task) | ⬜ pending |
| 2-07-03 | 07 | 7 | QUAL-01 | T-02-28 | Phasen-Gate wie CI (D-19), alle e2e, Smoke | gate | Befehl aus 02-07 Task 3 (`backend-test.sh`, Frontend in `node:22`, `e2e`, `setup-smoke.sh`, `backend-test.sh down`) | ✅ | ⬜ pending |

Im Befehl steht `\|` nur wegen der Markdown-Tabelle; im Terminal ist es ein einfaches `|` innerhalb der Anführungszeichen.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Kein Framework fehlt. Die fehlenden Testdateien entstehen jeweils im ersten Schritt des Tasks, der sie braucht (Test zuerst, rot belegt), nicht in einer eigenen Welle:

- [ ] `.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` — Backend-Lauf im SDK-Container gegen eigenes PostgreSQL 17 (02-01 Task 1, D-14)
- [ ] `backend/tests/WordQuest.Api.Tests/TestData.cs` — gemeinsame Familie/Set/Karten/Kind-Hilfen (02-01 Task 1)
- [ ] `backend/tests/WordQuest.Api.Tests/SessionEndpointTests.cs` — FIX-03/04/09, FIX-07-Wiederholung (02-01)
- [ ] `frontend/src/features/learn/SessionPage.test.tsx` — Doppel-Tipp, Fehleransicht (02-01 Task 3)
- [ ] `backend/tests/WordQuest.Api.Tests/LearnerDeleteTests.cs`, `SetDeleteTests.cs`, `MigrationTests.cs` — PAR-03, FIX-02 (02-02)
- [ ] `backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs` Zeilen 480-484 — Seed auf echte Karte umstellen, sonst FK-Verletzung (02-02 Task 1)
- [ ] `frontend/src/components/ui/dialog.test.tsx` — Dialog-Baustein (02-03 Task 2)
- [ ] `backend/tests/WordQuest.Api.Tests/SetEditTests.cs`, `backend/tests/WordQuest.Learning.Tests/ContentRulesTests.cs` — PAR-04 (02-04)
- [ ] `backend/tests/WordQuest.Api.Tests/AuthEndpointTests.cs`, `SiblingIsolationTests.cs` — QUAL-01 (02-06 Task 3)
- [ ] `backend/tests/WordQuest.Api.Tests/OverviewTests.cs`, `backend/tests/WordQuest.Learning.Tests/MasteryRulesTests.cs` — FIX-05/06 (02-07)

Bestehende Dateien, die erweitert werden: `RateLimitTests.cs`, `GamificationTests.cs` (`StreakRulesTests`), `api.test.ts`, `ChildFormPage.test.tsx`, `ChildrenPage.test.tsx`, `SetDetailPage.test.tsx`, `SetsPage.test.tsx`, `LearnHomePage.test.tsx`, `ProgressPage.test.tsx`, e2e `learn`, `children`, `manage`, `keyboard-zoom`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zwei echte Geräte im Heimnetz: Tablet A vertippt die PIN bzw. das Passwort bis zur Sperre, Tablet B meldet sich in derselben Minute an | FIX-01 | Automatisiert sind TestServer mit gesetzter Client-IP und der Smoke mit zwei Absendern im Compose-Netz; echte WLAN-Geräte hinter nginx (und optional Traefik) kann kein Test nachstellen | Schnellstart-Stack im Heimnetz starten; auf Gerät A elfmal ein falsches Elternpasswort → „Zu viele Versuche. Bitte in einer Minute nochmal probieren.“; sofort auf Gerät B anmelden → klappt; Ergebnis mit Gerätetyp und Uhrzeit festhalten |
| Dialoge „Kind löschen“, „Set umbenennen“, „Set löschen“, „Vokabel bearbeiten“, „Vokabel löschen“ auf dem Tablet und bei 200 % Browser-Zoom nur mit der Tastatur | PAR-03, PAR-04 | Sichtbarkeit des Fokusrings, Bildschirmtastatur und echtes Zoomverhalten des Browsers sind nicht vollständig automatisierbar (e2e prüft 640 × 400 und Tab-Reihenfolge) | Je Dialog: öffnen, Tab-Reihenfolge, sichtbarer Fokus, Esc schließt, Enter auf „Abbrechen“ löscht nicht, Fehlerfall lesbar; Ergebnis je Dialog im Verifikationsbericht |
| Migration auf einem Raspberry Pi 5 mit einer bestehenden Phase-1-Installation | FIX-02, PAR-03 | ARM64-Hardware und echte Altdaten stehen in der Testumgebung nicht bereit; `MigrationTests` und der Install-Smoke belegen die Logik auf x86 | Vor dem Update Sicherung prüfen, Images neu bauen, `docker compose up -d`; API-Log zeigt die Migration `ReferentialIntegrity` ohne Fehler, Kinder lernen weiter, ein Testkind lässt sich löschen |
| Serie am nächsten Tag | FIX-05 | Echte Tageswechsel in der eingestellten Zeitzone; automatisiert über gesetztes `LastActiveDate` | Ein Kind lernt an Tag 1, setzt Tag 2 und 3 aus (ohne Retter im Monat) → Startseite zeigt „Starte heute deine Serie!“ |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (vitest über `npm run test` mit `vitest run`, Playwright ohne UI-Modus)
- [ ] Feedback latency < 2s — nicht erreichbar: der gefilterte Backend-Lauf braucht wegen des Release-Builds im SDK-Container ca. 2 min (D-14); vitest je Datei unter 30 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
