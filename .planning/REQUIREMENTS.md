# Requirements: WordQuest

**Defined:** 2026-09-24
**Core Value:** Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.

## v1 Requirements

### Setup & Accounts

- [ ] **SETUP-01**: Home-network operation over plain HTTP (no domain, no certificate) is a full operating mode, not just a trial: `setup.sh` generates DB password and JWT key, and daily backups run
- [ ] **SETUP-02**: No demo credentials by default; `setup.sh` asks for the parent's email and password and creates the account
- [ ] **SETUP-03**: Parent can change their password in the app
- [ ] **SETUP-04**: Operator can reset a parent's password with one CLI command inside the container
- [ ] **SETUP-05**: Outside Development the API refuses to start with missing or default secrets (no `devpassword` / known JWT key fallback)
- [x] **SETUP-06**: `setup.sh` ist direkt ausführbar; neue und bestehende Secrets bleiben unverändert und sind über read-only Dateimounts für den Non-Root-API-Container lesbar, während das Hostverzeichnis `0700` behält

### Parent Basics

- [ ] **PAR-01**: Parent can edit a child (name, reset PIN, daily new-card limit)
- [ ] **PAR-02**: PIN must be 4–6 digits (validated server-side)
- [ ] **PAR-05**: Parent can create a child (name, PIN, daily new-card limit) in the app; on a fresh install this is the only way to get a first child (UI-SPEC Q3, 2026-10-15)
- [x] **PAR-03**: Parent can delete a child including all learning history
- [x] **PAR-04**: Parent can rename a set and correct an entry without losing learning progress

### Bug Fixes

- [x] **FIX-01**: One family member mistyping cannot lock the others out of login (rate limit per real client IP; token refresh does not consume the login budget)
- [x] **FIX-02**: Deleting a set or entry removes its learning data; no orphaned cards show up in sessions
- [x] **FIX-03**: Cards shown but not answered resurface later instead of staying stuck as `New`
- [x] **FIX-04**: Invalid session/item IDs and double taps return a clean 4xx/409 instead of 500
- [x] **FIX-05**: The dashboard shows the current streak (a broken streak is not displayed as ongoing)
- [ ] **FIX-08**: A child can enter the PIN with the keyboard (digits, Backspace, Enter), not only by tapping
- [x] **FIX-09**: Aborting a learning session does not use up the day's new-card limit; unanswered new cards count only when answered
- [x] **FIX-06**: Mastery rule (ease ≥ 2.1) is defined once and used by overview and traffic light
- [x] **FIX-07**: Eine Lernantwort funktioniert über unsicheres Heimnetz-HTTP per Button und Enter; stabile Antwort-IDs verhindern doppelte Wertung, Retry-Karten behalten eigene IDs und der Lernstand übersteht einen Stack-Neustart

### Design

- [ ] **DESIGN-01**: The frontend follows `DESIGN.md` (Liquid Glass with opaque fallback): Tailwind theme exported from `DESIGN.md`, UI components and pages use only its tokens, axe 0 WCAG 2.2 AA violations on every page

### Quality

- [x] **QUAL-01**: API integration tests against real PostgreSQL cover login, refresh, isolation between siblings, and each FIX requirement
- [ ] **QUAL-02**: New/changed forms (password change, edit child) have frontend tests with the edge-case matrix and pass an axe check (WCAG 2.2 AA)

### Release

- [x] **REL-01**: Operator updates with `upgrade.sh`, which takes a DB backup before pulling the new version
- [x] **REL-02**: Operator restores a backup with `restore.sh`
- [x] **REL-03**: One install page explains home-network setup step by step for non-experts (install, update, backup/restore)
- [ ] **REL-04**: Images are published with a version tag (e.g. `1.0.0`) and the install uses that tag instead of `master`

### Hardening (aus Codex-Gesamtreview 2026-10-19, `.planning/v1.0-CODEX-REVIEW.md`)

- [x] **HARD-01**: Sessions stay consistent: refresh rotation and revocation cannot race, logout cannot be undone by a late refresh, two tabs do not revoke all sessions, and the UI returns to login when the session ends
- [x] **HARD-02**: Learning is consistent: a chosen set limits due cards too, concurrent answers to the same card keep the review state, parallel rounds count open rounds against the daily new-word limit
- [x] **HARD-03**: The per-profile PIN lockout counts every failed attempt, even in parallel
- [x] **HARD-04**: Security headers and CSP are on every HTML response, the CSV import never drops a valid first word, the set list shows load errors, and logout clears cached API data
- [x] **HARD-05**: Parents install and update from the published release package and images without git; upgrade.sh fetches the newest release itself

## v2 Requirements

### Parents

- **PAR2-01**: Assign sets to individual children
- **PAR2-02**: JSON export of family data; delete whole family
- **PAR2-03**: Parent reporting: history over time, problem words, pre-test view, in-app notices

### Accounts

- **ACC2-01**: Second parent account (created by owner)
- **ACC2-02**: Browser setup wizard (for internet-facing installs)

### Learning

- **LRN2-01**: Additional game modes in the frontend (backend already defines `wordcatcher`, `memory`, `cram`)
- **LRN2-02**: Offline learning with outbox + sync

### Operations

- **OPS2-01**: Domain + Let's Encrypt path documented and tested (PWA install)
- **OPS2-02**: Off-host backups, CI restore/upgrade tests, Dependabot, pinned infra images
- **OPS2-03**: Further hardening: service-worker cache allowlist, CSP check on `index.html`, health split, payload limits, no PII in logs, refresh grace window

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple families per instance | One family per home installation |
| Schools / classes | Different audience, much stricter requirements |
| Email / push notifications | No mail infrastructure for non-expert hosters |
| Passkeys / OIDC | Not needed for a home-network family app |
| Tracking, leaderboards, streak penalties | Pressure on children (anti-features) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| SETUP-05 | Phase 1 | Pending |
| SETUP-06 | Phase 1 / Quick 261006-r7l | Complete |
| PAR-01 | Phase 1 | Pending |
| PAR-02 | Phase 1 | Pending |
| PAR-05 | Phase 1 | Pending |
| DESIGN-01 | Phase 1 | Pending |
| PAR-03 | Phase 2 | Complete |
| PAR-04 | Phase 2 | Complete |
| FIX-01 | Phase 2 | Complete |
| FIX-02 | Phase 2 | Complete |
| FIX-03 | Phase 2 | Complete |
| FIX-04 | Phase 2 | Complete |
| FIX-05 | Phase 2 | Complete |
| FIX-06 | Phase 2 | Complete |
| FIX-08 | Phase 1 | Pending |
| FIX-09 | Phase 2 | Complete |
| FIX-07 | Phase 1 / Quick 261006-r7l | Complete (2026-10-15; axe-Lauf offen, siehe Quick-Verifikation) |
| QUAL-01 | Phase 2 | Complete |
| QUAL-02 | Phase 1 | Pending |
| REL-01 | Phase 3 | Complete |
| REL-02 | Phase 3 | Complete |
| REL-03 | Phase 3 | Complete |
| REL-04 | Phase 3 | Pending |
| HARD-01 | Phase 3.1 | Complete |
| HARD-02 | Phase 3.1 | Complete |
| HARD-03 | Phase 3.1 | Complete |
| HARD-04 | Phase 3.1 | Complete |
| HARD-05 | Phase 3.1 | Complete |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-09-24*
*Last updated: 2026-10-19 — HARD-01 bis HARD-04 (Codex-Gesamtreview) und HARD-05 (D-16, Installation und Update ohne Git) für Phase 3.1 ergänzt.*
