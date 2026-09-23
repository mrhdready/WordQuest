# WordQuest

## What This Is

WordQuest is a self-hosted vocabulary learning PWA for families: a guardian manages vocabulary sets (manual or CSV import) and child profiles, children log in via profile picker + PIN and learn with SM-2 spaced repetition, XP, streaks and levels. It runs as a Docker Compose stack (Traefik, nginx/React, ASP.NET Core, PostgreSQL) on a home server such as a Raspberry Pi 5 or NAS. This cycle turns it into a v1.0 release that other families can install and run on their own hardware.

## Core Value

A family that is not the author can install WordQuest on their own hardware and run it securely: no default credentials, sane defaults, working backups, stable operation.

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
- ✓ PWA with Workbox runtime cache; server-side `/sessions/sync` endpoint — existing
- ✓ Docker Compose deployment with Traefik/Let's Encrypt, daily DB backups, multi-arch images, `setup.sh` for secrets — existing
- ✓ CI: build with `/warnaserror`, backend unit tests, frontend lint/typecheck/build, migration presence check — existing

### Active

**Accounts (current self-hosting practice):**
- [ ] First-run setup wizard creates owner + tenant when none exists; no default credentials
- [ ] Demo data seeding is opt-in only (off in production compose)
- [ ] Guardian can change own password in settings
- [ ] Password reset via CLI command inside the container (no SMTP dependency)
- [ ] Owner can invite a second guardian

**Hardening (from `.planning/codebase/CONCERNS.md`):**
- [ ] Rate limiting per real client IP behind Traefik/nginx (forwarded headers); refresh not sharing the login budget
- [ ] Invalid session/item IDs return 4xx instead of 500; sync skips-and-reports bad answers
- [ ] Concurrent answer submissions are safe (concurrency token, 409 instead of 500/lost update)
- [ ] Secrets fail fast outside Development (no silent `devpassword` fallback)
- [ ] PIN format validated server-side; payload size/count limits on import and sync
- [ ] No PII (email) in failed-login logs
- [ ] Separate liveness/readiness health checks; health not exposed via nginx
- [ ] Mastery rule in one place in the Learning module (no duplication in endpoints)
- [ ] Pinned image versions (semver releases, infra images pinned); placeholder image prefix replaced
- [ ] Off-host backup option and a documented, tested restore procedure

**Privacy (GDPR, children's data):**
- [ ] Guardian can delete a learner including all learning history
- [ ] Guardian can export all family data as JSON
- [ ] Owner can delete the entire tenant/account

**Parent reporting (in-app only):**
- [ ] History over time (learning time / cards per day and week, streak history)
- [ ] Problem words (cards with many errors/lapses)
- [ ] Pre-test view: readiness of a set before a test date
- [ ] In-app notices (weekly summary, "has not practiced") on the parent dashboard

**Game modes:**
- [ ] Additional game modes in the frontend. Backend `GameCatalog` already defines `classic`, `wordcatcher`, `memory` and `cram`, but the frontend only uses `classic`. Which modes to ship is open, and research should propose options.

**Quality:**
- [ ] API integration tests (auth, refresh rotation, tenant + sibling isolation, `MayActFor`) via `WebApplicationFactory`
- [ ] Frontend test runner + tests for login forms and session flow (edge-case matrix per house rules)
- [ ] CI checks for pending model changes and applies migrations to Postgres
- [ ] WCAG 2.2 AA check on touched pages

**Release:**
- [ ] v1.0 tagged, images published on GHCR, installation/upgrade/backup documentation, and a fresh install by a third party works without help

### Out of Scope

- Multiple families on one instance (real multi-tenant SaaS) — the target is one family per self-hosted instance
- Schools / classes — much stricter GDPR requirements, and not the target audience
- Passkeys / WebAuthn — deferred, basic auth is sufficient for v1.0
- OIDC / SSO (Authentik, Authelia, Keycloak) — deferred to after v1.0
- Email (SMTP) and Web Push notifications — notices are in-app only, which avoids mail server setup for hosters
- In-app registration for arbitrary users — only first-run owner setup + guardian invite

## Context

- Brownfield: modular monolith backend (.NET 10, EF Core 10, Minimal APIs), React 19 + Vite + Tailwind 4 PWA frontend, PostgreSQL 17. Codebase map in `.planning/codebase/` (mapped at `4ce32da`).
- Concept doc `Documentation/WordQuest_Konzept_und_Architektur.md`, deviations listed in `.planning/codebase/ARCHITECTURE.md` (no Reporting module, no domain events, no frontend game registry, no IndexedDB outbox).
- Deployment targets: Raspberry Pi 5 / ARM NAS, HTTPS required for PWA install.
- Known gaps: the only test project is `backend/tests/WordQuest.Learning.Tests/` (pure domain), and the frontend has no test runner.
- Current branch `production-readiness`.

## Constraints

- **Tech stack**: keep .NET 10 / EF Core / React / PostgreSQL / Docker Compose — existing working stack
- **Architecture**: domain modules stay dependency-free (no NuGet refs), endpoints stay thin, and business logic goes into services/modules (house rule)
- **Hosting**: must run on ARM64 home hardware with a single API replica, because the startup migration and in-memory rate limiter assume one instance
- **Security**: tokens stay in localStorage (documented offline trade-off), so the CSP stays strict
- **Operations**: an operator without developer background must be able to install, upgrade, back up and restore using documentation only
- **Accessibility**: WCAG 2.2 AA minimum on all UI changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Audience: other families self-hosting, one tenant per instance | Matches existing single-tenant profile picker, no SaaS ops burden | — Pending |
| Auth scope "basic": setup wizard, password change, CLI reset, guardian invite | Current practice of self-hosted apps (Immich, Jellyfin, Paperless) without mandatory SMTP | — Pending |
| Notifications in-app only | No mail/push infrastructure for hosters | — Pending |
| GDPR delete + export in v1.0 | Children's data, the hoster is the data controller | — Pending |
| Core value: secure self-hostability wins trade-offs | v1.0 is a release for third parties | — Pending |
| Done = v1.0 release a third party can install unaided | Observable release criterion | — Pending |

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
*Last updated: 2026-09-24 after initialization*
