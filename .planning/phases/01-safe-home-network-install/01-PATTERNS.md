# Phase 1: Safe Home-Network Install - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 27 (neu/geaendert, aus CONTEXT D-01…D-19, RESEARCH, UI-SPEC)
**Analogs found:** 23 / 27

Alle Analog-Pfade sind git-getrackt (`git ls-files`). Kommentare im Code deutsch mit `ae/oe/ue`, Nutzertexte laut UI-SPEC mit echten Umlauten.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/design-tokens.css` (neu, generiert) | config | transform (Build) | keine (Export aus `DESIGN.md`) | no analog |
| `frontend/src/index.css` (geaendert) | config | transform | sich selbst (Bestand `@theme`) | exact |
| `frontend/package.json` (Scripts `design:*`, `test`, `e2e`, Dev-Deps) | config | — | sich selbst, Zeilen 6-12 | exact |
| `frontend/vite.config.ts` (Block `test`) | config | — | sich selbst | exact |
| `frontend/src/components/ui/*.tsx` (Token-Umstellung) | component | — | `misc.tsx`, `input.tsx` | exact |
| `frontend/src/components/ui/field.tsx` (neu) | component | — | `misc.tsx` (`Label`, `ErrorNote`) + `input.tsx` | role-match |
| `frontend/src/lib/api.ts` (`ApiError.errors`, Netzfehler deutsch) | utility | request-response | sich selbst | exact |
| `frontend/src/types.ts` (Learner-Requests) | model | — | sich selbst | exact |
| `frontend/src/App.tsx` (4 Routen) | route | — | sich selbst, Zeilen 70-81 | exact |
| `frontend/src/features/manage/ManageLayout.tsx` (Tabs, `<main>`, `flex-wrap`) | component/layout | — | sich selbst | exact |
| `frontend/src/features/manage/ChildrenPage.tsx` (neu) | component (Seite) | CRUD-Read | `SetsPage.tsx` | exact |
| `frontend/src/features/manage/ChildFormPage.tsx` (neu, Anlegen+Bearbeiten) | component (Formular) | request-response | `GuardianLoginPage.tsx` + `SetDetailPage.tsx` (Zurueck-Link) | role-match |
| `frontend/src/features/manage/AccountPage.tsx` (neu) | component (Formular) | request-response | `GuardianLoginPage.tsx` | exact |
| `frontend/src/features/auth/ProfilePickerPage.tsx` (4-6 Ziffern, "Los geht’s", Tastatur FIX-08) | component | request-response | sich selbst | exact |
| alle uebrigen Seiten (`SetsPage`, `SetDetailPage`, `ProgressPage`, `LearnHomePage`, `SessionPage`, `GuardianLoginPage`) | component | — | Token-Umstellung, Gate-Grep RESEARCH Pitfall 1 | exact |
| `frontend/index.html` (Viewport ohne `user-scalable=no`) | config | — | sich selbst | exact |
| `frontend/src/test/setup.ts` (neu) | test | — | keine | no analog |
| `frontend/src/**/*.test.tsx` (neu) | test | — | keine Frontend-Tests; Struktur aus RESEARCH Code Examples | no analog |
| `frontend/e2e/*.spec.ts`, `frontend/playwright.config.ts` (neu) | test | — | keine | no analog |
| `backend/src/WordQuest.Infrastructure/AccountService.cs` (neu) | service | CRUD | `Infrastructure/LearningService.cs` + `Api/Auth/AuthService.cs` | role-match |
| `backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs` (bzw. `PinPolicy`/`PasswordPolicy`, neu) | utility (reine Regel) | transform | `Identity/Services/PasswordHasher.cs` | role-match |
| `backend/src/WordQuest.Api/Program.cs` (CLI-Verben, Secret-Pruefung, Service-Registrierung) | config/entry | batch | sich selbst, Zeilen 12-26, 136-156, 162-189 | exact |
| `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs` (PIN-Regel, Name, Limit beim Anlegen) | controller | CRUD | sich selbst | exact |
| Endpoint Passwort aendern (in `AuthEndpoints.cs` oder neu `AccountEndpoints.cs`) | controller | request-response | `LearnerEndpoints.cs` | exact |
| `backend/src/WordQuest.Api/Contracts/Contracts.cs` (Requests erweitern) | model (DTO) | — | sich selbst, Zeilen 25-39 | exact |
| `backend/tests/WordQuest.Api.Tests/` (neu, `WebApplicationFactory`) | test | request-response | `tests/WordQuest.Learning.Tests/*.csproj` + `LevenshteinTests.cs` | role-match |
| `docker-compose.quick.yml`, `setup.sh` (Secrets, Backup, Konto, `COMPOSE_FILE`) | config | file-I/O | `docker-compose.yml` Zeilen 20-60, 98-116; `setup.sh` Zeilen 10-36 | exact |

## Pattern Assignments

### `backend/src/WordQuest.Infrastructure/AccountService.cs` (service, CRUD)

**Analog:** `backend/src/WordQuest.Infrastructure/LearningService.cs` (Zeilen 1-26) — Primaerkonstruktor, `sealed`, Namespace `WordQuest.Infrastructure`, XML-Doku auf Deutsch:
```csharp
namespace WordQuest.Infrastructure;

/// <summary>
/// Orchestriert eine Lernsession: ...
/// Die eigentlichen Regeln liegen in den reinen Klassen des ... Moduls. Hier steht nur,
/// was dafuer aus der Datenbank kommt und was zurueckgeschrieben wird.
/// </summary>
public sealed class LearningService(
    WordQuestDbContext db,
    Sm2Scheduler scheduler,
    ...
    TimeProvider clock)
{
```
Unbekannte Entitaet → `?? throw new InvalidOperationException(...)` (Zeile 40-42); fuer "Konto unbekannt" im CLI lieber Rueckgabewert (null/bool) statt Exception, weil Exit-Code + UI-SPEC-Text.

**Token-Widerruf** aus `backend/src/WordQuest.Api/Auth/AuthService.cs:186-192` (bei Reset und Passwortwechsel):
```csharp
private async Task RevokeAllAsync(Guid userId, DateTimeOffset now, CancellationToken ct)
{
    await db.RefreshTokens
        .IgnoreQueryFilters()
        .Where(t => t.UserId == userId && t.RevokedAt == null)
        .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
}
```
E-Mail-Normalisierung wie `AuthService.cs:33`: `email.Trim().ToLowerInvariant()`. Hash: `PasswordHasher.Hash(...)` / `PasswordHasher.Verify(...)`. Zufallspasswort: `RandomNumberGenerator.GetString(choices, 16)`.
Registrierung in `Program.cs` neben Zeile 52-53: `builder.Services.AddScoped<AccountService>();`

---

### `backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs` (reine Regel)

**Analog:** `backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs` (Zeilen 1-16): `public static class`, keine NuGet/EF, Konstanten PascalCase, Doku warum.
```csharp
namespace WordQuest.Modules.Identity.Services;

/// <summary>PBKDF2-HMAC-SHA256. Bewusst ohne externe Abhaengigkeit ...</summary>
public static class PasswordHasher
{
    private const int SaltSize = 16;
```
Inhalt: `MinPasswordLength = 8`, PIN-Regex `^[0-9]{4,6}$` (nicht `\d`), Namenslimit 100. Optional `SecretCheck` (Name, Wert, IsDevelopment → Fehlertext/null) als reine Funktion fuer SETUP-05 — unit-testbar im Muster `LevenshteinTests` (`[Theory]`/`[InlineData]`). Hinweis: Unit-Test-Projekt referenziert Identity-Modul noch nicht (`WordQuest.Learning.Tests.csproj` Zeilen 7-12) → `ProjectReference` ergaenzen.

---

### `backend/src/WordQuest.Api/Program.cs` (Entry, Secret-Pruefung + CLI-Verben)

**Bestehende Fehlerform beim Start** (Zeilen 18-26) — Secret-Pruefung im selben Stil, Text aus UI-SPEC:
```csharp
string signingKey = ReadSecret("WQ_JWT_SIGNING_KEY", builder.Configuration["Auth:SigningKey"])
    ?? throw new InvalidOperationException(
        "Kein JWT-Signaturschluessel. WQ_JWT_SIGNING_KEY_FILE setzen oder setup.sh ausfuehren.");
```
Pruefung muss vor `BuildConnectionString` (Zeile 28) bzw. vor jedem DB-Zugriff greifen; Standardwerte: `"devpassword"` (Zeile 186), `wordquest`, `nur-zum-ausprobieren-…`, `entwicklungsschluessel-…` (RESEARCH Pattern 6). Bedingung `!builder.Environment.IsDevelopment()` (Muster Zeile 98).

**System-Kontext ohne Mandantenfilter** (Zeilen 136-147) — Vorlage fuer CLI-Verben zwischen `builder.Build()` (Zeile 107) und Start-Block:
```csharp
await using (AsyncServiceScope scope = app.Services.CreateAsyncScope())
{
    DbContextOptions<WordQuestDbContext> options =
        scope.ServiceProvider.GetRequiredService<DbContextOptions<WordQuestDbContext>>();
    // Fuer Migration und Seed bewusst ein eigener Kontext ohne Mandantenfilter ...
    await using var db = new WordQuestDbContext(options, new SystemTenantContext());
```
Verb-Skizze: RESEARCH Pattern 5 (`args is ["reset-password", string e] or ["create-owner", string e]`, `Environment.ExitCode`, `return`). Seed-Schalter Zeile 152 bleibt (D-16).

---

### `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs` + Passwort-Endpoint (controller)

**Gruppe + Policy** (Zeilen 18-24):
```csharp
RouteGroupBuilder group = app.MapGroup("/api/v1/learners")
    .WithTags("Learners")
    .RequireAuthorization();
group.MapPost("/", CreateAsync).RequireAuthorization("Guardian");
group.MapPatch("/{learnerId:guid}/settings", UpdateSettingsAsync).RequireAuthorization("Guardian");
```
Passwort-Endpoint analog mit `.RequireAuthorization("Guardian")`, Handler ruft `AccountService`, User-Id via `http.User.UserId()` (`ClaimsPrincipalExtensions`, genutzt Zeile 139).

**Validierungsfehler** (Zeilen 48-54) — Schluessel camelCase von Hand:
```csharp
if (string.IsNullOrWhiteSpace(request.DisplayName))
{
    return Results.ValidationProblem(new Dictionary<string, string[]>
    {
        ["displayName"] = ["Wie soll das Kind heissen? Ein Spitzname genuegt."],
    });
}
```
Neu: `["pin"] = ["Die PIN muss aus 4 bis 6 Ziffern bestehen."]`, `["displayName"] = ["Der Name darf höchstens 100 Zeichen lang sein."]` (D-15), `["currentPassword"] = ["Das aktuelle Passwort stimmt nicht."]` (400, nie 401 — `api.ts:122` wuerde Refresh ausloesen). Bestehender Text Zeile 52 bleibt (chirurgisch).
**Nicht gefunden** (Zeilen 95-98): `return Results.NotFound();`
**PIN setzen hebt Sperre auf** (Zeilen 117-122) — fuer Bearbeiten beibehalten:
```csharp
profile.PinHash = PasswordHasher.Hash(request.Pin);
profile.FailedPinAttempts = 0;
profile.PinLockedUntil = null;
```
Tageslimit klemmen (Zeile 104, `Math.Clamp(limit, 3, 15)`) auch fuer `CreateAsync` uebernehmen. `DisplayName` im Update: `profile.User!.DisplayName = request.DisplayName.Trim()` (User ist per `.Include(p => p.User)` geladen, Zeile 92).

---

### `backend/src/WordQuest.Api/Contracts/Contracts.cs` (DTO)

Zeilen 33-39, erweitern statt neu:
```csharp
public sealed record CreateLearnerRequest(string DisplayName, string? AvatarKey, string? Pin);

public sealed record UpdateLearnerSettingsRequest(
    int? DailyNewLimit,
    string? Speed,
    bool? SoundEnabled,
    string? Pin);
```
→ `CreateLearnerRequest` + `int? DailyNewLimit`; `UpdateLearnerSettingsRequest` + `string? DisplayName`; neu `ChangePasswordRequest(string CurrentPassword, string NewPassword)`.

---

### `backend/tests/WordQuest.Api.Tests/` (test, Integration)

**Analog:** `backend/tests/WordQuest.Learning.Tests/WordQuest.Learning.Tests.csproj` — gleiche Paketversionen (`Microsoft.NET.Test.Sdk 18.10.1`, `xunit 2.9.3`, `xunit.runner.visualstudio 4.0.0` mit dem Warn-Kommentar, `coverlet.collector 10.0.1`, `<Using Include="Xunit" />`), zusaetzlich `Microsoft.AspNetCore.Mvc.Testing 10.0.12` (D-13) und `ProjectReference` auf `WordQuest.Api`. In `backend/WordQuest.slnx` eintragen.
Testklassen: `public sealed class …Tests`, deutsche Warum-Kommentare (Muster `LevenshteinTests.cs`). Fallen: Rate-Limit 10/min (Pitfall 5), `CreateHost`/`ConfigureHostConfiguration` fuer Connection-String, Seed aus (Pitfall 6).

---

### `frontend/src/features/manage/AccountPage.tsx` / `ChildFormPage.tsx` (Formular)

**Analog:** `frontend/src/features/auth/GuardianLoginPage.tsx`
Imports (Zeilen 1-7):
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorNote, Label } from '@/components/ui/misc'
```
Submit als `try/catch` statt Mutation (offlineFirst, UI-SPEC "error") (Zeilen 18-30):
```tsx
async function handleSubmit(event: FormEvent) {
  event.preventDefault()
  setBusy(true)
  setError(null)
  try {
    await loginAsGuardian(email, password)
    navigate('/verwalten', { replace: true })
  } catch (caught) {
    setError(caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen.')
  } finally {
    setBusy(false)
  }
}
```
Struktur + Busy-Button (Zeilen 34-69): `Card > CardHeader > CardTitle`, `<form onSubmit className="flex flex-col gap-4">`, `{error ? <ErrorNote message={error} /> : null}`, `<Button type="submit" disabled={busy}>{busy ? 'Einen Moment …' : '…'}</Button>`. Abweichungen laut UI-SPEC: `noValidate`, `Field` statt `Label`+`Input`-Paar, Feldfehler aus `ApiError.errors`, Erfolg `role="status"`, kein `required`.
Nach Speichern: `void queryClient.invalidateQueries({ queryKey: ['learners'] })` (Muster `SetsPage.tsx:28`).
Zurueck-Link "Alle Kinder": `SetDetailPage.tsx:55-58` (`<Link …><ArrowLeft …/>Alle Sets</Link>`), optisch als `button-round` laut UI-SPEC.

---

### `frontend/src/features/manage/ChildrenPage.tsx` (Liste)

**Analog:** `frontend/src/features/manage/SetsPage.tsx` Zeilen 17-60:
```tsx
const sets = useQuery({
  queryKey: ['sets'],
  queryFn: () => api<VocabularySet[]>('/sets'),
})
if (sets.isLoading) return <Spinner />
...
<EmptyState title="Noch keine Vokabelsets" hint="Lege ein Set an — …" />
{sets.data?.map((set) => (
  <Link key={set.id} to={`/verwalten/sets/${set.id}`}>
    ...<ChevronRight className="h-5 w-5 text-ink-soft" />
```
→ `queryKey: ['learners']`, `api<Learner[]>('/learners')`, Zeile = `list-row` mit Avatar (`avatarFor` aus `@/lib/avatars`, wie `ProfilePickerPage.tsx:9`), `aria-hidden` auf Avatar/Icon.

---

### `frontend/src/components/ui/field.tsx` (component, neu)

**Analog:** `frontend/src/components/ui/misc.tsx` + `input.tsx` — Muster `ComponentProps` + `cn`:
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('…', className)} {...props} />
}
```
`Label` (misc.tsx 5-12) wiederverwenden; Fehlertext-`id="{feld}-fehler"`, `aria-invalid`, `aria-describedby`. Klassen nur Token (`type-*`, `text-danger-text`, `border-control`), `focus:outline-none` entfaellt (D6).

---

### `frontend/src/lib/api.ts` (utility)

`ApiError` (Zeilen 8-16) um `readonly errors?: Record<string, string[]>` erweitern; `readErrorMessage` (134-141) liest heute nur `detail ?? title` → `errors` mitlesen. `fetch` (Zeile 116) wirft bei Netzfehler `TypeError` → in `ApiError` mit UI-SPEC-Text "Der Server ist gerade nicht erreichbar. …" umwandeln.

---

### `frontend/src/features/auth/ProfilePickerPage.tsx`

Bestand Zeilen 12, 49-54 ersetzen:
```tsx
const PIN_LENGTH = 4
function press(digit: string) {
  if (busy || pin.length >= PIN_LENGTH) return
  const next = pin + digit
  setPin(next)
  if (next.length === PIN_LENGTH) void submit(next)
}
```
→ `MAX = 6`, kein Auto-Submit, Taste "Los geht’s" ab 4 Ziffern, `keydown`-Listener fuer Ziffern/Backspace/Enter (FIX-08). `submit()` (Zeilen 35-47) bleibt.

---

### `frontend/src/App.tsx` / `ManageLayout.tsx`

Routen unter `RequireGuardian` (App.tsx 78-80):
```tsx
<Route index element={<SetsPage />} />
<Route path="sets/:setId" element={<SetDetailPage />} />
<Route path="fortschritt" element={<ProgressPage />} />
```
→ `kinder`, `kinder/neu`, `kinder/:learnerId`, `konto`. Tabs-Array `ManageLayout.tsx:7-10` um `Users`/`KeyRound` ergaenzen; `<nav>` Zeile 27 → `aria-label="Bereiche"` + `flex-wrap`; `<Outlet />` Zeile 48 in `<main>`.

---

### `docker-compose.quick.yml` / `setup.sh` (config, file-I/O)

**Analog:** `docker-compose.yml` — api-Env (Zeilen ~33-50) mit `WQ_DB_PASSWORD_FILE: /run/secrets/db_password`, `WQ_JWT_SIGNING_KEY_FILE: /run/secrets/jwt_key`, `secrets: [db_password, jwt_key]`; `WQ_SEED_DEMO_DATA` weglassen. Dienst `backup` (Zeilen 98-116) woertlich:
```yaml
backup:
  image: prodrigestivill/postgres-backup-local:17
  environment:
    POSTGRES_HOST: db
    POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    SCHEDULE: "@daily"
    BACKUP_KEEP_DAYS: 14
    BACKUP_KEEP_WEEKS: 8
    BACKUP_KEEP_MONTHS: 6
  volumes:
    - ./backups:/backups
```
**setup.sh** Hilfen (Zeilen 10-12, 21-36) wiederverwenden: `say`/`warn`/`die`, `gen_secret`, Idempotenz "existiert bereits". Neue Prompts mit `read -rp` / `read -rsp` (Muster Zeile 48), Texte mit echten Umlauten (D-07), bestehende "fuer/unveraendert" angleichen. Konto: `printf '%s\n' "$pw" | docker compose exec -T api dotnet WordQuest.Api.dll create-owner "$email"`. `docker compose pull` (Zeile 71) bei Build-Overlay beachten (Pitfall 10).

## Shared Patterns

### Fehlerform API
**Source:** `LearnerEndpoints.cs:50-53`, `:97`. **Apply to:** alle neuen/geaenderten Endpoints. `Results.ValidationProblem` mit festem camelCase-Schluessel, `Results.NotFound()`, nie 500, nie 401 fuer falsches aktuelles Passwort.

### Mandanten/System-Kontext
**Source:** `Program.cs:145-147`, `AuthService.cs:189`. **Apply to:** CLI-Verben, `AccountService`-Pfade ohne Request. `IgnoreQueryFilters()`/`SystemTenantContext` nur dort.

### Krypto
**Source:** `Identity/Services/PasswordHasher.cs`. **Apply to:** Passwort, PIN, Reset. Nur BCL.

### Frontend-Formular
**Source:** `GuardianLoginPage.tsx:18-30, 39-69`. **Apply to:** AccountPage, ChildFormPage. `try/catch`, `busy`, ein `type="submit"`, "Einen Moment …".

### Styling
**Source:** `components/ui/*` mit `cn()` aus `@/lib/utils`. **Apply to:** alle UI-Dateien. Nur Token-Klassen; Gate-Grep RESEARCH Pitfall 1 muss 0 Treffer liefern; `misc.tsx:26` `style={{ width }}` → `<progress>`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/src/design-tokens.css` | config | transform | generiert; RESEARCH Pattern 1 (`design:export`/`design:check`) |
| `frontend/src/test/setup.ts`, `*.test.tsx` | test | — | kein Frontend-Testrunner im Bestand; RESEARCH Code Examples + Pitfalls 8/9 |
| `frontend/e2e/*.spec.ts`, `playwright.config.ts` | test | — | neu; RESEARCH "axe-Lauf mit Playwright", CDP fuer reduced-transparency |
| `index.css` `@utility glass` / `type-*` | config | — | kein Glas im Bestand; RESEARCH Patterns 2-4 |

## Metadata

**Analog search scope:** `backend/src`, `backend/tests`, `frontend/src`, `docker-compose*.yml`, `setup.sh`
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-16
