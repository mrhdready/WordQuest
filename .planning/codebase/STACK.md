---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
# Technology Stack

**Analysis Date:** 2026-10-24

## Languages

**Primary:**
- C# (`<Nullable>enable</Nullable>`, Ziel `net10.0` in `backend/Directory.Build.props`) - Backend unter `backend/src/` und `backend/tests/`
- TypeScript `^5.9.3` - Frontend unter `frontend/src/` (React/TSX)

**Secondary:**
- Bash - Betriebsskripte `setup.sh`, `upgrade.sh`, `restore.sh`, `.github/release-package.sh`
- YAML - Docker-Compose-Dateien im Repo-Root, `frontend/e2e/docker-compose.e2e.yml`, `.github/workflows/ci.yml`
- nginx-Konfiguration - `frontend/nginx.conf`, `frontend/nginx-security-headers.conf`, `frontend/nginx-traefik-realip.conf`

## Runtime

**Environment:**
- .NET 10 (ASP.NET Core); Container-Image `mcr.microsoft.com/dotnet/aspnet:10.0-alpine`, Build mit `mcr.microsoft.com/dotnet/sdk:10.0-alpine` (`backend/Dockerfile`), läuft als Nutzer `wordquest` auf Port 8080
- Node 22 für Build und Tooling (`node:22-alpine` in `frontend/Dockerfile`, `NODE_VERSION: "22"` in `.github/workflows/ci.yml`)
- Auslieferung des Frontends über `nginxinc/nginx-unprivileged:alpine` (Port 8080)
- `InvariantGlobalization=false` absichtlich (deutsche Texte, IANA-Zeitzonen) in `backend/Directory.Build.props`

**Package Manager:**
- NuGet; Versionen stehen in der jeweiligen `.csproj`, Central Package Management ist aus (`backend/Directory.Packages.props`)
- npm; Lockfile `frontend/package-lock.json` vorhanden (CI nutzt `npm ci`)
- Solution-Datei: `backend/WordQuest.slnx`

## Frameworks

**Core:**
- ASP.NET Core Minimal APIs (`Microsoft.NET.Sdk.Web`) - `backend/src/WordQuest.Api/`
- EF Core 10.0.12 + Npgsql 10.0.3 - Persistenz in `backend/src/WordQuest.Infrastructure/`
- React `^19.3.0` + React Router `^7.18.4` - SPA in `frontend/src/`
- TanStack Query `^5.102.8` - Server-State im Frontend
- Tailwind CSS `^4.3.3` (via `@tailwindcss/vite`), Tokens aus `DESIGN.md` exportiert nach `frontend/src/design-tokens.css`

**Testing:**
- xUnit 2.9.3, `xunit.runner.visualstudio` 4.0.0, `Microsoft.NET.Test.Sdk` 18.10.1, `coverlet.collector` 10.0.1 - `backend/tests/WordQuest.Learning.Tests/`, `backend/tests/WordQuest.Api.Tests/`
- `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 - Integrationstests mit `WebApplicationFactory` gegen echtes PostgreSQL
- Vitest 5.0.3 + jsdom 30.1.2 + Testing Library (`@testing-library/react` 16.3.3, `user-event` 14.6.7) - Konfiguration in `frontend/vite.config.ts` (`test`-Block, Setup `src/test/setup.ts`)
- Playwright 1.64.0 + `@axe-core/playwright` 4.13.0 - E2E und WCAG-Check, `frontend/playwright.config.ts`, Stack `frontend/e2e/docker-compose.e2e.yml`

**Build/Dev:**
- Vite `^8.3.0` mit `@vitejs/plugin-react` `^6.1.1` - `frontend/vite.config.ts` (Alias `@` → `./src`)
- `vite-plugin-pwa` `^1.3.0` - Manifest + Workbox (NetworkFirst-Cache `wq-api` für GET `/api/`)
- ESLint `^10.10.0` + `typescript-eslint` `^8.70.0` + `eslint-plugin-react-hooks` - `frontend/eslint.config.js`
- `@google/design.md@0.4.0` (per `npx`) - `npm run design:lint|design:export|design:check`
- `frontend/scripts/design-classes.mjs` - `npm run design:classes`
- `Microsoft.EntityFrameworkCore.Design` 10.0.12 - Migrationen (`dotnet ef`)

## Key Dependencies

**Critical:**
- `Microsoft.AspNetCore.Authentication.JwtBearer` 10.0.12 + `System.IdentityModel.Tokens.Jwt` 8.22.0 - JWT-Auth (`backend/src/WordQuest.Api/WordQuest.Api.csproj`)
- `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 - DB-Provider (`backend/src/WordQuest.Infrastructure/`)
- Radix-Primitives `@radix-ui/react-dialog`, `react-label`, `react-slot` - Basis von `frontend/src/components/ui/`
- `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` - UI-Hilfen und Icons

**Infrastructure:**
- `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 10.0.12 - `/health/live`, `/health/ready`
- `Microsoft.AspNetCore.OpenApi` 10.0.12 - `MapOpenApi()` nur in Development (`backend/src/WordQuest.Api/Program.cs`)
- Krypto nur BCL: PBKDF2-HMAC-SHA256 (`PasswordHasher.cs`), SHA256 für Token (`TokenHasher.cs`)
- Domänenmodule `WordQuest.Modules.{Identity,Content,Learning,Gamification}` und `WordQuest.Shared.Kernel` ohne NuGet-Abhängigkeiten

## Configuration

**Environment:**
- Vorlage `.env.example` (Variablen: `COMPOSE_FILE`, `WQ_IMAGE_PREFIX`, `WQ_VERSION`, `WQ_HOST`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`, `WQ_ACME_EMAIL`, `WQ_ACME_DNS_PROVIDER`, `CF_DNS_API_TOKEN`); `.env` wird von `setup.sh` angelegt
- `ReadSecret()` in `backend/src/WordQuest.Api/Program.cs` liest zuerst `<NAME>_FILE`, dann die Umgebungsvariable (`WQ_JWT_SIGNING_KEY`, `WQ_DB_PASSWORD`)
- DB-Verbindung aus `WQ_DB_HOST`, `WQ_DB_PORT`, `WQ_DB_NAME`, `WQ_DB_USER`, `WQ_DB_PASSWORD` (Defaults `localhost`/`5432`/`wordquest`/`wordquest`)
- Weitere Schlüssel: `WQ_TIMEZONE` (Default `Europe/Berlin`), `WQ_SEED_DEMO_DATA` (Default `false`), `Auth:RequestsPerMinute` (Default 10), `Auth:SigningKey` (Dev-Fallback), `WQ_PORT` (Host-Port in `docker-compose.quick.yml`, Default 8080)
- App-Settings: `backend/src/WordQuest.Api/appsettings.json`, `appsettings.Development.json`; Dev-Signing-Key in `Properties/launchSettings.json`

**Build:**
- `backend/Directory.Build.props` (lokal `TreatWarningsAsErrors=false`, CI baut mit `/warnaserror`)
- `.editorconfig` (Codestil, `EnforceCodeStyleInBuild`)
- `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/eslint.config.js`, `frontend/playwright.config.ts`
- `backend/Dockerfile`, `frontend/Dockerfile` (Multi-Stage, `--platform=$BUILDPLATFORM`)

## Platform Requirements

**Development:**
- .NET 10 SDK, Node 22, Docker; PostgreSQL per `docker-compose.dev.yml`
- Backend-Tests brauchen `WQ_TEST_DB` (Standard `Host=localhost;Port=5432;Username=wordquest;Password=devpassword`)

**Production:**
- Docker Compose auf ARM64-Heimhardware (Raspberry Pi 5, NAS); Images für `linux/amd64,linux/arm64`
- Standardweg `docker-compose.quick.yml` (HTTP im Heimnetz), Fortgeschrittene `docker-compose.yml` (Traefik + Let's Encrypt)
- Genau eine API-Instanz (Migration beim Start, In-Memory-Rate-Limiter)

---

*Stack analysis: 2026-10-24*
