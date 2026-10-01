# Project Research Summary

**Project:** WordQuest
**Domain:** Self-hosted family vocabulary-learning PWA (SM-2, children's data, Docker Compose on ARM home hardware) — brownfield v1.0 self-hosting release
**Researched:** 2026-09-24
**Confidence:** MEDIUM-HIGH (codebase observations HIGH, read-in-source not runtime-reproduced; versions HIGH via registry APIs; framework behaviour and ecosystem claims MEDIUM; legal framing LOW)

## Executive Summary

WordQuest already has a working learning core (auth, tenant filters, SM-2, gamification, CSV import, compose deployment). v1.0 is not a technology problem — it is a "make it safe and operable for a family that isn't the author" problem: no default credentials, a recovery path without SMTP, correct deletion of children's data, honest parent reports, and an install/upgrade/restore path that works from documentation alone. Comparable self-hosted apps (Immich, Home Assistant, Paperless, Jellyfin) converge on the same pattern: web first-run wizard, CLI password reset inside the container, admin-created/invited extra users, version pinned in `.env`, documented dump-based backup, "no downgrade" upgrades.

The recommended approach is almost dependency-free: BCL/ASP.NET Core/EF Core for every backend capability, plus `Microsoft.AspNetCore.Mvc.Testing` for integration tests and a pinned `dotnet-ef` tool for a CI model-drift gate; Vitest + Testing Library + Playwright + axe-core as frontend devDependencies; no chart/date/validation libraries. Architecture stays a modular monolith: new DB-touching services (`ReportingService`, `PrivacyService`) in Infrastructure, pure rules (`Mastery`, `TrafficLight`, `Readiness`) in `Modules.Learning`, account logic next to `AuthService` in Api. Reports are computed on read; deletion relies on DB-level FK cascades — which the current schema almost entirely lacks, so an orphan-cleanup + FK migration is a prerequisite.

The research surfaced several existing defects that change the plan (all derived from code, not runtime-reproduced): (1) deleting a set/entry orphans `review_state`/`review_log`; (2) shown-but-unanswered and `cram` cards stay `New` forever and never resurface; (3) `wordcatcher` can grade a <2 s tap as Easy, inflating SM-2 intervals and making readiness lie; (4) the frontend never calls `/sessions/sync`, so PROJECT.md's Validated list overstates offline learning; (5) nginx `add_header` inheritance very likely strips the CSP from `index.html` — the CSP is the stated mitigation for localStorage tokens; (6) the service worker caches every authenticated `GET /api/*` for 7 days (shared-tablet leak, outlives GDPR deletes); (7) the quick compose ships a known JWT signing key. The biggest new risk is setup-wizard takeover via Certificate Transparency discovery — the wizard must be gated by a setup token.

## Key Findings

### Recommended Stack

Keep the existing stack (.NET 10, EF Core 10.0.12, Npgsql 10.0.3, PostgreSQL 17, React 19, Vite 8, Traefik v3). Do not move to .NET 11 / Npgsql 11 / Postgres 18 / xunit.v3 4.x in this milestone.

**Additions:**
- `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 — `WebApplicationFactory` integration tests
- `dotnet-ef` 10.0.12 (tool manifest) — CI `has-pending-model-changes`; EF 9+ `MigrateAsync` throws on model drift, so a forgotten migration crash-loops every install
- Vitest 5.0.1 + jsdom 30 + Testing Library; Playwright 1.63 + `@axe-core/playwright` 4.13 — no MSW, stub `fetch`
- Pinned images: `postgres:17.11-alpine`, `traefik:v3.7.13`, `nginxinc/nginx-unprivileged:1.30.5-alpine`, `prodrigestivill/postgres-backup-local:17-alpine-d257e5d`; Dependabot (incl. `docker-compose` ecosystem)
- Optional off-host backup: `offen/docker-volume-backup` v2.49.1 behind an `offsite` profile, read-only mount

**API trap:** `KnownIPNetworks`, not `KnownNetworks` (ASPDEPR005 obsolete in .NET 10 → fails `/warnaserror`); `ForwardLimit = 2` (Traefik → nginx → api).

**Rejected:** FluentValidation, MediatR, ASP.NET Core Identity, Data Protection for tokens, System.CommandLine, chart/date libs, Renovate, image digest pinning.

### Expected Features

**Must have (table stakes):** first-run wizard with setup token + demo seed opt-in; password change (revokes other refresh tokens); CLI `reset-password` / `list-users` / `version` / `setup-token`; owner-only guardian invite (hashed token in URL fragment, expiry, revoke, remove-guardian); **edit learner** (name, PIN reset, daily limit — missing from PROJECT.md, a forgotten child PIN is unrecoverable today); delete learner (hard cascade); JSON export (no hashes); delete tenant → locked first-run state; game picker + `GameCatalog` fairness; `cram` with its own composition; accessible `wordcatcher`; day-level history, problem words with actual wrong answers, pre-test view with test date, on-read notices; install/upgrade/restore/troubleshooting docs; version in UI/API/CLI; semver GHCR images, CHANGELOG, SECURITY.md, LICENSE; child-visible transparency note.

**Differentiators:** pre-test view → one-click cram; problem words with the child's actual misspellings; games that cannot inflate scheduling; no default credentials + setup token; no telemetry.

**Defer:** `memory` game (needs new "match" answer contract), set CSV export, server-side notice dismissal, further concept games, update check, TTS, OIDC/passkeys.

**Anti-features:** minute-level tracking, cheat reports, leaderboards, pass/fail predictions, streak penalties, XP/heart loss on wrong answers, soft-delete learner trash, built-in cloud backup, default-on update check.

### Architecture Approach

Modular monolith unchanged; no `Modules.Reporting` project (documented deviation from concept §10.2).

1. **`AccountService`** (Api/Auth) — setup under `pg_advisory_xact_lock` inside `CreateExecutionStrategy()` (mandatory because of `EnableRetryOnFailure`)
2. **`Mastery` / `TrafficLight` / `Readiness`** — pure in `Modules.Learning`; single mastery definition as EF expression + compiled scalar, equivalence-tested
3. **`ReportingService`** — read-only, bounded windows, day-bucketing in C#; no aggregate tables, no background jobs
4. **`PrivacyService`** — export via explicit field allowlist DTOs; delete via `ExecuteDeleteAsync` + DB cascades, after an orphan-cleanup + FK migration (incl. `tenant_id` FKs)
5. **Error mapping** — `NotFoundException`/`DomainRuleException` via `StatusCodeSelector`; never map `InvalidOperationException` globally; xmin + `23505` → 409
6. **Frontend** — `SessionPage` becomes the engine (API, timing); games are presentational `{onAnswer}` components; grading stays server-side
7. **`IgnoreQueryFilters()`** confined to Api/Auth + CLI (grep gate)

### Critical Pitfalls

1. **Setup takeover** — CT-log discovery, setup race, re-open after tenant delete, seed creating a second tenant → token in URL fragment, advisory lock + 409 loser, re-arm only via CLI, seed/setup mutually exclusive
2. **Recognition games inflate SM-2 and make readiness lie** — decide the policy before any new mode ships
3. **Orphaned `New` cards** — add a candidate query or composer-specific cram; regression test
4. **GDPR delete leaves data** — no FKs, backups retain up to ~6 months, SW cache, unrotated logs
5. **Upgrades / stale PWA** — unguarded startup migration; nginx caches api IP (502 after recreate); SW `autoUpdate` + all API GETs cached → `upgrade.sh` with pre-dump, previous-release-dump migration test in CI, nginx `resolver 127.0.0.11`, SW `prompt`, cache allowlist + clear on logout/delete
6. **HTTPS/DNS for non-technical hosters** — `.local` default, `example.com` ACME email, `manual` DNS provider, FRITZ!Box rebind, DS-Lite → validation in `setup.sh`, one documented tested path, third-party install

Also: missing CSP, known JWT key in quick compose, refresh-reuse logout on flaky Wi-Fi (grace window), time-zone/DST day buckets, stale stored streak shown as current.

## Conflicts Between Researchers (need a decision)

| Topic | Positions | Recommendation |
|---|---|---|
| Setup protection | STACK/ARCH: in-memory code in log · FEATURES/PITFALLS: `setup.sh` token + printed URL, CLI `setup-token` re-arms after tenant delete | `setup.sh` token + CLI re-arm, log fallback; user confirms UX |
| Streak history | ARCH/FEATURES: on read · PITFALLS: `learner_activity_day` table | On read + one effective-streak function; no streak-over-time chart; table only if saver days must be historicised |
| Test DB | STACK: external Postgres · ARCH/PITFALLS: Testcontainers | External Postgres (dotnet runs in an SDK container locally, Testcontainers needs extra wiring) |
| CLI reset position in `Program.cs` | after migrate / before migrate / after `Build()` | Directly after `Build()`, before migrate/seed; generate + print password |
| xmin mapping | entity property vs shadow | Shadow property |
| Invite link origin | `WQ_PUBLIC_URL` vs `window.location.origin` | `window.location.origin` |
| Invite expiry | 72 h vs 7 d | 7 d |
| Recognition policy | Good cap vs `AffectsScheduling=false` | Good cap + ignore `answerMs` + recall-only readiness; interval-bound test after N recognition answers; fallback `AffectsScheduling=false` |

## Open Decisions for the User

- Mastery threshold 2.0 vs 2.1 — recommend 2.1, one constant
- Learner ↔ set assignment (currently none; reports mix siblings' vocab) — recommend per-set reports in v1.0
- Test date per set or per learner+set — per learner+set is correct if siblings share sets without assignment
- Offline learning in or out of v1.0 — recommend out + correct PROJECT.md; in means outbox + clamped client `AnsweredAt` + E2E test
- LAN-only vs HTTPS with domain — recommend one documented path: DynDNS name + DNS-01, LAN/VPN access, internet exposure optional with warning
- Set/entry editing in v1.0 — recommend yes, together with the FK migration
- Edit learner — recommend P1
- Cram XP farming — cap XP or no streak credit for cram-only days
- Backup retention vs deletion — show retention horizon in the UI; optionally reduce monthly dumps to 3 or keep a re-apply deletion log
- GDPR wording — household exemption likely; phrase docs as good practice. UNBEKANNT: legal review

## Implications for Roadmap

1. **Test Harness + CI gates** — integration project with real Postgres, per-test tenant, configurable rate limit; characterization tests for auth/refresh/isolation/`MayActFor`; Vitest; pending-model-changes; action bumps
2. **Hardening** — error mapping, xmin/409, sync skip-and-report, forwarded headers + split refresh limit, health split, secrets fail-fast, PIN validation, no PII logs; extract `Mastery`/`TrafficLight` + effective streak; fix orphaned `New` cards; CSP per nginx location; quick-compose key; SW cache allowlist + clear on logout; refresh grace window; TZ fail-fast
3. **Accounts** — seed off, setup wizard (token + lock), password change, CLI, `Owner` policy, invites, edit learner; form edge-case matrix + axe
4. **Data integrity + privacy** — orphan cleanup + FK migration; delete learner/export/delete tenant (→ locked first-run); cache clearing, retention text, log rotation, no-rows-left test; set/entry editing if accepted
5. **Parent reporting** — `ReportingService`, day-level history, problem words, test date + recall-only readiness, on-read notices; DST/late-evening tests
6. **Game registry refactor** — no behaviour change; parallelisable with 4–5 after 1
7. **New game modes** — `GameCatalog` policy + interval-bound test; `cram` composition; accessible `wordcatcher`; `memory` deferred
8. **Release/Ops** — pins, Dependabot, public GHCR + anonymous-pull test, `$BUILDPLATFORM`, `setup.sh` validation, `upgrade.sh`, `restore.sh` + CI restore test, previous-release-dump migration test, nginx resolver, SW prompt + version check, docs, third-party install

**Research flags:** needs research — Phase 3 (setup-token UX, authorization matrix), Phase 4 (migration against a real dump), Phase 7 (wordcatcher a11y, recognition policy), Phase 8 (DNS-01 providers, FRITZ!Box, offen read-only mount, Playwright with SW). Standard patterns — Phases 1, 2, 5, 6.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Registry-sourced versions; some behaviour from memory |
| Features | MEDIUM | Codebase facts HIGH; GDPR framing LOW |
| Architecture | HIGH | Read from code at `4ce32da` |
| Pitfalls | MEDIUM | Code-derived bugs not reproduced |

**Gaps:** reproduce orphan / stuck-`New` / CSP / SW-cache bugs with failing tests first; `UseSetting` timing in test host; Playwright with SW blocked; whether a Good cap bounds intervals; PBKDF2 latency on a Pi 5; GHCR visibility on first push; legal review.

## Sources

Full URL lists in the four research files. Primary: repository code at `4ce32da`; NuGet/npm/Docker Hub/GitHub APIs. Secondary: Microsoft Learn; Npgsql, vite-plugin-pwa, Playwright, nginx docs; Immich, Home Assistant, Paperless, Mealie, Portainer, phase6, Quizlet, cabuu, Anki docs. LOW: GDPR interpretation, streak/child-monitoring articles.

---
*Research completed: 2026-09-24*
*Ready for roadmap: yes, once the open decisions are answered or explicitly deferred*
