---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
# External Integrations

**Analysis Date:** 2026-10-24

## APIs & External Services

**Laufzeit-APIs:**
- Keine. Das Backend ruft keine externen Dienste auf (kein `HttpClient` in `backend/src/`). Das Frontend spricht nur die eigene API über `fetch` in `frontend/src/lib/api.ts` (`${BASE}${path}`, Refresh über `${BASE}/auth/refresh`); die CSP in `frontend/nginx-security-headers.conf` erlaubt nur `connect-src 'self'`.

**Zertifikate (nur `docker-compose.yml`):**
- Let's Encrypt über Traefik `traefik:v3` - ACME per DNS-Challenge, Resolver `le`
  - Provider: `WQ_ACME_DNS_PROVIDER` (Default `manual`)
  - Auth: provider-spezifisch, vorgesehen `CF_DNS_API_TOKEN` (Cloudflare); Kontakt `WQ_ACME_EMAIL`

**Container-Registry:**
- GitHub Container Registry `ghcr.io/mrhdready/wordquest-api` und `-web` (überschreibbar über `WQ_IMAGE_PREFIX`, Tag `WQ_VERSION`, Default `1.0.0`)

## Data Storage

**Databases:**
- PostgreSQL 17 (`postgres:17-alpine` in allen Compose-Dateien)
  - Connection: `WQ_DB_HOST`, `WQ_DB_PORT`, `WQ_DB_NAME`, `WQ_DB_USER`, `WQ_DB_PASSWORD`/`WQ_DB_PASSWORD_FILE` (`backend/src/WordQuest.Api/Program.cs`)
  - Client: EF Core + Npgsql, `EnableRetryOnFailure(3)`; `WordQuestDbContext` mit Global Query Filters für `ITenantOwned`
  - Migrationen in `backend/src/WordQuest.Infrastructure/Migrations/`, beim API-Start angewendet

**File Storage:**
- Kein Dateispeicher. Vokabelbilder liegen als `byte[] Data` in der Datenbank (`backend/src/WordQuest.Modules.Content/Entities/VocabularyPicture.cs`), Auslieferung über `MapPictureEndpoints`.
- Backups: `prodrigestivill/postgres-backup-local:17` in `docker-compose.quick.yml` und `docker-compose.yml` (`SCHEDULE: "@daily"`, 14 Tage / 8 Wochen / 6 Monate); Wiederherstellung über `restore.sh`

**Caching:**
- Server: keiner.
- Browser: Workbox-Cache `wq-api` (NetworkFirst, 5 s Timeout, 200 Einträge, 7 Tage) in `frontend/vite.config.ts`; greift nur mit Service Worker, also nur unter HTTPS.

## Authentication & Identity

**Auth Provider:**
- Eigenbau, kein externer IdP
  - Implementation: JWT-Bearer (`AddJwtBearer`, `MapInboundClaims = false`) mit Signing-Key aus `WQ_JWT_SIGNING_KEY`/`_FILE`; Refresh-Token als SHA256-Hash (`TokenHasher.cs`); Passwörter/PINs mit PBKDF2-HMAC-SHA256 (`PasswordHasher.cs`)
  - Endpoints: `MapAuthEndpoints`, `MapAccountEndpoints` in `backend/src/WordQuest.Api/`
  - Rate-Limiting In-Memory (`AddRateLimiter`, `Auth:RequestsPerMinute`, Default 10/min)
  - Frontend hält Token im `localStorage` (dokumentierter Kompromiss, `frontend/src/lib/api.ts`)

## Monitoring & Observability

**Error Tracking:**
- Keins. `UseExceptionHandler()` + `AddProblemDetails()` in `Program.cs`.

**Logs:**
- ASP.NET-Core-Standardlogging auf stdout (Container-Logs); keine personenbezogenen Daten.
- Health-Checks: `/health/live`, `/health/ready` (inkl. `AddDbContextCheck`).

## CI/CD & Deployment

**Hosting:**
- Selbst gehostet per Docker Compose im Heimnetz; Installation `setup.sh`, Update `upgrade.sh`.

**CI Pipeline:**
- GitHub Actions `.github/workflows/ci.yml` (Push/PR auf `master`, Tags `v*`), Actions per Commit-SHA gepinnt
  - Job `backend`: Build mit `/warnaserror`, Tests gegen Service `postgres:17-alpine`
  - Job `frontend`: `npm ci`, lint, typecheck, build, test, `design:check`, `design:classes`
  - Images: Buildx + QEMU, `linux/amd64,linux/arm64`, Push nach GHCR (nur bei Push)
  - Release (nur Tags `v*`): `.github/release-package.sh` erzeugt `wordquest.tar.gz` + `.sha256`, Upload per `gh release`

## Environment Configuration

**Required env vars:**
- `WQ_JWT_SIGNING_KEY` bzw. `WQ_JWT_SIGNING_KEY_FILE` (Start bricht ab bei fehlendem/schwachem Key, `SecretCheck`)
- `WQ_DB_PASSWORD` bzw. `WQ_DB_PASSWORD_FILE`
- Optional: `WQ_HOST`, `WQ_TIMEZONE`, `WQ_SEED_DEMO_DATA`, `WQ_PORT`, `WQ_ACME_*`, `CF_DNS_API_TOKEN`

**Secrets location:**
- Docker-Secrets `db_password`, `jwt_key` gemountet unter `/run/secrets/` (`docker-compose.quick.yml`); Quelldateien legt `setup.sh` an. Inhalt nicht Teil dieser Analyse.

## Webhooks & Callbacks

**Incoming:**
- Keine.

**Outgoing:**
- Keine.

---

*Integration audit: 2026-10-24*
