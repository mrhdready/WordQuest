---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
# Coding Conventions

**Analysis Date:** 2026-10-24

Maßgeblich sind die Regeln in `AGENTS.md` (Abschnitt „Konventionen“). Dieses Dokument zeigt, wie sie im Code umgesetzt sind.

## Naming Patterns

**Files:**
- C#: ein Haupttyp pro Datei, Dateiname = Typname (`backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs`, `backend/src/WordQuest.Infrastructure/LearningService.cs`). Ausnahme: kleine Begleittypen in derselben Datei (`ReviewSnapshot`/`ReviewOutcome` in `Sm2Scheduler.cs`, `AuthFailedException` in `backend/src/WordQuest.Api/Auth/AuthService.cs`); DTOs gesammelt in `backend/src/WordQuest.Api/Contracts/Contracts.cs`.
- Endpoints: `<Bereich>Endpoints.cs` unter `backend/src/WordQuest.Api/Endpoints/` (`SetEndpoints.cs`, `SessionEndpoints.cs`, `LearnerEndpoints.cs`, `AuthEndpoints.cs`, `AccountEndpoints.cs`, `PictureEndpoints.cs`).
- Frontend-Seiten: PascalCase mit Suffix `Page` unter `frontend/src/features/<bereich>/` (`ChildFormPage.tsx`, `SessionPage.tsx`). Layout ohne Suffix-Pflicht: `ManageLayout.tsx`.
- UI-Primitives und Libs kleingeschrieben: `frontend/src/components/ui/button.tsx`, `frontend/src/lib/api.ts`.
- Tests neben der Datei: `<Name>.test.tsx` / `<name>.test.ts`; e2e: `frontend/e2e/<bereich>.spec.ts`.

**Functions:**
- C#: PascalCase; async-Methoden enden auf `Async` (`ListAsync`, `SeedFamilyAsync`). Endpoint-Registrierung als Extension `Map<Bereich>Endpoints(this IEndpointRouteBuilder app)`; Handler sind `private static` Methoden in derselben Klasse.
- TS: camelCase für Funktionen und Hooks; Komponenten als benannte `function`-Exports in PascalCase (`export function ChildrenPage()`).

**Variables:**
- C#: private Felder `_camelCase` (`_options`, `_factory`), Konstanten PascalCase (`DefaultServer`, `TestSigningKey`, `ChildPin`).
- TS: camelCase; modulweite Konstanten in UPPER_SNAKE (`ACCESS_KEY`, `UNREACHABLE` in `frontend/src/lib/api.ts`). Ungenutzte Variablen/Argumente mit `_` präfixen (ESLint erzwingt das, `frontend/eslint.config.js`).

**Types:**
- C#: Klassen standardmäßig `sealed`; DTOs/Werte als `sealed record` bzw. `readonly record struct` (`ReviewSnapshot`); Interfaces mit `I` (`ITenantContext`, `ITenantOwned` in `backend/src/WordQuest.Shared.Kernel/`).
- Enums mit expliziten Werten und XML-Doku pro Member (`backend/src/WordQuest.Shared.Kernel/Grade.cs`, `backend/src/WordQuest.Modules.Content/Services/ContentTextProblem.cs`).
- Fachbegriffe im Code: `VocabularyEntry`, `Card`, `ReviewState`, `Grade`, `LearningSession`.
- Entity-IDs: `Guid.CreateVersion7()` (z. B. `backend/src/WordQuest.Modules.Content/Entities/VocabularySet.cs`).
- TS: gemeinsame API-Typen in `frontend/src/types.ts`.

## Code Style

**Formatting:**
- Kein Prettier/kein Formatter-Tool im Frontend. Stil per Konvention: keine Semikolons, einfache Anführungszeichen, Trailing Commas, 2 Leerzeichen.
- `.editorconfig` (Repo-Root): UTF-8, LF, finale Newline; 4 Leerzeichen für `*.cs`, 2 für TS/JSON/CSS/YAML/MD/SH.
- C#-Regeln in `.editorconfig`: `file_scoped:warning` für Namespaces, Zugriffsmodifizierer Pflicht (`warning`), `var` nur bei offensichtlichem Typ, explizite Typen für Built-ins, `System`-Usings zuerst, `CA2007` aus.
- `backend/src/WordQuest.Infrastructure/Migrations/*.cs` sind als `generated_code` von den Stilregeln ausgenommen. Nie von Hand ändern.

**Linting:**
- Backend: `backend/Directory.Build.props` — `Nullable=enable`, `ImplicitUsings=enable`, `EnforceCodeStyleInBuild=true`, lokal `TreatWarningsAsErrors=false`; CI baut mit `/warnaserror`. Build muss warnungsfrei bleiben.
- Frontend: `frontend/eslint.config.js` (flat config) — `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended, `no-unused-vars` mit `^_`-Ausnahme.
- TypeScript strikt (`frontend/tsconfig.json`): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`.
- Design-Gate: `frontend/scripts/design-classes.mjs` (`npm run design:classes`) bricht ab bei alten Tailwind-Klassen, `style={`, Hex-Farben in Strings, Einzelfall-`px` (`-[..px]`) und `bg-glass*` ohne Fallback. `npm run design:check` prüft `DESIGN.md`-Lint und dass `frontend/src/design-tokens.css` dem Export entspricht.

## Import Organization

**Order (Frontend, beobachtet):**
1. Externe Pakete (`@tanstack/react-query`, `lucide-react`, `react-router-dom`)
2. Interne Module über `@/…` (`@/components/ui/...`, `@/lib/...`)
3. Typ-Importe mit `import type` (`import type { Learner } from '@/types'`)

**Order (C#):** `System.*` zuerst, dann `Microsoft.*`, dann `WordQuest.*` (`dotnet_sort_system_directives_first`).

**Path Aliases:**
- `@/*` → `frontend/src/*` (`frontend/tsconfig.json`, `frontend/vite.config.ts`). Nie `../` verwenden.

## Error Handling

**Backend:**
- Endpoints liefern `IResult`: `Results.ValidationProblem(Dictionary<string,string[]>)` mit Feldschlüssel wie im Request, `Results.NotFound`, `Results.Problem`. Konflikte und „nicht gefunden“ sind 4xx, nie unbehandelte 500.
- Längenprüfungen im Endpoint gegen Konstanten der Domänenregeln (`ContentRules.MaxDescriptionLength` in `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs`), damit nichts als Datenbankfehler endet.
- Domänenservices melden Befunde als Enum (`ContentTextProblem`, `LearnerProfileProblem`); die deutschen Texte vergibt der Aufrufer.
- Wenige eigene Exceptions für Kontrollfluss zwischen Service und Endpoint: `SessionCompletedException` (`backend/src/WordQuest.Infrastructure/SessionCompletedException.cs`), `AuthFailedException`, `RefreshConflictException` (`backend/src/WordQuest.Api/Auth/AuthService.cs`). Kein `Result<T>`.
- `ArgumentNullException.ThrowIfNull` am öffentlichen Einstieg von Domänenservices (31 Stellen in `backend/src`).
- Meldungen an Nutzer auf Deutsch in ganzen Sätzen.

**Frontend:**
- `api<T>()` in `frontend/src/lib/api.ts` wirft `ApiError(message, status, errors?)`; `errors` enthält Feldfehler aus `ValidationProblem`. Netzfehler → Status 0 mit deutschem Text (`UNREACHABLE`), Rate-Limit → `TOO_MANY`.
- Seiten zeigen Fehler mit `ErrorNote` aus `frontend/src/components/ui/misc.tsx` (`learners.isError ? <ErrorNote message={learners.error.message} /> : null`).
- Feldfehler mit `id="<input-id>-fehler"`, `aria-invalid` und `aria-describedby` (`frontend/src/components/ui/field.tsx`).
- Speicherzugriffe defensiv (`safeRead`/`safeWrite`, leerer `catch` mit Kommentar).

## Logging

**Framework:** `Microsoft.Extensions.Logging` (`ILogger`).

**Patterns:**
- Nur in Api/Infrastructure: `backend/src/WordQuest.Api/Program.cs`, `backend/src/WordQuest.Api/Auth/AuthService.cs`, `backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs`. Domänenmodule loggen nicht.
- Keine personenbezogenen Daten (E-Mail-Adressen) in Logs; `backend/tests/WordQuest.Api.Tests/StartupLogTests.cs` prüft Startlog-Ausgaben.
- Frontend: kein Logging-Framework.

## Comments

**When to Comment:**
- Kommentare erklären das *Warum*, auf Deutsch, Umlaute als `ae/oe/ue` umschrieben (`// Laenger endete sonst als Datenbankfehler (500, W-2).`). Nutzertexte in Strings behalten echte Umlaute.
- Verweise auf Konzept/Planung: `(Konzept §6.1)`, `(RESEARCH Pitfall 3)`, `(Review 02 MEDIUM)`, Entscheidungs-IDs wie `D-16`.

**XML-Doku / TSDoc:**
- C#: `/// <summary>` an öffentlichen Typen, Enum-Membern und nicht-trivialen Methoden (`Sm2Scheduler`, `ApiFactory`). `GenerateDocumentationFile=false`.
- TS: `/** … */` sparsam für Hilfsfunktionen (`renderWithProviders` in `frontend/src/test/render.tsx`), sonst Zeilenkommentare.

## Function Design

**Size:** Endpoints dünn: parsen, autorisieren (`RequireAuthorization("Guardian")`), aufrufen, mappen. Geschäftslogik in Modul-Services (`backend/src/WordQuest.Modules.*/Services/`) oder Infrastructure-Services (`LearningService.cs`, `AccountService.cs`, `PictureService.cs`).

**Parameters:** Minimal-API-Handler bekommen Request-DTO, `WordQuestDbContext`, `HttpContext` und `CancellationToken ct` injiziert. Domänenservices sind rein (z. B. `Sm2Scheduler` mit `SchedulerOptions` und `Random`), Zeit kommt als Parameter oder über `TimeProvider`.

**Return Values:** Endpoints `Task<IResult>`; Domänenservices Werte (`ReviewOutcome`) oder Enums für Befunde.

## Module Design

**Exports:**
- C#: Module `WordQuest.Modules.{Identity,Content,Learning,Gamification}` enthalten nur `Entities/` und `Services/`, ohne EF, HTTP oder NuGet. `WordQuest.Shared.Kernel` hält `Grade`, `ITenantContext`, `ITenantOwned`.
- Mandantengebundene Entitäten implementieren `ITenantOwned` und werden in `WordQuestDbContext` mit Global Query Filter registriert. `IgnoreQueryFilters()`/`SystemTenantContext` nur in Auth-, Start- und Seed-Code.
- TS: benannte Exports, keine Default-Exports in `src/` (Ausnahme: Konfig-Dateien, `frontend/e2e/global-setup.ts`).
- UI-Varianten mit `cva` + `cn()` (`frontend/src/components/ui/button.tsx`, `frontend/src/lib/utils.ts`); Radix-Primitives (`Slot`, Dialog, Label) als Basis.
- Datenzugriff in Seiten über TanStack Query (`useQuery({ queryKey: ['learners'], queryFn: () => api<Learner[]>('/learners') })`).

**Barrel Files:** Keine. Direkt aus der Datei importieren.

## Commits

- Deutsch mit Conventional-Präfix (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), optional mit Plan-/Task-ID im Scope (`fix(261023-k4m): …`). Atomar pro Anliegen.

---

*Convention analysis: 2026-10-24*
