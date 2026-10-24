---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
# Testing Patterns

**Analysis Date:** 2026-10-24

## Test Framework

**Runner:**
- Backend: xUnit 2.9.3 mit `xunit.runner.visualstudio` 4.0.0, `Microsoft.NET.Test.Sdk` 18.10.1, `coverlet.collector` 10.0.1. `Xunit` als globales `<Using>` in beiden Test-`.csproj`.
- Integration: `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 (`WebApplicationFactory<Program>`, `Program` ist `public partial`).
- Frontend Unit/Komponenten: Vitest 5.0.3 mit jsdom 30.1.2, Config im `test`-Block von `frontend/vite.config.ts` (`include: ['src/**/*.test.{ts,tsx}']`, `setupFiles: ['src/test/setup.ts']`).
- E2E/Barrierefreiheit: Playwright 1.64.0 + `@axe-core/playwright` 4.13.0, Config `frontend/playwright.config.ts`.

**Assertion Library:**
- Backend: xUnit `Assert`.
- Frontend: Vitest `expect`, `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.7; Playwright `expect`.

**Run Commands:**

```bash
docker compose -f docker-compose.dev.yml up -d          # PostgreSQL fuer Backend-Tests
dotnet test backend/WordQuest.slnx -c Release            # Alle Backend-Tests
cd frontend && npm test                                  # vitest run (einmalig)
cd frontend && npx vitest                                # Watch-Modus
cd frontend && npm run e2e:stack && npm run e2e          # Playwright + axe gegen gebauten Stack
docker compose -f frontend/e2e/docker-compose.e2e.yml down -v   # Teststack abraeumen
```

## Gate (aus `AGENTS.md`, entspricht `.github/workflows/ci.yml`)

```bash
dotnet build backend/WordQuest.slnx -c Release /warnaserror
dotnet test backend/WordQuest.slnx -c Release
cd frontend && npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes
```

- CI-Job `backend` startet einen `postgres:17-alpine`-Service und setzt `WQ_TEST_DB`; prüft vorab, dass Migrationen unter `backend/src/WordQuest.Infrastructure/Migrations/` existieren; sammelt TRX und `XPlat Code Coverage` als Artefakt.
- CI-Job `frontend` führt lint, typecheck, build, test, `design:check`, `design:classes` aus.
- Playwright/axe läuft **nicht** in der CI; bei UI-Änderungen lokal Pflicht, Ergebnis in der Fertig-Meldung festhalten.
- Ohne lokales .NET-SDK: Build/Tests im Container `mcr.microsoft.com/dotnet/sdk:10.0` mit `-e WQ_TEST_DB='Host=host.docker.internal;Port=5432;Username=wordquest;Password=devpassword'`.

## Test File Organization

**Location:**
- Backend getrennt unter `backend/tests/`:
  - `backend/tests/WordQuest.Learning.Tests/` — reine Domänen-Unit-Tests, referenziert nur `Shared.Kernel` und die Module `Content`, `Learning`, `Gamification` (kein EF, kein HTTP).
  - `backend/tests/WordQuest.Api.Tests/` — Integrationstests über die echte API gegen PostgreSQL.
- Frontend co-located neben der Quelle (`frontend/src/features/manage/ChildFormPage.test.tsx` neben `ChildFormPage.tsx`).
- E2E in `frontend/e2e/`.

**Naming:**
- C#: `<Thema>Tests.cs`, eine `public sealed class` je Datei. Methodennamen in `Learning.Tests` englisch im Stil `FirstCorrectAnswer_SchedulesOneDayAhead`; in `Api.Tests` als deutscher Satz mit Unterstrichen (`Kind_kann_fuer_ein_Geschwisterkind_nichts_tun_und_nichts_lesen`).
- Frontend: `<Datei>.test.ts(x)`, `describe`/`it` mit deutschen Beschreibungen.
- E2E: `<bereich>.spec.ts`, `test('Login: Token-Design, axe 0, Anmeldung per Enter', …)`.

**Structure:**

```
backend/tests/
├── WordQuest.Learning.Tests/   # Sm2SchedulerTests, YearLongSimulationTests, AnswerEvaluatorTests,
│                               # SessionComposerTests, GamificationTests, CsvVocabularyParserTests,
│                               # ContentRulesTests, PictureRulesTests, MasteryRulesTests, LevenshteinTests
└── WordQuest.Api.Tests/        # ApiFactory, TestData, FixedClock + *EndpointTests, SiblingIsolationTests,
                                # MigrationTests, RateLimitTests, SecretCheckTests, StartupLogTests, ...
frontend/
├── src/test/                   # setup.ts, render.tsx (renderWithProviders), render.test.tsx
├── src/**/*.test.ts(x)         # co-located Tests
└── e2e/                        # *.spec.ts, axe.ts, global-setup.ts, pictures.ts, docker-compose.e2e.yml
.planning/phases/*/smoke/       # Install-/Release-Smoke (Bash)
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
- `[Theory]` + `[InlineData]` für Eingabevarianten (`AnswerEvaluatorTests.cs`).
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
- `[assembly: CollectionBehavior(DisableTestParallelization = true)]`: keine parallelen Suites gegen eine geteilte DB; die Factory setzt Prozess-Umgebungsvariablen (`ConnectionStrings__Default`, `WQ_JWT_SIGNING_KEY`, `WQ_SEED_DEMO_DATA=false`).

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
- `frontend/src/test/setup.ts`: `afterEach(cleanup)` (Vitest läuft ohne globals).
- Abfragen über Rolle/Label (`getByRole`, `getByLabelText`), nicht über Testids.

## Mocking

**Framework:** Vitest `vi`; im Backend keine Mock-Bibliothek.

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

**What to Mock:**
- Frontend: `fetch` (Netzgrenze) und Browser-APIs, die jsdom nicht kann (z. B. Bildverkleinerung in `@/lib/picture`).
- Backend: Uhr (`FixedClock : TimeProvider` in `backend/tests/WordQuest.Api.Tests/FixedClock.cs`), Interceptors über `ApiFactory.TestServices`.

**What NOT to Mock:**
- Datenbank: Integrationstests laufen gegen echtes PostgreSQL inkl. Migrationen, Global Query Filters, Constraints.
- Auth: Tokens kommen echt aus `JwtTokenService` (`ApiFactory.CreateClientFor(user)`), das umgeht nur das Login-Rate-Limit.
- Nebenläufigkeit: echte Zeilensperren über `LockRowsAsync`, `LockReviewStateAsync`, `WaitForBlockedAsync`, `ReleaseAsync` in `ApiFactory`.

## Fixtures and Factories

**Test Data:**

```csharp
SeededFamily family = await TestData.SeedFamilyAsync(factory, children: 2, dailyNewLimit: 5);
SeededSet set = await TestData.SeedSetAsync(factory, family);
string answer = set.AnswerFor(prompt);  // Gegenseite des Eintrags
```

- `backend/tests/WordQuest.Api.Tests/TestData.cs`: `SeedFamilyAsync` (Mandant, Owner, Kinder mit Lern- und Spielprofil, PIN `ChildPin = "4711"`), `SeedSetAsync`, Records `SeededFamily`, `SeededSet`. Direkt über `factory.CreateSystemDbContext()` (ohne Mandantenfilter).
- Frontend: Konstanten für exakte Fehlertexte und gültige Werte am Dateianfang (`const valid = { name: 'Mia', limit: '5', pin: '1234' }`), lokale Helfer `fill`, `fields`, `settle`, `expectClientError`.
- E2E: Demo-Konto aus `DemoDataSeeder` (`demo@wordquest.local`), Bilddaten in `frontend/e2e/pictures.ts`.

**Location:**
- Backend: `backend/tests/WordQuest.Api.Tests/{ApiFactory,TestData,FixedClock}.cs`.
- Frontend: `frontend/src/test/`; testspezifische Helfer bleiben in der Testdatei.

## Formular-Tests (Pflicht, Edge-Case-Matrix)

- Pro Fall genau ein Feld falsch, durch alle Felder rotieren; exakte Fehlertexte; Enter-Submit als eigener Pfad; Happy Path zuletzt.
- Muster `expectClientError` in `frontend/src/features/manage/ChildFormPage.test.tsx`: Fehler-`id` = `<input-id>-fehler`, `aria-invalid="true"`, `aria-describedby` verdrahtet, Fokus auf dem Feld, genau ein Fehler im DOM, kein `fetch`-Aufruf.

## E2E / Barrierefreiheit (Playwright + axe)

- Läuft gegen den gebauten Teststack `frontend/e2e/docker-compose.e2e.yml` (Projekt `wordquest-e2e`: PostgreSQL, API mit `ASPNETCORE_ENVIRONMENT=Development`, `WQ_SEED_DEMO_DATA=true`, `Auth__RequestsPerMinute=1000`, Web/nginx), Base-URL `http://localhost:18080` (überschreibbar per `WQ_E2E_BASE_URL`). Damit werden CSP, nginx und Produktions-Build mitgeprüft.
- `workers: 1`, `fullyParallel: false`, `retries: 0`, nur Chromium.
- `frontend/e2e/global-setup.ts`: eine Eltern-Anmeldung je Lauf, speichert `playwright/.auth/guardian.json`; Specs nutzen `test.use({ storageState: guardianStorageState })`. Zugangsdaten per `WQ_E2E_GUARDIAN_EMAIL`/`WQ_E2E_GUARDIAN_PASSWORD` überschreibbar (Install-Smoke).
- `frontend/e2e/axe.ts` → `checkPage(page)` ist der Standardaufruf je Seite:
  - `expectNoAxeViolations`: Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, 0 Violations; `incomplete color-contrast` und Best-Practice-Zahlen als Annotation.
  - `expectGlassContrast`: Kontrast auf jeder Backdrop-Farbe einzeln; ungemessene Knoten außer `bgGradient` lassen den Test scheitern.
  - `expectDialogContrast`: offener Dialog allein, über Backdrops und `primary-deep`.
  - `expectOpaqueFallback`: `prefers-reduced-transparency: reduce` per CDP, Glasflächen deckend ohne Blur.
  - `expectReflow`: 320 CSS-px ohne horizontales Scrollen (WCAG 1.4.10).
- Weitere Specs: `keyboard-zoom.spec.ts` (Tastatur, Zoom), `headers.spec.ts` (Security-Header/CSP), `first-run.spec.ts`, `login.spec.ts` (sichtbarer Fokus: `outline` `solid 3px`), `learn.spec.ts`, `manage.spec.ts`, `children.spec.ts`, `account.spec.ts`. Service Worker bei Bedarf mit `test.use({ serviceWorkers: 'block' })`.

## Install- und Release-Smoke

- `.planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh`: kopiert den Arbeitsbaum (ohne `.git`, `secrets`, `.env`) nach `mktemp -d`, baut Images (`COMPOSE_PROJECT_NAME=wq-smoke`, Port 18081, eindeutiger `WQ_VERSION`), führt `setup.sh` aus bis zur ersten Lernantwort eines Kindes; `trap cleanup EXIT` räumt Container, Volumes und Images ab.
- `.planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh`: Installation aus dem lokal gebauten Release-Paket (HTTP-Server `127.0.0.1:18083`, `curl | tar xz`, `./setup.sh`), Images mit veröffentlichten Namen `ghcr.io/mrhdready/wordquest-{api,web}:1.0.0`, Update über lokale Registry `127.0.0.1:18084`; Projekt `wq-release`, Port 18082. Nur Bash-3.2-Mittel (macOS).
- Aufruf: `bash .planning/phases/<phase>/smoke/<script>.sh`. Fehler über `fail()` mit Präfix `SMOKE FEHLER:` bzw. `RELEASE-SMOKE FEHLER:`. Nicht Teil der CI; bei Änderungen an Installation, Compose-Dateien, `setup.sh`/`upgrade.sh`/`restore.sh` oder Release-Paket ausführen.

## Coverage

**Requirements:** Kein Schwellwert erzwungen. CI sammelt Backend-Coverage (`--collect:"XPlat Code Coverage"`) nur als Artefakt; Frontend ohne Coverage-Konfiguration.

**View Coverage:**

```bash
dotnet test backend/WordQuest.slnx -c Release --collect:"XPlat Code Coverage"   # cobertura unter **/TestResults/
```

## Test Types

**Unit Tests:**
- Domänenlogik (SM-2, Bewertung, Gamification, CSV-Parser, Content-/Picture-Regeln) in `backend/tests/WordQuest.Learning.Tests/`. Neue Domänenregeln dort testen.

**Integration Tests:**
- Endpoints, Auth, Mandanten- und Geschwistertrennung, Persistenz, Migration, Rate-Limit, Secret-/Demo-Prüfung beim Start in `backend/tests/WordQuest.Api.Tests/`.
- Frontend-Seiten mit gestubbtem `fetch` in Vitest.

**E2E Tests:**
- Playwright + axe gegen gebauten Docker-Stack (`frontend/e2e/`); Install-/Release-Smoke als Bash-Skripte.

## Common Patterns

**Async Testing:**

```ts
const error = await screen.findByText(message)          // wartet auf Render
await waitFor(() => expect(...).toBe(...))
// "kein fetch" erst nach einem Tick pruefen
async function settle() { await new Promise((resolve) => setTimeout(resolve, 20)) }
```

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

**Bugfix:** zuerst roter Test, der den Bug reproduziert, dann der Fix.

---

*Testing analysis: 2026-10-24*
