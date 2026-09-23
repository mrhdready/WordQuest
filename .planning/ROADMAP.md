# Roadmap: WordQuest

## Overview

v1.0 turns the existing learning core into a working, safe base that another family can run in its home network. Phase 1 makes the plain-HTTP home-network install safe and recoverable (own parent account, generated secrets, daily backups, password and PIN recovery). Phase 2 removes the known defects that make learning unreliable and lets a parent delete a child and correct sets without leaving orphaned data, backed by integration tests against real PostgreSQL. Phase 3 ships a versioned 1.0.0 release with upgrade and restore scripts and one install page a non-expert can follow.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Safe Home-Network Install** - Parent installs over plain HTTP with own account, generated secrets and daily backups, and can recover passwords and child PINs
- [ ] **Phase 2: Reliable Learning & Clean Family Data** - Known learning bugs fixed, child deletion and set/entry correction without orphaned data, proven by integration tests
- [ ] **Phase 3: Installable 1.0.0 Release** - Versioned images, `upgrade.sh`, `restore.sh` and one install page for non-experts

## Phase Details

### Phase 1: Safe Home-Network Install
**Goal**: A parent installs WordQuest in the home network over plain HTTP with their own account, generated secrets and daily backups, and can recover their own password and a child's forgotten PIN without help
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, PAR-01, PAR-02, QUAL-02
**Success Criteria** (what must be TRUE):
  1. On a fresh host, `setup.sh` in home-network mode asks for the parent's email and password and generates DB password and JWT key; after start the parent logs in at `http://<host>:8080` with exactly that account, and no demo account exists
  2. The home-network stack writes a daily database dump to the backup directory, and outside Development the API refuses to start (clear error naming the secret) when the DB password or JWT key is missing or a known default
  3. Parent changes their password in the app and can then log in only with the new one; an operator who lost it resets it with one command inside the container and logs in with the result
  4. Parent edits a child's name, daily new-card limit and PIN, and the child logs in with the new PIN; a PIN that is not 4-6 digits is rejected by the server with a readable message, also when sent directly to the API
  5. The password-change and edit-child forms have frontend tests covering the full edge-case matrix (one wrong field at a time, exact error texts, Enter-submit path, happy path last), axe reports 0 WCAG 2.2 AA violations on both pages, and a keyboard walkthrough plus 200 % zoom pass
**Plans**: TBD
**UI hint**: yes

### Phase 2: Reliable Learning & Clean Family Data
**Goal**: Children learn without lockouts, crashes, stuck cards or wrong numbers, and a parent can delete a child or correct sets and entries without orphaned data or lost progress, proven by integration tests against real PostgreSQL
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, PAR-03, PAR-04, QUAL-01
**Success Criteria** (what must be TRUE):
  1. When one family member mistypes their login repeatedly, the others can still log in from their own devices, and token refresh during normal learning never counts against the login limit
  2. A card that was shown but not answered comes back in a later session instead of staying `New`; a double tap on an answer or an invalid session/item ID yields a clean 4xx/409 response and a readable message, never a 500
  3. After a missed day the dashboard shows the actual current streak (not the old one as ongoing), and the parent overview and traffic light count the same words as mastered (ease >= 2.1, defined once)
  4. After a parent deletes a set, an entry or a child (with confirmation), none of the removed words appear in any session and no learning history of the deleted child remains; renaming a set or correcting an entry keeps the child's progress on that word; the new rename/edit forms and the delete dialog pass the edge-case matrix and axe (0 WCAG 2.2 AA violations) like the Phase 1 forms
  5. API integration tests run against a real PostgreSQL in CI and cover login, refresh, isolation between siblings and each FIX requirement, all green
**Plans**: TBD
**UI hint**: yes

### Phase 3: Installable 1.0.0 Release
**Goal**: Another family installs, updates and restores WordQuest 1.0.0 in its home network by following one install page, without special know-how
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. API and web images are published with the tag `1.0.0` for the home-server architecture, and a fresh install pulls that tag instead of `master`
  2. Following only the install page (install, update, backup/restore, step by step), a person new to the project gets from an empty host to a working parent login in home-network mode
  3. `upgrade.sh` writes a DB backup before pulling the new version, and the family's children, sets and progress are intact after the upgrade
  4. `restore.sh` restores a chosen backup, and afterwards the parent sees the data as of that backup
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safe Home-Network Install | 0/TBD | Not started | - |
| 2. Reliable Learning & Clean Family Data | 0/TBD | Not started | - |
| 3. Installable 1.0.0 Release | 0/TBD | Not started | - |
