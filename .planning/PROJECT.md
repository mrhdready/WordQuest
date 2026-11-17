# WordQuest

## What This Is

WordQuest ist eine Vokabel-Lern-App für Kinder, die Eltern ohne besonderes Know-how im Heimnetz betreiben können. Eltern verwalten Vokabelsets (manuell oder per CSV) und Kinderprofile. Kinder melden sich per Profilauswahl und PIN an und lernen mit SM-2-Wiederholungen, XP, Streaks und Leveln. Die App läuft als Docker-Compose-Stack auf Raspberry Pi 5 oder NAS. Der Planungsmeilenstein heißt weiterhin v1.0; der aktuelle Code bereitet Release 1.1.0 mit HTTPS und eigener CA vor. Geräteabnahme, aktuelle Verifikation und Veröffentlichung bleiben offen.

## Core Value

Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.

## Requirements

### Validated

Abgleich am 2026-11-17 gegen `9627760`. „Validated“ bezeichnet vorhandene Implementierung mit historischen Nachweisen, keine neue Abnahme. Aktueller Prüf- und Abnahmestand: [STATE.md](STATE.md#abgleich-am-2026-11-17).

- ✓ Guardian login (email/password) and learner login via profile picker + PIN, JWT + rotating refresh tokens with reuse detection — existing
- ✓ Tenant isolation via EF global query filters on all tenant-owned entities — existing
- ✓ Guardian can create learners and manage vocabulary sets and entries — existing
- ✓ CSV vocabulary import with preview and confirm — existing
- ✓ Learning sessions: composition of relearning/due/new cards, server-side grading (normalization + Damerau-Levenshtein), SM-2 scheduling — existing
- ✓ Gamification: XP per answer, completion bonus, streaks, level curve — existing
- ✓ Parent views: learner overview and traffic-light mastery per set — existing
- Heimnetz-Betrieb über `docker-compose.quick.yml`: HTTPS mit eigener CA (`certs`), HTTP-Umleitung, tägliche Datenbanksicherung. Traefik/Let's Encrypt sind entfernt. Code: `docker-compose.quick.yml`, `setup.sh`, `backend/src/WordQuest.Api/TlsCommand.cs`.
- CI in `.github/workflows/ci.yml`: Backend-Build `/warnaserror`, Unit-/API-Integrationstests gegen PostgreSQL, Frontend-Lint/Typecheck/Build/Vitest und Design-Prüfungen, Migration-Präsenzprüfung, Images und Release-Paket. Playwright/axe und Betriebs-Smokes sind weiterhin kein CI-Gate (QA2-01).

### Active

39 v1-Anforderungen sind in [REQUIREMENTS.md](REQUIREMENTS.md) zugeordnet. Die fünf Phasen sind implementiert (32/32 Pläne), aber keine ist nach aktueller GSD-Verifikation freigegeben (`stale`).

- Aktuellen vollständigen Prüflauf und Phasenverifikationen erneuern.
- Vokabelbilder A1–A3 und HTTPS/CA auf echten Geräten abnehmen; verbleibende Hardware-/Bedienungsgrenzen aus den UAT-Protokollen offen halten.
- Release 1.1.0 nach Abnahme veröffentlichen. Historische Veröffentlichungen 1.0.0/1.0.1 sind dokumentiert; sie belegen keine Veröffentlichung von 1.1.0.

### Out of Scope

- Multiple families per instance — one family per home installation
- Schools / classes — different audience, much stricter requirements
- Email / push notifications — no mail infrastructure for non-expert hosters
- Passkeys / OIDC — not needed for a home-network family app
- Tracking, leaderboards, streak penalties — pressure on children
- Deferred to v2 (see REQUIREMENTS.md): set assignment per child, export / delete family, parent reporting, second parent, browser setup wizard, new game modes, offline outbox, off-host backups and deeper hardening

## Context

- Brownfield: modular monolith backend (.NET 10, EF Core 10, Minimal APIs), React 19 + Vite + Tailwind 4 PWA frontend, PostgreSQL 17. Codebase map in `.planning/codebase/` (zuletzt nach HTTPS-Umstellung aktualisiert, `2fce2c0`).
- Concept doc `Documentation/WordQuest_Konzept_und_Architektur.md`; deviations listed in `.planning/codebase/ARCHITECTURE.md`.
- Research in `.planning/research/` covers a much larger scope (53 requirements); it was cut back deliberately. Its findings stay valid input for v2.
- `setup.sh` erzeugt Secrets und das Elternkonto; Demo-Daten sind standardmäßig aus (`WQ_SEED_DEMO_DATA=false`). `SecretCheck.cs` verweigert außerhalb Development fehlende/bekannte Standard-Secrets. Der Compose-Stack enthält den Dienst `backup`.
- Echtes Offline-Lernen mit Outbox/Sync bleibt v2. Der Service Worker benötigt einen vertrauenswürdigen Secure Context; die Browser-App muss auch ohne installierte CA funktionieren.
- Tests existieren in `backend/tests/WordQuest.Learning.Tests/`, `backend/tests/WordQuest.Api.Tests/`, Frontend-Vitest und `frontend/e2e/` mit Playwright/axe. Der letzte dokumentierte volle Lauf vom 2026-10-26 ist grün mit 1 übersprungenem E2E-Fall; aktueller Lauf offen (siehe STATE.md).

## Constraints

- **Simplicity**: every addition must keep install/operation doable for parents without special know-how; when in doubt, leave it out
- **Tech stack**: keep .NET 10 / EF Core / React / PostgreSQL / Docker Compose
- **Architecture**: domain modules stay dependency-free, endpoints stay thin, business logic in services/modules (house rule)
- **Hosting**: ARM64 home hardware, single API replica
- **Accessibility**: WCAG 2.2 AA minimum on all UI changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope cut to a working base (21 requirements, from 53) | The larger scope contradicted the goal of a simple app for non-expert parents | — Pending |
| Primary operating mode: home network over plain HTTP, no domain | Simplest for non-experts, no certificate warnings; no PWA install (service worker needs HTTPS) | Superseded 2026-10-25 by HTTPS with an own CA per install (1.1.0) |
| Domain + Let's Encrypt compose stays as-is for advanced users | Already exists, not extended in v1.0 | Removed 2026-10-25 (owner): not doable for non-expert parents; HTTPS via an own CA instead (quick 261025-fpi) |
| HTTPS with an own CA per install (certs service, RSA, no HSTS, CA not in backups, no name constraints) | PWA install and service worker need a trusted certificate; works without a domain or internet access for certificates (owner 2026-10-25, quick 261025-fpi, ADR-008) | Pending owner device acceptance |
| Parent account created by `setup.sh` instead of a browser wizard | Home network only; no setup takeover window, same mechanism as CLI reset | Implementiert; 01-02/01-05 und Install-Smokes historisch belegt; aktuelles Gate offen |
| Mastery threshold ease ≥ 2.1, one constant | Concept doc contradicts itself (2.0 vs 2.1); 2.1 matches current code | Implementiert in MasteryRules; 02-07 historisch belegt; aktuelle Verifikation offen |
| Offline learning, new game modes, reporting deferred to v2 | Not needed for a working base | Weiterhin v2, siehe REQUIREMENTS.md |
| Every code change gets a subagent review before "done" (rules in `AGENTS.md` → Review) | Operator's explicit choice; deviates from the harness default (review only on structural signal) | — Pending |
| Deletion framed as good practice, not GDPR compliance promise | A family hosting for itself likely falls under the household exemption; no legal review | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-17 — Code- und Nachweisabgleich; Umsetzung, historische Prüfung und offene Abnahme getrennt.*
