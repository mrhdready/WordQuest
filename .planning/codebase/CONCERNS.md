---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
# Codebase Concerns

**Analysis Date:** 2026-09-24

## Tech Debt

**No guardian account lifecycle (register / change password):**

- Issue: The only way a guardian account comes into existence is `DemoDataSeeder`. The auth group exposes only `profiles`, `login`, `learner-login`, `refresh`, `logout`.
- Files: `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs:13-21`, `backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs`, `setup.sh:90-95`
- Impact: Every production install runs on `demo@wordquest.local` / `demo1234`. `setup.sh:94-95` tells the operator to change the demo password and disable seeding "once you have created your own accounts", which is impossible in-app.
- Fix approach: Add a first-run setup endpoint (create owner + tenant when no tenant exists) and an authenticated `POST /api/v1/auth/password` endpoint; flip `WQ_SEED_DEMO_DATA` default to `false`.

**Demo seeding enabled by default in production compose:**

- Issue: `WQ_SEED_DEMO_DATA: ${WQ_SEED_DEMO_DATA:-true}` in the TLS/production file.
- Files: `docker-compose.yml:43-45`, `backend/src/WordQuest.Api/Program.cs:148-151`
- Impact: Publicly reachable instance with known credentials.
- Fix approach: Default `false`; seed only via explicit opt-in (quick/dev compose).

**Silent DB password fallback:**

- Issue: `ReadSecret("WQ_DB_PASSWORD", "devpassword")` falls back to a hardcoded password when the secret file is missing or the path is wrong (`File.Exists` false is silently ignored).
- Files: `backend/src/WordQuest.Api/Program.cs:158-168`, `backend/src/WordQuest.Api/Program.cs:182`
- Impact: Misconfigured secret mounts fail late and confusingly (auth error against DB) or connect to a DB actually using `devpassword`.
- Fix approach: Fallback only when `builder.Environment.IsDevelopment()`; throw otherwise (same pattern as the JWT key at `Program.cs:18-20`). Also throw when `*_FILE` is set but the file does not exist.

**Business logic in endpoint files:**

- Issue: `TrafficLightAsync`, `OverviewAsync` and import logic (mastery thresholds `Repetitions >= 3 && EaseFactor >= 2.1 && Lapses <= 1`) live in minimal-API handlers; the mastery rule is duplicated.
- Files: `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:168-172`, `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:223-227`, `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:166-192`
- Impact: Mastery definition can drift between dashboard and overview; not unit-testable.
- Fix approach: Move the mastery predicate into `WordQuest.Modules.Learning` (next to `Sm2Scheduler`) and call it from both places.

**Repo hygiene:**

- Issue: Seven near-duplicate `.docx` files (`... 1.docx`, `... 2.docx`, `... 3.docx`, `_Vollstaendig 1/2.docx`) and a stray `Claude outputs/` folder with old CI drafts.
- Files: `Documentation/*.docx`, `Claude outputs/ci.yml`, `Claude outputs/ci-1.yml`
- Impact: Unclear which document is canonical; binary bloat in git history.
- Fix approach: Keep one canonical doc (prefer `Documentation/WordQuest_Konzept_und_Architektur.md`), delete copies and `Claude outputs/`.

## Known Bugs

**Rate limiter is effectively one global bucket:**

- Symptoms: 10 auth requests/minute shared across all users; one family member mistyping can lock everyone out of login/PIN/refresh with 429.
- Files: `backend/src/WordQuest.Api/Program.cs:70-81`, `frontend/nginx.conf:39-47`, `docker-compose.yml:60-96`
- Trigger: API sits behind Traefik -> nginx; `RemoteIpAddress` is always the nginx container. No `UseForwardedHeaders` in the pipeline (`Program.cs:106-121`).
- Workaround: None.
- Fix: `app.UseForwardedHeaders()` with `KnownNetworks` set to the Docker network, before `UseRateLimiter`. Note `/refresh` is also in the rate-limited group (`AuthEndpoints.cs:15,20`), so normal token refreshes consume the same budget.

**Invalid session item IDs produce HTTP 500:**

- Symptoms: `SubmitAnswerAsync` throws `InvalidOperationException` for unknown session/item; nothing maps it, so `UseExceptionHandler` returns 500.
- Files: `backend/src/WordQuest.Infrastructure/LearningService.cs:150-156`, `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:44-64`, `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:109-114`
- Trigger: Stale offline sync payload or tampered `itemId`. In `SyncAsync` one bad answer aborts the whole batch.
- Fix: Map to 404/400 in the endpoint, or skip-and-report per answer in sync.

**Race on concurrent answers:**

- Symptoms: Two concurrent submissions for the same item (double tap, parallel sync) can both see `AnsweredAt == null`. A second `ReviewState` insert fails on the primary key `(LearnerId, CardId)` → HTTP 500; updates to an existing `ReviewState`/`GamificationProfile` can be lost (last write wins). Derived from code, not reproduced.
- Files: `backend/src/WordQuest.Infrastructure/LearningService.cs:169-193`, `backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs:12`
- Trigger: Parallel requests. Duplicate `ReviewState` rows are impossible (composite PK `(LearnerId, CardId)`, `LearningConfigurations.cs:12`); no concurrency token observed.
- Fix: `xmin` concurrency token on `ReviewState`/`SessionItem`/`GamificationProfile` and map `DbUpdateConcurrencyException`/PK violation to 409.

## Security Considerations

**Known default credentials (see Tech Debt):**

- Risk: Account takeover of the guardian account on any default install.
- Files: `backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs`, `setup.sh:91-92`, `docker-compose.yml:45`
- Current mitigation: Warning text in `setup.sh`.
- Recommendations: Default seed off; password-change endpoint; force change on first login.

**PII in logs:**

- Risk: Failed-login warning logs the normalized email address (also for non-existent addresses entered by anyone).
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:47`
- Current mitigation: None.
- Recommendations: Log user ID when known, otherwise a hash or nothing.

**Health endpoints publicly exposed and identical:**

- Risk: `/health/live` and `/health/ready` both run the DB check; nginx proxies `/health/` to the internet. Unauthenticated callers can trigger DB queries and learn DB status; liveness failing on DB outage causes restart loops.
- Files: `backend/src/WordQuest.Api/Program.cs:84-85`, `backend/src/WordQuest.Api/Program.cs:123-124`, `frontend/nginx.conf:49-51`
- Recommendations: `/health/live` with `Predicate = _ => false`; tag DB check for `ready` only; drop the `/health/` location from nginx (compose healthcheck calls the API directly at `docker-compose.yml:53`).

**Unauthenticated child profile listing:**

- Risk: `GET /api/v1/auth/profiles` returns all children's display names and learner IDs without auth (single-tenant only, documented).
- Files: `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs:24-59`
- Current mitigation: Refuses when >1 tenant; PIN lockout in `AuthService.cs:73-90`.
- Recommendations: Acceptable for home use; before multi-tenant/school use require a tenant hint or device token. PIN is optional (`LearnerEndpoints.cs:70`) — a learner without PIN is fully accessible to anyone reaching the instance.

**No PIN / password strength validation:**

- Risk: PIN accepts any string (including 1 char) when set via create/update.
- Files: `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:70`, `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:117-122`, `backend/src/WordQuest.Api/Contracts/Contracts.cs:33-39`
- Recommendations: Validate format (e.g. 4-6 digits) server-side.

**Unbounded import payloads:**

- Risk: `ImportPreviewRequest.Content` and `ImportConfirmRequest.Entries` have no size/count limit; `SyncRequest.Answers` likewise.
- Files: `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:153-192`, `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:100-105`
- Current mitigation: Kestrel default body limit (~30 MB); guardian/auth required.
- Recommendations: Cap row count and content length.

**GDPR / children's data:**

- Risk: No endpoint to delete a learner, the guardian account, or the tenant, and no data export. Learner data (answers in `SessionItem.GivenAnswer`, `ReviewLog`) is retained indefinitely.
- Files: `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:16-28` (no DELETE), `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs:13-21`
- Recommendations: `DELETE /api/v1/learners/{id}` with cascade, JSON export, retention policy for logs/sessions.

**Tokens in localStorage (accepted risk):**

- Risk: XSS could exfiltrate access/refresh tokens.
- Files: `frontend/src/lib/api.ts:19`, `frontend/src/lib/api.ts:45-63`, `frontend/nginx.conf:7-14`
- Current mitigation: Deliberate, documented trade-off (offline PWA); strict CSP without inline scripts; refresh-token rotation with reuse detection (`backend/src/WordQuest.Api/Auth/AuthService.cs:112-119`).
- Recommendations: Keep CSP strict; do not relax `script-src`. Not a bug.

**Docker socket mounted into Traefik:**

- Risk: `/var/run/docker.sock` read-only mount still grants host-level API access if Traefik is compromised.
- Files: `docker-compose.yml:94`
- Recommendations: Docker socket proxy, or file provider since the service set is static.

## Performance Bottlenecks

**Traffic light correlated subquery:**

- Problem: Per-card subquery against `ReviewStates`, then full in-memory grouping of all cards in the tenant when `setId` is null.
- Files: `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:202-240`
- Cause: Correlated subquery per card; `(learner_id, card_id)` is already the primary key, so the lookup is indexed — cost comes from query shape and in-memory grouping.
- Improvement path: Single left join / grouped query instead of per-card subquery.

**Overview issues four sequential count queries:**

- Problem: `OverviewAsync` runs 4 `CountAsync` + 2 lookups per call; `CardsTotal` counts all tenant cards.
- Files: `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:153-174`
- Improvement path: Fine at family scale; single grouped query if it becomes hot.

**Sync submits answers one by one:**

- Problem: Each offline answer loads session + items + card and calls `SaveChangesAsync`.
- Files: `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:100-105`, `backend/src/WordQuest.Infrastructure/LearningService.cs:150-243`
- Improvement path: Load session once, save once, inside a transaction.

## Fragile Areas

**Tenant isolation via global query filters:**

- Files: `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs:38-55`, `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs:126-140`, `backend/src/WordQuest.Api/Auth/HttpTenantContext.cs`, `backend/src/WordQuest.Api/Auth/AuthService.cs`, `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs:36-53`
- Why fragile: Every new entity must be registered in `ApplyTenantFilter`; any `IgnoreQueryFilters()` bypasses it. Learner-vs-sibling access relies on manual `MayActFor` checks (`SessionEndpoints.cs:121-134`, `LearnerEndpoints.cs:139-142`).
- Safe modification: Register new `ITenantOwned` entities in `OnModelCreating`; never use `IgnoreQueryFilters()` outside `AuthService` / profile listing.
- Test coverage: None — no test verifies cross-tenant or sibling isolation.

**Startup migration on every boot:**

- Files: `backend/src/WordQuest.Api/Program.cs:132-152`
- Why fragile: `MigrateAsync` runs inside the API process; scaling to >1 replica or a failed migration blocks startup. No documented rollback path (EF `Down` exists in `Migrations/20260917045557_Initial.cs`).
- Safe modification: Keep single replica; take a backup before upgrades.

## Scaling Limits

**Single-tenant profile picker:**

- Current capacity: Exactly one tenant per instance.
- Limit: `GET /api/v1/auth/profiles` returns 400 when a second tenant exists (`AuthEndpoints.cs:42-49`).
- Scaling path: Tenant hint (subdomain/code) as documented in the handler comment.

**In-memory rate limiter:**

- Current capacity: Single API process.
- Limit: State is per process; lost on restart.
- Scaling path: Acceptable for single-instance home deployment.

## Dependencies at Risk

**Floating image tags:**

- Risk: `WQ_VERSION:-master` for app images and `traefik:v3`, `postgres:17-alpine` unpinned; an upgrade happens implicitly on `docker compose pull`.
- Files: `docker-compose.yml:13`, `docker-compose.yml:31`, `docker-compose.yml:61`, `docker-compose.yml:73`, `docker-compose.yml:99`
- Impact: Untested builds from `master` deployed to production; default image prefix `ghcr.io/example/wordquest` is a placeholder.
- Migration plan: Default to released semver tags; pin digests for infra images.

**Backups only on the same host:**

- Risk: `./backups` bind mount on the Docker host; disk loss or host compromise loses DB and backups together. No restore procedure or restore test.
- Files: `docker-compose.yml:98-116`
- Migration plan: Off-host copy (restic/rclone), documented and tested restore.

## Missing Critical Features

**Account management:**

- Problem: No registration, password change/reset, guardian invite, learner delete, or data export.
- Blocks: Real production use and GDPR compliance for children's data.

**Observability:**

- Problem: No structured logging config, metrics, or error tracking beyond default console logs.
- Blocks: Diagnosing issues on self-hosted installs.

## Test Coverage Gaps

**API / integration:**

- What's not tested: All endpoints, auth flow, refresh rotation, rate limiting, tenant isolation, `MayActFor` authorization. `public partial class Program` (`Program.cs:187-188`) exists for `WebApplicationFactory` but no project uses it; the only test project is `backend/tests/WordQuest.Learning.Tests/` (pure domain logic).
- Files: `backend/src/WordQuest.Api/**`, `backend/src/WordQuest.Infrastructure/LearningService.cs`
- Risk: Authorization or tenant leaks ship unnoticed.
- Priority: High

**Frontend:**

- What's not tested: No test runner configured in `frontend/package.json`; CI only runs lint/typecheck/build (`.github/workflows/ci.yml`). Login forms, session flow, offline sync untested.
- Files: `frontend/src/features/**`, `frontend/src/lib/api.ts`, `frontend/src/lib/auth.tsx`
- Risk: Regressions in the offline/PWA flow and form validation.
- Priority: High

**Migrations:**

- What's not tested: CI only checks that migration files exist, not that they match the model (`dotnet ef migrations has-pending-model-changes`) or apply to Postgres.
- Files: `.github/workflows/ci.yml` (step "Migration vorhanden?")
- Risk: Model drift crashes container on startup.
- Priority: Medium

---

*Concerns audit: 2026-09-24*
