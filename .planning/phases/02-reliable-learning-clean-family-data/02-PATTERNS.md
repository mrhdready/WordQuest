# Phase 2: Reliable Learning & Clean Family Data – Pattern Map

**Erstellt:** 2026-10-17
**Dateien analysiert:** 22 (neu oder geändert)
**Analoga gefunden:** 21 / 22

Zeilennummern beziehen sich auf den Arbeitsbaum vom 2026-10-17 (Branch `v1-fertig`, mit uncommitteten Phase-1-Nachbesserungen). Einige Zeilen in 02-RESEARCH.md sind leicht verschoben, z. B. steht die Meisterschaftsregel in `LearnerEndpoints.cs` bei :204 und :259, nicht bei :199 und :254.

## Dateiklassifikation

| Neue/geänderte Datei | Rolle | Datenfluss | Nächstes Analogon | Qualität |
|---|---|---|---|---|
| `backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs` (FKs, xmin) | config | CRUD | `Configurations/ContentConfigurations.cs:20-24, 50-54` | exakt |
| `backend/src/WordQuest.Infrastructure/Migrations/<ts>_ReferentialIntegrity.cs` | migration | batch | `Migrations/20260917045557_Initial.cs` (generiert) | Rolle |
| `backend/src/WordQuest.Infrastructure/LearningService.cs` | service | request-response | eigener Bestand, `:29-41, :116-130, :138-156, :259-267` | exakt |
| `backend/src/WordQuest.Api/Program.cs` (ForwardedHeaders, Limiter) | config | request-response | `Program.cs:114-125, :160-175` | exakt |
| `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs` (Refresh ohne Limit) | route | request-response | `AuthEndpoints.cs:15, :20` | exakt |
| `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs` (PATCH Set, PATCH Eintrag, Längen) | route | CRUD | `LearnerEndpoints.cs:89-139` (PATCH settings) | exakt |
| `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs` (DELETE Kind, Serie, Meisterschaft) | route | CRUD | `SetEndpoints.cs:73-85` (DeleteAsync) | exakt |
| `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs` (404/409 mit Text) | route | request-response | `LearnerEndpoints.cs:152-160` (ValidationProblem-Mapping) | Rolle |
| `backend/src/WordQuest.Modules.Learning/Services/MasteryRules.cs` (neu) | utility (Domäne) | transform | `Modules.Identity/Services/AccountRules.cs:1-40` | Rolle |
| `backend/src/WordQuest.Modules.Gamification/Services/StreakRules.cs` (+ aktuelle Serie) | utility (Domäne) | transform | eigener Bestand `:1-82` | exakt |
| Validierungsregeln für Set-Titel/Eintragstexte (Ort: `SetEndpoints` oder Content-Regel) | utility | transform | `AccountRules.cs` + `LearnerProfileProblem.cs` | Rolle |
| `backend/tests/WordQuest.Api.Tests/{SessionEndpoint,SetEdit,LearnerDelete,Migration,AuthRefresh}Tests.cs` | test | request-response | `LearnerEndpointTests.cs`, `RateLimitTests.cs:14-40`, `ApiFactory.cs` | exakt |
| `backend/tests/WordQuest.Api.Tests/RateLimitTests.cs` (X-Forwarded-For) | test | request-response | eigener Bestand | exakt |
| `backend/tests/WordQuest.Learning.Tests/GamificationTests.cs` / neue `MasteryRulesTests` | test | transform | `GamificationTests.cs:7-70` | exakt |
| `frontend/src/components/ui/dialog.tsx` (neu, ConfirmDialog) | component | event-driven | `components/ui/misc.tsx:1-12` (Radix-Wrapper), `button.tsx:41` | Rolle |
| `frontend/src/features/manage/SetDetailPage.tsx` (Umbenennen, Eintrag bearbeiten, Löschen, Fehleranzeige) | component | CRUD | `ChildFormPage.tsx:84-150` | exakt |
| `frontend/src/features/manage/SetsPage.tsx` / `ChildFormPage.tsx` (Löschen-Knopf + Dialog) | component | CRUD | `SetDetailPage.tsx:41-48` (removeEntry) | Rolle |
| `frontend/src/features/learn/SessionPage.tsx` (Doppel-Tipp-Riegel) | component | request-response | `ChildFormPage.tsx:84, :124` | exakt |
| `frontend/src/lib/api.ts` (`refreshAccessToken` nur bei 400/401 abmelden) | utility | request-response | eigener Bestand, `api.test.ts` | exakt |
| `frontend/src/**/*.test.tsx` (neue Matrix-Tests) | test | CRUD | `ChildFormPage.test.tsx:17-30, :89-240, :247-280` | exakt |
| `frontend/e2e/{manage,children,keyboard-zoom}.spec.ts` | test (e2e) | request-response | `keyboard-zoom.spec.ts:9-135`, `axe.ts`, `manage.spec.ts:119` | exakt |
| `frontend/e2e/docker-compose.e2e.yml` (Kommentar zu Auth-Limit) | config | – | eigener Bestand `:41-44` | exakt |

## Pattern Assignments

### `LearningConfigurations.cs` (FKs ohne Navigation)

**Analogon:** `backend/src/WordQuest.Infrastructure/Configurations/ContentConfigurations.cs:20-24` und `:50-54` (bestehende FKs, beide `.OnDelete(DeleteBehavior.Cascade)`). Ziel `ReviewStateConfiguration` steht in `LearningConfigurations.cs:7-21`:

```csharp
builder.ToTable("review_state");
builder.HasKey(s => new { s.LearnerId, s.CardId });
...
// Der Index, auf dem jede Session-Zusammenstellung laeuft.
builder.HasIndex(s => new { s.LearnerId, s.DueAt });
```

Neu im selben Stil, ohne Navigationen in der Domänenklasse:
`builder.HasOne<Card>().WithMany().HasForeignKey(s => s.CardId).OnDelete(DeleteBehavior.Cascade);`
Constraint-Namen kommen automatisch über `ApplySnakeCaseNames` (`WordQuestDbContext.cs:80-83`). Kommentare auf Deutsch, Umlaute umschrieben (`laeuft`).

### `Migrations/<ts>_ReferentialIntegrity.cs`

**Analogon:** `Migrations/20260917045557_Initial.cs` (Tabellen-/Spaltennamen). Erzeugen per `dotnet ef migrations add ReferentialIntegrity --project src/WordQuest.Infrastructure --startup-project src/WordQuest.Api`. Einzige Hand-Ergänzung nach D-18: `migrationBuilder.Sql("DELETE FROM review_state WHERE ...")` am Anfang von `Up()`. Kommentar in `Down()`: gelöschte Waisen kommen nicht zurück. `.Designer.cs` und Snapshot bleiben unangetastet.

### `LearningService.cs`

**Analogon:** eigener Bestand. Heute werfen die Not-found-Pfade `InvalidOperationException` (`:41`, `:153`, `:156`, `:267`, `:345`), was 500 ergibt. Muster nach RESEARCH Pattern 2: `null` zurückgeben bzw. ein schmales Ergebnis, Mapping auf `IResult` im Endpoint. Kein `Result<T>` (AGENTS.md verbietet es). Block `:116-130` (ReviewState beim Start) streichen; `CreateInitialState` (`:191-193`, `:318-326`) bleibt der einzige Anlagepfad.

### `Program.cs` (ForwardedHeaders, Rate-Limiter)

**Analogon:** `backend/src/WordQuest.Api/Program.cs:114-125` (Limiter) und `:160-175` (Pipeline):

```csharp
options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
    _ => new FixedWindowRateLimiterOptions { PermitLimit = authRequestsPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, }));
...
app.UseExceptionHandler();
app.UseStatusCodePages();
...
app.UseRateLimiter();
```

`app.UseForwardedHeaders()` als erste Middleware vor `UseExceptionHandler` (`:160`). Konfiguration als `builder.Services.Configure<ForwardedHeadersOptions>(...)` neben dem Limiter. Fail-fast bei falscher Konfiguration wie `:110-113` (`throw new InvalidOperationException("Start abgebrochen: ...")`). Obsolete `KnownNetworks`-API meiden (RESEARCH Pitfall 2, `/warnaserror`).

### `AuthEndpoints.cs`

**Analogon:** `AuthEndpoints.cs:15` (`.RequireRateLimiting("auth")` an der Gruppe) und `:20` (`group.MapPost("/refresh", RefreshAsync);`). Änderung: `.DisableRateLimiting()` an `/refresh` und `/logout`.

### `SetEndpoints.cs` (PATCH Set, PATCH Eintrag)

**Analogon:** `LearnerEndpoints.cs:89-139` (`UpdateSettingsAsync`). Muster zum Kopieren:

```csharp
LearnerProfile? profile = await db.LearnerProfiles...FirstOrDefaultAsync(p => p.Id == learnerId, ct);
if (profile is null)
{
    return Results.NotFound();
}

// Alles pruefen, bevor etwas zugewiesen wird: eine abgelehnte Anfrage aendert nichts.
IReadOnlyList<LearnerProfileProblem> problems = AccountRules.ValidateLearnerProfile(...);
if (problems.Count > 0)
{
    return ValidationProblem(problems);
}
... Zuweisung ...
await db.SaveChangesAsync(ct);
return Results.Ok(new LearnerDto(...));
```

Registrierung wie `SetEndpoints.cs:22-25`: `group.MapPatch("/{setId:guid}", UpdateAsync).RequireAuthorization("Guardian");` und `group.MapPatch("/{setId:guid}/entries/{entryId:guid}", UpdateEntryAsync).RequireAuthorization("Guardian");`. Bestehende ValidationProblem-Form im selben File: `SetEndpoints.cs:49` und `:119` (`Results.ValidationProblem(new Dictionary<string, string[]> { ... })`). Feldnamen camelCase (`title`, `sourceText`, `targetText`), Grenze 200 aus `ContentConfigurations.cs:14, :35-36`. Request-DTOs als `sealed record` in `Contracts.cs` (Muster `Contracts.cs:97`). Mandantentrennung kommt über den Global Query Filter; fremde Sets liefern so 404.

### `LearnerEndpoints.cs` (DELETE Kind, Serie, Meisterschaft)

**Analogon DELETE:** `SetEndpoints.cs:73-85`:

```csharp
VocabularySet? set = await db.VocabularySets.FirstOrDefaultAsync(s => s.Id == setId, ct);
if (set is null)
{
    return Results.NotFound();
}

db.VocabularySets.Remove(set);
await db.SaveChangesAsync(ct);
return Results.NoContent();
```

Registrierung wie `LearnerEndpoints.cs:25`: `group.MapDelete("/{learnerId:guid}", DeleteAsync).RequireAuthorization("Guardian");`. Löschen über FK-Cascade, keine Löschlisten (D-06). Das Kind ist ein `User` mit `LearnerProfile`; der Plan legt fest, welche Zeile entfernt wird, damit Refresh-Tokens (`refresh_token.user_id`) mitgehen.

**Meisterschaft:** Die zwei Kopien `:204` und `:259` (`Repetitions >= 3 && EaseFactor >= 2.1 && Lapses <= 1`) durch einen Aufruf von `MasteryRules` ersetzen. Bei EF-Abfragen muss die Regel übersetzbar bleiben, also als `Expression<Func<ReviewState,bool>>` oder vorher materialisieren.

**Serie:** `Streak: gamification.CurrentStreak` (RESEARCH :214) durch `StreakRules.CurrentStreak(profile, scheduler.LocalDate(now))` ersetzen.

### `SessionEndpoints.cs` (404/409 mit Text)

**Analogon:** `LearnerEndpoints.cs:152-160` für deutsche Sätze mit echten Umlauten in `detail`. 409 nach RESEARCH Pattern 3: `Results.Problem(statusCode: StatusCodes.Status409Conflict, detail: "Diese Antwort ist schon angekommen.")`. 404 bekommt einen Body: `Results.Problem(statusCode: 404, detail: "...")` statt nacktem `Results.NotFound()` (`:52-56`, `:77-81`), damit das Frontend `ApiError.message` zeigt.

### `MasteryRules.cs` (neu, Domänenmodul Learning)

**Analogon:** `backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs:1-40`: `public static class`, XML-Doku auf Deutsch („Regeln ... stehen an genau einer Stelle ..."), Grenzwerte als dokumentierte `public const`, `ArgumentNullException.ThrowIfNull` am Einstieg. Keine EF- oder NuGet-Abhängigkeit (`using` nur auf `WordQuest.Modules.Learning.Entities`). Ort: `backend/src/WordQuest.Modules.Learning/Services/` neben `Sm2Scheduler.cs`.

### `StreakRules.cs` (+ aktuelle Serie)

**Analogon:** eigener Bestand `:1-40`:

```csharp
public static StreakResult RegisterActivity(GamificationProfile profile, DateOnly today)
{
    ArgumentNullException.ThrowIfNull(profile);
    RefillSaversIfNewMonth(profile, today);
    DateOnly? last = profile.LastActiveDate;
```

Neue Methode reiner Lese-Natur (verändert `profile` nicht), mit derselben Lückenlogik wie `:40-65` (`gap == 1`, `gap == 2 && StreakSaversLeft > 0`). XML-Doku zur Ortszeit wie `:13-17`.

### Backend-Integrationstests

**Analogon Factory:** `backend/tests/WordQuest.Api.Tests/ApiFactory.cs:15-60`. Isolationsregel (`:19-28`): Tests, die vom Datenbankstand abhängen oder den Limiter nutzen, bekommen eine eigene Factory pro Testfall:

```csharp
public sealed class RateLimitTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new ApiFactory();
    public Task InitializeAsync() => _factory.InitializeAsync();
    public Task DisposeAsync() => _factory.DisposeAsync().AsTask();
```

(`RateLimitTests.cs:14-22`). Alle anderen nutzen `IClassFixture<ApiFactory>` (`LearnerEndpointTests.cs:23`) mit eindeutigen Testdaten (Guid in E-Mail/Name). Seeding über `_factory.CreateSystemDbContext()` (`ApiFactory.cs:53-59`, Beispiel `RateLimitTests.cs:24-40`). Authentifizierte Clients per `_factory.CreateClientFor(owner)` (`LearnerEndpointTests.cs:64`). Testnamen im Stil `Name_with_101_characters_returns_400_not_500` (`:156`), Theorie-Fälle wie `:116-138`, Trennung zwischen Familien wie `Child_of_another_family_is_not_listed` (`:224-229`).

Pflicht-Anpassung: `LearnerEndpointTests.cs:480-484` seedet einen `ReviewState` mit zufälliger `CardId`. Mit dem neuen FK schlägt das fehl, deshalb Set, Eintrag und Karte mitseeden.

Kein Fake-Clock über `TimeProvider` (RESEARCH Pitfall 7). `LastActiveDate` direkt seeden.

### Domänen-Unit-Tests

**Analogon:** `backend/tests/WordQuest.Learning.Tests/GamificationTests.cs` (`LevelCurveTests` :7, `XpRulesTests` :50): je Regelklasse eine `public sealed class <Regel>Tests` mit `[Fact]`. `StreakRules`-Tests kommen in dieselbe Datei, `MasteryRulesTests` als neue Datei im Projekt.

### `frontend/src/components/ui/dialog.tsx` (neu)

**Analogon:** `frontend/src/components/ui/misc.tsx:1-12` (Radix-Primitive kapseln, `cn` + Token-Klassen):

```tsx
import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('type-label-section text-ink-soft', className)} {...props} />
}
```

`@radix-ui/react-dialog` ist installiert (`frontend/node_modules/@radix-ui/react-dialog`). Knöpfe über `Button` (`button.tsx:41`, Variante `danger` bei `:20`). Klassen nur aus DESIGN.md-Tokens (Glas-Sheet), kein Hex, keine Inline-Styles; `npm run design:classes` prüft das. `Dialog.Title` ist Pflicht, der Startfokus liegt auf „Abbrechen“ (RESEARCH Pattern 5). Kleingeschriebener Dateiname wie die übrigen Primitives.

### `SetDetailPage.tsx`, `SetsPage.tsx`, `ChildFormPage.tsx` (Formulare und Löschen)

**Analogon Formular:** `frontend/src/features/manage/ChildFormPage.tsx:84-150`:

```tsx
const busyRef = useRef(false)
...
async function handleSubmit(event: FormEvent) {
  event.preventDefault()
  // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
  if (busyRef.current) return
  ...
  const found = validate(...)
  if (Object.keys(found).length > 0) { showErrors(found); return }
  ...
  } catch (caught) {
    // Feldfehler des Servers am Feld, alles ohne Feldbezug im Hinweis ueber dem Button.
    const fieldErrors: Errors = caught instanceof ApiError ? { name: caught.errors?.displayName?.[0], ... } : {}
    if (fieldErrors.name || fieldErrors.pin) showErrors(fieldErrors)
    else setFailure(caught instanceof Error ? caught.message : 'Das hat nicht geklappt. Versuche es noch einmal.')
  } finally { busyRef.current = false; setBusy(false) }
}
```

Felder mit `Field` (`components/ui/field.tsx:16-40`, Render-Prop liefert `id`/`aria-describedby`; Beispiel `ChildFormPage.tsx:166`). Fehler- und Leerzustände mit `ErrorNote` / `SuccessNote` / `EmptyState` / `Spinner` (`misc.tsx:60-92`, Beispiel `ChildFormPage.tsx:66`). Imports nur über `@/…` (`ChildFormPage.tsx:3-9`).

**Analogon Mutation + Cache:** `SetDetailPage.tsx:27-48` (`useMutation` → `api<T>(path, { method, body })` → `invalidateQueries(['entries', setId])` und `['sets']`). Neu ist die fehlende Fehleranzeige: `addEntry.isError` / `removeEntry.isError` über `ErrorNote` (offene Phase-1-Notiz). Nach dem Löschen eines Kindes `['learners']` und `['profiles']` invalidieren (`ChildFormPage.tsx:118-119`).

### `SessionPage.tsx` (Doppel-Tipp)

**Analogon:** `busyRef`-Riegel aus `ChildFormPage.tsx:84, :124`, vor `answer.mutate`. Die Fehleranzeige gibt es schon (RESEARCH: `SessionPage.tsx:82-85, 139-147`).

### `api.ts` (`refreshAccessToken`)

**Analogon:** eigener Bestand (RESEARCH: `api.ts:96-99`) mit Tests in `src/lib/api.test.ts`. Den 429-Text nicht ändern (D-10).

### Frontend-Komponententests (Vitest)

**Analogon:** `frontend/src/features/manage/ChildFormPage.test.tsx`.
- `renderWithProviders(ui, { route, path, state })` aus `@/test/render` (`src/test/render.tsx:24-40`, frischer QueryClient ohne Retry, Fangroute zeigt Ziel und Meldung).
- Fetch-Stub, der die Bodies mitschreibt (`:17-27`):

```ts
function stubFetch(respond: () => Promise<Response>) {
  const bodies: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return respond()
  }))
  return bodies
}
```

- Für Seiten mit GET + PATCH: `stubEdit(patch, list)` (`:247-258`), `renderEdit` (`:260`), `fillEdit` (`:277`).
- Matrix-Reihenfolge wie `describe('Kind anlegen')` (`:89-240`): rotierende Einzelfehler (`:107`, `:128`), leeres Absenden mit Fokus (`:138`), Server-Feldfehler (`:150`, `:166`), Server nicht erreichbar (`:182`), Enter-Submit genau einmal (`:197`), Doppelklick genau eine Anfrage (`:205`), Happy Path zuletzt (`:222`). Fehlertexte exakt prüfen.

### e2e-Specs

**Analoga:**
- axe: `frontend/e2e/axe.ts` → `expectNoAxeViolations(page)` (`:7-21`), Glas-Kontrast `expectGlassContrast(page)` (`:26ff`). Einen Helfer `checkPage` gibt es nicht; diese beiden benutzen.
- Tastatur + 200 % Zoom: `frontend/e2e/keyboard-zoom.spec.ts` existiert. `zoomed = { width: 640, height: 400 }` (`:8`), `walkFocus` (`:17-57`), `expectKeyboardAtZoom(page, path)` (`:59-75`). Neue Seiten bzw. der Dialog kommen als weiterer `test(...)` in den Guardian-Block (`:94ff`, Muster `/verwalten/kinder/:id` bei `:123`, „Enter sendet das Formular“ bei `:96`, `:113`).
- Formularfluss mit Request-Zählung: `manage.spec.ts:119-170` (`page.on('request')` filtert `POST /entries`). Für PATCH/DELETE übernehmen.
- Kind-Flows: `children.spec.ts:32-80` (anlegen, bearbeiten, `learnerLogin` bei `:10`). Kind löschen und danach den Login-Versuch hier ergänzen.

## Gemeinsame Muster

### Fehlerform (Backend)
**Quelle:** `LearnerEndpoints.cs:152-160`, `SetEndpoints.cs:49, :119`. Gilt für alle Endpoints: `IResult`; Validierung gibt `Results.ValidationProblem` mit camelCase-Feldschlüsseln und ganzen deutschen Sätzen mit echten Umlauten zurück. „Nicht gefunden“ wird 404, Konflikte 409, nie 500. Erst alles prüfen, dann zuweisen.

### Regeln an einer Stelle
**Quelle:** `AccountRules.cs` + `LearnerProfileProblem.cs` (Enum der Befunde), Texte erst im Endpoint (`LearnerEndpoints.cs:150-160`). Gilt für MasteryRules, StreakRules und gegebenenfalls Set-/Eintrags-Längen.

### Autorisierung
**Quelle:** `LearnerEndpoints.cs:19-28`, `SetEndpoints.cs:14-27`: Gruppe `.RequireAuthorization()`, schreibende Routen `.RequireAuthorization("Guardian")`. Die Mandantentrennung läuft über Global Query Filters, deshalb in Endpoints kein `IgnoreQueryFilters`.

### Frontend-Fehler
**Quelle:** `ApiError(message, status)` aus `api<T>()`, Feldfehler über `caught.errors?.<feld>?.[0]` (`ChildFormPage.tsx:137-143`), Anzeige über `ErrorNote`.

## Kein Analogon

| Datei | Rolle | Datenfluss | Grund |
|---|---|---|---|
| Concurrency-Token (xmin) auf `SessionItem` + Fang von `DbUpdateConcurrencyException`/23505 | config/route | request-response | Im Projekt gibt es bisher weder Concurrency-Token noch Fang von `PostgresException`. RESEARCH Pattern 3 verwenden. |

## Metadaten

**Suchbereich:** `backend/src/WordQuest.{Api,Infrastructure,Modules.*}`, `backend/tests/*`, `frontend/src/{components/ui,features/manage,test,lib}`, `frontend/e2e`
**Gelesene Dateien:** etwa 20
**Alle genannten Pfade** sind getrackte Quellen bzw. neue Dateien. Gitignorierte Spiegel werden nicht genannt; `keyboard-zoom.spec.ts` ist noch untracked (Phase-1-Nachbesserung, nicht committet).
