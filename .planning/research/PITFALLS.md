# Pitfalls Research

**Domain:** Self-hosted family vocabulary PWA (SM-2 spaced repetition, children's data, Docker Compose on ARM home hardware), shipped to third-party hosters
**Researched:** 2026-09-24
**Confidence:** MEDIUM overall. Findings tagged **[code]** come from reading this repo at `4ce32da` and are HIGH confidence as observations, but none were reproduced at runtime. Findings tagged **[web]** were checked with WebSearch and cross-read sources, which is MEDIUM per the classify-confidence seam. Findings tagged **[reasoning]** are LOW, derived from domain knowledge without a source fetched in this session.

This file adds to `.planning/codebase/CONCERNS.md` and does not repeat it. Where a CONCERNS item has a trap that CONCERNS does not mention, only that trap is listed here.

Phase labels below use the requirement groups from `PROJECT.md`: **Accounts**, **Hardening**, **Privacy**, **Reporting**, **Game modes**, **Quality**, **Release/Ops**.

---

## Critical Pitfalls

### Pitfall 1: Setup wizard takeover in the window between certificate issuance and owner setup

**What goes wrong:**
The planned rule "setup is open while no tenant exists" gives the whole internet an unauthenticated "create owner" endpoint. Traefik requests the Let's Encrypt certificate on first start. The hostname then appears in public Certificate Transparency logs within minutes, and bots watch those logs for fresh installers. WordPress sites have been taken over in the gap between certificate issuance and the owner finishing the installer **[web]**. For WordQuest the attacker would become Owner of a family instance that is about to hold children's data.

**Why it happens:**
- "No tenant = setup mode" feels safe because the operator is "about to" open the page.
- The TLS compose (`docker-compose.yml`) publishes 80/443, so the stack is internet-facing from its first second.

**Traps specific to this codebase [code]:**
- **Setup reopens.** The planned GDPR feature "Owner can delete the entire tenant" returns the instance to "no tenant exists", so a deleted family's public instance reopens for takeover.
- **Race between two setup requests.** Two requests can both see "no tenant" and create two tenants. `GET /api/v1/auth/profiles` then returns 400 for everyone (`AuthEndpoints.cs:42-49`, single-tenant check), and the profile picker is broken for good.
- **Collision with demo seeding.** Seeding still defaults to true in `docker-compose.yml`. If it runs before or after setup, you also end up with two tenants.

**How to avoid:**
- Require a **setup token**. `setup.sh` already generates secrets. Have it also write `secrets/setup_token.txt` and print `https://<host>/setup#<token>`. Put the token in the URL fragment so it never reaches nginx or Traefik access logs. The API accepts setup only with that token, and only while no Owner exists. This is the Jenkins pattern (`initialAdminPassword` file). Portainer instead closes the unauthenticated admin window after 5 minutes **[web]**. The token approach is friendlier for non-technical users who get distracted.
- Make setup atomic with a DB constraint rather than app code. Use a singleton `installation` row (`id = 1` PK plus check constraint), or `pg_advisory_xact_lock` around "check no owner, create tenant + owner". A lost race gets 409.
- After tenant deletion, leave the instance **locked**: setup needs a new token from the CLI (`wordquest setup-token`), and "no tenant" alone never reopens it.
- Demo seeding and setup are mutually exclusive. Seeding runs only on an empty DB with an explicit flag, and setup refuses when a demo tenant exists (or offers "wipe demo").
- Rate-limit the setup endpoint and exclude it from the service-worker API cache.

**Warning signs:**
- A setup endpoint that works with only a password in the body.
- Any code path of the form `if (!db.Tenants.Any()) allowSetup`.
- An E2E test that completes setup without reading the token.

**Phase to address:** Accounts (first). This must ship before or together with turning demo seeding off, never after.

---

### Pitfall 2: Recognition game modes inflate SM-2 intervals, and parent reports inherit the inflation

**What goes wrong [code]:**
- `BuildChoicesAsync` (`LearningService.cs:404`) turns **every** non-classic game into 4-option multiple choice: `wordcatcher`, `memory` and `cram`.
- `wordcatcher` has `AffectsScheduling: true` and **no grade cap** (`GameCatalog.cs:28`).
- `AnswerEvaluator.GradeFor` grades Easy on speed alone (`answerMs < 2000`, `AnswerEvaluator.cs:111`), and tapping one of four buttons is almost always under 2 s. Each Easy adds +0.1 to the ease factor, and intervals multiply by ease.
- With `FirstIntervalDays = 1`, `SecondIntervalDays = 3`, ease capped at 2.8, and 5 % fuzz ignored, six fast correct taps run roughly 1 → 3 → 8 → 24 → 66 → 180 days (ease reaches its 2.8 cap on the third tap, and the sixth tap hits the 180-day interval cap).
- Each tap has a 25 % guess chance, and a higher one in sets with fewer than 4 entries of the same part of speech, where fallback distractors are thin.
- `SourceToTarget` (production) cards are also shown as multiple choice, so a child who can only *recognize* "Hund → dog" gets production intervals of months.
- `memory` is capped at Good but still `AffectsScheduling: true`. Good keeps ease flat (delta 0) and still advances the interval ramp.
- The mastery predicate (`Repetitions >= 3 && EaseFactor >= 2.1 && Lapses <= 1`) then shows green. The planned **pre-test readiness view** will then tell a parent the child is ready for the vocabulary test when the child can only pick the word from a list.

**Why it happens:**
Game modes get built as UI skins over the same grading pipeline. Recognition is weaker evidence than free recall, and SRS communities warn that grading recognition as recall inflates intervals **[web]**.

**How to avoid:**
- Give each `GameDefinition` an explicit **evidence level**, either `Recall` (typed answer) or `Recognition` (choice), plus a policy:
  - Recognition modes never produce Easy. Cap at Good, and ignore `answerMs` for grading.
  - Recognition modes advance a card **only while `Repetitions < 2`** (the learning ramp) or only for `TargetToSource` cards. Mature intervals grow only from recall.
  - Or, the simplest option: recognition modes are `AffectsScheduling: false`, like cram, and only log.
- Record the game key in `ReviewLog`, which already exists. Compute mastery and readiness **only from recall evidence**, and put that predicate in the Learning module (the CONCERNS item "mastery rule in one place" is the natural home).
- Add unit tests on `Sm2Scheduler` + `GameCatalog` that assert N fast recognition answers never push a card past X days.

**Warning signs:**
- The traffic light turns green after a week of Wort-Fänger play.
- Median `ResultingIntervalDays` in `review_log` for `wordcatcher` is well above that for `classic`.
- Children prefer the quick-tap mode and the due queue empties.

**Phase to address:** Game modes. Decide the evidence policy **before** exposing any new mode in the frontend. Reporting depends on it for readiness.

---

### Pitfall 3: Cards introduced in cram mode, or in abandoned sessions, are stranded in `New` forever

**What goes wrong [code, derived and not reproduced]:**
- `StartSessionAsync` creates a `ReviewState` with `State = New` for every new card it presents (`LearningService.cs:119-131`), deliberately, so the daily budget counts on presentation.
- Later sessions select cards through only three queries:
  - Relearning: `State == Relearning`
  - Due: `State == Review`
  - Fresh: cards **without any** `ReviewState`
- A `ReviewState` stuck in `New` matches none of them.
- A card reaches that state when:
  - the child starts a session and closes the app before answering it (common with kids),
  - it is answered in **cram**, where `AffectsScheduling: false` leaves the state at `New`,
  - it sits unanswered at the end of any session.
- Such a card never returns in classic mode. The set looks "done" while words were never learned, and it still consumes the daily new budget.

**How to avoid:**
- Add a fourth candidate query: `State == New && DueAt <= now`. Or skip creating `ReviewState` for cram sessions.
- Cram needs its own composition anyway: all cards of a set regardless of due date. The standard composer (relearning/due/new under budget) does not do that. Cram must not touch the new-card budget or `FirstSeenAt`.
- Add a regression test: start session, answer nothing, start the next session, and the card is offered again.

**Warning signs:**
`SELECT count(*) FROM review_state WHERE state = 'New' AND due_at < now() - interval '1 day'` grows over time.

**Phase to address:** Game modes (before cram ships). The same fix covers abandoned classic sessions, so it could also land in Hardening.

---

### Pitfall 4: Upgrade path. A failed or slow startup migration leaves a Pi with no working version

**What goes wrong:**
- **Partial multi-migration upgrade.** Postgres DDL is transactional, and EF runs migrations inside transactions. EF9+ even warns when a migration mixes operations that cannot run in a transaction **[web]**. A hoster who jumps from v1.0 to v1.3 applies several migrations. If the third fails (data-dependent `UPDATE`, unique index over existing duplicates, disk full on the SD card), the DB is left **between** versions. The old image cannot run against the newer schema, and the new image crash-loops. EF has no automatic down-migration on image rollback.
- **Model drift becomes a crash loop.** Since EF Core 9, `MigrateAsync` **throws** `PendingModelChangesWarning` when the model differs from the last snapshot **[web]**. A release built with a forgotten migration, or a non-deterministic model (e.g. `HasData` with `Guid.NewGuid()`/`DateTime.Now`), crash-loops on every hoster's box. `Program.cs:139` calls `MigrateAsync` unguarded before `RunAsync` **[code]**.
- **Slow SD card plus healthchecks.** A data migration over `review_log` on a Pi SD card can outlast `start_period: 30s` plus retries. Hosters then think it "hangs" and hard-reset during the migration, or power-cycle the Pi. `restart: unless-stopped` does not restart an unhealthy container, but humans do.
- **nginx keeps the old API IP.** `proxy_pass http://api:8080` (`frontend/nginx.conf`) resolves `api` once at nginx start **[code]**. When `docker compose up -d` recreates only the API container, it can get a new IP, and `web` answers 502 until it is restarted. This is a well-documented Docker + nginx trap **[web]**.

**How to avoid:**
- Ship an `upgrade.sh` next to `setup.sh`:
  1. Run `docker compose exec backup /backup.sh` for a pre-upgrade dump.
  2. Record the old `WQ_VERSION`.
  3. Set the new version in `.env`, then `pull` and `up -d`.
  4. Wait for `/health/ready`.
  5. Print the exact rollback command: restore the dump plus the old version.

  Restore-from-dump **is** the rollback path; say so in the docs.
- Log each migration name before applying it, so the hoster sees progress in `docker compose logs api`.
- CI gates:
  - `dotnet ef migrations has-pending-model-changes`
  - apply all migrations to a real Postgres 17
  - an **upgrade test**: restore a fixture dump from the previous release and migrate forward. This is the scenario that actually breaks for users.
- Keep migrations small, one concern per migration, and keep non-transactional operations (`CREATE INDEX CONCURRENTLY`, enum changes) in their own migration.
- nginx: `resolver 127.0.0.11 valid=10s;` plus a variable in `proxy_pass`.
- Document "never power off during an upgrade", and recommend putting the Postgres volume on SSD/NVMe rather than an SD card.

**Warning signs:**
- The API container restarts in a loop after `pull`.
- `__EFMigrationsHistory` holds a migration the running image does not know.
- 502 from `/api/` while `docker compose ps` shows the API healthy.

**Phase to address:** Release/Ops for `upgrade.sh`, the docs and the nginx resolver. Quality for the CI migration and upgrade tests. These are prerequisites for publishing v1.0: the first upgrade a third party runs (v1.0 → v1.1) is the dangerous one.

---

### Pitfall 5: Stale service worker and cached API responses after upgrade, logout, or deletion

**What goes wrong:**
- `registerType: 'autoUpdate'` forces `skipWaiting` + `clientsClaim`, but the page only reloads if the app imports `virtual:pwa-register` **[web]**. The frontend imports nothing of the kind **[code]** (no `registerSW`/`useRegisterSW` in `frontend/src`). Open tabs and installed PWAs keep running **old JS against the new API** until the next cold start. The API is `/api/v1`, so any breaking contract change inside v1 breaks those clients silently. If a reload is wired up in autoUpdate mode, it can fire mid-session, and vite-plugin-pwa itself warns about data loss **[web]**.
- The runtime cache `wq-api` stores **every authenticated `GET /api/*`** response for 7 days under a URL key, with a 5 s `NetworkFirst` timeout (`vite.config.ts`) **[code]**. Consequences:
  - After a schema change, a slow Pi (cold .NET start, running migration, report query over 5 s) makes the new frontend receive **old-shape cached JSON**, which crashes the UI or silently shows stale reports.
  - On a shared family tablet, after logout or profile switch, cached responses of the previous child or parent stay readable, and any endpoint without a learner ID in the URL can serve them to the next user when the network is slow.
  - After a **GDPR deletion**, the deleted child's data stays in Cache Storage on every family device for up to 7 days. The planned `GET` export endpoint would put the entire family export into Cache Storage.
  - Workbox runtime caching does not honour `Cache-Control: no-store` on the response, so a header fix on the server is not enough **[reasoning]**.

**How to avoid:**
- Switch to `registerType: 'prompt'` and show "Update available" only at safe points: profile picker, session summary, parent dashboard. Never reload inside a learning session.
- Add a version handshake. The API returns its version in a response header (`X-WQ-Version`), and the client compares it with its build version and prompts. Keep `/api/v1` backward compatible for at least one minor release.
- Replace the catch-all `/api/` GET cache with an **allowlist** of the endpoints actually needed offline. Clear `wq-api` (`caches.delete`) on logout, profile switch, learner delete and tenant delete. Never cache export, setup, invite or auth endpoints.
- Keep the existing `Cache-Control: no-cache` on `sw.js` and `index.html`. That part is right.

**Warning signs:**
- Bug reports that "only happen on the tablet" after an upgrade.
- Parents seeing yesterday's numbers.
- A deleted child still visible in the offline profile picker.

**Phase to address:** Hardening (cache allowlist and clear-on-logout). Privacy (clear on delete). Release/Ops (update prompt and version handshake before v1.0, because after v1.0 every installed PWA is a client you cannot force-upgrade).

---

### Pitfall 6: Offline answers are stamped with sync time, which corrupts streaks, day reports and due dates

**What goes wrong [code]:**
`SubmitAnswerAsync` and `CompleteSessionAsync` use `clock.GetUtcNow()`, and `SubmitAnswerRequest` has no client timestamp. An answer given offline on Sunday evening and synced Monday gets:
- `ReviewLog.ReviewedAt` = Monday, so the "learning time per day" report credits the wrong day,
- the streak day = Monday, so Sunday counts as missed and the streak breaks or a saver is burned,
- `DueAt` computed from Monday.

The frontend does not call `/sessions/sync` at all today (no outbox in `frontend/src`). Offline learning is therefore **not actually delivered**, even though `PROJECT.md` lists it as validated.

**How to avoid:**
- Before building an outbox, add `AnsweredAt` (client time) to the answer contract and **clamp** it server-side to `[session.StartedAt, now]`. Clamping stops a device-clock change from farming streaks, a known move by kids.
- Derive streak day and report day from the clamped answer time.
- Correct the "Validated" claim in `PROJECT.md`, or scope offline explicitly. Do not document "works offline" for v1.0 unless an outbox exists and has an E2E test.

**Phase to address:** Reporting (the time basis must be right before history charts exist). Game modes / PWA if an outbox is built.

---

### Pitfall 7: Streak and day-bucket off-by-one errors (time zone, DST, stale stored value)

**What goes wrong:**
- **Stored streak shown as current [code].** `LearnerEndpoints.cs:184` returns `gamification.CurrentStreak` as stored. The streak is only recomputed on the next completed session, so a child who stopped five days ago still shows "12-day streak" on the parent dashboard. The planned "has not practiced" notice would then contradict the streak badge on the same screen.
- **Two sources of truth for history.** `StreakRules` counts only *completed* sessions with at least 1 answer, and saver-bridged days count as active without any activity. A streak-history chart derived from `review_log` shows a gap on the saver day, and on days where a session was started but not completed, while the streak says "unbroken".
- **Report bucketing in SQL.** `date_trunc('day', reviewed_at)` on `timestamptz` truncates in the **Postgres session time zone**, which is UTC in the official image. Npgsql translates "local" date operations using the connection's `TimeZone` **[web]**. Evening sessions from 22:00 to 24:00 Berlin summer time (UTC+2) land on the next day.
- **JS side.** `new Date().toISOString().slice(0, 10)` is the UTC date: between 00:00 and 02:00 Berlin time it yields yesterday.
- **Week boundaries.** The container sets no culture, so `CultureInfo.CurrentCulture` is likely invariant (week starts Sunday) **[reasoning]**. German parents expect Monday-based ISO weeks.
- **DST.** "Per-day" loops that add 24 h, or `TimeSpan.FromDays(7)` windows, are wrong on the last Sundays of March and October (23 h and 25 h days).
- **Changing `WQ_TIMEZONE` after data exists** shifts the meaning of `LastActiveDate` (a `DateOnly` in the old zone), and streaks break or double-count.
- A session started at 23:55 and completed at 00:05 counts for the next day, because the streak registers on completion.

**How to avoid:**
- One function in the Gamification module computes the **effective streak** at read time from `LastActiveDate`, today and saver availability. All endpoints use it.
- Persist a tiny `learner_activity_day(learner_id, local_date, kind: active|saver)` row when `RegisterActivity` changes state. Streak history and "has not practiced" read **that table**, which keeps them consistent with the badge by construction. Deriving history from `review_log` gives a second, diverging definition.
- Do day bucketing in C# with `Sm2Scheduler.LocalDate()` (which already exists), or in SQL with `AT TIME ZONE 'Europe/Berlin'` taken from the same `WQ_TIMEZONE` setting. Never rely on the session time zone.
- The API returns days as `DateOnly` strings (`"2026-03-29"`). The frontend treats them as opaque labels and never re-parses them into `Date`.
- Use `System.Globalization.ISOWeek` for weeks.
- Treat `WQ_TIMEZONE` as install-time only and document it as such. Log the resolved time zone at startup. `Sm2Scheduler.ResolveTimeZone` silently falls back to UTC on a typo (`Sm2Scheduler.cs:172-183`) **[code]**; in production, fail fast instead.
- Test with `FakeTimeProvider` (`LearningService` already takes `TimeProvider`): 2026-03-29 and 2026-10-25 transitions, 23:59/00:01 local, and 22:30 local, which is the previous day in UTC.

**Warning signs:**
- Parents report "the streak says 5 but the chart shows 4 days".
- Children lose streaks after learning late in the evening.
- Report totals differ between the dashboard and the week view.

**Phase to address:** Reporting. The effective-streak fix is tiny and could go into Hardening.

---

### Pitfall 8: GDPR delete misses tables, backups and device caches

**What goes wrong:**
- **No foreign keys to learner [code].** `review_state`, `review_log`, `learning_session` and `gamification_profile` hold `LearnerId` as a plain `Guid` with **no FK** (`LearningConfigurations.cs`, only `SessionItem → Session` cascades). Deleting a `LearnerProfile`, or relying on a DB cascade, leaves the child's full answer history behind, including free-text `GivenAnswer` (up to 300 characters of whatever the child typed). The same applies to cards: deleting a set cascades entries and cards, but orphaned `review_state`/`review_log` rows remain and later break joins in "problem words".
- **Backups keep deleted data for 6 months [code].** The backup service keeps 14 daily, 8 weekly and 6 monthly dumps. Deleted data therefore lives on for up to about 6 months, and **restoring an old dump resurrects deleted children**.
- **Logs.** Docker's default `json-file` driver does not rotate, so container logs grow without bound on the SD card and hold PII (the CONCERNS email log, plus anything new). **[reasoning]**
- **Devices.** Pitfall 5: Cache Storage and localStorage on family tablets.
- **Access tokens.** Deleting a learner while their access token is still valid produces 500s in the child's app, unless refresh tokens are revoked and a missing profile maps to 401/404.
- **Export leaks.** A hand-written export that walks entities with `IgnoreQueryFilters()` (as `AuthService` does) can pull other tenants' rows or credential hashes (password, PIN, refresh-token hashes).

**How to avoid:**
- Add real FKs with `ON DELETE CASCADE` from all learner-owned tables to `learner_profile`, and from card-owned rows to `card`, in one migration. Include an orphan cleanup step in that migration. Let the database do the cascade.
- Delete explicitly in one transaction as belt-and-braces, and add an integration test: create a learner with sessions, logs and a profile, delete it, and assert that **every table** has zero rows for that `learner_id`. Generate the table list from the EF model so new tables are covered automatically.
- Revoke the learner's refresh tokens on delete.
- **Backups.** State the retention in the operator docs and the in-app delete dialog ("removed from backups after at most N months"). Keep a minimal deletion ledger (learner GUIDs plus a timestamp only), and make the documented restore procedure re-apply it. Consider shortening monthly retention to 3.
- Set compose `logging: { driver: local }` (rotating by default) or `json-file` with `max-size`/`max-file` on all services. This addresses both disk-full on SD cards and log retention.
- Build the export from an explicit allowlist DTO per entity and tenant-scoped queries only. Add a test asserting that no hash fields appear.
- **Do not over-engineer.** A family running its own instance for its own children is likely covered by the GDPR household exemption, Art. 2(2)(c) **[reasoning, not legal advice]**. Build working delete and export. Skip consent ledgers, DPAs and VACUUM-FULL tricks: dead tuples are reclaimed by autovacuum, and chasing physical erasure in Postgres pages is out of proportion here.

**Phase to address:** Privacy. The FK migration must come **before** Reporting adds more learner-owned tables.

---

### Pitfall 9: HTTPS/DNS setup fails for non-technical hosters, and without HTTPS there is no PWA

**What goes wrong [code + web]:**
- **`.local` default.** `WQ_HOST` defaults to `wordquest.local`. Let's Encrypt cannot issue for `.local`, so Traefik falls back to its self-signed default certificate. The browser warns, service workers do not register on an untrusted origin, and there is no install and no offline use.
- **Invalid ACME email.** `WQ_ACME_EMAIL` defaults to `admin@example.com`, and Let's Encrypt **rejects** example.com contact addresses at account registration **[web]**. The `setup.sh` prompt offers exactly that default.
- **Unusable DNS provider default.** The DNS-01 provider defaults to `manual`, which needs interactive TXT entry and is useless in a detached container **[reasoning]**. Only `CF_DNS_API_TOKEN` is passed through, so every other provider (deSEC, DuckDNS, IONOS, Hetzner, INWX) silently lacks credentials.
- **German home networks.**
  - FRITZ!Box **DNS-rebind protection** blocks public names that resolve to 192.168.x.x unless the hostname is added as an exception **[web]**. The typical split-horizon/LAN-only setup "doesn't resolve" inside the home.
  - DS-Lite connections (common on German cable and fiber) have no public IPv4, so port-forwarding for HTTP-01 or remote access is impossible **[reasoning]**.
  - A stale AAAA record pointing elsewhere makes validation fail.
- **Rate limits.** Repeated restarts with broken config hit Let's Encrypt failed-validation and duplicate-certificate limits, so the hoster is locked out for hours or a week.
- **Floating Traefik tag.** `traefik:v3` floats. Docker Engine 29 (Nov 2025) raised the minimum API version, which broke Traefik's Docker provider until 3.6.1 **[web]**. Pinning an *old* Traefik is equally dangerous. Pin a known-good minor that is ≥ 3.6.1 and bump it deliberately with each release.
- **No hardware clock.** The Raspberry Pi keeps no time without network, and a Pi 5 keeps time only with a backup battery for its RTC **[reasoning]**. After a power cut with no internet, a wrong clock breaks JWT validation, ACME and streak days.

**How to avoid:**
- `setup.sh` validates its inputs:
  - reject `.local`, bare hostnames and `example.com` emails;
  - ask for the DNS provider from a short list and write the matching environment variables into an `env_file` for the proxy;
  - offer the Let's Encrypt **staging** CA for a first dry run.
- Document **one** recommended path in detail: LAN-only access, a real domain or a free dynamic-DNS name with DNS-01 (deSEC or DuckDNS, both lego providers **[reasoning]**), and the FRITZ!Box rebind exception with screenshots. Internet exposure is optional, with a warning. This also shrinks the takeover and brute-force surface from pitfalls 1 and 11.
- Keep `docker-compose.quick.yml` clearly "no PWA, local test only". It already says so, which is good. See Pitfall 12 for its security issue.
- Have the API log a clear startup warning when `WQ_PUBLIC_URL` is not `https`.

**Phase to address:** Release/Ops (docs, `setup.sh` validation, Traefik pin). Verify it by having a third party install unaided, which is the v1.0 done criterion.

---

## Moderate Pitfalls

### Pitfall 10: The forwarded-headers fix still yields one global bucket, or allows spoofing

**What goes wrong:**
The CONCERNS fix, `UseForwardedHeaders` with `KnownNetworks`, is incomplete for this topology: client → Traefik → nginx → API.
- nginx *appends* to `X-Forwarded-For`, which becomes `client, traefik-ip`.
- ASP.NET's default `ForwardLimit = 1` processes only the right-most hop, so every client appears as Traefik's IP and still shares one bucket **[web]**.
- Since .NET 8, headers from proxies outside `KnownProxies`/`KnownNetworks` (default: loopback only) are ignored, so Docker bridge IPs must be listed **[web]**.
- nginx *overwrites* `X-Forwarded-Proto` with `$scheme` = `http` **[code]**. The resulting header asymmetry can make the middleware ignore the headers **[web]**, and any server-built URL (invite links) comes out as `http://`.
- Trusting all private ranges plus a high `ForwardLimit` lets a LAN client spoof its IP to dodge the PIN lockout.

**How to avoid:**
- Pin the compose network subnet explicitly.
- Set `KnownNetworks` to that subnet, `ForwardLimit = 2`, and forward only `XForwardedFor`.
- In nginx, pass `X-Forwarded-Proto $http_x_forwarded_proto`.
- Build invite and setup links client-side from `window.location.origin` rather than from the request scheme or `WQ_PUBLIC_URL`.
- Add an integration test with a crafted `X-Forwarded-For` chain.

**Phase:** Hardening.

### Pitfall 11: Refresh-token reuse detection logs families out on flaky tablet Wi-Fi

**What goes wrong [code]:**
`RefreshAsync` revokes **all** tokens of the user when an already-rotated token reappears (`AuthService.cs:112-119`), and `refreshInFlight` deduplicates only within one tab. Three ordinary events trigger it:
- the server rotates but the response is lost on bad Wi-Fi, and the client retries with the old token;
- two tabs or windows refresh at once;
- a service-worker update reload happens mid-refresh.

Any of these logs the child, or the parent on every device, out. Kids then re-enter PINs, burn the PIN lockout, and parents conclude the app is broken.

**How to avoid:**
- Add a short grace window of about 30-60 s. Within it, a presentation of the *immediate predecessor* returns the already-issued successor instead of revoking everything; outside it, revoke as today.
- Coordinate tabs with the Web Locks API (`navigator.locks.request`) or `BroadcastChannel`.

**Phase:** Hardening.

### Pitfall 12: The quick compose runs as production with a public JWT key

**What goes wrong [code]:**
`docker-compose.quick.yml` ships a **known default `WQ_JWT_SIGNING_KEY`** and publishes port 8080 on all interfaces. Anyone who knows the repo can forge tokens for a quick-mode instance that is reachable from outside: a VPS, a port-forward, or a NAS exposed via UPnP. Docker-published ports also bypass host firewalls such as UFW **[reasoning]**. "Quick" installs have a habit of becoming the permanent install.

**How to avoid:**
- Generate a random key when none is set: the API writes it to the data volume on first start. Or refuse to start in Production with the known default string.
- Bind quick mode to `127.0.0.1:8080` by default, and document LAN exposure as a conscious choice.

**Phase:** Hardening.

### Pitfall 13: The CLI password reset boots the whole web host

**What goes wrong [reasoning + code]:**
- `docker compose exec api dotnet WordQuest.Api.dll reset-password ...` runs `Program.cs` top to bottom. That means `MigrateAsync`, optional demo seeding, and `RunAsync` binding port 8080, which is already taken by the running process.
- A password passed as an argument lands in shell history and `ps`.
- A reset that does not revoke refresh tokens leaves an attacker's session alive.

**How to avoid:**
- Branch on `args` right after `builder.Build()` and before the migration and seed block. Resolve the `DbContext` from DI, run the command, and exit.
- Prompt for the password on stdin, or generate one and force a change at next login.
- Revoke all refresh tokens and clear the lockout.
- Add `list-users` and `setup-token` commands in the same CLI; both are needed for pitfalls 1 and 13.

**Phase:** Accounts.

### Pitfall 14: Guardian invite tokens leak, and a second guardian can destroy the family account

**What goes wrong:**
- **Token leaks.** An invite token in a URL path or query ends up in nginx access logs (`docker logs web`), in the service-worker API cache if fetched via GET, and in browser history.
- **No role boundary.** Roles `Owner`/`Guardian` exist (`Program.cs:66`) **[code]**, but if "Guardian" may delete the tenant, remove the owner or issue invites, then in a separated-parents scenario one parent can erase the other's access and the children's history.
- **Broken links.** Links built from `WQ_PUBLIC_URL` break when the family uses a different hostname or IP internally.

**How to avoid:**
- Put the token in the URL fragment, and have the SPA POST it. Store only its hash. Make it single-use with a 7-day expiry, and allow listing and revoking pending invites.
- Keep tenant delete, invite and guardian removal **Owner-only**. Use an explicit authorization matrix with an integration test per cell.
- Build links client-side from `window.location.origin`.

**Phase:** Accounts.

### Pitfall 15: A backup exists but restore fails silently

**What goes wrong [web + code]:**
- `prodrigestivill/postgres-backup-local` writes plain `.sql.gz` dumps meant to be restored through `psql` **[web]**. Piping one into a DB that the API has **already auto-migrated** produces "already exists" and duplicate-key errors. `psql` continues past errors by default, so the result is a half-restored database that *looks* fine.
- The `./backups` bind mount must be writable by UID 999, per the image README **[web]**, or backups fail silently from day one.
- Named volumes (`letsencrypt`) and `secrets/` are not in the dump. The JWT key can be regenerated, which only forces a re-login, but losing `acme.json` repeatedly runs into Let's Encrypt rate limits.
- `latest` symlinks inside `backups/` are handled inconsistently by off-host copy tools.
- Restoring a dump from a *newer* app version into an older image fails.

**How to avoid:**
- Write a documented `restore.sh`:
  1. stop `api` and `web`;
  2. drop and recreate the DB;
  3. `gunzip -c dump | psql -v ON_ERROR_STOP=1 --single-transaction`;
  4. start the image version recorded with the dump.

  Name dumps or record metadata with `WQ_VERSION`.
- Test the restore **in CI** (dump → restore → API health → row counts) and once on real ARM hardware.
- Have `setup.sh` create `backups/` with the right owner.
- For off-host copies, recommend restic (encrypted, which matters for children's data on third-party storage) and follow symlinks deliberately, or exclude them.

**Phase:** Release/Ops. The restore test belongs in Quality.

### Pitfall 16: Missing CSP on the pages that matter (nginx `add_header` inheritance)

**What goes wrong [code + web]:**
nginx inherits `add_header` from the server block **only if the location defines none** **[web]**. `location = /index.html`, `/sw.js` and `/assets/` each set `Cache-Control` via `add_header`, so they drop **all** security headers, including the strict CSP. SPA navigation ends at `/index.html` through `try_files` and `index`. The main HTML document therefore very likely ships **without CSP**, and the precached copy in the service worker keeps it that way. CSP is the stated compensating control for tokens in localStorage (`PROJECT.md` constraints). Not verified at runtime.

**How to avoid:**
- Move the security headers into an `include` file and include it in every location, or use `add_header_inherit merge` if the nginx image is ≥ 1.29.3 **[web]**.
- Verify with `curl -sI https://<host>/ | grep -i content-security-policy` and a CI smoke test against the built `web` image.

**Phase:** Hardening.

---

## Minor Pitfalls

| # | Pitfall | Prevention | Phase |
|---|---------|------------|-------|
| 17 | Image publication. New GHCR packages default to **private**, and visibility is set per package, not inherited from a public repo later **[web]**, so third parties get `denied` on `docker pull`. | Make both packages public once. Add a release smoke test that pulls anonymously. | Release/Ops |
| 18 | arm64 builds under QEMU on `ubuntu-latest` (`ci.yml:94-117`) **[code]** are slow and fragile for `dotnet publish`/`npm ci`. | Use `FROM --platform=$BUILDPLATFORM` for the SDK and node stages and cross-publish with `-a $TARGETARCH`, or use native arm64 runners (free for public repos, available for private since Jan 2026) **[web]**. | Release/Ops |
| 19 | The mutable `master` tag is the default `WQ_VERSION` **[code]**. | Release tags `1.0.0` and `1.0`. Docs pin the exact version. No `latest` in docs. | Release/Ops |
| 20 | Auto-updaters. Hosters run Watchtower, which was archived Dec 2025 **[web]**, or a fork, and it pulls a new release with migrations at 3 a.m. with no backup. | Docs: "do not auto-update WordQuest; use `upgrade.sh`". Exact version pins make floating updaters a no-op. | Release/Ops |
| 21 | Future Postgres major bump. The `postgres:18` image moved PGDATA and the VOLUME path, so an old mount is silently ignored and the DB starts empty **[web]**. Switching alpine ↔ debian variants risks collation or index problems **[reasoning]**. | Stay on `17-alpine` for v1.x. A major upgrade is a documented dump/restore, never a tag bump. | Release/Ops |
| 22 | Disk fills on SD card or NAS from old images after each upgrade, unrotated logs, and dumps. | `upgrade.sh` runs `docker image prune -f`; logging driver `local`; document expected sizes. | Release/Ops |
| 23 | Duplicate distractors. `BuildChoicesAsync` can include a synonym equal to the correct answer, or give fewer than 4 options in tiny sets **[code]**. | Deduplicate normalized choices against the correct answer and alternatives. Recognition modes need a minimum set size (≥ 4 entries) or fall back to classic. | Game modes |
| 24 | Speed-based Easy uses client-supplied `answerMs` **[code]**. | Fine for classic typing. In recognition modes, ignore it (see Pitfall 2). | Game modes |
| 25 | Cram and memory give 0.5 XP with no scheduling effect, so cram can be replayed endlessly for XP and streak. | Cap cram XP per day or per set, or give no streak credit for cram-only days. Decide deliberately; kids will find it. | Game modes |
| 26 | "Has not practiced" notice computed on page load at 00:05 flags a child who practiced at 23:50. | Base it on `learner_activity_day` with an "N full local days" rule, not on hours since the last answer. | Reporting |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Setup open while no tenant exists, no token | No extra step for the hoster | Takeover via CT-log scanning; reopens after tenant delete | Never on the TLS compose |
| Deriving streak history from `review_log` | No new table | Two diverging streak definitions; parent confusion | Never. Add `learner_activity_day` |
| Catch-all `GET /api/*` runtime cache | "Offline" for free | Stale schemas after upgrade, cross-user leakage, GDPR residue | Only with an allowlist and clear-on-logout |
| New game modes reusing classic grading | Fast to ship modes | Inflated intervals; false readiness reports; later data repair needed | Only with `AffectsScheduling: false` |
| Startup auto-migration with no pre-migration dump | Zero-step upgrades | No rollback path on a failed upgrade | Acceptable **with** `upgrade.sh` taking a dump first |
| Bucketing reports with `date_trunc` in SQL | One query | Evening activity on the wrong day | Only with an explicit `AT TIME ZONE` from `WQ_TIMEZONE` |
| Silent UTC fallback for a misspelled time zone | Instance always starts | Due dates, streaks and reports shifted by 1-2 h, unnoticed | Development only; fail fast in Production |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Let's Encrypt via Traefik | example.com email, `.local` host, `manual` DNS provider, testing against the production CA | Validate in `setup.sh`; use staging for the first run; pass provider env via `env_file` |
| FRITZ!Box / home router | Split-horizon DNS blocked by rebind protection; DS-Lite has no IPv4 | Document the rebind exception; recommend DNS-01 plus LAN/VPN access |
| Docker Engine ↔ Traefik | Floating `traefik:v3`, or an old pin that breaks with Docker 29 | Pin a tested minor ≥ 3.6.1; bump per release |
| nginx ↔ API container | Static `proxy_pass http://api:8080` caches the IP | `resolver 127.0.0.11` plus a variable upstream |
| Postgres backup image | Restoring into an auto-migrated DB with `psql` defaults | Stop the API, recreate the DB, `ON_ERROR_STOP=1 --single-transaction` |
| GHCR | Private-by-default packages | Set visibility public; anonymous pull smoke test |
| EF Core 10 `MigrateAsync` | Model drift throws at startup on every hoster | CI `has-pending-model-changes` plus a forward-upgrade test |

## Performance Traps

Family scale is tiny: about 3 children × about 50 answers/day is about 55k `review_log` rows/year. Do **not** pre-aggregate reports. The real traps are latency on Pi hardware, not volume.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| The 5 s `NetworkFirst` timeout vs. cold .NET start or report queries on a Pi | Silently stale data served from cache | Allowlist cache; keep report endpoints out of the SW cache; a single grouped query per report | First request after idle or upgrade on Pi 4/5 with SD card |
| Postgres on an SD card | Slow migrations, corruption after power loss, card wear | Recommend SSD/NVMe for `pgdata`; document it | Months of daily use; any power cut |
| Export built fully in memory | Fine now | Stream JSON (`Utf8JsonWriter`) only if exports exceed tens of MB | Not at family scale; skip for v1.0 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tokenless setup endpoint | Instance takeover minutes after cert issuance | Setup token in fragment, singleton constraint, CLI re-arm |
| Known JWT key in quick compose | Token forgery on exposed quick installs | Generate per install; refuse the default in Production |
| Missing CSP on `index.html` due to nginx inheritance | XSS → token theft (the stated compensating control is absent) | Shared header include; curl check in CI |
| Invite token in path/query | Leaks via logs and caches | Fragment plus POST, hashed, single-use, expiring |
| Guardian can delete tenant or owner | Hostile co-parent erases the family account | Owner-only destructive actions; authz matrix tests |
| Forwarded-headers misconfiguration | Global lockout, or IP spoofing that bypasses PIN lockout | Pinned subnet, `ForwardLimit = 2`, XFF only |
| Children without a PIN on an internet-exposed instance | Anyone can act as the child | Recommend LAN/VPN; consider requiring a PIN when `WQ_PUBLIC_URL` is public |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Update reload during a child's session | Lost progress, frustration | Prompt mode; update only at safe points |
| Streak badge disagrees with history and notices | Parents distrust all reports | One effective-streak function plus `learner_activity_day` |
| Readiness shows green from recognition-only practice | Child fails the vocabulary test, parent blames the app | Readiness from recall evidence only; show the evidence basis ("12 of 20 typed correctly") |
| Mass logout after a Wi-Fi blip (reuse detection) | Kids re-enter PINs and hit lockout | Grace window plus cross-tab lock |
| Setup and HTTPS docs written for developers | The v1.0 criterion (third-party install unaided) fails | One tested path with screenshots; `setup.sh` validation with plain-language errors |

## "Looks Done But Isn't" Checklist

- [ ] **Setup wizard:** refuses without the token; two concurrent POSTs give one 201 and one 409; stays locked after tenant delete; demo tenant blocks it.
- [ ] **CLI reset:** runs while the API is up (no port bind, no migration); revokes refresh tokens; no password in `ps`.
- [ ] **Learner delete:** zero rows in **every** learner-owned table (test generated from the EF model); refresh tokens revoked; `wq-api` cache cleared on the deleting device; backup retention stated in the UI.
- [ ] **Export:** contains `GivenAnswer`, sessions and gamification; contains **no** password, PIN or token hashes; not cached by the SW.
- [ ] **Reports:** a 22:30 Berlin answer lands on the same local day; DST Sundays give correct totals; weeks start Monday; the stored streak is not shown raw.
- [ ] **New game mode:** N fast correct answers cannot push an interval beyond the agreed bound; readiness ignores recognition; cram leaves no `New` orphans.
- [ ] **Upgrade:** `upgrade.sh` takes a dump first; a forward migration from the previous release's fixture passes in CI; nginx survives recreation of the API container.
- [ ] **Restore:** tested end to end in CI with `ON_ERROR_STOP=1`; a documented version-matching rule.
- [ ] **HTTPS:** `curl -sI` shows CSP on `/`; `setup.sh` rejects `.local` and `example.com`; anonymous `docker pull` of both images works.
- [ ] **PWA update:** an old installed client gets a prompt (not a crash) against a new API; logout clears `wq-api`.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Setup takeover happened | HIGH | Stop the stack, drop the DB volume (no user data yet), re-run with a setup token; rotate the JWT key |
| Intervals inflated by recognition modes | MEDIUM | `review_log` has `GameKey` and grades: recompute `ReviewState` by replaying only recall logs through `Sm2Scheduler` (the append-only log was designed for this, see `ReviewLog.cs`) |
| Stranded `New` states | LOW | One-off migration: set `due_at = now()` so the fixed query picks them up |
| Failed mid-upgrade migration | MEDIUM | Restore the pre-upgrade dump into a fresh DB and start the previous `WQ_VERSION` |
| Orphaned learner data after delete | LOW | FK migration with an orphan-cleanup step (`DELETE ... WHERE learner_id NOT IN (...)`) |
| Wrong day buckets in reports | LOW | Reports are derived data; fix the bucketing function. Stored `LastActiveDate` values stay valid if `WQ_TIMEZONE` never changed |
| Deleted child restored from backup | LOW | Re-apply the deletion ledger after restore |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Setup takeover | Accounts | Integration tests: no token → 403; parallel setup → 201 + 409; tenant delete → setup still 403 |
| 2 Recognition inflation | Game modes (before any new mode in UI) | Scheduler unit test with a bound on interval after N recognition answers |
| 3 Stranded `New` states | Game modes / Hardening | Test: start session, answer nothing, next session re-offers the card |
| 4 Upgrade/migration | Release/Ops + Quality | CI forward-migration test from the previous release fixture; `upgrade.sh` dry run on arm64 |
| 5 Stale SW / API cache | Hardening + Privacy + Release/Ops | Playwright SW-enabled test: old build → new API shows the prompt; logout empties `wq-api` |
| 6 Sync timestamps | Reporting | Test: clamped `AnsweredAt` from yesterday lands on yesterday's streak day |
| 7 Time zone / streak | Reporting | `FakeTimeProvider` tests at DST dates and 22:30/23:59 local |
| 8 GDPR delete gaps | Privacy | Model-generated "all learner tables empty" test; backup retention text present |
| 9 HTTPS/DNS | Release/Ops | Third-party install on a FRITZ!Box network; `setup.sh` input validation tests |
| 10 Forwarded headers | Hardening | Integration test with a two-hop XFF chain; two clients get separate buckets |
| 11 Refresh reuse | Hardening | Test: replay the predecessor within the grace window → same successor, no revoke |
| 12 Quick-compose key | Hardening | Production start with the default key fails |
| 13 CLI reset | Accounts | `docker compose exec api ... reset-password` against a running stack in CI |
| 14 Invites | Accounts | Authorization matrix tests; token absent from `docker logs web` |
| 15 Restore | Release/Ops + Quality | CI dump → restore → health → counts |
| 16 nginx CSP | Hardening | CI curl check on the built `web` image |

## Testing Pitfalls (for the Quality phase)

- **Wrong provider.** Do not test against EF InMemory or SQLite. `xmin` concurrency tokens, `timestamptz` semantics, the Postgres-syntax filtered unique index (`client_answer_id IS NOT NULL`) and case sensitivity all differ. Use Testcontainers with the **same image as production** (`postgres:17-alpine`, multi-arch, so it runs natively on Apple Silicon and arm64 runners).
- **Shared DB races.** xUnit runs test *classes* in parallel. Several classes sharing one database container cause flaky failures. Use one container per assembly plus a fresh database per class (`CREATE DATABASE ... TEMPLATE`, or Respawn), or put DB tests into one sequential collection, as the house rule requires for shared databases.
- **`WebApplicationFactory` runs real startup.** It executes `MigrateAsync`, optional seeding and secret-file reading from `Program.cs`. After the planned "fail fast on missing secrets" change, the test host will not start unless tests provide secrets through configuration. Plan the test configuration together with that hardening item.
- **The rate limiter breaks auth tests [code].** The `auth` policy allows 10 requests/minute per `RemoteIpAddress`, and TestServer has a null or constant IP. The 11th login in a test run returns 429. Make limits configurable, with high values in tests, and add one dedicated test for the limiter itself.
- **Time travel.** Use `FakeTimeProvider` for streak, DST and due-date tests at service level. JWT validation uses its own clock, so keep time-travel tests below the HTTP layer, or configure the token handler's time source consistently **[reasoning]**.
- **Local container runtime.** Testcontainers on macOS with Colima or rootless Docker needs `DOCKER_HOST`/`TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`, and sometimes `TESTCONTAINERS_RYUK_DISABLED` **[web]**. Document this in CONTRIBUTING; CI on `ubuntu-latest` needs nothing extra.
- **Playwright and the service worker.**
  - `context.route()` does **not** intercept requests handled by a service worker. Functional E2E tests need `serviceWorkers: 'block'` **[web]**.
  - Keep a separate, small SW-enabled suite for update and offline behaviour, run against `vite preview` or the built `web` image. The dev server does not register the production SW.
  - Run E2E sequentially against one backend; parallel workers against a shared DB are flaky (house rule).
- **Form edge-case matrix.** The house rule applies to setup wizard, password change, invite acceptance and PIN forms: one wrong field per test, a keyboard-submit path, and exact error texts.

## Sources

- Repository code at `4ce32da`: `LearningService.cs`, `GameCatalog.cs`, `AnswerEvaluator.cs`, `SchedulerOptions.cs`, `Sm2Scheduler.cs`, `StreakRules.cs`, `LearningConfigurations.cs`, `AuthService.cs`, `Program.cs`, `frontend/vite.config.ts`, `frontend/nginx.conf`, `frontend/src/lib/api.ts`, `docker-compose.yml`, `docker-compose.quick.yml`, `setup.sh`, `backend/Dockerfile`, `.github/workflows/ci.yml` (HIGH as observations; not runtime-reproduced)
- EF Core 9 breaking change, PendingModelChangesWarning on Migrate: https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-9.0/breaking-changes, https://github.com/dotnet/efcore/issues/35285 (MEDIUM)
- EF Core 9 what's new, migration locking and non-transactional operation warning: https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-9.0/whatsnew (MEDIUM; official doc fetched)
- Docker 29 vs Traefik API version: https://forums.docker.com/t/docker-29-increased-minimum-api-version-breaks-traefik-reverse-proxy/150384, https://community.traefik.io/t/traefik-stops-working-it-uses-old-api-version-1-24/29019 (MEDIUM)
- Portainer 5-minute setup window: https://docs.portainer.io/faqs/installing/your-portainer-instance-has-timed-out-for-security-purposes-error-fix (MEDIUM)
- CT-log-driven WordPress installer takeover: https://www.feistyduck.com/bulletproof-tls-newsletter/issue_89_certificate_transparency_data_is_used_to_compromise_wordpress_before_installation (MEDIUM)
- Postgres 18 image PGDATA/VOLUME change: https://hub.docker.com/_/postgres, https://github.com/docker-library/postgres/issues/1370 (MEDIUM)
- vite-plugin-pwa autoUpdate behaviour: https://raw.githubusercontent.com/vite-pwa/docs/main/guide/auto-update.md (MEDIUM; official doc source fetched)
- Playwright service workers vs route: https://playwright.dev/docs/service-workers, https://playwright.dev/docs/network (MEDIUM)
- Let's Encrypt forbidden example.com contact: https://cert-manager.io/docs/troubleshooting/acme/ (MEDIUM)
- FRITZ!Box DNS rebind protection: https://dasnetzundich.de/dns-rebind-schutz-bei-der-fritzbox-warum-deine-heimserver-domain-intern-nicht-erreichbar-ist/ (MEDIUM)
- nginx add_header inheritance and add_header_inherit (1.29.3): https://nginx.org/en/docs/http/ngx_http_headers_module.html (MEDIUM)
- nginx stale upstream IP in Docker: https://ypereirareis.github.io/blog/2020/02/18/how-to-reduce-nginx-502-bad-gateway-errors-risks-with-dynamic-domain-name-resolution/ (MEDIUM)
- ASP.NET Core forwarded headers, ForwardLimit and unknown proxies: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0, https://learn.microsoft.com/en-us/dotnet/core/compatibility/aspnet-core/8.0/forwarded-headers-unknown-proxies (MEDIUM)
- Npgsql date/time translation and the TimeZone connection parameter: https://www.npgsql.org/efcore/mapping/translations.html (MEDIUM)
- postgres-backup-local README (permissions, psql restore): https://github.com/prodrigestivill/docker-postgres-backup-local (MEDIUM)
- GHCR default package visibility: https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility (MEDIUM)
- GitHub arm64 hosted runners: https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/, https://github.blog/changelog/2026-01-29-arm64-standard-runners-are-now-available-in-private-repositories/ (MEDIUM)
- Watchtower archived: https://github.com/containrrr/watchtower/discussions/2135 (MEDIUM)
- Testcontainers with Colima/rootless: https://golang.testcontainers.org/features/configuration/ (MEDIUM; cross-language config, .NET equivalent assumed)
- Recognition vs recall in SRS: https://migaku.com/blog/language-fun/spaced-repetition-in-2026-how-it-actually-works (LOW; vendor blog; the interval arithmetic in Pitfall 2 comes from the repo's own scheduler constants)

---
*Pitfalls research for: self-hosted family vocabulary PWA (WordQuest v1.0 release)*
*Researched: 2026-09-24*
