---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
# Technology Stack

**Analysis Date:** 2026-09-24

## Languages

**Primary:**

- C# (`LangVersion` = `latest`, nullable + implicit usings enabled) - Backend, all projects under `backend/src/` and `backend/tests/` (settings in `backend/Directory.Build.props`)
- TypeScript 5.9.3 - Frontend SPA under `frontend/src/` (`frontend/tsconfig.json`)

**Secondary:**

- Bash - `setup.sh` (first-time setup: secrets, `.env`, stack start)
- YAML - Docker Compose files (`docker-compose*.yml`) and CI (`.github/workflows/ci.yml`)
- Nginx config - `frontend/nginx.conf`

## Runtime

**Environment:**

- .NET 10 (`<TargetFramework>net10.0</TargetFramework>` in `backend/Directory.Build.props`; CI uses `dotnet-version: 10.0.x`)
- Container images: `mcr.microsoft.com/dotnet/sdk:10.0-alpine` (build) and `mcr.microsoft.com/dotnet/aspnet:10.0-alpine` (runtime) in `backend/Dockerfile`
- `InvariantGlobalization=false` on purpose: German texts and IANA time zones; runtime image installs `icu-libs` and `tzdata`, `TZ=Europe/Berlin`
- Node.js 22 (build only: `node:22-alpine` in `frontend/Dockerfile`, `NODE_VERSION: "22"` in CI)
- Frontend served by `nginxinc/nginx-unprivileged:alpine` on port 8080

**Package Manager:**

- NuGet - versions live directly in each `.csproj`. Central Package Management is explicitly disabled in `backend/Directory.Packages.props` (`ManagePackageVersionsCentrally=false`) - do NOT add versions there
- npm - Lockfile: `frontend/package-lock.json` present (install via `npm ci`)
- Solution file: `backend/WordQuest.slnx` (new XML solution format)

## Frameworks

**Core:**

- ASP.NET Core 10 Minimal APIs - HTTP API (`backend/src/WordQuest.Api/Program.cs`, endpoint groups in `backend/src/WordQuest.Api/Endpoints/*.cs`)
- Entity Framework Core 10.0.12 - ORM, migrations in `backend/src/WordQuest.Infrastructure/Migrations/`
- React 19.3.0 + React DOM - UI (`frontend/src/main.tsx`, `frontend/src/App.tsx`)
- React Router DOM 7.18.4 - client routing
- TanStack React Query 5.102.8 - server state / data fetching
- Tailwind CSS 4.3.3 (via `@tailwindcss/vite`) - styling (`frontend/src/index.css`)

**Testing:**

- xUnit 2.9.3 + `xunit.runner.visualstudio` 4.0.0 - backend unit tests (`backend/tests/WordQuest.Learning.Tests/`). Note in csproj: runner 4.x targets xunit v3; if no tests are discovered, align both (downgrade runner to 2.8.2 or move to xunit v3 together)
- `Microsoft.NET.Test.Sdk` 18.10.1
- `coverlet.collector` 10.0.1 - coverage (`--collect:"XPlat Code Coverage"` in CI)
- Frontend: no test framework configured

**Build/Dev:**

- Vite 8.3.0 + `@vitejs/plugin-react` 6.1.1 - dev server (port 5173, proxies `/api` to `http://localhost:5080`) and bundler (`frontend/vite.config.ts`)
- `vite-plugin-pwa` 1.3.0 - PWA manifest + Workbox service worker (autoUpdate, `NetworkFirst` cache `wq-api` for GET `/api/*`)
- ESLint 10 + `typescript-eslint` 8.70 + `eslint-plugin-react-hooks` 7.1 (`frontend/eslint.config.js`)
- `.editorconfig` - LF, UTF-8, 4 spaces (C#), 2 spaces (TS/JSON/YAML/MD/SH); C# style rules enforced in build (`EnforceCodeStyleInBuild=true`)
- Docker multi-stage builds: `backend/Dockerfile`, `frontend/Dockerfile` (build context = repo root)

## Key Dependencies

**Critical (backend):**

- `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 - PostgreSQL provider (`backend/src/WordQuest.Infrastructure/WordQuest.Infrastructure.csproj`)
- `Microsoft.EntityFrameworkCore` / `.Relational` / `.Design` 10.0.12 - ORM + design-time (`DesignTimeDbContextFactory.cs` needs `.Design` WITHOUT PrivateAssets in Infrastructure)
- `Microsoft.AspNetCore.Authentication.JwtBearer` 10.0.12 + `System.IdentityModel.Tokens.Jwt` 8.22.0 - JWT auth (`backend/src/WordQuest.Api/WordQuest.Api.csproj`)
- `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 10.0.12 - DB health check
- `Microsoft.AspNetCore.OpenApi` 10.0.12 - OpenAPI doc, Development only

**Critical (frontend):**

- `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot` - accessible primitives for shadcn-style components in `frontend/src/components/ui/`
- `class-variance-authority`, `clsx`, `tailwind-merge` - class composition (`frontend/src/lib/utils.ts`)
- `lucide-react` - icons

**Infrastructure:**

- Module projects (`WordQuest.Modules.Identity`, `.Content`, `.Learning`, `.Gamification`, `WordQuest.Shared.Kernel`) have NO NuGet dependencies - keep domain modules dependency-free
- Crypto uses BCL only: PBKDF2-HMAC-SHA256 (`backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs`), SHA256 token hashing (`TokenHasher.cs`)
- Rate limiting: built-in `Microsoft.AspNetCore.RateLimiting` (fixed window, 10/min per IP, policy `auth`)

## Configuration

**Environment:**

- Backend reads env vars directly in `backend/src/WordQuest.Api/Program.cs`: `WQ_DB_HOST`, `WQ_DB_PORT`, `WQ_DB_NAME`, `WQ_DB_USER`, `WQ_DB_PASSWORD`, `WQ_JWT_SIGNING_KEY` (min. 32 chars, startup fails otherwise), `WQ_TIMEZONE` (default `Europe/Berlin`), `WQ_SEED_DEMO_DATA`
- Secrets support `<NAME>_FILE` variants (Docker secrets) via `ReadSecret()` in `Program.cs` - prefer files over env vars
- `ConnectionStrings:Default` overrides the `WQ_DB_*` assembly (set in `appsettings.Development.json`)
- `Auth` section in `backend/src/WordQuest.Api/appsettings.json` bound to `AuthOptions` (`backend/src/WordQuest.Api/Auth/AuthOptions.cs`): Issuer, Audience, AccessTokenMinutes=15, RefreshTokenDays=30, MaxPinAttempts=10, PinLockoutMinutes=15
- Dev signing key in `backend/src/WordQuest.Api/Properties/launchSettings.json` (API on `http://localhost:5080`)
- Deployment `.env` template: `.env.example` (keys: `WQ_IMAGE_PREFIX`, `WQ_VERSION`, `WQ_HOST`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`, `WQ_ACME_EMAIL`, `WQ_ACME_DNS_PROVIDER`, `CF_DNS_API_TOKEN`)
- JSON: camelCase + string enums (`ConfigureHttpJsonOptions` in `Program.cs`)

**Build:**

- `backend/Directory.Build.props` - shared MSBuild settings (warnings not errors locally; CI builds with `/warnaserror`)
- `backend/Directory.Packages.props` - CPM disabled marker only
- `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/eslint.config.js`
- Path alias `@` -> `frontend/src`

## Platform Requirements

**Development:**

- .NET 10 SDK, Node 22, Docker (PostgreSQL via `docker-compose.dev.yml`, port 5432, password `devpassword`)
- `dotnet run` for API (port 5080), `npm run dev` for frontend (port 5173)
- EF migrations: `dotnet ef migrations add <Name> --project src/WordQuest.Infrastructure --startup-project src/WordQuest.Api` (run from `backend/`)
- API applies migrations automatically on startup (`db.Database.MigrateAsync()` in `Program.cs`)

**Production:**

- Self-hosted Docker Compose (`docker-compose.yml`): postgres 17, api, web (nginx), Traefik v3 with Let's Encrypt, daily DB backups
- Multi-arch images `linux/amd64,linux/arm64` (Raspberry Pi 5 / ARM NAS targeted) published to GHCR
- HTTPS required for PWA install / service worker

---

*Stack analysis: 2026-09-24*
