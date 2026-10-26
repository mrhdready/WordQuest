---
last_mapped_commit: 00d6615b8a97d9dc54b7a0451f777fbfa6e91621
last_mapped_at: 2026-10-26
---
# Technology Stack

**Analysis Date:** 2026-10-26

## Languages

**Primary:**
- C# (`LangVersion` latest, `Nullable` enable, `ImplicitUsings` enable) - Backend in `backend/src/` (settings in `backend/Directory.Build.props`)
- TypeScript ^5.9.3 - Frontend in `frontend/src/` (`frontend/tsconfig.json`, `verbatimModuleSyntax`)

**Secondary:**
- Bash - Install/operate scripts `setup.sh`, `upgrade.sh`, `restore.sh`, `.github/release-package.sh`
- nginx config - `frontend/nginx.conf`, `frontend/nginx-security-headers.conf`
- CSS (Tailwind 4) - `frontend/src/index.css`, generated `frontend/src/design-tokens.css`
- YAML front matter design tokens - `DESIGN.md` (google-labs design.md format, `version: alpha`)

## Runtime

**Environment:**
- .NET 10 (`net10.0`), ASP.NET Core runtime image `mcr.microsoft.com/dotnet/aspnet:10.0-alpine` (`backend/Dockerfile`), plus `tzdata`, `wget`, `icu-libs`
- `InvariantGlobalization=false` deliberately (German texts, IANA time zones)
- Node 22 for build/dev (`node:22-alpine` in `frontend/Dockerfile`, `NODE_VERSION: "22"` in `.github/workflows/ci.yml`)
- Frontend served as static files by `nginxinc/nginx-unprivileged:alpine` (ports 8080 HTTP redirect, 8443 HTTPS)
- Target hardware: ARM64 home servers (Raspberry Pi 5, NAS); images built for `linux/amd64,linux/arm64`

**Package Manager:**
- NuGet - versions inline in each `.csproj`; Central Package Management disabled (`backend/Directory.Packages.props`, `ManagePackageVersionsCentrally=false`) - do not put versions there
- npm - lockfile `frontend/package-lock.json` present; `npm ci` in CI and Dockerfile

## Frameworks

**Core:**
- ASP.NET Core Minimal APIs (net10.0) - `backend/src/WordQuest.Api/Program.cs`, endpoints in `backend/src/WordQuest.Api/Endpoints/`
- EF Core 10.0.12 + Npgsql provider 10.0.3 - `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs`
- React ^19.3.0 + react-dom - `frontend/src/main.tsx`, `frontend/src/App.tsx`
- React Router DOM ^7.18.4 - routing
- TanStack Query ^5.102.8 - server state
- Tailwind CSS ^4.3.3 via `@tailwindcss/vite`
- Radix UI primitives (`@radix-ui/react-dialog`, `react-label`, `react-slot`) - wrapped in `frontend/src/components/ui/`

**Testing:**
- xUnit 2.9.3, `xunit.runner.visualstudio` 4.0.0, `Microsoft.NET.Test.Sdk` 18.10.1, `coverlet.collector` 10.0.1 - `backend/tests/WordQuest.Learning.Tests/`, `backend/tests/WordQuest.Api.Tests/`
- `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 - `WebApplicationFactory` integration tests against real PostgreSQL
- Vitest 5.0.3 + jsdom 30.1.2 + Testing Library (`@testing-library/react` 16.3.3, `dom` 10.4.2, `user-event` 14.6.7) - frontend unit tests (`*.test.ts(x)` co-located, e.g. `frontend/src/lib/api.test.ts`)
- Playwright 1.64.0 (`playwright-core` pinned via `overrides`) + `@axe-core/playwright` 4.13.0 - E2E/a11y in `frontend/e2e/`, config `frontend/playwright.config.ts`, stack `frontend/e2e/docker-compose.e2e.yml`

**Build/Dev:**
- Vite ^8.3.0 + `@vitejs/plugin-react` ^6.1.1 - `frontend/vite.config.ts` (dev proxy `/api` -> `http://localhost:5080`)
- `vite-plugin-pwa` ^1.3.0 - `registerType: 'autoUpdate'`, Workbox; Service Worker only under trusted HTTPS
- ESLint ^10.10.0 + `typescript-eslint` ^8.70.0 + `eslint-plugin-react-hooks` ^7.1.1 - `frontend/eslint.config.js`
- `@google/design.md@0.4.0` (via `npx -y`) - `npm run design:lint|design:export|design:check`
- `frontend/scripts/design-classes.mjs` - `npm run design:classes`
- `Microsoft.EntityFrameworkCore.Design` 10.0.12 - migrations (`dotnet ef`), `DesignTimeDbContextFactory.cs`
- `.editorconfig` + `EnforceCodeStyleInBuild=true`; CI builds with `/warnaserror`

## Key Dependencies

**Critical:**
- `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 - only DB provider (`backend/src/WordQuest.Infrastructure/WordQuest.Infrastructure.csproj`)
- `Microsoft.AspNetCore.Authentication.JwtBearer` 10.0.12 + `System.IdentityModel.Tokens.Jwt` 8.22.0 - API auth (`backend/src/WordQuest.Api/WordQuest.Api.csproj`)
- `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 10.0.12 - `/health/live`, `/health/ready`
- `Microsoft.AspNetCore.OpenApi` 10.0.12
- BCL crypto only: PBKDF2-HMAC-SHA256 (`PasswordHasher.cs`), SHA256 tokens (`TokenHasher.cs`), X.509 CA/server certs (`backend/src/WordQuest.Api/TlsCertificates.cs`)

**Infrastructure:**
- `class-variance-authority`, `clsx`, `tailwind-merge` - component variants (`frontend/src/lib/utils.ts`)
- `lucide-react` ^1.46.0 - icons
- Domain modules (`WordQuest.Modules.Identity|Content|Learning|Gamification`, `WordQuest.Shared.Kernel`) have no NuGet dependencies

## Configuration

**Environment:**
- API reads env vars `WQ_DB_HOST`, `WQ_DB_PORT`, `WQ_DB_NAME`, `WQ_DB_USER`, `WQ_DB_PASSWORD`, `WQ_JWT_SIGNING_KEY`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`, `WQ_TLS_NAMES`, `WQ_DESIGN_CONNECTION` (design-time)
- Secrets via `ReadSecret()` in `backend/src/WordQuest.Api/Program.cs`: `<NAME>_FILE` first, then env var (`WQ_DB_PASSWORD_FILE`, `WQ_JWT_SIGNING_KEY_FILE`)
- Compose-level vars in `.env` (template `.env.example`, contents not read): `COMPOSE_FILE`, `WQ_IMAGE_PREFIX`, `WQ_VERSION`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`; set by `setup.sh` also `WQ_TLS_NAMES`, `WQ_HTTP_PORT`, `WQ_HTTPS_PORT`, optional `WQ_RELEASE_URL`
- `WQ_AI_PROVIDER: none` is set in `docker-compose.quick.yml` but not read anywhere in `backend/src` or `frontend/src`
- Dev signing key in `backend/src/WordQuest.Api/Properties/launchSettings.json`; `appsettings.json`, `appsettings.Development.json`

**Build:**
- `backend/WordQuest.slnx`, `backend/Directory.Build.props`, `backend/Directory.Packages.props`
- `backend/Dockerfile` (build on `$BUILDPLATFORM` with `sdk:10.0-alpine`, framework-dependent `/p:UseAppHost=false`)
- `frontend/Dockerfile` (node build -> nginx-unprivileged; `nginx.conf` used as envsubst template, `NGINX_ENVSUBST_FILTER=WQ_`)
- Compose: `docker-compose.quick.yml` (production: db, api, certs, web, backup), `docker-compose.build.yml` (build overlay), `docker-compose.dev.yml` (Postgres only)

## Platform Requirements

**Development:**
- .NET 10 SDK, Node 22, Docker
- `docker compose -f docker-compose.dev.yml up -d` (PostgreSQL 17 on 5432), API `dotnet run` on `http://localhost:5080`, frontend `npm run dev` on `http://localhost:5173`
- Tests need PostgreSQL via `WQ_TEST_DB`

**Production:**
- Docker Compose on a home server (single API instance required: migrations at startup, in-memory rate limiter)
- HTTPS with a per-install own CA generated by the `certs` service (`tls watch` command of the API image); CA downloadable at `http://<host>/wordquest-ca.crt`
- Images from `ghcr.io/mrhdready/wordquest-api|web` (default tag `1.1.0`), release tarball from GitHub Releases

---

*Stack analysis: 2026-10-26*
