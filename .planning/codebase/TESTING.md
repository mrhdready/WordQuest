---
last_mapped_commit: 00d6615b8a97d9dc54b7a0451f777fbfa6e91621
last_mapped_at: 2026-10-26
---
# Testing Patterns

**Analysis Date:** 2026-10-26

## Test Framework

**Runner:**
- Backend: xUnit 2.9.3 mit `xunit.runner.visualstudio` 4.0.0, `Microsoft.NET.Test.Sdk` 18.10.1, `coverlet.collector` 10.0.1. `Xunit` als globales `<Using>` in beiden Test-`.csproj`.
- Integration: `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 (`WebApplicationFactory<Program>`, `Program` ist `public partial`).
- Frontend Unit/Komponenten: Vitest 5.0.3 mit jsdom 30.1.2, Config im `test`-Block von `frontend/vite.config.ts` (`include: ['src/**/*.test.{ts,tsx}']`, `setupFiles: ['src/test/setup.ts']`).
- E2E/Barrierefreiheit: Playwright 1.64.0 (`overrides.playwright-core` gepinnt) + `@axe-core/playwright` 4.13.0, Config `frontend/playwright.config.ts`.
- Shell-Smokes und Gates: Bash-Skripte unter `.planning/phases/*/smoke/` und `.planning/phases/*/gate/` (nur Bash-3.2-Mittel, laufen auf macOS).

**Assertion Library:**
- Backend: xUnit `Assert`.
- Frontend: Vitest `expect`, `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.7; Playwright `expect` (inkl. `expect.poll`).
- Smokes: `fail()` mit festem Präfix und `exit 1`.

**Run Commands:**

```bash
docker compose -f docker-compose.dev.yml up -d                  # PostgreSQL fuer Backend-Tests
dotnet test backend/WordQuest.slnx -c Release                    # Alle Backend-Tests
cd frontend && npm test                                          # vitest run (einmalig)
cd frontend && npx vitest                                        # Watch-Modus
cd frontend && npm run e2e:stack && npm run e2e                  # Playwright + axe gegen gebauten Stack (HTTPS)
docker compose -f frontend/e2e/docker-compose.e2e.yml down -v    # Teststack abraeumen
bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh   # Backend-Gate im SDK-Container
```

## Gate (aus `AGENTS.md`, entspricht `.github/workflows/ci.yml`)

```bash
dotnet build backend/WordQuest.slnx -c Release /warnaserror
dotnet test backend/WordQuest.slnx -c Release
cd frontend && npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes
```

- CI-Job `backend` startet einen `postgres:17-alpine`-Service, setzt `WQ_TEST_DB`, prüft vorab, dass Migrationen unter `backend/src/WordQuest.Infrastructure/Migrations/` existieren, sammelt TRX und `XPlat Code Coverage` als Artefakt.
- CI-Job `frontend` führt lint, typecheck, build, test, `design:check`, `design:classes` aus.
- Playwright/axe, Smokes und Phasen-Gates laufen **nicht** in der CI; sie sind lokal Pflicht, wenn ihr Bereich berührt ist. Ergebnis in der Fertig-Meldung festhalten.
- Ohne lokales .NET-SDK: `.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` (eigenes PostgreSQL im Docker-Netz `wq-p2`, Host-Port 5432 bleibt frei; optionaler Filter als Argument, z. B. `'FullyQualifiedName~SessionEndpointTests'`; `down` räumt ab). Alternativ direkt im Container `mcr.microsoft.com/dotnet/sdk:10.0` mit `-e WQ_TEST_DB='Host=host.docker.internal;Port=5432;Username=wordquest;Password=devpassword'`.

## Test File Organization

**Location:**
- Backend getrennt unter `backend/tests/`:
  - `backend/tests/WordQuest.Learning.Tests/`: reine Domänen-Unit-Tests, referenziert nur `Shared.Kernel` und die Module `Content`, `Learning`, `Gamification` (kein EF, kein HTTP).
  - `backend/tests/WordQuest.Api.Tests/`: Integrationstests über die echte API gegen PostgreSQL, dazu Tests der CLI-Verben (`TlsCommandTests`, `AccountCommandTests`, `ResetPasswordCommandTests`) und der Zertifikatslogik (`TlsCertificatesTests`).
- Frontend co-located neben der Quelle (`frontend/src/features/manage/ChildFormPage.test.tsx` neben `ChildFormPage.tsx`); gemeinsame Helfer in `frontend/src/test/`.
- E2E in `frontend/e2e/`.
- Install-/Release-Smokes und Gates in `.planning/phases/<phase>/{smoke,gate}/`; Einmal-Smokes eines Quick-Tasks in `.planning/quick/<id>/` (z. B. `smoke.mjs`).

**Naming:**
- C#: `<Thema>Tests.cs`, eine `public sealed class` je Datei.
  - `Learning.Tests`: englisch, PascalCase-Segmente (`FirstCorrectAnswer_SchedulesOneDayAhead`).
  - `Api.Tests` (Endpoints, Fachverhalten): deutscher Satz mit Unterstrichen (`Kind_kann_fuer_ein_Geschwisterkind_nichts_tun_und_nichts_lesen`).
  - `Api.Tests` (technische Bausteine wie TLS): englischer Satz mit Unterstrichen (`Watch_on_empty_directory_creates_authority_and_server_with_modes`, `Server_chains_to_authority`). Neue Tests übernehmen den Stil der Datei.
- Frontend: `<Datei>.test.ts(x)`, `describe`/`it` mit deutschen Beschreibungen.
- E2E: `<bereich>.spec.ts`, Testtitel deutsch und beschreibend (`'Login: Token-Design, axe 0, Anmeldung per Enter'`, `'HTTP leitet mit 301 auf HTTPS um, Pfad und Query bleiben'`).
- Smokes: `<zweck>-smoke.sh`, `<zweck>-check.sh`.

**Structure:**

```
backend/tests/
├── WordQuest.Learning.Tests/   # Sm2SchedulerTests, YearLongSimulationTests, AnswerEvaluatorTests,
│                               # SessionComposerTests, GamificationTests, CsvVocabularyParserTests,
│                               # ContentRulesTests, PictureRulesTests, MasteryRulesTests, LevenshteinTests
└── WordQuest.Api.Tests/        # ApiFactory, TestData, FixedClock, ManualTimeProvider
                                # *EndpointTests, SiblingIsolationTests, MigrationTests, RateLimitTests,
                                # SecretCheckTests, DemoAccountCheckTests, StartupLogTests,
                                # TlsCertificatesTests, TlsCommandTests, AccountCommandTests, ...
frontend/
├── src/test/                   # setup.ts, render.tsx (renderWithProviders), render.test.tsx
├── src/**/*.test.ts(x)         # co-located Tests
└── e2e/                        # *.spec.ts, axe.ts, global-setup.ts, pictures.ts, docker-compose.e2e.yml
.planning/phases/
├── 01-safe-home-network-install/smoke/   # setup-smoke.sh, setup-functions-check.sh
├── 02-reliable-learning-clean-family-data/gate/  # backend-test.sh, proxy-xff-check.sh
└── 03-installable-1-0-0-release/smoke/   # release-smoke.sh
```

## Test Structure

**Domänen-Unit-Test (Arrange/Act/Assert, deterministisch):**

```csharp
public sealed class Sm2SchedulerTests
{
    private static readonly SchedulerOptions NoFuzz = new() { FuzzFactor = 0 };
    private static Sm2Scheduler Scheduler(SchedulerOptions? options = null) =>
        new(options ?? NoFuzz, new Random(1));

    [Fact]
    public void FirstCorrectAnswer_SchedulesOneDayAhead()
    {
        ReviewOutcome outcome = Scheduler().Schedule(
            ReviewSnapshot.ForNewCard(NoFuzz), Grade.Good, Monday);

        Assert.Equal(1, outcome.Repetitions);
    }
}
```

- Zufall mit festem Seed (`new Random(1)`), Zeit als fester `DateTimeOffset`.
- `[Theory]` + `[InlineData]` für Eingabevarianten (`AnswerEvaluatorTests.cs`, `TlsCertificatesTests.NeedsReissue_renews_below_30_days`).
- `YearLongSimulationTests.cs` simuliert ein Schuljahr (600 Karten, 365 Tage) und prüft Arbeitslast-Grenzen statt Einzelformeln.

**Integrationstest mit geteilter Factory:**

```csharp
public sealed class SiblingIsolationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public SiblingIsolationTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Kind_kann_fuer_ein_Geschwisterkind_nichts_tun_und_nichts_lesen()
    {
        SeededFamily family = await SeedFamilyAsync(_factory, children: 2);
        using HttpClient clientA = _factory.CreateClientFor(family.Children[0]);
        ...
    }
}
```

**Isolationsregel (`backend/tests/WordQuest.Api.Tests/ApiFactory.cs`):**
- Jede `ApiFactory` legt eine eigene Datenbank `wordquest_test_<guid>` auf dem Server aus `WQ_TEST_DB` an (Default `Host=localhost;Port=5432;Username=wordquest;Password=devpassword`), migriert sie in `InitializeAsync` und löscht sie in `DisposeAsync`.
- Tests, deren Erwartung vom globalen DB-Stand abhängt (Owner vorhanden, Anzahl Mandanten, Rate-Limit), nutzen **kein** `IClassFixture`, sondern `new ApiFactory()` je Testfall über `IAsyncLifetime` (z. B. `AuthEndpointTests`, `MigrationTests`, `RateLimitTests`, `StartupLogTests`).
- Klassen mit geteilter Factory legen Daten mit eindeutigen Werten an (Guid in Namen/E-Mail, `TestData`) und prüfen keine globalen Zählungen.
- `[assembly: CollectionBehavior(DisableTestParallelization = true)]` in `ApiFactory.cs`: keine parallelen Suites gegen eine geteilte DB; die Factory setzt Prozess-Umgebungsvariablen (`ConnectionStrings__Default`, `WQ_JWT_SIGNING_KEY`, `WQ_SEED_DEMO_DATA=false`).

**Dateisystem-/CLI-Tests (`backend/tests/WordQuest.Api.Tests/TlsCommandTests.cs`):**
- Echtes Temp-Verzeichnis je Test (`Directory.CreateTempSubdirectory("wq-tls-")`), Aufräumen über `IDisposable.Dispose`.
- Ausgabe über `StringWriter` (mit `TextWriter.Synchronized`) einfangen und zeilenweise gegen exakte deutsche Texte prüfen; erwartete Texte als `private const string` am Klassenanfang.
- Teure Vorbereitung (RSA 3072) einmal per `static readonly Lazy<…>` erzeugen und je Test kopieren.
- Unix-Dateimodi prüfen (`File.GetUnixFileMode`), Test mit `[UnsupportedOSPlatform("windows")]` markiert.
- Zeitgesteuerte Schleifen (`tls watch`) mit `ManualTimeProvider` (`backend/tests/WordQuest.Api.Tests/ManualTimeProvider.cs`): Zeit von Hand stellen, Timer feuern per `FireLatest`, warten per `WaitForTimersAsync(n)`.

**Frontend-Komponententest:**

```tsx
renderWithProviders(<ChildFormPage mode="create" />, {
  route: '/verwalten/kinder/neu',
  path: '/verwalten/kinder/neu',
})
await userEvent.type(screen.getByLabelText('Name'), 'Mia')
expect(await screen.findByText('Wie soll das Kind heißen? Ein Spitzname genügt.')).toBeTruthy()
```

- `renderWithProviders` (`frontend/src/test/render.tsx`): neuer `QueryClient` ohne Retry, `MemoryRouter` mit echtem Pfadmuster, Fangroute `*` zeigt Ziel-Pfad und Router-State-Meldung nach `navigate()`.
- `frontend/src/test/setup.ts`: `afterEach(cleanup)` (Vitest läuft ohne globals, `describe`/`it`/`expect` explizit importieren).
- Abfragen über Rolle/Label (`getByRole`, `getByLabelText`), nicht über Testids.

## Mocking

**Framework:** Vitest `vi`; im Backend keine Mock-Bibliothek; in Smokes PATH-Stubs.

**Patterns:**

```ts
// fetch je Test stubben (frontend/src/lib/api.test.ts)
function respond(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
}
afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

// Modul teilweise ersetzen (frontend/src/features/manage/SetDetailPage.test.tsx)
vi.mock('@/lib/picture', async (importOriginal) => ({ ... }))
vi.mocked(shrinkPicture).mockResolvedValue(small)
```

```csharp
// Backend: echte Dienste, gezielt per TestServices ersetzt (vor erstem Host-Zugriff setzen)
factory.TestServices = services => services.AddSingleton<TimeProvider>(new FixedClock(now));
```

```bash

# Smoke: Programm per PATH-Stub ersetzen (setup-functions-check.sh)

cat >"$T/bin/hostname" <<'EOF'
#!/bin/sh
if [ "${1:-}" = -I ]; then echo "$STUB_ADDR"; exit 0; fi
echo "$STUB_NAME"
EOF
export PATH="$T/bin:$PATH"
```

**What to Mock:**
- Frontend: `fetch` (Netzgrenze) und Browser-APIs, die jsdom nicht kann (z. B. Bildverkleinerung in `@/lib/picture`).
- Backend: Uhr (`FixedClock : TimeProvider` für feste Zeit, `ManualTimeProvider` für Timer/Takte), Interceptors über `ApiFactory.TestServices`.
- Smokes: Host-Werkzeuge wie `hostname` per PATH-Stub; `docker` und Ports bleiben echt.

**What NOT to Mock:**
- Datenbank: Integrationstests laufen gegen echtes PostgreSQL inkl. Migrationen, Global Query Filters, Constraints.
- Auth: Tokens kommen echt aus `JwtTokenService` (`ApiFactory.CreateClientFor(user)`), das umgeht nur das Login-Rate-Limit.
- Nebenläufigkeit: echte Zeilensperren über `LockRowsAsync`, `LockReviewStateAsync`, `WaitForBlockedAsync`, `ReleaseAsync` in `ApiFactory`.
- Krypto/Zertifikate: echte Schlüssel und X.509 aus der BCL (`TlsCertificatesTests`), im e2e echter TLS-Handshake.
- E2E: kein Request-Routing/Mocking; Tests laufen gegen den gebauten Stack mit nginx, CSP und Produktions-Build.

## Fixtures and Factories

**Test Data:**

```csharp
SeededFamily family = await TestData.SeedFamilyAsync(factory, children: 2, dailyNewLimit: 5);
SeededSet set = await TestData.SeedSetAsync(factory, family);
string answer = set.AnswerFor(prompt);  // Gegenseite des Eintrags
```

- `backend/tests/WordQuest.Api.Tests/TestData.cs`: `SeedFamilyAsync` (Mandant, Owner, Kinder mit Lern- und Spielprofil, PIN `ChildPin = "4711"`), `SeedSetAsync`, Records `SeededFamily`, `SeededSet`. Direkt über `factory.CreateSystemDbContext()` (ohne Mandantenfilter).
- Frontend: Konstanten für exakte Fehlertexte und gültige Werte am Dateianfang (`const valid = { name: 'Mia', limit: '5', pin: '1234' }`), lokale Helfer `fill`, `fields`, `settle`, `expectClientError`.
- E2E: Demo-Konto aus `DemoDataSeeder` (`demo@wordquest.local`, Kind `Max`, PIN `1234`), Bilddaten über `frontend/e2e/pictures.ts` (`canvasPicture`, `putPicture`, `accessToken`).

**Location:**
- Backend: `backend/tests/WordQuest.Api.Tests/{ApiFactory,TestData,FixedClock,ManualTimeProvider}.cs`.
- Frontend: `frontend/src/test/`; testspezifische Helfer bleiben in der Testdatei.
- E2E: `frontend/e2e/{axe,global-setup,pictures}.ts`.

## Formular-Tests (Pflicht, Edge-Case-Matrix)

- Pro Fall genau ein Feld falsch, durch alle Felder rotieren; exakte Fehlertexte; Enter-Submit als eigener Pfad; Happy Path zuletzt.
- Muster `expectClientError` in `frontend/src/features/manage/ChildFormPage.test.tsx`: Fehler-`id` = `<input-id>-fehler`, `aria-invalid="true"`, `aria-describedby` verdrahtet, Fokus auf dem Feld, genau ein Fehler im DOM, kein `fetch`-Aufruf.
- E2E ergänzt leeres Absenden mit allen Feldfehlern per `aria-describedby` (`account.spec.ts`, `children.spec.ts`) und Enter-Submit bei 200 % Zoom (`keyboard-zoom.spec.ts`).

## E2E / Barrierefreiheit (Playwright + axe, über HTTPS)

**Teststack (`frontend/e2e/docker-compose.e2e.yml`, Projekt `wordquest-e2e`):**
- Dienste `db`, `api` (`ASPNETCORE_ENVIRONMENT=Development`, `WQ_SEED_DEMO_DATA=true`, `Auth__RequestsPerMinute=1000`), `certs` (API-Image mit `tls watch`, `network_mode: none`, `WQ_TLS_NAMES=localhost,wordquest.test,127.0.0.1`, einziger Dienst mit CA-Volume) und `web` (nginx).
- Ports nur an `127.0.0.1`: `18080` (HTTP, leitet mit 301 auf HTTPS um, liefert `/wordquest-ca.crt`) und `18443` (HTTPS).
- `npm run e2e:stack` baut immer frisch (`down -v` vor `up -d --build --wait`).

**Konfiguration (`frontend/playwright.config.ts`):**
- Base-URL `https://localhost:18443` (überschreibbar per `WQ_E2E_BASE_URL`), `workers: 1`, `fullyParallel: false`, `retries: 0`, Reporter `list`, nur Chromium.
- Vertrauter Pfad: Ist `WQ_E2E_SPKI` gesetzt, startet Chromium mit `--ignore-certificate-errors-spki-list=<spki>`; vertraut wird genau dem Schlüssel des ausgelieferten Server-Zertifikats, nicht pauschal (`--ignore-certificate-errors` ist verboten, weil es Zertifikatsfehler verdeckt und den Service Worker trotzdem zulässt).

**`frontend/e2e/global-setup.ts`:**
- Bricht ab, wenn `baseURL` nicht mit `https://` beginnt.
- Holt Server-Zertifikat (TLS-Connect) und CA (`/wordquest-ca.crt`) mit Retry bis 30 s, prüft `server.verify(ca.publicKey)`, berechnet den SPKI-SHA-256, schreibt die CA nach `playwright/.auth/wordquest-ca.pem` (`caFile`) und setzt `WQ_E2E_SPKI` und `NODE_EXTRA_CA_CERTS` für die Worker.
- Eine Eltern-Anmeldung je Lauf, speichert `playwright/.auth/guardian.json` (`guardianStorageState`); Specs nutzen `test.use({ storageState: guardianStorageState })`. Zugangsdaten per `WQ_E2E_GUARDIAN_EMAIL`/`WQ_E2E_GUARDIAN_PASSWORD` überschreibbar (Install-Smoke).

**Warnpfad ohne Vertrauen (`frontend/e2e/learn.spec.ts`):**
- Dateiweit `test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP wordquest.test 127.0.0.1'] } })`: ersetzt die SPKI-Liste, Browser-Optionen gelten nur auf Dateiebene. Bildet ein Gerät ohne installierte CA ab.
- `test.describe('Zertifikat nicht vertraut')` mit `baseURL: 'https://wordquest.test:18443'`: prüft, dass die Service-Worker-Registrierung mit `SSL certificate error` scheitert, keine Registrierung bleibt (per `expect.poll`) und eine Lernrunde trotzdem vollständig läuft.
- Zusätzliche Kontexte im Warnpfad brauchen `ignoreHTTPSErrors: true` (`browser.newContext({ baseURL, storageState: guardianStorageState, ignoreHTTPSErrors: true })`).
- Vertrauter Pfad mit aktivem Service Worker: `login.spec.ts` (`'CA-Download mit aktivem Service Worker'`) und die Lernrunde mit Service Worker. Wo ein Service Worker stört: `test.use({ serviceWorkers: 'block' })`.

**`frontend/e2e/axe.ts` → `checkPage(page)` als Standardaufruf je Seite:**
- `expectNoAxeViolations`: Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, 0 Violations; `incomplete color-contrast` und Best-Practice-Zahlen als Annotation.
- `expectGlassContrast`: Kontrast auf jeder Backdrop-Farbe einzeln; ungemessene Knoten außer `bgGradient` lassen den Test scheitern.
- `expectDialogContrast`: offener Dialog allein, über Backdrops und `primary-deep`.
- `expectOpaqueFallback`: `prefers-reduced-transparency: reduce` per CDP, Glasflächen deckend ohne Blur.
- `expectReflow`: 320 CSS-px ohne horizontales Scrollen (WCAG 1.4.10).

**Specs:**
- `tls.spec.ts`: CA per HTTP holen, Handshake auf 18443 nur mit dieser CA als Anker (`authorized === true`), Laufzeiten und Namen der Zertifikate; nur Node-Bordmittel (`node:tls`, `node:crypto`), kein Browser. Ziel per `WQ_E2E_HTTPS_URL` überschreibbar.
- `headers.spec.ts`: Sicherheits-Header/CSP und Cache-Header an HTML, Assets, `sw.js` und Fehlerantworten; 301 von HTTP auf HTTPS mit Pfad und Query; CA-Download über HTTP und HTTPS identisch, ohne Schlüssel.
- `login.spec.ts` (sichtbarer Fokus `outline` `solid 3px`, Abmelden über Tabs), `first-run.spec.ts`, `learn.spec.ts`, `manage.spec.ts`, `children.spec.ts`, `account.spec.ts`, `keyboard-zoom.spec.ts` (Tastatur, 200 %, Dialoge).
- Rate-Limit sichtbar machen statt verstecken: `expect(response.status(), 'Rate-Limit auth erreicht').not.toBe(429)`.

## Install-, Release- und Funktions-Smokes (Bash)

- Gemeinsame Form: `set -euo pipefail`, `ROOT` aus Skriptpfad bzw. `git rev-parse --show-toplevel`, Arbeitsordner per `mktemp -d`, `trap cleanup EXIT` räumt Container, Volumes, Images und Temp-Ordner ab, Fehler über `fail()` mit Präfix (`SMOKE FEHLER:`, `RELEASE-SMOKE FEHLER:`, `FUNKTIONEN FEHLER:`), Fortschritt als `== Abschnitt` und `… OK`-Zeilen. Nur Bash-3.2-Mittel.
- `.planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh`: kopiert den Arbeitsbaum (ohne `.git`, `secrets`, `.env`) nach `mktemp -d`, Projekt `wq-smoke`, führt `setup.sh` bis zur ersten Lernantwort eines Kindes aus. HTTPS-Prüfungen mit `curl --cacert "$WORK/ca.pem"` (CA aus dem `certs`-Container): Abschlusszeile `https://`, CA-Download über HTTP mit SHA-256-Vergleich, 301-Umleitung, Rechte `ca.key` = 600, nur `server.pem` und `wordquest-ca.crt` unter `/etc/nginx/tls`, `web` ohne CA-Volume, Namensänderung (`WQ_TLS_NAMES` in `.env`, `curl --resolve`), Erneuerung mit kurz laufendem Zertifikat, kaputte `server.pem` (`wait_https` meldet Fehler, zweiter `./setup.sh`-Lauf heilt).
- `.planning/phases/01-safe-home-network-install/smoke/setup-functions-check.sh`: lädt nur die Funktionen in Spalte 0 aus `setup.sh` per `awk` (setup.sh selbst läuft nicht), prüft, dass `valid_label`, `bridge_gateways`, `tls_names`, `is_terminal`, `own_port`, `port_free`, `port_usable`, `choose_ports`, `set_env`, `start_stack` existieren, und testet sie in je einer Subshell mit eigenem Ordner und `.env`: Namensliste fürs Zertifikat, Portprüfung gegen echte Listener, `.env`-Schreiben, Startmeldung bei belegtem Port. Voraussetzung dafür: neue Funktionen in `setup.sh` in Spalte 0 als `name() {` definieren.
- `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh`: Installation aus dem lokal gebauten Release-Paket (HTTP-Server `127.0.0.1:18083`, `curl | tar xz`, `./setup.sh`), Images mit veröffentlichten Namen `ghcr.io/mrhdready/wordquest-{api,web}`, Update über lokale Registry `127.0.0.1:18084`; Projekt `wq-release`.
- `.planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh`: nginx (`frontend/nginx.conf`) gegen Echo-Upstream über HTTPS: X-Forwarded-For-Kette, Sicherheits-Header an jedem Pfad, HTTP→HTTPS ohne HSTS; dazu für jeden Dienst jeder Compose-Datei: nur `certs` bindet das CA-Volume (`*-ca`), `/etc/nginx/tls` nur schreibgeschützt, `certs` ohne Netz, Ports und Secrets, keine Mounts unter `/etc/nginx/conf.d` oder `/etc/nginx/templates`.
- Wann ausführen: bei Änderungen an `setup.sh`, `upgrade.sh`, `restore.sh`, Compose-Dateien, `frontend/nginx.conf`, TLS-Code (`backend/src/WordQuest.Api/TlsCommand.cs`, `TlsCertificates.cs`) oder Release-Paket (`.github/release-package.sh`). Aufruf: `bash .planning/phases/<phase>/<smoke|gate>/<script>.sh`.

## Coverage

**Requirements:** Kein Schwellwert erzwungen. CI sammelt Backend-Coverage (`--collect:"XPlat Code Coverage"`) nur als Artefakt; Frontend ohne Coverage-Konfiguration.

**View Coverage:**

```bash
dotnet test backend/WordQuest.slnx -c Release --collect:"XPlat Code Coverage"   # cobertura unter **/TestResults/
```

## Test Types

**Unit Tests:**
- Domänenlogik (SM-2, Bewertung, Gamification, CSV-Parser, Content-/Picture-Regeln) in `backend/tests/WordQuest.Learning.Tests/`. Neue Domänenregeln dort testen.
- Zertifikatslogik (`TlsCertificatesTests`) und CLI-Verben in `backend/tests/WordQuest.Api.Tests/` ohne Datenbank.

**Integration Tests:**
- Endpoints, Auth, Mandanten- und Geschwistertrennung, Persistenz, Migration, Rate-Limit, Secret-/Demo-Prüfung beim Start in `backend/tests/WordQuest.Api.Tests/`.
- Frontend-Seiten mit gestubbtem `fetch` in Vitest.

**E2E Tests:**
- Playwright + axe gegen den gebauten Docker-Stack über HTTPS (`frontend/e2e/`), vertrauter Pfad und Warnpfad ohne Vertrauen.
- Install-/Release-/Funktions-Smokes und Proxy-Gate als Bash-Skripte.

## Common Patterns

**Async Testing:**

```ts
const error = await screen.findByText(message)          // wartet auf Render
await waitFor(() => expect(...).toBe(...))
// "kein fetch" erst nach einem Tick pruefen
async function settle() { await new Promise((resolve) => setTimeout(resolve, 20)) }
```

```ts
// E2E: Antwort und Aktion gemeinsam abwarten, Zustand pollen statt fester Wartezeit
const [response] = await Promise.all([
  page.waitForResponse((candidate) => isAnswer(candidate.url())),
  action(),
])
await expect.poll(workers).toEqual({ controller: false, registrations: 0 })
```

- Dienste, die nach dem Start Zeit brauchen (CA, Server-Zertifikat), mit begrenztem Retry (Deadline 30 s, 1 s Pause) abwarten, nicht mit festem `sleep`.

**Error Testing:**

```ts
async function caught(): Promise<ApiError> {
  try { await api('/probe') } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('api() hat nicht geworfen')
}
expect((await caught()).status).toBe(400)
```

```csharp
HttpResponseMessage response = await client.PostAsJsonAsync(url, body);
Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);   // 4xx statt 500
```

```bash
status=0
(. ./wait-https.sh; wait_https "$WQ_HTTPS_PORT") >tls-broken.log 2>&1 || status=$?
[[ "$status" != 0 ]] || fail "wait_https mit kaputter server.pem: Exit 0."
grep -qF 'WordQuest antwortet nicht über HTTPS.' tls-broken.log || fail "wait_https ohne Meldung"
```

**Bugfix:** zuerst roter Test, der den Bug reproduziert, dann der Fix.

---

*Testing analysis: 2026-10-26*
