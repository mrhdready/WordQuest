# Stack Research

**Domain:** Self-hosted family vocabulary PWA (brownfield, v1.0 production readiness)
**Researched:** 2026-09-24
**Confidence:** HIGH for versions (read directly from the NuGet/npm/Docker Hub/GitHub release APIs on 2026-09-24). MEDIUM for behavioural claims taken from official docs via web fetch (the GSD `classify-confidence` seam rates `websearch`/`webfetch` as LOW; every claim below that is marked HIGH was cross-checked against a primary source such as a registry API, the Microsoft Learn page, or the project's own code).

**Scope rule:** The existing stack stays: .NET 10 / ASP.NET Core Minimal APIs / EF Core 10.0.12 / Npgsql 10.0.3 / PostgreSQL 17, React 19.3 / Vite 8.3 / Tailwind 4.3 / TanStack Query 5 / vite-plugin-pwa 1.3, Docker Compose + Traefik v3. This file covers only what the v1.0 targets add.

## Bottom Line: What Actually Gets Added

Most v1.0 targets need **no new dependency**. The full list of additions:

| Where | Add | Why it can't be avoided |
|-------|-----|-------------------------|
| New test project `backend/tests/WordQuest.Api.Tests` | `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 | `WebApplicationFactory` is the only supported way to host the real pipeline in-process |
| `frontend` devDependencies | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` | The frontend has no test runner at all |
| `frontend` devDependencies | `@playwright/test`, `@axe-core/playwright` | The house rules require a WCAG 2.2 AA check on every touched page in a real browser |
| `.config/dotnet-tools.json` (tool manifest, not a runtime dependency) | `dotnet-ef` 10.0.12 | Needed for the explicit `has-pending-model-changes` CI gate |
| `docker-compose.yml` (optional profile `offsite`) | `offen/docker-volume-backup:v2.49.1` | Off-host copy of the existing pg_dump output |
| `.github/dependabot.yml` | Dependabot (built into GitHub, nothing to install) | Keeps the pinned image and action versions current |

Everything else (setup wizard, password change, CLI reset, invites, forwarded headers, rate limiting, xmin concurrency, health split, size limits, JSON export, charts, date handling) uses BCL, ASP.NET Core, EF Core, Npgsql, browser APIs, or code that already exists in this repo.

## Recommended Stack

### Core Technologies (unchanged, re-verified)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| .NET / ASP.NET Core | 10.0.x (packages 10.0.12, current patch) | API | Already in use. 11.0 is only at rc.1 (`11.0.0-rc.1.26425.128`), so don't upgrade in this milestone. HIGH |
| EF Core + Npgsql provider | 10.0.12 / 10.0.3 | ORM | Already current. Npgsql 11 is rc.1 only. HIGH |
| PostgreSQL | **pin `postgres:17.11-alpine`** | DB | 17.11 is the current 17.x minor (Docker Hub, 2026-09-21). Don't jump to 18 (`18.6-alpine` exists): a major upgrade needs dump/restore, and that is a separate operator-facing procedure. HIGH |
| Traefik | **pin `traefik:v3.7.13`** (not `v3`) | TLS reverse proxy | `traefik:v3` floats across minors, which breaks the "pinned infra images" requirement. HIGH |
| nginx | **pin `nginxinc/nginx-unprivileged:1.30.5-alpine`** (stable line) | Static files + `/api` proxy | Replaces the floating `:alpine` tag. 1.31.x is the mainline branch, 1.30.x the stable one. HIGH |
| Node (build/CI only) | 22.x (currently 22.23.3) | Frontend build | Still fine: jsdom 30 needs `^22.22.2`, which the `22` tag resolves to. Node 22 leaves LTS in April 2027, so move to 24 after v1.0. MEDIUM (the EOL date comes from memory) |

### Area 1: Accounts (setup wizard, password change, CLI reset, invites). No new dependency.

| Need | Use | Notes | Confidence |
|------|-----|-------|------------|
| Password hashing for owner / change / reset | Existing `PasswordHasher` (PBKDF2-HMAC-SHA256, versioned `v1.{iterations}...` format) | Reuse it. Side note: `DefaultIterations = 210_000` is below OWASP's current PBKDF2-SHA256 guidance (600k, from memory). Because the iteration count is stored in the hash, you can raise the default and rehash on the next successful login without a migration. Measure latency on a Pi 5 first. | HIGH (code) / MEDIUM (OWASP figure) |
| Random invite tokens | `RandomNumberGenerator.GetBytes(32)` + `System.Buffers.Text.Base64Url.EncodeToString` (BCL since .NET 9) | Store only the SHA-256 via the existing `TokenHasher`. Tokens are single-use with an expiry. Build the link from the `WQ_PUBLIC_URL` already set in compose. | HIGH |
| Temporary password from the CLI reset | `RandomNumberGenerator.GetString(alphabet, length)` (BCL since .NET 8) | Generate a password and print it. Don't read from stdin: `docker compose exec -T` has no TTY, and generating is simpler anyway. | HIGH |
| CLI verb `reset-password` | Plain C# pattern match on `args` in `Program.cs`: `if (args is ["reset-password", var email]) { ...; return; }` placed **after `builder.Build()`**. It must return before `app.RunAsync()`, and before demo seeding. | Invocation: `docker compose exec api dotnet WordQuest.Api.dll reset-password user@example.org`. The container `ENTRYPOINT` is already `dotnet WordQuest.Api.dll`, so `docker compose run --rm api reset-password ...` works too. **Don't use `System.CommandLine`** (2.0.12). It's a whole parser for one verb. | HIGH |
| Setup-wizard "no owner exists" guard | EF query + DB uniqueness, no library | Race condition: two first-run POSTs. Enforce "exactly one owner" in the DB (a unique partial index, or a transaction plus a re-check). Optionally add a one-time setup code that is printed to the container log at startup while no owner exists (Jenkins-style), so an internet-exposed instance can't be claimed by a stranger. | MEDIUM (a design choice, no source needed) |
| Anything using ASP.NET Core Data Protection (e.g. `IDataProtector` for invite tokens) | **Avoid** | The key ring lives in the container filesystem unless you persist it. Every image upgrade would invalidate outstanding tokens. Random token + hash in the DB has no such state. | MEDIUM |

### Area 2: Hardening. No new dependency.

| Need | Use | Notes | Confidence |
|------|-----|-------|------------|
| Real client IP behind Traefik → nginx → api | Built-in `UseForwardedHeaders` with `ForwardedHeadersOptions { ForwardedHeaders = XForwardedFor \| XForwardedProto, ForwardLimit = 2 }` and **`KnownIPNetworks`** (`System.Net.IPNetwork`) set to the compose network. **Not** `KnownNetworks`. | In .NET 10, `KnownNetworks` and `Microsoft.AspNetCore.HttpOverrides.IPNetwork` are obsolete and raise warning `ASPDEPR005`. CI builds with `/warnaserror`, so the old API **fails the build**. Two hops matter: Traefik sets `X-Forwarded-For: client`, and nginx appends Traefik's IP (`$proxy_add_x_forwarded_for`, already in `frontend/nginx.conf`). The default `ForwardLimit = 1` would therefore yield Traefik's IP, which is the bug in CONCERNS.md. Pin the compose network subnet (`networks: default: ipam: config: - subnet: ...`), or trust the RFC1918 ranges. The api port is not published, so only nginx can reach it. Call `UseForwardedHeaders()` **before** `UseRateLimiter()`. | HIGH (MS Learn + breaking-change doc) |
| Rate limiting per IP; refresh gets its own budget | Existing built-in `Microsoft.AspNetCore.RateLimiting`, already wired in `Program.cs` with policy `auth` partitioned by `RemoteIpAddress` | Add a second policy (for example `refresh`) with a larger budget and attach it to the refresh endpoint. Once forwarded headers work, the existing partition key becomes correct without further changes. | HIGH (code) |
| Optimistic concurrency on answer submission | Npgsql **xmin** mapping: `public uint Version { get; private set; }` on the entity (plain property, so the module stays NuGet-free) plus `.Property(x => x.Version).IsRowVersion()` in `WordQuest.Infrastructure/Configurations` | xmin is a hidden PostgreSQL system column, so no real column gets added. Check that the generated migration does not `AddColumn`. Catch `DbUpdateConcurrencyException` in the service layer and return 409. `UseXminAsConcurrencyToken()` is the legacy form; the current Npgsql docs show only `[Timestamp]` / `IsRowVersion()`. | HIGH |
| Liveness vs readiness | Built-in `MapHealthChecks("/health/live", new() { Predicate = _ => false })` and `/health/ready` filtered by tag | Both endpoints already exist but run the same checks. Fix it with the options overload. | HIGH |
| Payload limits (import, sync) | Built-in `RequestSizeLimitAttribute` via `.WithMetadata(...)` on the endpoint, Kestrel `MaxRequestBodySize`, nginx `client_max_body_size`, plus a count check in the service | No validation library needed. | HIGH |
| Fail fast on missing secrets | Plain code in `ReadSecret` / `BuildConnectionString`: throw outside `IsDevelopment()` instead of falling back to `"devpassword"` | | HIGH (code, `Program.cs:182`) |
| PIN format, 4xx instead of 500 | Hand-written checks in services + `Results.Problem` / `TypedResults.ValidationProblem` (built-in, `AddProblemDetails()` is already registered) | **Don't add FluentValidation.** There are few rules, and modules must stay NuGet-free. | HIGH |

### Area 3: Backend integration tests

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `Microsoft.AspNetCore.Mvc.Testing` | 10.0.12 | `WebApplicationFactory<Program>`. In ASP.NET Core 10 a source generator makes the top-level `Program` public, so **no `public partial class Program {}` is needed**. | HIGH |
| `xunit` | **stay on 2.9.3** (the final v2 release) | Both test projects use the same framework. The existing project works: 104/104 passed (TESTING.md). | HIGH |
| `xunit.runner.visualstudio` | 4.0.0 (keep) | Its package description says: *"Capable of running xUnit.net v1, v2, and v3 tests."* The pairing warning in the existing csproj is outdated, and 104/104 tests being discovered confirms that. Delete the misleading comment while you're in the file. | HIGH |
| `Microsoft.NET.Test.Sdk` | 18.10.1 (keep) | | HIGH |
| Postgres for tests | **No Testcontainers.** Use a real Postgres from outside the test process: the CI `services: postgres` container, or `docker-compose.dev.yml` locally. Pass it in via env var. | The fixture creates a unique database per run (`Database=wq_test_{guid}`). The app's own startup `MigrateAsync()` creates and migrates it, and `EnsureDeletedAsync()` removes it at the end. Tests create their own tenants, which the isolation tests need anyway, so no Respawn is required. | MEDIUM (design choice) |

**Why not xunit v3 now:** `xunit.v3` jumped to **4.0.x** in August/September 2026 (4.0.0 on 2026-08-15, 4.0.1 on 2026-09-12). The TestContainers xunit integration still targets `xunit.v3.extensibility.core >= 3.2.2`. Moving means rewriting `IAsyncLifetime` to `ValueTask`, adopting Microsoft Testing Platform, and possibly changing the CI `--collect` / TRX flags. That buys nothing for v1.0. Revisit after the release.

**Wiring notes (from reading `Program.cs`):**
- The signing key and connection string are read **before `builder.Build()`** (`Program.cs:18`, `:28`). Override them in the factory with `builder.UseSetting("ConnectionStrings:Default", ...)` and `UseSetting("Auth:SigningKey", ...)`. Settings applied through `ConfigureAppConfiguration` arrive too late for values read at builder time. Also make sure no `WQ_*` env vars leak into the test process, because env vars win over the fallbacks. MEDIUM (known minimal-hosting behaviour, not re-verified for 10.0).
- In TestServer, `RemoteIpAddress` is `null`, so every request shares the `"unknown"` rate-limit partition, and the 10/min `auth` limit will trip in the login tests. Make `PermitLimit` configurable (options binding) and raise it in the factory. HIGH (code).
- Since EF Core 9, `Migrate()` / `MigrateAsync()` **throws** `PendingModelChangesWarning` when the model differs from the last migration. The integration tests boot the real app, which migrates on start. Just by running, they cover two CI requirements: migrations apply to a real Postgres, and no model changes are pending. HIGH.

**Alternative:** `Testcontainers.PostgreSql` 4.15.0 (plus `Testcontainers.XunitV3` if you later move to v3). Pick it only if `dotnet test` must be self-contained on a dev machine with Docker. Note that on this machine `dotnet` itself runs inside an SDK container (TESTING.md), so Testcontainers there would need the Docker socket mounted plus `TESTCONTAINERS_HOST_OVERRIDE`. That is more wiring than simply pointing at the dev-compose Postgres.

### Area 4: Frontend tests and accessibility

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `vitest` | 5.0.1 (npm `latest`; 5.0.0 released 2026-09-03) | Test runner. Peer `vite ^6.4 \|\| ^7 \|\| ^8`, engines Node `^22.12`, so it works with the existing Vite 8.3 / Node 22. Put the `test:` block in the **existing `vite.config.ts`** so the `@` alias and plugins are reused, with no second config file. If a 5.0 regression bites, 4.1.11 also supports Vite 8. | HIGH (registry) |
| `jsdom` | 30.1.1 | DOM environment for component tests (engines Node `^22.22.2`, so CI Node 22.23.3 is fine) | HIGH |
| `@testing-library/react` | 16.3.3 | Render + queries. Peer react ^19 | HIGH |
| `@testing-library/dom` | 10.4.2 | Required peer of RTL 16 (**must be installed explicitly**) | HIGH |
| `@testing-library/user-event` | 14.6.7 | Realistic typing and Enter-to-submit. The house rules require a separate keyboard-submit path in the form edge-case matrix. | HIGH |
| `@testing-library/jest-dom` | 7.0.1 | `toHaveTextContent` etc. for exact error-text assertions. Use the `@testing-library/jest-dom/vitest` entry. Engines Node >=22. | HIGH |
| `@playwright/test` | 1.63.0 | Real-browser page checks + session flow E2E. CI: `npx playwright install --with-deps chromium` (Chromium only, since this is a family PWA). | HIGH |
| `@axe-core/playwright` | 4.13.0 (axe-core 4.13.0) | WCAG check per touched page: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()` and assert `violations` is empty. That gives the "tool + result" evidence the house rules require. | HIGH (versions) / MEDIUM (the `wcag22aa` tag name should be checked against the axe 4.13 docs) |

**How to test without a backend:** Every API call goes through one wrapper (`frontend/src/lib/api.ts`, `fetch` at lines 80 and 116). Component tests stub `globalThis.fetch` with `vi.fn()`, so **no MSW is needed**. For Playwright, run against `vite preview` and mock `/api/**` with `page.route`. Also set the Playwright context option `serviceWorkers: 'block'`. The PWA service worker would otherwise handle requests that `page.route` cannot intercept. MEDIUM (Playwright docs, from memory; verify in the phase). A full-stack E2E against the compose stack is optional and can come after v1.0.

**Colour modes:** The frontend has no dark mode today (no `dark:` classes, no `prefers-color-scheme`), so one axe run per page covers "all colour modes". If a dark mode is added, the axe run has to repeat with `colorScheme: 'dark'`.

### Area 5: CI (migrations). One dev tool, no runtime dependency.

| Step | Use | Notes | Confidence |
|------|-----|-------|------------|
| Pending model changes | `dotnet tool restore` + `dotnet ef migrations has-pending-model-changes --project src/WordQuest.Infrastructure --startup-project src/WordQuest.Api` (available since EF Core 8), with `dotnet-ef` 10.0.12 pinned in `.config/dotnet-tools.json` | Needs no database, because `DesignTimeDbContextFactory` exists. It replaces the current `ls Migrations/*.cs` shell check with a real semantic check. Pin the tool version to the EF runtime version (10.0.12). | HIGH |
| Apply migrations to Postgres | GitHub Actions `services: postgres: image: postgres:17.11-alpine` + the integration tests from Area 3 | The app migrates on startup, so this needs no separate step and no migration bundle. | HIGH |
| Action versions | Bump everything: `actions/checkout@v7`, `actions/setup-dotnet@v6`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `docker/setup-qemu-action@v4`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/metadata-action@v6`, `docker/build-push-action@v7` | The CI still uses v3/v5/v6 majors that run on Node 20. The docker/* v4+/v6+/v7 releases switched to Node 24 (runner >= 2.327.1). | HIGH (GitHub releases API) |

### Area 6: Off-host backups and restore testing

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| `prodrigestivill/postgres-backup-local` (keep) | **pin `17-alpine-d257e5d`** instead of `:17` | Local daily/weekly/monthly `pg_dump`. It works and is already configured. **Watch item:** its last image push was 2025-09-26, a year ago. If it goes unmaintained, the replacement is a 10-line `postgres:17.11-alpine` + cron sidecar. | HIGH (Docker Hub) |
| `offen/docker-volume-backup` | **`v2.49.1`** (2026-09-21) | **Optional** compose profile `offsite`. Mount `./backups` **read-only** under `/backup`, then ship the dumps to S3 / WebDAV (Nextcloud, Synology) / SSH / Azure / Dropbox / Google Drive. Encryption via `AGE_PASSPHRASE` / `AGE_PUBLIC_KEYS` or GPG, schedule via `BACKUP_CRON_EXPRESSION`, retention via `BACKUP_RETENTION_DAYS`. About 25 MB, arm64. **Don't mount the Docker socket.** It's only needed for stop/exec labels, which this setup doesn't use, since dumps come from the existing sidecar. | HIGH (env var names from the upstream reference) / MEDIUM (read-only bind-mount behaviour, check in the phase) |
| Restore test | No tool. Write a `restore.sh` (`gunzip \| psql` into a fresh `postgres:17.11-alpine`), then boot the API against it and hit `/health/ready`. Run it in CI on each release against a dump made by the pinned backup image, and document the same steps for operators. | "Documented, tested restore" is a requirement. A CI restore job is the observable evidence. | MEDIUM (design) |

**Why not restic/rclone directly:** `restic` 0.19.1 has no scheduler, needs `restic init`, and needs a password kept outside the backup. `rclone` 1.75.1 needs a config file and cron. Each means more operator steps than offen's environment variables, for a database that stays in the MB range. Operators who already run Synology Hyper Backup / restic on the host can ignore the profile and back up `./backups` themselves. Document that as path B.

### Area 7: Release (GHCR, semver, pinning, updates)

| Need | Use | Notes | Confidence |
|------|-----|-------|------------|
| Semver tags | Existing `docker/metadata-action` (bump to v6.2.0). Tags: `type=semver,pattern={{version}}`, `type=semver,pattern={{major}}.{{minor}}`, `type=semver,pattern={{major}}`, `type=sha`. Drop `type=ref,event=branch` for release pulls. | Operators pin `WQ_VERSION=1.0.0` (or `1.0`). Compose default changes from `master` to the release version. | HIGH |
| Image name | `ghcr.io/mrhdready/wordquest-api` / `-web` (lowercase) | metadata-action lowercases image names (`src/meta.ts`: `name.toLowerCase()`), so CI already pushes lowercase names. Replace the `ghcr.io/example/wordquest` placeholder in `docker-compose*.yml` with this. | HIGH |
| GHCR visibility | Manual, one-time: package settings → change visibility to Public, once per package (api, web) | Sources disagree on whether a public repo's first push produces a public package. Add a **logged-out `docker pull`** to the release checklist. | MEDIUM |
| Faster, non-flaky multi-arch builds | `FROM --platform=$BUILDPLATFORM` on the **build** stages of both Dockerfiles (sdk and node) | The API is published framework-dependent with `UseAppHost=false`, so the output is portable IL and the arm64 image can be built natively on amd64 without QEMU. The frontend build stage emits static files. This removes the slow and flaky `dotnet publish`-under-QEMU step with no new tool. Alternative: GitHub's free `ubuntu-24.04-arm` runners for public repos. | MEDIUM (standard Docker + .NET pattern; verify the published image runs on the Pi) |
| Dependency updates | **Dependabot** (`.github/dependabot.yml`) for the ecosystems `nuget`, `npm`, `github-actions`, `docker` (Dockerfiles), and `docker-compose` (GA since 2025-02) | Built into GitHub, so there is nothing to install or host. It keeps the new pins from rotting. Renovate (44.x) is more powerful (grouping, digest pinning with auto-merge) but needs the Renovate app or self-hosting, which is overkill for this repo. | HIGH |
| Image digest pinning | **Don't**, for the published compose | Operators edit tags. Digests are unreadable and make upgrade docs harder. Exact semver tags plus Dependabot are enough for a home-server product. | MEDIUM (judgement) |

### Area 8: Parent reporting charts. No library.

| Need | Use | Why |
|------|-----|-----|
| Cards/time per day and week | Plain JSX + Tailwind: flex bars whose `style={{ height: pct + '%' }}` comes from the data, **plus a visually hidden `<table>` with the same numbers** | One or two bar series and a streak grid are all the charts needed. Hand-rolled bars are around 30 lines, fully themable, and meet WCAG because the real data sits in a table rather than in pixels. Chart libraries are weak at screen-reader output. HIGH (judgement) |
| Streak history | CSS grid of day cells (heatmap), `aria-label` per cell | Same as above. |
| Date buckets / formatting | Server: aggregate in SQL (`date_trunc('week', ts AT TIME ZONE 'Europe/Berlin')`) or in C# with the existing `TimeZoneInfo` / `WQ_TIMEZONE`. Client: `Intl.DateTimeFormat('de-DE', ...)`. | **Don't add date-fns/dayjs/NodaTime.** The BCL and the browser already cover this, and the time-zone handling already exists (`WQ_TIMEZONE`, tzdata in the image). |
| Family data export | `System.Text.Json` (already configured camelCase) + `Results.File(...)` / `Content-Disposition: attachment` | No dependency. |

Upgrade path, only if the reports grow into interactive multi-series charts: `recharts` 3.10.1 (peer React ^19). Don't add it in v1.0.

## Installation

```bash
# Backend: new integration test project
dotnet new xunit -o backend/tests/WordQuest.Api.Tests   # then set xunit 2.9.3 / runner 4.0.0 / Test.Sdk 18.10.1 like the existing project
dotnet add backend/tests/WordQuest.Api.Tests package Microsoft.AspNetCore.Mvc.Testing --version 10.0.12
dotnet sln backend/WordQuest.slnx add backend/tests/WordQuest.Api.Tests

# Backend: EF CLI as a pinned local tool (repo root)
dotnet new tool-manifest
dotnet tool install dotnet-ef --version 10.0.12

# Frontend
cd frontend
npm install -D vitest@5.0.1 jsdom@30.1.1 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 \
  @playwright/test@1.63.0 @axe-core/playwright@4.13.0
npx playwright install --with-deps chromium
```

No `npm install` for charts, dates, validation, or mocking. No NuGet packages in any module project.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| External Postgres (CI service / dev compose) for API tests | `Testcontainers.PostgreSql` 4.15.0 | `dotnet test` must spin up its own DB on a dev machine with a directly reachable Docker |
| xunit 2.9.3 | `xunit.v3` 4.0.1 | After v1.0, as a separate tooling migration of both test projects together |
| jsdom + Testing Library | Vitest browser mode (`@vitest/browser-playwright` 5.0.1) | Component tests start depending on real layout/CSS (e.g. drag-and-drop game modes) |
| `@axe-core/playwright` | `pa11y` 10 / `pa11y-ci` 4.1.1 | Never here. pa11y brings its own Puppeteer browser, so it would be a second browser stack next to Playwright |
| offen/docker-volume-backup | restic 0.19.1 sidecar (+ cron wrapper) | Deduplicated, versioned history of large data (not this DB) |
| Dependabot | Renovate 44.x | Grouped updates or auto-merge policies become a real need |
| Hand-rolled SVG/CSS bars | Recharts 3.10.1 | Interactive, multi-series, zoomable charts are requested |
| `args` pattern match | `System.CommandLine` 2.0.12 | Three or more CLI verbs with options/help text |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ForwardedHeadersOptions.KnownNetworks` / `Microsoft.AspNetCore.HttpOverrides.IPNetwork` | Obsolete in .NET 10 (`ASPDEPR005`). With `/warnaserror` in CI this breaks the build. | `KnownIPNetworks` + `System.Net.IPNetwork` |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` | Clears the trusted proxy/network lists and trusts any peer. Per MS docs it is designed for cloud environments and does not restrict which IPs forwarders are accepted from. | Explicit `UseForwardedHeaders` with `KnownIPNetworks` + `ForwardLimit = 2` |
| Default `ForwardLimit = 1` with two proxy hops | You'd rate-limit Traefik's IP, and every client would share one budget | `ForwardLimit = 2` |
| `UseXminAsConcurrencyToken()` | Legacy Npgsql API; current docs use standard EF mechanisms | `uint Version` + `IsRowVersion()` |
| FluentValidation, MediatR, AutoMapper, Polly | New NuGet dependencies for problems a few lines of service code solve. Modules must stay NuGet-free. | Plain checks + `TypedResults.ValidationProblem` |
| ASP.NET Core Identity | Brings its own schema and user model and would conflict with the existing PBKDF2 hasher, refresh rotation, and learner PIN model | Keep the existing hand-rolled auth (it's small and tested) |
| Data Protection for invite/reset tokens | The key ring is lost on container recreate unless persisted | Random token, SHA-256 stored in the DB |
| MSW | The app has a single `fetch` wrapper. Stubbing `fetch` is one line. | `vi.fn()` on `globalThis.fetch`; `page.route` in Playwright |
| Chart.js 4.5.1 / uPlot 1.6.32 / Recharts in v1.0 | Canvas charts are opaque to screen readers, and all of them are more weight than two bar charts need | CSS/SVG bars + data table |
| Floating tags `traefik:v3`, `postgres:17-alpine`, `nginx-unprivileged:alpine`, `postgres-backup-local:17`, `WQ_VERSION:-master` | They break the "pinned infra images" requirement, and upgrades happen without the operator's knowledge | Exact tags (see above) + Dependabot `docker-compose` |
| Postgres 18 in v1.0 | A major-version jump needs a dump/restore procedure for existing installs | Stay on 17.11, plan 18 with its own upgrade doc |

## Stack Patterns by Variant

**If the operator already has a NAS backup tool (Synology Hyper Backup, restic on the host):**
- Don't enable the `offsite` profile. Point the NAS tool at `./backups`.
- Because the dumps are plain `.sql.gz` files, any file-level backup works.

**If the instance is reachable from the internet before the owner is created:**
- Require the one-time setup code from the container log in the wizard.
- Because "first POST wins" would otherwise let anyone claim the instance.

**If the API tests become slow (dozens of classes each booting the host):**
- Share one `WebApplicationFactory` per test collection (`ICollectionFixture`) and isolate by tenant.
- Because the host boot and migration are the expensive part, not the tests.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 | net10.0, ASP.NET Core 10.0.12 | Keep it in lockstep with the other `10.0.x` Microsoft packages |
| `dotnet-ef` 10.0.12 | EF Core 10.0.12 | Tool and runtime versions should match |
| `xunit` 2.9.3 | `xunit.runner.visualstudio` 4.0.0 | Runner 4.0.0 explicitly supports v1/v2/v3. Proven by 104/104 discovered tests. |
| `Testcontainers.XunitV3` 4.15.0 | `xunit.v3.extensibility.core >= 3.2.2` | Only relevant if you migrate. Check against xunit.v3 4.x first. |
| `vitest` 5.0.1 | `vite` ^6.4 / ^7 / ^8, Node ^22.12 / ^24 / >=26 | OK with Vite 8.3.0 and Node 22.23.3 |
| `jsdom` 30.1.1 | Node ^22.22.2 / ^24.15 / >=26 | The CI `node-version: "22"` resolves to 22.23.3. OK. |
| `@testing-library/react` 16.3.3 | React ^19, `@testing-library/dom` ^10 | `@testing-library/dom` is a peer and must be installed |
| `@testing-library/jest-dom` 7.0.1 | vitest >= 0.32, `@testing-library/dom` >=10 <11, Node >=22 | |
| `@axe-core/playwright` 4.13.0 | `playwright-core` >= 1.0 | Works with `@playwright/test` 1.63.0 |
| docker/* actions v4/v6/v7 | GitHub runner >= 2.327.1 (Node 24) | Hosted `ubuntu-latest` satisfies this |
| `offen/docker-volume-backup` v2.49.1 | linux/amd64, arm64, arm/v7 | Pi 5 / ARM NAS OK |

## Sources

Primary (registry/API reads on 2026-09-24, HIGH):
- NuGet flat-container + nuspec API (`api.nuget.org/v3-flatcontainer/...`): Mvc.Testing, EF Core, Npgsql, xunit, xunit.v3, xunit.runner.visualstudio (including its description), Testcontainers.*, System.CommandLine, dotnet-ef, Respawn
- npm registry (`registry.npmjs.org/...`): vitest (dist-tags, peers, engines), jsdom, Testing Library packages, @playwright/test, @axe-core/playwright, axe-core, pa11y, recharts, chart.js, uplot, msw
- Docker Hub tags API: postgres, traefik, nginxinc/nginx-unprivileged, prodrigestivill/postgres-backup-local, offen/docker-volume-backup, restic/restic
- GitHub releases API (`gh api repos/.../releases`): traefik, restic, rclone, offen/docker-volume-backup, renovate, playwright, and all docker/* and actions/* used in CI
- `nodejs.org/dist/index.json`: Node 22/24/26 current versions
- `docker/metadata-action` source `src/meta.ts` (image name lowercasing)
- Project code: `backend/src/WordQuest.Api/Program.cs`, `frontend/nginx.conf`, `frontend/src/lib/api.ts`, `backend/Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `PasswordHasher.cs`

Official docs (MEDIUM, fetched this session):
- [Configure ASP.NET Core to work with proxy servers and load balancers](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0): ForwardLimit default 1, right-to-left processing, loopback-only default, `ASPNETCORE_FORWARDEDHEADERS_ENABLED` warning
- [Breaking change: IPNetwork and ForwardedHeadersOptions.KnownNetworks are obsolete](https://learn.microsoft.com/en-us/dotnet/core/compatibility/aspnet-core/10/ipnetwork-knownnetworks-obsolete)
- [dotnet/aspnetcore#63627](https://github.com/dotnet/aspnetcore/issues/63627): `KnownIPNetworks.Clear()` regression in 10.0 RC1, closed with fix PR #63658
- [Npgsql EF Core concurrency tokens](https://www.npgsql.org/efcore/modeling/concurrency.html): `uint` + `[Timestamp]` / `IsRowVersion()` maps to xmin
- [EF Core tools reference (.NET CLI)](https://learn.microsoft.com/en-us/ef/core/cli/dotnet): `has-pending-model-changes` since EF Core 8, tool manifest
- [EF Core 9 breaking changes](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-9.0/breaking-changes): Migrate throws on pending model changes
- [ASP.NET Core 10 release notes (Safia Rocks blog)](https://blog.safia.rocks/2025/11/10/aspnetcore-ten/): Program class made public by a source generator
- [Base64Url class](https://learn.microsoft.com/en-us/dotnet/api/system.buffers.text.base64url?view=net-10.0) and [RandomNumberGenerator.GetString](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.randomnumbergenerator.getstring?view=net-8.0)
- [offen/docker-volume-backup docs](https://offen.github.io/docker-volume-backup/) and the upstream `docs/reference/index.md` (env var list)
- [Dependabot Docker Compose GA (GitHub Changelog)](https://github.blog/changelog/2025-02-25-dependabot-version-updates-now-support-docker-compose-in-general-availability/)
- [GHCR visibility (DEV Community)](https://dev.to/niklasmtj/github-actions-workflows-in-combination-with-github-container-registry-package-visibility-1no0): new packages default to private. LOW; verify on first release.

From memory, not re-verified this session (treat as MEDIUM/LOW): the OWASP PBKDF2 600k figure, Node 22 EOL date, Playwright `serviceWorkers: 'block'` vs `page.route`, the axe `wcag22aa` tag name, and `UseSetting` vs `ConfigureAppConfiguration` timing under minimal hosting in .NET 10.

---
*Stack research for: self-hosted family vocabulary PWA (WordQuest v1.0)*
*Researched: 2026-09-24*
