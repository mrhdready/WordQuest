# Feature Research

**Domain:** Self-hosted family vocabulary-learning PWA (German school children, grades 5-10, English/French/Latin), v1.0 release for third-party hosters
**Researched:** 2026-09-24
**Confidence:** MEDIUM overall. Codebase findings are HIGH (read directly from source in this session). Competitor/ecosystem findings are MEDIUM (web search cross-checked against official docs where possible). Learning-science claims are MEDIUM.

Scope of this file: the five v1.0 feature areas from `PROJECT.md` → Active: game modes, parent reporting, account lifecycle, GDPR, and release/operations. Hardening items are covered in PITFALLS/ARCHITECTURE, not here.

---

## Codebase Facts That Shape These Features (HIGH, observed)

These facts constrain the recommendations below. Each one was checked in source.

| Fact | Where | Consequence |
|------|-------|-------------|
| Frontend hardcodes `gameKey: 'classic'` | `frontend/src/features/learn/SessionPage.tsx:47` | No game picker or registry exists. Every new mode needs a picker first. |
| Server already builds multiple-choice distractors for every non-classic game (same set, same part of speech) | `LearningService.BuildChoicesAsync` (~line 405) | Wordcatcher needs **no backend work** for choices. |
| `wordcatcher` = XP 1.0, `MaxGrade = null`, affects scheduling | `GameCatalog.cs:28` | A multiple-choice tap in under 2 s grades **Easy** (`EasyThresholdMs = 2000`). Recognition would then inflate SM-2 intervals. **Change before shipping.** |
| `cram` uses the **same session composition** as classic (relearning, due, new, and the daily new budget) | `StartSessionAsync` lines 29-135 | The "Klassenarbeit-Modus" is not implemented yet. It does not practise "all cards of a set, weakest first" (concept §6.3). |
| Starting any session persists `ReviewState(New)` for new candidates. `cram` then never schedules them. | lines 118-130, 195-204 | **Bug if cram ships as-is:** new cards shown in cram stay `New` forever. They count as "already seen" and are never picked as due or relearning, so classic never offers them again. |
| Retry-on-wrong only happens when `AffectsScheduling` | line 229 | A wrong answer in cram gets no second attempt in the same session. For test prep, the retry is the most valuable part. |
| `VocabularyEntry` has an `Emoji` field | `Modules.Content/Entities/VocabularyEntry.cs` | Memory (emoji ↔ word) is possible in principle, but only for entries that have an emoji. |
| `ReviewLog` stores `ReviewedAt`, `Grade`, `AnswerMs`, `GivenAnswer`, `GameKey`, `ResultingIntervalDays` | `LearningService` line 206 ff. | History, problem words (including the actual wrong spellings) and weekly summary can all be **computed from existing data**. No new tracking is needed. |
| `UserRole.Owner` and `Guardian` already exist, and policy "Guardian" = Owner or Guardian | `Program.cs:66` | Owner-only actions (invite, delete tenant) only need a new policy, not a new role model. |
| Learner endpoints: list, create, overview, traffic-light. There is **no update or delete**. | `LearnerEndpoints.cs` | Guardians cannot change a learner's PIN, name or `daily_new_limit`, or delete a learner. The concept says the daily limit "is explained in the parent dashboard". See the table stakes below. |
| Set endpoints: no rename or edit of entries (only add and delete) | `SetEndpoints.cs` | Out of this question's scope, but a guardian who finds a typo in an imported set must delete the entry and re-add it. Flagged as a gap. |

---

## Feature Landscape

### Table Stakes (Users Expect These)

#### A. Game modes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Game picker before a session** (choose mode for the chosen set) | Every comparable app offers more than one practice form (Quizlet: Flashcards/Learn/Test/Match; phase6: normal learning and "Lernen für Test"; Brainyoo: exam/random/long-term mode). One mode feels thin for children. | LOW | Minimal frontend registry `{key, title, component}` as in concept §7.3. `GET /sessions/games` already exists. Everything else depends on this. |
| **Klassenarbeit-Modus (`cram`)**: practise all cards of one set before a test, weakest first, typed answers, **no rescheduling** | The core German use case: the child's set is tested on a known date. phase6 ("Lernen für Test") and cabuu (target date → plan) both offer it. Anki's equivalent is a filtered deck with "Reschedule cards based on my answers" turned off. | MEDIUM | Needs its own composition path: all cards in set, ordered by lapses desc, then ease asc, then unseen; no daily new budget; **no ReviewState creation** for unseen cards; retry-on-wrong within the session; typed input (tests are written). End screen: "x of y right on the first try" (as phase6 does). Must not touch `LastReviewedAt`, or it will skew "last practised" reporting. |
| **Wort-Fänger (`wordcatcher`)**: a multiple-choice recognition game | This is the "fun" mode children expect (like Quizlet Match or Brainyoo battle mode). Backend choices already exist. | MEDIUM | Ship with `MaxGrade = Good` (not Easy). `Again` counts fully. Start with speed `relaxed`, and include a **no-timer / pause option**: WCAG 2.2 SC 2.2.1 (Timing Adjustable) and 2.2.2 (Pause, Stop, Hide) apply to falling words. Honour `prefers-reduced-motion`, falling back to a static 4-button grid. |

**Recall vs. recognition: which modes should reschedule SM-2**

| Mode | Cognitive task | Evidence value for scheduling | Recommended `GameCatalog` setting |
|------|----------------|-------------------------------|-----------------------------------|
| `classic` | Typed cued recall (productive) | Strong. This is what German Vokabeltests measure. | Unchanged: 1.0 XP, full grades, reschedules |
| `wordcatcher` | Recognition (multiple choice) | **Asymmetric.** A failure is strong evidence (the child cannot even recognise the word). A success is weak evidence, because recognition can rest on familiarity alone. A meta-analysis finds MC retrieval practice produces testing effects about as good as recall for *learning*. As a *measurement* of productive recall, it overestimates. | 1.0 XP is fine (the practice has value). **Set `MaxGrade = Good`.** Good keeps ease unchanged (`+0.1 − 1·0.10 = 0`), so ease does not drift, and it prevents speed-Easy inflation. Do not cap at Hard: repeated Hard lowers ease by 0.14 per answer and would punish children who like this game. |
| `memory` | Visual/spatial pairing | Very weak. A mismatch mostly means "forgot where the card was", not "does not know the word". | **Set `AffectsScheduling = false`** (currently `true`). Otherwise a spatial slip grades `Again` and resets the interval to 0. Keep 0.5 XP as a reward game. |
| `cram` | Typed recall, massed | Massed practice right before a test inflates short-term performance. It should not lengthen intervals. | Unchanged: 0.5 XP, no rescheduling, log only. Fix the composition and side effects (see facts above). |

**Proposed v1.0 set, prioritised**

1. Game picker plus the `GameCatalog` changes above (LOW). This is the prerequisite.
2. `cram` Klassenarbeit-Modus (MEDIUM). Highest value for the audience, and it pairs with the pre-test view (reporting).
3. `wordcatcher` in an accessible form (MEDIUM). This is the fun mode, and the backend is already there.
4. `memory`: **defer to v1.x.** It needs a new "match" answer contract (a batch of pairs with per-pair results, where today every answer is one item). It works only for entries with an emoji, gives the least learning value, and has the highest UI cost (grid, flip animation, keyboard operability for WCAG).

#### B. Parent reporting (in-app only)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Activity history**: per day for the last 14/30 days (sessions, cards answered, accuracy) and a streak calendar | phase6 reports show "how many cards were due each day and how many were completed". Concept §9 specifies a weekly overview. | LOW-MEDIUM | Aggregate `ReviewLog` by local day (use the same 04:00 day boundary as the scheduler, `StartOfLocalDay`). Show a **day-level granularity only**. No minutes, no time of day (concept §9). Accuracy counts `classic`, `wordcatcher` and `cram` separately, or at least excludes `memory`. |
| **Problem words**: top 10 per learner, by lapses and recent `Again` count | phase6 has a "Difficult Cards" report. Concept §9 specifies it. It is the single most actionable view for a parent ("where can I help"). | LOW | Show the word, both directions, lapse count, and the **last 3 wrong answers the child actually gave** (`ReviewLog.GivenAnswer`). This shows the error pattern (spelling vs. not known), which phase6 only hints at. |
| **Pre-test view**: guardian sets a test date for a learner + set, and sees readiness | cabuu's paid core feature (target date → plan). German school life is organised around announced Vokabeltests. | MEDIUM | Store the test date on the learner+set pair, not on the set (siblings share sets but have different tests). The view shows days left, traffic-light distribution for that set, count of never-seen entries, and a "start Klassenarbeit-Modus" call to action for the child. **No pass/fail prediction** (concept §9). Needs the mastery rule in one place (a hardening item). |
| **Parent-dashboard notices**: "hasn't practised for N days" and a weekly summary card | This replaces e-mail/push, which are out of scope. Parents expect *some* nudge without opening every child's detail page. | LOW | **Compute on read, with no background job:** the dashboard queries the last activity date and the last-7-days aggregates when opened. N defaults to 3 days (matches "no streak counter before day 3"). A dismiss/"seen" flag is optional. Skip it unless parents complain. |
| **Edit learner**: name, avatar, PIN reset, `daily_new_limit` | A guardian who cannot reset a forgotten child PIN is stuck. The concept says the daily limit is configurable and explained in the dashboard. | LOW | Currently missing (no update endpoint). The PIN is validated server-side (a hardening item). |

#### C. Account lifecycle (self-hosted practice)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **First-run setup wizard**: when no owner exists, the web UI creates owner + tenant | Immich, Jellyfin and Home Assistant all do this (HA calls it "onboarding" and creates the *owner* account). Mealie is the counterexample: it ships `changeme@example.com` / `MyPassword` with a forced change. This is exactly the default-credential pattern the Core Value rules out. | MEDIUM | **Setup-hijack protection is required,** because the instance is internet-facing via Traefik/Let's Encrypt before the family opens it. Portainer shuts down if setup is not completed within 5 minutes. For WordQuest the simpler answer is: `setup.sh` already writes secrets, so it also writes a one-time `SETUP_TOKEN` to `.env` and prints it, and the wizard requires it. After an owner exists, the setup endpoint returns 404/409 permanently. |
| **Change own password** in settings (requires current password) | Universal. | LOW | On success, revoke all other refresh tokens of that user (the token families already exist). |
| **CLI password reset inside the container** | Immich `immich-admin reset-admin-password`. Home Assistant `hass --script auth change_password`. Paperless `manage changepassword`/`createsuperuser`. No SMTP needed. | LOW-MEDIUM | For example `docker compose exec api ./WordQuest.Api reset-password <email>`: prints a generated temporary password (or reads one from stdin) and revokes that user's refresh tokens. Add `list-users` and `version` to the same entry point (Immich ships both). Also works when the owner forgot their e-mail. |
| **Invite a second guardian** (owner only) | Mealie has one-time invite links scoped to a household. Jellyfin/Immich let the admin create users directly. Two parents per family is the norm. | MEDIUM | One-time link with expiry (72 h is enough), shown in the UI to copy (no SMTP). The invitee sets name, e-mail and password. Store only the token hash. Owner can also **revoke a pending invite and remove a guardian**. Guardians cannot invite or delete the tenant. |
| **Demo data opt-in only** | Already in Active. | LOW | Otherwise a fresh install shows fake children before setup. |

#### D. GDPR / children's data

**Legal framing (MEDIUM, pushback on `PROJECT.md` Key Decisions):** a family running WordQuest for itself most likely falls under the **household exemption** (Art. 2(2)(c) GDPR, Recital 18). The GDPR then does not bind the family as a controller. The open-source authors process nothing, so they are not controllers either. The decision text "the hoster is the data controller" is therefore probably wrong for the target audience; it would apply if someone hosts for *other* families, which is out of scope. **The features are still right,** for other reasons: trust, data minimisation for children, families leaving the app, and a cheap build. Word the documentation as "good practice", not "legal compliance". UNBEKANNT: no legal review. Do not claim GDPR compliance in the README.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Delete learner**, a hard delete with cascade | Concept §12 promises it. It is expected when a child stops using the app. | LOW-MEDIUM | Cascade: learner user, profile, review states, review logs, sessions and items, gamification profile, refresh tokens, test dates. Confirm by typing the child's name. **No soft delete or trash.** State in the UI and docs that **existing backups still contain the data until they rotate out** (backup retention = deletion horizon). |
| **Export all family data as JSON** | Art. 15/20 style ("structured, commonly used, machine-readable"). Concept §12 promises it in the parent dashboard. | MEDIUM | One file download (or a zip if large). Include `exportedAt`, the app version and a `schemaVersion`. Contents: guardians **without password hashes**, learners **without PIN hashes**, sets + entries, review states, review logs, sessions, gamification. **It is not a backup and has no import.** Paperless shows that a DB-image export is only importable on the same version. Keep backup/restore (`pg_dump`) and export as two clearly separate things in the docs. |
| **Delete entire tenant** (owner only) | Leaving should be possible without SSH. | LOW-MEDIUM | Re-enter the password plus a typed confirmation. Because there is one tenant per instance, **deleting the tenant returns the instance to the first-run wizard state.** Needs a new `SETUP_TOKEN` (via CLI or `setup.sh`) to prevent hijack. Same backup caveat as for delete learner. |
| **Child-visible transparency**: the learner profile states that parents can see progress | Concept §9: "heimliche Überwachung ist ausgeschlossen". Research on monitoring apps shows trust damage when children discover hidden monitoring. | LOW | One sentence plus an icon on the child's profile page. |

#### E. Release / operations

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Install guide** for a non-developer: prerequisites (Docker, ARM64/amd64, domain + DNS or explicit LAN option, ports 80/443), `setup.sh`, first-run URL + setup token | Core Value: a third party installs without help. | LOW | Must be tested on a clean Pi by someone other than the author (this is the milestone's done-criterion). |
| **Pinned versions**: semver image tags, `WORDQUEST_VERSION` in `.env`, infra images pinned | Immich pattern: `IMMICH_VERSION` in `.env`, plus a major-tag option. | LOW | Already an Active item. The docs recommend pinning a major and never `latest`. |
| **Upgrade guide**: back up, read release notes, `docker compose pull && docker compose up -d`, migrations run automatically, **downgrade not supported** | Immich documents exactly this, including "downgrading is not supported". | LOW | Release notes must mark breaking changes explicitly (a "Breaking" section). |
| **Backup + tested restore procedure**, with an off-host option | The daily DB dump exists. Restore is undocumented. | MEDIUM | Document one command for restore into a fresh stack, and test it in CI or at least manually per release. Off-host backup: document an `rsync`/rclone target. Do not build a sync feature. |
| **Version display**: in the UI (settings/footer), via `GET /api/v1/version`, and the CLI `version` | Standard (Immich exposes the version in UI, API and CLI). Needed for support ("which version are you on?"). | LOW | Stamp at build time (image label / assembly informational version). |
| **CHANGELOG + GitHub Releases** on GHCR tags | Hosters subscribe to GitHub releases. Immich recommends this as the alternative to its in-app check. | LOW | Already partly in the Release item. |
| **Troubleshooting page**: logs command, health endpoints, the "forgot password" CLI, and "PWA won't install" = HTTPS missing | Most support requests for self-hosted apps are about these. | LOW | |
| **SECURITY.md** (how to report vulnerabilities) and a LICENSE | Expected in any public self-hosted repo that holds children's data. | LOW | |

### Differentiators (Competitive Advantage)

These align with the Core Value (secure, calm self-hosting) and the concept's "helper, not surveillance" stance.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Pre-test view that links directly into Klassenarbeit-Modus** | cabuu charges for the target-date plan, and phase6 has no date concept in its reports. Here it is free and self-hosted, and it deliberately does not predict grades. | MEDIUM (together) | This is the flagship v1.0 story: "Test on Friday → see which words wobble → child crams without breaking long-term scheduling". |
| **Problem words with the child's actual wrong answers** | It shows *why* a word fails (spelling vs. confusion vs. not known). Parents can help specifically. | LOW | The data already exists in `ReviewLog.GivenAnswer`. |
| **Scheduling-honest games** (recognition cannot inflate intervals, memory cannot reset them) | Most gamified apps let games farm progress. Here the traffic light stays truthful. | LOW | Two `GameCatalog` constant changes plus tests. Explain in one sentence in the parent help. |
| **No default credentials plus a setup token** | Better than Mealie (default creds) and simpler than Portainer (timeout). | LOW | This is the security story for the README. |
| **Deleting the tenant returns the instance to first-run** | A clean exit and a clean handover (for example, handing the Pi to another family). | LOW | Falls out of single-tenant-per-instance. |
| **Set export as CSV in the import format** | Families share sets ("the Green Line 2 Unit 3 list") between instances without a central server. | LOW | Reuses the existing CSV import format. Optional, a P2 candidate. |
| **No phone-home, no telemetry** | A children's app on home hardware. A trust argument for privacy-conscious German parents. | LOW (by omission) | If an update check is ever added, make it opt-in (Immich has it opt-out). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Minute-precise usage times, time-of-day logs, session timelines for parents** | "I want to know when and how long my child learned." | Concept §9 rules it out. Monitoring research: about 1 in 10 children say monitoring apps broke trust, and about 1 in 12 report anxiety. Precise surveillance also invites nagging. | Day-level activity (practised yes/no, cards, accuracy). |
| **"Input control" / cheat detection report** (phase6 has one for the "Gelten lassen" override) | "Is my child cheating?" | It signals distrust. WordQuest grades server-side, and the child cannot override, so there is nothing to detect. | Server-side grading (already built, ADR-006). |
| **Sibling comparison, leaderboards, family ranking** | "Motivate through competition." | Concept §9 rules it out. It punishes the younger or weaker sibling, and grade levels differ. | Personal progress only (own level, own streak). |
| **Pass/fail prediction for the test** ("will probably fail") | Seems like the logical extension of the pre-test view. | Concept §9 rules it out. It creates pressure, and SM-2 data cannot validly predict a grade. | Show distribution plus "x words still unsure", and offer cram. |
| **Streak-loss penalties, streak emphasis in parent notices** ("streak broken!") | Engagement. | Duolingo streak anxiety is well documented (loss aversion, the streak becoming the goal). The concept already has streak savers and hides the streak before day 3. | The "hasn't practised" notice is phrased neutrally for the parent and never shown as a failure to the child. |
| **E-mail/push reminders to children** | "Remind them automatically." | Out of scope (no SMTP/push). Also nagging. | In-app parent notice. The parent talks to the child. |
| **Hearts/lives, losing XP on wrong answers** | "Stakes make it exciting." | Named by research as a source of anxiety and frustration. The concept rule: wrong answers cost 0 XP. | Retry-on-wrong in the same session. |
| **Memory affecting scheduling / wordcatcher granting Easy** | "All games should count equally." | It corrupts the traffic light and the intervals. Visible failure: words turn green that the child cannot write. | The per-game caps above. |
| **In-app update check calling GitHub by default** | Convenient. | Phone-home from a children's app. It needs outbound access and consent. | Document "watch GitHub releases". Show the running version in the UI. |
| **Built-in off-site backup sync / cloud backup integration** | "Backups should be automatic." | A large surface (credentials, providers), and a Pi-class hoster typically already has NAS tooling. | Document rsync/rclone of the existing dump directory, plus a tested restore. |
| **Soft delete / trash for learners** | "Undo accidental delete." | For children's data, deletion should mean deletion. A trash adds retention questions. | Typed-name confirmation before a hard delete. |
| **Self-registration, multiple families, school classes** | Growth. | Out of scope (`PROJECT.md`). Much stricter GDPR (no household exemption). | Owner invites guardians only. |
| **Monster-Duell, Buchstaben-Chaos, Zeitrennen for v1.0** | They are in the concept catalogue. | Each is a new answer contract or UI. None adds scheduling value beyond classic/wordcatcher. `timerace` is pure speed, which is again a WCAG timing issue. | v1.x+ after the game registry has proven itself. |

---

## Feature Dependencies

```
[Game picker / frontend registry]
    ├──required by──> [wordcatcher UI]
    ├──required by──> [cram UI]
    └──required by──> [memory UI (v1.x)]

[GameCatalog changes: wordcatcher MaxGrade=Good, memory AffectsScheduling=false]
    └──must land before──> [wordcatcher UI shipped]  (else interval inflation reaches real users)

[cram composition path (all set cards, weakest first, no new-budget, no ReviewState creation, retry)]
    └──required by──> [cram UI]
                          └──enhanced by──> [Pre-test view "practise now" CTA]

[Mastery rule in one place (hardening)]
    ├──required by──> [Pre-test readiness]
    ├──required by──> [Weekly summary]
    └──used by──> [Traffic light (existing)]

[ReviewLog (existing)]
    ├──feeds──> [Activity history]
    ├──feeds──> [Problem words + wrong answers]
    ├──feeds──> [Weekly summary / hasn't-practised notice]
    └──polluted by──> [cram touching LastReviewedAt]  → fix cram first or history lies

[Test date (learner+set)] ──required by──> [Pre-test view]

[Setup token in setup.sh]
    └──required by──> [First-run wizard]
                          ├──required by──> [Invite second guardian] (owner must exist)
                          └──re-entered by──> [Delete tenant] (instance returns to wizard)

[CLI entry point in API image]
    ├──hosts──> [reset-password]
    ├──hosts──> [version, list-users]
    └──hosts──> [new setup token after tenant delete]

[Edit learner (PIN/limit)] ──independent──  (small, fills an existing gap)

[All new entities (test date, invites)]
    └──must be covered by──> [JSON export] and [delete learner / delete tenant cascade]
        → schedule export/delete AFTER entity-adding features, or add a test that fails
          when a tenant-owned entity is missing from export/cascade

[Concurrency-token hardening] ──enhances──> [wordcatcher] (fast taps → parallel answer POSTs)

[wordcatcher falling animation] ──conflicts──> [WCAG 2.2.1 / 2.2.2] unless pause/no-timer + reduced-motion
```

### Dependency Notes

- **cram requires a backend composition change:** today it reuses classic's composition and silently strands new cards in `New` (HIGH, observed). Shipping only the frontend would create a data bug that is invisible until words "disappear".
- **Export/delete depend on the final entity set:** every table added in this milestone must appear in the export and the cascade. A test that walks all tenant-owned entity types (the global query filters already enumerate them) prevents drift. This is the cheapest guard.
- **Delete tenant loops back to the setup wizard:** build the wizard and token first, then delete tenant.
- **Reporting and game modes meet at cram:** the pre-test view is much more valuable with a working cram mode. Put them in the same phase or in adjacent phases.

---

## MVP Definition

### Launch With (v1.0)

- [ ] First-run wizard with setup token, and a permanently closed setup endpoint afterwards. *Core Value: no default credentials.*
- [ ] Password change, and CLI `reset-password` / `version` / `list-users`. *No SMTP, and there must be a recovery path.*
- [ ] Owner invites a second guardian (one-time link, revoke, remove guardian). *Two-parent families.*
- [ ] Edit learner (PIN reset, name, daily new limit). *Otherwise a forgotten PIN locks a child out.*
- [ ] Delete learner (hard cascade), JSON export, delete tenant → back to first-run. *Children's data, clean exit.*
- [ ] Game picker, plus the `GameCatalog` honesty changes. *Prerequisite for all modes.*
- [ ] Klassenarbeit-Modus (`cram`) with the correct composition. *Highest-value mode for the audience.*
- [ ] Wort-Fänger (`wordcatcher`), accessible (no-timer option, reduced motion). *The fun mode, with the backend already there.*
- [ ] Activity history (day level), problem words with wrong answers, pre-test view with test date, dashboard notices computed on read. *Parent reporting as specified in concept §9.*
- [ ] Install, upgrade, backup/restore and troubleshooting docs; version in UI/API; pinned semver images; CHANGELOG; SECURITY.md. *Done-criterion: a third party installs unaided.*

### Add After Validation (v1.x)

- [ ] Memory game. *Trigger: families ask for more variety. Needs a match contract and emoji coverage.*
- [ ] Set export as CSV. *Trigger: families want to share sets.*
- [ ] Edit set/entry text (fix typos). *Trigger: likely immediate. Consider pulling it into v1.0 if cheap.*
- [ ] Dismissable notices. *Trigger: parents find repeated notices annoying.*

### Future Consideration (v2+)

- [ ] Monster-Duell, Buchstaben-Chaos, Zeitrennen. *Game registry must prove itself first. Timing/WCAG cost.*
- [ ] Opt-in update check. *Only with explicit consent.*
- [ ] OIDC/SSO, passkeys. *Already deferred in `PROJECT.md`.*
- [ ] Text-to-speech pronunciation (browser `SpeechSynthesis`). *Concept "later" list. Cheap, but not release-critical.*

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| First-run wizard + setup token | HIGH | MEDIUM | P1 |
| CLI reset-password / version | HIGH | LOW | P1 |
| Password change | MEDIUM | LOW | P1 |
| Invite second guardian | MEDIUM | MEDIUM | P1 |
| Edit learner (PIN, limit) | HIGH | LOW | P1 |
| Delete learner | HIGH | LOW | P1 |
| JSON export | MEDIUM | MEDIUM | P1 |
| Delete tenant → first-run | MEDIUM | LOW | P1 |
| Game picker + GameCatalog caps | HIGH | LOW | P1 |
| Klassenarbeit-Modus (cram) | HIGH | MEDIUM | P1 |
| Wort-Fänger (accessible) | MEDIUM | MEDIUM | P1 |
| Problem words (+ wrong answers) | HIGH | LOW | P1 |
| Activity history | MEDIUM | LOW | P1 |
| Pre-test view + test date | HIGH | MEDIUM | P1 |
| Dashboard notices (compute on read) | MEDIUM | LOW | P1 |
| Install/upgrade/backup-restore docs | HIGH | MEDIUM | P1 |
| Version in UI/API | MEDIUM | LOW | P1 |
| Child-visible transparency note | MEDIUM | LOW | P1 |
| Set CSV export | LOW | LOW | P2 |
| Edit set/entry text | MEDIUM | LOW | P2 |
| Memory game | LOW | HIGH | P3 |
| Further games | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | phase6 | cabuu | Quizlet | Anki | Our Approach |
|---------|--------|-------|---------|------|--------------|
| Practice modes | 6-phase Leitner, "Lernen für Test" with first-try stats | Gesture-based learning, vocab test with paper check | Flashcards, Learn (adaptive MC → written), Test, Match (timed) | Reviews and filtered decks | classic (typed recall), wordcatcher (MC, capped), cram (test prep, no reschedule); memory later |
| Test prep without breaking scheduling | "Lernen für Test" mode | Target date → plan (premium) | Test mode (no SRS) | Filtered deck with "reschedule" off | cram: log only, weakest first, retry; linked from pre-test view |
| Parent reports | Phases, daily due vs. done, 7-day preview, difficult cards, input control | UNBEKANNT (not found in sources) | n/a (teacher focus) | n/a | Day-level history, problem words with wrong answers, pre-test readiness; no cheat report, no minute tracking |
| Notifications | App push | App push | E-mail/push | none | In-app parent notice, computed on read |

| Self-hosting lifecycle | Immich | Jellyfin | Home Assistant | Paperless-ngx | Mealie | Our Approach |
|---|---|---|---|---|---|---|
| First admin | Web onboarding | Startup wizard | Onboarding creates *owner* | CLI `createsuperuser` or env `PAPERLESS_ADMIN_USER` | **Default creds** + forced change | Web wizard + `SETUP_TOKEN` from `setup.sh` |
| Lost admin password | `immich-admin reset-admin-password` | "Forgot password" writes a PIN file (LAN only); or reset the wizard flag | `hass --script auth change_password` | `manage changepassword` | Admin resets other users | CLI `reset-password` in the API container |
| More users | Admin creates | Admin creates | Owner creates | Admin creates | One-time invite links per household | One-time invite link (owner only) |
| Version / upgrade | UI + CLI `version`; `IMMICH_VERSION` pin; "no downgrade"; opt-out GitHub version check | Dashboard | UI | UI | UI | UI + API + CLI; `WORDQUEST_VERSION` pin; no phone-home |
| Backup | Documented DB dump + restore | UNBEKANNT (not researched) | Built-in backups | Exporter/importer (same-version only) | Built-in backups | Existing daily `pg_dump` + documented, tested restore; JSON export kept separate |

---

## Sources

Codebase (HIGH, read in this session):
- `backend/src/WordQuest.Modules.Learning/Services/GameCatalog.cs`
- `backend/src/WordQuest.Infrastructure/LearningService.cs` (session composition, answer handling, choices)
- `backend/src/WordQuest.Modules.Learning/Services/SchedulerOptions.cs` (`EasyThresholdMs = 2000`)
- `backend/src/WordQuest.Api/Endpoints/*.cs`, `backend/src/WordQuest.Api/Program.cs`
- `frontend/src/features/learn/SessionPage.tsx`
- `Documentation/WordQuest_Konzept_und_Architektur.md` §6, §7, §8, §9, §12

Web (MEDIUM unless noted; confidence tier per `classify-confidence`: websearch unverified = LOW, cross-checked = MEDIUM):
- phase6 reports: https://www.phase-6.de/help/knowledge-base/reports/ ; test mode: https://www.auswandern-handbuch.de/phase-6-test/
- Quizlet study modes: https://quizlet.com/gb/features/study-modes ; https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn
- cabuu learning plan / target date: https://www.cabuu.app/lernplan ; https://www.daddylicious.de/vokabeln-lernen-fremdsprachen-schule-cabuu-app/
- Brainyoo modes: https://www.brainyoo.de/shop/freizeit/vokabeltrainer.html (LOW)
- Anki filtered decks (reschedule off): https://docs.ankiweb.net/filtered-decks.html
- Recognition vs. recall retrieval practice: https://link.springer.com/article/10.1007/s11251-020-09526-1 ; https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00005/full
- Immich admin CLI: https://docs.immich.app/administration/server-commands/ ; upgrading: https://docs.immich.app/install/upgrading/ ; version check: https://docs.immich.app/administration/system-settings/
- Home Assistant onboarding / locked out: https://www.home-assistant.io/getting-started/onboarding/ ; https://www.home-assistant.io/docs/locked_out/
- Jellyfin password reset: https://lumadock.com/tutorials/jellyfin-forgot-password (LOW)
- Paperless-ngx setup/admin user: https://docs.paperless-ngx.com/configuration/ ; backup/export: https://docs.paperless-ngx.com/administration/
- Mealie default credentials / invites: https://github.com/mealie-recipes/mealie/issues/2787 ; https://github.com/mealie-recipes/mealie/pull/4252
- Portainer setup timeout: https://docs.portainer.io/faqs/installing/your-portainer-instance-has-timed-out-for-security-purposes-error-fix
- GDPR household exemption: https://www.dataprotection.ie/en/faqs/general/what-household-exemption ; https://gdprhub.eu/Article_2_GDPR
- Monitoring-app harms: https://www.technologyreview.com/2026/08/19/1141623/child-monitoring-apps-need-reboot/ ; https://digitalwellnesslab.org/research-briefs/safety-and-surveillance-software-practices-as-a-parent-in-the-digital-world/
- Streak anxiety: https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids (LOW) ; https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification (LOW)

---
*Feature research for: self-hosted family vocabulary-learning PWA (WordQuest v1.0)*
*Researched: 2026-09-24*
