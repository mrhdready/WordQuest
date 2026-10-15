---
phase: "1"
slug: "safe-home-network-install"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend xUnit (+ neu `WordQuest.Api.Tests` mit Mvc.Testing); Frontend Vitest + jsdom, Playwright + @axe-core/playwright |
| **Config file** | none — Wave 0 installs (`frontend/vite.config.ts` test-Block, `frontend/playwright.config.ts`, `backend/tests/WordQuest.Api.Tests/`) |
| **Quick run command** | `cd frontend && npx vitest run` bzw. gefilterter `dotnet test` im SDK-Container |
| **Full suite command** | Gate aus AGENTS.md + `cd frontend && npm test && npx playwright test` + `npm run design:check` |
| **Estimated runtime** | ~300 seconds |

---

## Sampling Rate

- **After every task commit:** Run Quick run command
- **After every plan wave:** Run Full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task-IDs vergibt der Planer; Zuordnung Anforderung → Prüfung laut RESEARCH.md:


| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DESIGN-01 | Tokens aktuell | Drift | `cd frontend && npm run design:check` (Exit 0, leerer Diff) | ❌ Wave 0 (Skript) |
| DESIGN-01 | DESIGN.md gültig, keine Kontrast-Warnung | Lint | `npx -y @google/design.md@0.4.0 lint DESIGN.md` → `"warnings": 0` | ✅ |
| DESIGN-01 | keine alten Klassen/Inline-Styles | statisch | Grep aus Pitfall 1 → 0 Treffer | ❌ Wave 0 (als npm-Skript oder Plan-Check) |
| DESIGN-01 | axe 0 auf allen Seiten, Glas-Kontrast je Blob, Fallback-Modus | e2e | `cd frontend && npx playwright test e2e/a11y.spec.ts` | ❌ Wave 0 |
| FIX-07 | axe auf `/lernen` | e2e | Teil von `e2e/a11y.spec.ts` | ❌ Wave 0 |
| SETUP-01 | Secrets erzeugt, Backup-Datei vorhanden | Smoke (Docker) | `docker compose exec backup /backup.sh && ls backups/daily/wordquest-*.sql.gz` | ❌ |
| SETUP-02 | Konto aus `setup.sh`, kein Demo-Konto | Smoke + Integration | `printf 'mail\npw\npw\n' \| ./setup.sh`; `curl -X POST …/auth/login` mit Konto → 200, mit `demo@wordquest.local`/`demo1234` → 401 | ❌ |
| SETUP-03 | neues Passwort gilt, altes nicht; falsches aktuelles → 400 `currentPassword` | Integration + Vitest-Matrix | `dotnet test --filter AccountEndpointTests`; `npx vitest run src/features/manage/AccountPage.test.tsx` | ❌ |
| SETUP-04 | Reset per Befehl, Login mit Ergebnis | Smoke + Integration | `docker compose exec -T api dotnet WordQuest.Api.dll reset-password <mail>` → Passwort parsen → Login 200; `AccountService`-Test | ❌ |
| SETUP-05 | Startabbruch mit Namen des Secrets | Unit + Smoke | Unit für Prüffunktion; `docker run --rm -e ASPNETCORE_ENVIRONMENT=Production -e WQ_DB_PASSWORD=devpassword -e WQ_JWT_SIGNING_KEY=<32+ zufällig> <api-image>; echo $?` → ≠ 0, Ausgabe enthält `WQ_DB_PASSWORD` | ❌ |
| SETUP-06 | Regression Rechte | Smoke | `node .planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/smoke.mjs --installer` (aus diesem Verzeichnis) | ✅ |
| PAR-01 | Name/Limit/PIN ändern, Kind meldet sich mit neuer PIN an | Integration + Vitest-Matrix | `dotnet test --filter LearnerEndpointTests`; `npx vitest run src/features/manage/ChildFormPage.test.tsx` | ❌ |
| PAR-02 | PIN ≠ 4–6 Ziffern → 400 `pin`, auch direkt an der API | Integration | `dotnet test --filter LearnerEndpointTests` (Fälle 3, 7 Ziffern, Buchstaben, Leerzeichen, Anlegen ohne PIN) | ❌ |
| PAR-05 | Kind anlegen mit Limit und PIN | Integration + Vitest | wie PAR-01, Modus „Anlegen“ | ❌ |
| QUAL-02 | Matrix + axe + Tastatur + 200 % Zoom | Vitest + e2e + manuell | `npx vitest run`; `npx playwright test`; Tastatur/Zoom als Playwright-Schritte (Tab-Reihenfolge, `page.setViewportSize({ width: 320 })`) plus manueller Durchgang | ❌ |

#### Sampling Rate (Research)
- **Per task commit:** `npx vitest run` (Frontend-Tasks) bzw. gefilterter `dotnet test` im Container (Backend-Tasks); `npm run design:check` bei CSS-Änderungen.
- **Per wave merge:** volles Gate aus AGENTS.md + `npm test`.
- **Phase gate:** Gate grün, Playwright/axe gegen gebauten Stack (`docker compose -f docker-compose.quick.yml -f docker-compose.build.yml up -d --build`), Smoke SETUP-01/02/04/05, dann `/gsd-verify-work`.

## Wave 0 Requirements
- [ ] `frontend/src/design-tokens.css` + Skripte `design:export`/`design:check`
- [ ] `frontend/vite.config.ts` `test`-Block, `frontend/src/test/setup.ts`, Skript `test`
- [ ] `frontend/playwright.config.ts`, `frontend/e2e/a11y.spec.ts`, `globalSetup` für Testdaten
- [ ] `backend/tests/WordQuest.Api.Tests/` (Factory mit `CreateHost`-Override, eigene DB pro Lauf), Eintrag in `backend/WordQuest.slnx`
- [ ] `.github/workflows/ci.yml`: Postgres-Service im Backend-Job, `npm test` im Frontend-Job
- [ ] Framework-Installation: siehe „Installation“ (nach Checkpoint)


---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tastatur-Durchgang und 200 % Zoom je Seite | QUAL-02, DESIGN-01 | Fokusbild und Lesbarkeit brauchen Augenschein | Playwright-Schritte plus manueller Durchgang laut UI-SPEC |
| Glas-Wirkung und Leistung auf günstigem Tablet, Android/Windows | DESIGN-01 | echte Hardware nötig | Dennis prüft am Gerät (CONTEXT, Hinweis aus Issue #3) |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
