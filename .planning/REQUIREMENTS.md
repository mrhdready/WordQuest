# Requirements: WordQuest

**Defined:** 2026-09-24
**Core Value:** A family that is not the author can install WordQuest on their own hardware and run it securely: no default credentials, sane defaults, working backups, stable operation.

## v1 Requirements

### Accounts

- [ ] **ACCT-01**: Fresh install has no default credentials; demo seeding runs only on explicit opt-in and never together with setup
- [ ] **ACCT-02**: `setup.sh` generates a one-time setup token and prints the setup URL (`https://host/setup#token`)
- [ ] **ACCT-03**: Owner can complete the first-run wizard (owner account + family) only with a valid setup token; concurrent attempts yield exactly one tenant (loser gets 409)
- [ ] **ACCT-04**: Operator can re-arm setup via CLI `setup-token` (the setup does not reopen by itself after tenant delete)
- [ ] **ACCT-05**: Guardian can change own password; other sessions (refresh tokens) are revoked
- [ ] **ACCT-06**: Operator can reset a guardian password via CLI `reset-password` inside the container (generated password printed); `list-users` shows accounts
- [ ] **ACCT-07**: Owner can invite a second guardian via one-time link (hashed token in URL fragment, 7-day expiry, revocable) and remove a guardian
- [ ] **ACCT-08**: Guardian can edit a learner (display name, PIN reset, daily new-card limit)
- [ ] **ACCT-09**: PIN format is validated server-side (4–6 digits)

### Content & Assignment

- [ ] **CONT-01**: Guardian can rename a set and correct an entry without losing learning progress
- [ ] **CONT-02**: Guardian can assign sets to individual learners; learners only learn and see assigned sets
- [ ] **CONT-03**: Deleting a set or entry removes all dependent learning data (no orphaned review states)
- [ ] **CONT-04**: Import and sync payloads are bounded (row count, content length)

### Hardening

- [ ] **HARD-01**: Rate limiting applies per real client IP behind Traefik + nginx; token refresh has its own budget
- [ ] **HARD-02**: Invalid session/item IDs return 4xx instead of 500; sync skips and reports bad answers
- [ ] **HARD-03**: Concurrent answer submissions never produce 500 or lost updates (409 on conflict)
- [ ] **HARD-04**: Outside Development, missing/invalid secrets stop startup (no `devpassword` fallback); quick compose ships no known JWT key
- [ ] **HARD-05**: Failed-login logs contain no email address
- [ ] **HARD-06**: Liveness and readiness are separate; health endpoints are not reachable through nginx
- [ ] **HARD-07**: CSP and security headers are delivered on every response including `index.html`
- [ ] **HARD-08**: Service worker caches only an allowlist of API responses; cache is cleared on logout
- [ ] **HARD-09**: Cards shown but not answered never get stuck in state `New` (they resurface)
- [ ] **HARD-10**: Mastery rule (ease ≥ 2.1) is defined once in the Learning module and used by all views
- [ ] **HARD-11**: The displayed streak is the effective streak (a lapsed streak is not shown as current)
- [ ] **HARD-12**: A brief network hiccup during token refresh does not log the user out (reuse grace window)
- [ ] **HARD-13**: On a LAN install with a self-signed certificate the app works fully in the browser without service worker (no errors, no broken states)

### Privacy

- [ ] **PRIV-01**: Guardian can delete a learner including all learning history
- [ ] **PRIV-02**: Guardian can export all family data as JSON (no password/PIN/token hashes)
- [ ] **PRIV-03**: Owner can delete the entire family/account; instance returns to a locked first-run state
- [ ] **PRIV-04**: Before deleting, the UI states how long data remains in backups
- [ ] **PRIV-05**: After a delete, no rows of the deleted learner/tenant remain in any table (verified by test)

### Parent Reporting

- [ ] **REPT-01**: Guardian sees learning history per learner over time (cards per day/week, active days)
- [ ] **REPT-02**: Guardian sees problem words per learner, including the child's actual wrong answers
- [ ] **REPT-03**: Guardian can set a test date per learner and set and sees readiness for that test (recall answers only)
- [ ] **REPT-04**: Guardian sees in-app notices on the dashboard (weekly summary, "has not practiced for N days")
- [ ] **REPT-05**: Day boundaries follow the configured time zone including DST

### Game Modes

- [ ] **GAME-01**: Session page uses a game registry; learner can pick a game mode (behaviour of `classic` unchanged)
- [ ] **GAME-02**: Game modes cannot inflate scheduling: recognition modes capped at Good, response time ignored, readiness only from recall answers (interval-bound test)
- [ ] **GAME-03**: At least one additional game mode ships in v1.0 — which one(s) (`cram`, `wordcatcher`, …) is decided in the phase discussion
- [ ] **GAME-04**: If `cram` ships: own session composition, no rescheduling, daily XP cap

### Quality

- [ ] **QUAL-01**: API integration tests run against real PostgreSQL (auth, refresh rotation, tenant + sibling isolation, `MayActFor`)
- [ ] **QUAL-02**: Frontend has a test runner; login and setup forms are covered by the edge-case matrix
- [ ] **QUAL-03**: CI fails on pending EF model changes and applies migrations to Postgres
- [ ] **QUAL-04**: Touched pages pass axe (WCAG 2.2 AA) in CI

### Operations & Release

- [ ] **OPS-01**: Operator runs `upgrade.sh`, which takes a DB dump before pulling the new version
- [ ] **OPS-02**: Operator restores from a dump via `restore.sh`; CI runs a restore test
- [ ] **OPS-03**: CI migrates a dump of the previous release forward
- [ ] **OPS-04**: Optional off-host backup via a compose profile
- [ ] **OPS-05**: `setup.sh` validates host, email and TLS mode; the LAN mode with a self-signed certificate is the documented and tested path
- [ ] **OPS-06**: nginx resolves the API dynamically (no 502 after the API container is recreated)
- [ ] **OPS-07**: Images are released as semver on public GHCR; infra images are pinned; Dependabot updates dependencies
- [ ] **OPS-08**: Docs cover install, upgrade, backup/restore and troubleshooting; SECURITY.md, LICENSE, CHANGELOG exist
- [ ] **OPS-09**: A third party installs v1.0 from the docs without help

## v2 Requirements

### Offline

- **OFFL-01**: Learner can learn offline; answers are queued (IndexedDB outbox) and synced with client answer timestamps

### Accounts

- **ACCT2-01**: Passkeys (WebAuthn) for guardians
- **ACCT2-02**: OIDC/SSO login

### Game Modes

- **GAME2-01**: Memory (needs a match answer contract)
- **GAME2-02**: Further concept games

### Misc

- **MISC-01**: Version display in UI/API/CLI + client/API version check
- **MISC-02**: Child-visible transparency note ("your parents can see your progress")
- **MISC-03**: PWA path with domain + DNS-01 certificate documented and tested
- **MISC-04**: Set CSV export, server-side notice dismissal

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple families per instance | Target is one family per self-hosted instance |
| Schools / classes | Much stricter GDPR requirements, not the target audience |
| Email / Web Push notifications | In-app only, no mail infrastructure for hosters |
| Minute-level tracking, cheat reports, leaderboards, pass/fail prediction | Surveillance and pressure on children (anti-features) |
| Streak penalties, XP/heart loss | Demotivating (anti-features) |
| Soft-delete trash for learners | Deletion must be real (privacy) |
| Built-in cloud backup, default-on update check | No telemetry and no outbound dependency |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 0 (roadmap pending)

---
*Requirements defined: 2026-09-24*
*Last updated: 2026-09-24 after initial definition*
