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
- [ ] **PAR-02**: PIN must be exactly 4 digits (validated server-side; the parent forms accept at most 4 characters)
- [ ] **PAR-05**: Parent can create a child (name, PIN, daily new-card limit) in the app; on a fresh install this is the only way to get a first child (UI-SPEC Q3, 2026-10-15)
- [x] **PAR-03**: Parent can delete a child including all learning history
- [x] **PAR-04**: Parent can rename a set and correct an entry without losing learning progress

### Bug Fixes

- [x] **FIX-01**: One family member mistyping cannot lock the others out of login (rate limit per real client IP; token refresh does not consume the login budget)
- [x] **FIX-02**: Deleting a set or entry removes its learning data; no orphaned cards show up in sessions
- [x] **FIX-03**: Cards shown but not answered resurface later instead of staying stuck as `New`
- [x] **FIX-04**: Invalid session/item IDs and double taps return a clean 4xx/409 instead of 500
- [x] **FIX-05**: The dashboard shows the current streak (a broken streak is not displayed as ongoing)
- [ ] **FIX-08**: A child can enter the PIN with the keyboard (digits, Backspace), not only by tapping; the 4th digit submits exactly once (2026-10-21)
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

### Pictures (Dennis 2026-10-22)

- [ ] **IMG-01**: Parents can give each vocabulary entry its own picture (add, replace, remove); children see it in the learning round; pictures are stored in the database, isolated per family, and survive backup, restore and upgrade

### HTTPS im Heimnetz (Owner-Entscheidung 2026-10-25)

- [ ] **TLS-01**: Jede Installation hat eine eigene Zertifizierungsstelle (10 Jahre, RSA 3072) und ein davon signiertes Server-Zertifikat (RSA 2048, höchstens 800 Tage, EKU serverAuth, alle Namen und IPs im SAN); der CA-Schlüssel verlässt nie das CA-Volume des Dienstes certs, wird nie ausgeliefert und liegt nicht in den Sicherungen.
- [ ] **TLS-02**: Das Server-Zertifikat wird ohne CA-Wechsel automatisch neu ausgestellt, täglich geprüft bei weniger als 30 Tagen Restlaufzeit und bei geänderter Namensliste mit dem nächsten `./setup.sh`, und nginx übernimmt es ohne Neustart.
- [ ] **TLS-03**: Die Ports 80 und 443 leiten mit 301 auf HTTPS um, setup.sh prüft vorher, ob sie belegt sind, und weicht auf 8080/8443 aus; es gibt kein HSTS.
- [ ] **TLS-04**: Die CA lässt sich über HTTP und HTTPS herunterladen, setup.sh zeigt am Ende die Fingerabdrücke, die Doku erklärt Browserwarnung und CA-Installation je Browser und Gerät in Laiensprache, und die Abnahme läuft auf echten Geräten.
- [ ] **TLS-05**: Traefik und Let's Encrypt sind entfernt, die neue Paketliste ist in release-package.sh, upgrade.sh und dem Release-Smoke konsistent, und Installationen der Version 1.0.x werden nicht migriert.
- [ ] **TLS-06**: WordQuest erscheint mit diesen Änderungen als Release 1.1.0.

## v2 Requirements

### Parents

- **PAR2-01**: Assign sets to individual children
- **PAR2-02**: JSON export of family data; delete whole family
- **PAR2-03**: Parent reporting: history over time, problem words, pre-test view, in-app notices
- **PAR2-04**: Read-only family dashboard for a wall tablet: all children side by side (level, streak, done today), refreshes itself; access via a display link the parent creates and can revoke, not via a parent session

### Accounts

- **ACC2-01**: Second parent account (created by owner)
- **ACC2-02**: Browser setup wizard (for internet-facing installs)

### Learning

- **LRN2-01**: Additional game modes in the frontend (backend already defines `wordcatcher`, `memory`, `cram`)
- **LRN2-02**: Offline learning with outbox + sync
- **CNT2-01**: Vocabulary library: curated CC0 sets by grade and topic in the repo, checked in CI, offered next to the CSV import ("Aus der Bibliothek", served from the web image); proposal in `.planning/research/VOKABEL-REGISTRY.md`
- **SPL2-01**: Set type "Lernwörter": parents create a spelling set (one language, setting "article required" yes/no); every entry is a word plus a picture or an emoji, without both it cannot be saved (Dennis 2026-10-25, module proposal `.planning/research/LERNWOERTER-MODUL.md`)
- **SPL2-02**: In a Lernwörter round the child sees only the picture (or emoji) and types the word; the screen-reader text does not reveal the word
- **SPL2-03**: Strict server-side grading for Lernwörter: case matters, every typo is wrong, article per set setting; on a mistake the feedback shows the correct spelling and marks the letters where the input differs (not by color alone)
- **SPL2-04**: Spaced repetition, XP, streak and progress apply to Lernwörter sets as to vocabulary sets
- **SPL2-05**: "Anhören" button in a Lernwörter round reads the word aloud via the browser's speech synthesis (dictation, no new dependency, no internet), keyboard-reachable; without a voice for the language the button is disabled with a German hint (Dennis 2026-10-25; cloud TTS such as ElevenLabs and server-side Piper rejected; the picture requirement stays)
- **SPL2-06**: Later stage: parents record their own pronunciation per word; it plays instead of speech synthesis and is stored, backed up and restored like pictures
- **LRN2-03**: Further games from the concept: Monster-Duell, Buchstaben-Chaos, Zeitrennen (§4 Should, §7.2)
- **LRN2-04**: Read-aloud for vocabulary items via the browser's speech synthesis (§4 Should), same mechanism as `SPL2-05`
- **LRN2-05**: Quest rules from the concept: a round also ends after 5 minutes (M5); streak counter shown from day 3 (§8); the child sees that parents can see the progress (§9)
- **LRN2-06**: Card type "hear → write" (`AudioToSource`, §5.1), after `LRN2-04`
- **CNT2-02**: CSV import with column mapping in the UI (M2) and quick entry `Hund = dog` (M1)
- **CNT2-03**: Parents maintain answer alternatives, part of speech and example sentences in the UI and CSV (fields exist, §5.2)

### Gamification

Source: gap analysis 2026-10-25 against the original concept by mrhdready (`7788890`, changes in `3d0684a`/`233ccd9`); section numbers refer to that concept. Prioritisation open in the GitHub issue "Offene Punkte aus dem Ursprungskonzept".

- **GAM2-01**: Spend coins: avatar items and treasure chests, avatar customisation (§8, §4 Should)
- **GAM2-02**: Collectible cards, daily missions, trophies/achievements, theme worlds (§8, §18); asset licences depend on O5 (licence)

### Operations

- **OPS2-02**: Off-host backups, CI restore/upgrade tests, Dependabot, pinned infra images
- **OPS2-03**: Further hardening: service-worker cache allowlist, CSP check on `index.html`, health split, payload limits, no PII in logs, refresh grace window
- **SEC2-01**: Audit log of parent actions (§15)
- **SEC2-02**: CSP without `'unsafe-inline'` for styles (§15)
- **SEC2-03**: TOTP second factor for the owner (§3)
- **AI2-01**: AI provider interfaces with a no-op default and `WQ_AI_PROVIDER` (§11, ADR-005); later OCR import, pronunciation check, sentence generator, coach (§4 Could)

### Code quality

Source: codebase map 2026-10-24 (`.planning/codebase/CONCERNS.md`, `TESTING.md`).

- **QA2-01**: Playwright/axe e2e and the install/release smokes run in CI, not only locally
- **QA2-02**: Frontend formatter checked in the gate (scope and tool need approval: new dependency)
- **QA2-03**: Move business logic and direct DB access out of `SetEndpoints.cs` into a service (pattern `LearningService`)
- **QA2-04**: Split `SetDetailPage.tsx` (about 1040 lines) into smaller components
- **QA2-05**: Measured test coverage > 90 % for the learning module in CI (§10.2); optional seq log container (§10.1)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple families per instance | One family per home installation |
| Schools / classes | Different audience, much stricter requirements |
| Email / push notifications | No mail infrastructure for non-expert hosters |
| Passkeys / OIDC | Not needed for a home-network family app |
| Tracking, leaderboards, streak penalties | Pressure on children (anti-features) |
| Domain + Let's Encrypt path (former OPS2-01) | Not doable for non-expert parents; replaced by HTTPS with an own CA per install (TLS-01..TLS-06, owner 2026-10-25) |

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
| IMG-01 | Phase 3.1.1 | Pending — automatisch belegt 2026-10-23 (END f70271c), manuelle Abnahme A1–A3 offen |
| TLS-01 | Quick 261025-fpi | Pending |
| TLS-02 | Quick 261025-fpi | Pending |
| TLS-03 | Quick 261025-fpi | Pending |
| TLS-04 | Quick 261025-fpi | Pending |
| TLS-05 | Quick 261025-fpi | Pending |
| TLS-06 | Quick 261025-fpi | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-09-24*
*Last updated: 2026-10-25 — Domain-Variante entfernt, OPS2-01 nach Out of Scope (Quick 261025-fpi-02); davor TLS-01 bis TLS-06 (HTTPS im Heimnetz mit eigener CA, Quick 261025-fpi) ergänzt; davor am selben Tag v2-Kandidaten aus dem Abgleich mit dem Ursprungskonzept (LRN2-03..06, CNT2-02/03, GAM2-01/02, SEC2-01..03, AI2-01, QA2-05) und SPL2-01 bis SPL2-06 (Lernwörter) ergänzt; davor 2026-10-24 QA2-01 bis QA2-04 und PAR2-04.*
