---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
# External Integrations

**Analysis Date:** 2026-09-24

## APIs & External Services

**Third-party APIs:**

- None called from application code. Backend (`backend/src/`) and frontend (`frontend/src/`) make no outbound calls to external services.
- `WQ_AI_PROVIDER: none` and `WQ_PUBLIC_URL` are set in `docker-compose.yml` / `docker-compose.quick.yml` but are not read anywhere in `backend/src/` (placeholders for future features).

**Internal HTTP API (frontend -> backend):**

- Base path `/api/v1` (`frontend/src/lib/api.ts`, `const BASE = '/api/v1'`), plain `fetch` with bearer token and automatic refresh on 401
- Endpoint groups:
  - `/api/v1/auth` - profiles, login, learner-login, refresh, logout (`backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs`)
  - `/api/v1/learners` - list/create, overview, traffic-light (`LearnerEndpoints.cs`)
  - `/api/v1/sets` - CRUD, entries, CSV import preview/confirm (`SetEndpoints.cs`)
  - `/api/v1/sessions` - start, answers, complete, sync, games (`SessionEndpoints.cs`)
- Health: `/health/live`, `/health/ready` (DB check via `AddDbContextCheck`)
- OpenAPI document only in Development (`app.MapOpenApi()` in `backend/src/WordQuest.Api/Program.cs`)

## Data Storage

**Databases:**

- PostgreSQL 17 (`postgres:17-alpine` image in all compose files)
  - Connection: `ConnectionStrings:Default` or assembled from `WQ_DB_HOST`, `WQ_DB_PORT`, `WQ_DB_NAME`, `WQ_DB_USER`, `WQ_DB_PASSWORD` / `WQ_DB_PASSWORD_FILE` (`BuildConnectionString()` in `Program.cs`)
  - Client: EF Core 10 + Npgsql (`EnableRetryOnFailure(3)`), context `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs`, entity configs in `backend/src/WordQuest.Infrastructure/Configurations/`
  - Multi-tenancy via query filters on `ITenantOwned` (`backend/src/WordQuest.Shared.Kernel/`); startup migration/seed uses `SystemTenantContext`
  - Demo seed: `backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs` (toggle `WQ_SEED_DEMO_DATA`)

**File Storage:**

- Local filesystem only (no uploads persisted; CSV import is parsed in-request by `backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs`)

**Caching:**

- No server cache. Client-side: Workbox runtime cache `wq-api` (NetworkFirst, 5s timeout, 7 days) in `frontend/vite.config.ts`; tokens/user in `localStorage` (`frontend/src/lib/api.ts`)

## Authentication & Identity

**Auth Provider:**

- Custom, self-contained
  - JWT bearer access tokens (15 min) signed with symmetric key `WQ_JWT_SIGNING_KEY[_FILE]` (`backend/src/WordQuest.Api/Auth/JwtTokenService.cs`)
  - Refresh tokens (30 days) stored hashed with SHA256 (`backend/src/WordQuest.Modules.Identity/Services/TokenHasher.cs`, entity `RefreshToken.cs`)
  - Guardian login: email + password, PBKDF2-HMAC-SHA256 (`PasswordHasher.cs`)
  - Learner login: profile + PIN with lockout (`MaxPinAttempts`, `PinLockoutMinutes`), logic in `backend/src/WordQuest.Api/Auth/AuthService.cs`
  - Policies `Guardian` (roles Owner/Guardian) and `Learner` in `Program.cs`
  - Rate limit policy `auth`: 10 requests/min per IP

## Monitoring & Observability

**Error Tracking:**

- None. `AddProblemDetails()` + `UseExceptionHandler()` return RFC 7807 responses.

**Logs:**

- Default ASP.NET Core `ILogger` to console; levels in `appsettings.json` / `appsettings.Development.json`
- Container healthchecks via `wget` against `/health/live` (Dockerfile) and `/health/ready` (compose)

## CI/CD & Deployment

**Hosting:**

- Self-hosted Docker Compose (`docker-compose.yml`), images pulled from GitHub Container Registry `ghcr.io/<owner>/<repo>-api` / `-web`
- Reverse proxy: Traefik v3 with Let's Encrypt ACME DNS challenge (provider via `WQ_ACME_DNS_PROVIDER`, e.g. Cloudflare with `CF_DNS_API_TOKEN`); mounts `/var/run/docker.sock` read-only
- nginx in web container proxies `/api/` and `/health/` to `http://api:8080` (`frontend/nginx.conf`), sets CSP and security headers
- Backups: `prodrigestivill/postgres-backup-local:17` daily to `./backups` (14 days / 8 weeks / 6 months)
- Variants: `docker-compose.quick.yml` (no TLS, plaintext defaults, test only), `docker-compose.dev.yml` (DB only), `docker-compose.build.yml` (build overlay)

**CI Pipeline:**

- GitHub Actions `.github/workflows/ci.yml` (push/PR on `master`, tags `v*`):
  - `backend`: migration presence check, restore, build `/warnaserror`, test with TRX + coverage, upload artifact
  - `frontend`: `npm ci`, lint, typecheck, build
  - `images` (push only): buildx multi-arch, push to GHCR with `GITHUB_TOKEN`, GHA cache
- `Claude outputs/ci.yml`, `Claude outputs/ci-1.yml` are loose copies, not active workflows

## Environment Configuration

**Required env vars:**

- `WQ_JWT_SIGNING_KEY` or `WQ_JWT_SIGNING_KEY_FILE` (>= 32 chars; startup throws otherwise)
- `WQ_DB_PASSWORD` or `WQ_DB_PASSWORD_FILE` (falls back to `devpassword`)
- `WQ_DB_HOST` / `WQ_DB_NAME` / `WQ_DB_USER` / `WQ_DB_PORT` (defaults localhost/wordquest/wordquest/5432)
- Deployment: `WQ_IMAGE_PREFIX`, `WQ_VERSION`, `WQ_HOST`, `WQ_ACME_EMAIL`, `WQ_ACME_DNS_PROVIDER` (`.env.example`)

**Secrets location:**

- `./secrets/db_password.txt`, `./secrets/jwt_key.txt` generated by `setup.sh`, mounted as Docker secrets to `/run/secrets/*`
- `.env` (gitignored) created from `.env.example` by `setup.sh`
- Dev-only key committed in `backend/src/WordQuest.Api/Properties/launchSettings.json`; dev DB password in `docker-compose.dev.yml` / `appsettings.Development.json`

## Webhooks & Callbacks

**Incoming:**

- None

**Outgoing:**

- None (only Traefik ACME traffic to Let's Encrypt / DNS provider)

---

*Integration audit: 2026-09-24*
