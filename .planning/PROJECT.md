# WordQuest

## What This Is

WordQuest is a simple vocabulary learning app for children that parents without special know-how can set up in their home network. A parent manages vocabulary sets (manual or CSV import) and child profiles; children log in via profile picker + PIN and learn with SM-2 spaced repetition, XP, streaks and levels. It runs as a Docker Compose stack on a home server such as a Raspberry Pi 5 or NAS. This cycle delivers a working, safe base (v1.0) that other families can install from one install page.

## Core Value

Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.

## Requirements

### Validated

<!-- Inferred from existing code (commit 4ce32da). -->

- ✓ Guardian login (email/password) and learner login via profile picker + PIN, JWT + rotating refresh tokens with reuse detection — existing
- ✓ Tenant isolation via EF global query filters on all tenant-owned entities — existing
- ✓ Guardian can create learners and manage vocabulary sets and entries — existing
- ✓ CSV vocabulary import with preview and confirm — existing
- ✓ Learning sessions: composition of relearning/due/new cards, server-side grading (normalization + Damerau-Levenshtein), SM-2 scheduling — existing
- ✓ Gamification: XP per answer, completion bonus, streaks, level curve — existing
- ✓ Parent views: learner overview and traffic-light mastery per set — existing
- ✓ Docker Compose variants: `docker-compose.quick.yml` (HTTP :8080, trial only today) and `docker-compose.yml` (Traefik + Let's Encrypt DNS-01, daily backups, `setup.sh` for secrets) — existing
- ✓ CI: build with `/warnaserror`, backend unit tests, frontend lint/typecheck/build, migration presence check — existing

### Active

See `.planning/REQUIREMENTS.md` (21 v1 requirements):
- [ ] Setup & accounts: HTTP home-network mode as full operating mode, no demo credentials, parent account created by `setup.sh`, password change, CLI reset, fail-fast secrets
- [ ] Parent basics: edit child (PIN reset), PIN validation, delete child, edit set/entry
- [ ] Bug fixes: rate-limit lockout, orphaned learning data, stuck `New` cards, 500s on bad IDs/double taps, stale streak, single mastery rule
- [ ] Quality: API integration tests on real Postgres; form tests + axe for new forms
- [ ] Release: `upgrade.sh` with pre-backup, `restore.sh`, one install page, versioned images

### Out of Scope

- Multiple families per instance — one family per home installation
- Schools / classes — different audience, much stricter requirements
- Email / push notifications — no mail infrastructure for non-expert hosters
- Passkeys / OIDC — not needed for a home-network family app
- Tracking, leaderboards, streak penalties — pressure on children
- Deferred to v2 (see REQUIREMENTS.md): set assignment per child, export / delete family, parent reporting, second parent, browser setup wizard, new game modes, offline outbox, domain/PWA path, off-host backups and deeper hardening

## Context

- Brownfield: modular monolith backend (.NET 10, EF Core 10, Minimal APIs), React 19 + Vite + Tailwind 4 PWA frontend, PostgreSQL 17. Codebase map in `.planning/codebase/` (mapped at `4ce32da`).
- Concept doc `Documentation/WordQuest_Konzept_und_Architektur.md`; deviations listed in `.planning/codebase/ARCHITECTURE.md`.
- Research in `.planning/research/` covers a much larger scope (53 requirements); it was cut back deliberately. Its findings stay valid input for v2.
- `docker-compose.quick.yml` today ships known defaults (`WQ_JWT_SIGNING_KEY` fallback, DB password `wordquest`, `WQ_SEED_DEMO_DATA: "true"`) and no backups. It is labelled as trial only.
- Frontend never calls `/sessions/sync`, so there is no real offline learning. Without HTTPS the service worker does not register, so the app runs as a plain browser app.
- Known gaps: the only test project is `backend/tests/WordQuest.Learning.Tests/` (pure domain), and the frontend has no test runner.

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
| Primary operating mode: home network over plain HTTP, no domain | Simplest for non-experts, no certificate warnings; no PWA install (service worker needs HTTPS) | — Pending |
| Domain + Let's Encrypt compose stays as-is for advanced users | Already exists, not extended in v1.0 | — Pending |
| Parent account created by `setup.sh` instead of a browser wizard | Home network only; no setup takeover window, same mechanism as CLI reset | — Pending |
| Mastery threshold ease ≥ 2.1, one constant | Concept doc contradicts itself (2.0 vs 2.1); 2.1 matches current code | — Pending |
| Offline learning, new game modes, reporting deferred to v2 | Not needed for a working base | — Pending |
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
*Last updated: 2026-09-24 after scope reduction to a working base*
