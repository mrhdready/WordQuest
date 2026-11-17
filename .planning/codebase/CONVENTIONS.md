---
last_mapped_commit: 00d6615b8a97d9dc54b7a0451f777fbfa6e91621
last_mapped_at: 2026-10-26
---
# Coding Conventions

**Analysis Date:** 2026-10-26

Maßgeblich sind die Regeln in `AGENTS.md` (Abschnitt „Konventionen“). Dieses Dokument zeigt, wie sie im Code umgesetzt sind.

## Naming Patterns

**Files:**
- C#: ein Haupttyp pro Datei, Dateiname = Typname (`backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs`, `backend/src/WordQuest.Infrastructure/LearningService.cs`). Ausnahme: kleine Begleittypen in derselben Datei (`ReviewSnapshot`/`ReviewOutcome` in `Sm2Scheduler.cs`, `AuthFailedException` in `backend/src/WordQuest.Api/Auth/AuthService.cs`); DTOs gesammelt in `backend/src/WordQuest.Api/Contracts/Contracts.cs`.
- Endpoints: `<Bereich>Endpoints.cs` unter `backend/src/WordQuest.Api/Endpoints/` (`SetEndpoints.cs`, `SessionEndpoints.cs`, `LearnerEndpoints.cs`, `AuthEndpoints.cs`, `AccountEndpoints.cs`, `PictureEndpoints.cs`).
- CLI-Verben der API: `<Verb>Command.cs` bzw. `<Bereich>Commands.cs` direkt in `backend/src/WordQuest.Api/` (`TlsCommand.cs`, `AccountCommands.cs`), Startprüfungen als `<Thema>Check.cs` (`SecretCheck.cs`, `DemoAccountCheck.cs`).
- Frontend-Seiten: PascalCase mit Suffix `Page` unter `frontend/src/features/<bereich>/` (`ChildFormPage.tsx`, `SessionPage.tsx`). Layout ohne Suffix-Pflicht: `ManageLayout.tsx`.
- UI-Primitives und Libs kleingeschrieben: `frontend/src/components/ui/button.tsx`, `frontend/src/lib/api.ts`.
- Tests neben der Datei: `<Name>.test.tsx` / `<name>.test.ts`; e2e: `frontend/e2e/<bereich>.spec.ts`.
- Shell: Betriebsskripte im Repo-Root kleingeschrieben (`setup.sh`, `upgrade.sh`, `restore.sh`); Prüfskripte `<zweck>-smoke.sh` / `<zweck>-check.sh` unter `.planning/phases/<phase>/{smoke,gate}/`.

**Functions:**
- C#: PascalCase; async-Methoden enden auf `Async` (`ListAsync`, `SeedFamilyAsync`, `RunAsync`). Endpoint-Registrierung als Extension `Map<Bereich>Endpoints(this IEndpointRouteBuilder app)`; Handler sind `private static` Methoden in derselben Klasse.
- CLI-Verben als `public static class` mit `IsCommand(string[] args)` (List-Pattern, `args is ["tls", ..]`) und `RunAsync(...)` → Exit-Code `int`; Aufruf am Anfang von `backend/src/WordQuest.Api/Program.cs` vor bzw. nach `builder.Build()`. Argumente per List-Pattern parsen (`["tls", "watch" or "show", "--dir", string dir]`).
- TS: camelCase für Funktionen und Hooks; Komponenten als benannte `function`-Exports in PascalCase (`export function ChildrenPage()`).
- Bash: `snake_case`, definiert in Spalte 0 als `name() {` (einzeilig `name() { …; }`). Die Funktionsprüfung `.planning/phases/01-safe-home-network-install/smoke/setup-functions-check.sh` lädt sie per `awk` genau in dieser Form.

**Variables:**
- C#: private Felder `_camelCase` (`_options`, `_factory`), Konstanten PascalCase (`DefaultServer`, `TestSigningKey`, `ChildPin`).
- TS: camelCase; modulweite Konstanten in UPPER_SNAKE (`ACCESS_KEY`, `UNREACHABLE` in `frontend/src/lib/api.ts`). Ungenutzte Variablen/Argumente mit `_` präfixen (ESLint erzwingt das, `frontend/eslint.config.js`).
- Bash: Umgebungs-/Konfigwerte UPPER_SNAKE mit Präfix `WQ_` (`WQ_HTTPS_PORT`, `WQ_TLS_NAMES`), lokale Variablen kleingeschrieben.
- Umgebungsvariablen der App: Präfix `WQ_`; Secrets zusätzlich als `<NAME>_FILE` lesbar (`ReadSecret()` in `Program.cs`).

**Types:**
- C#: Klassen standardmäßig `sealed`; DTOs/Werte als `sealed record` bzw. `readonly record struct` (`ReviewSnapshot`); Interfaces mit `I` (`ITenantContext`, `ITenantOwned` in `backend/src/WordQuest.Shared.Kernel/`). Primärkonstruktoren sind üblich (`ManualTimeProvider(DateTimeOffset now)`), Sperren mit `System.Threading.Lock`.
- Enums mit expliziten Werten und XML-Doku pro Member (`backend/src/WordQuest.Shared.Kernel/Grade.cs`, `backend/src/WordQuest.Modules.Content/Services/ContentTextProblem.cs`).
- Fachbegriffe im Code: `VocabularyEntry`, `Card`, `ReviewState`, `Grade`, `LearningSession`.
- Entity-IDs: `Guid.CreateVersion7()` (z. B. `backend/src/WordQuest.Modules.Content/Entities/VocabularySet.cs`).
- TS: gemeinsame API-Typen in `frontend/src/types.ts` (auch von `frontend/e2e/*.spec.ts` per `import type` genutzt).

## Code Style

**Formatting:**
- Kein Prettier/kein Formatter-Tool im Frontend. Stil per Konvention: keine Semikolons, einfache Anführungszeichen, Trailing Commas, 2 Leerzeichen.
- `.editorconfig` (Repo-Root): UTF-8, LF, finale Newline; 4 Leerzeichen für `*.cs`, 2 für TS/JSON/CSS/YAML/MD/SH.
- C#-Regeln in `.editorconfig`: `file_scoped:warning` für Namespaces, Zugriffsmodifizierer Pflicht (`warning`), `var` nur bei offensichtlichem Typ, explizite Typen für Built-ins, `System`-Usings zuerst, `CA2007` aus. Collection-Expressions (`[]`, `["a", "b"]`) statt `new List<…>()`.
- `backend/src/WordQuest.Infrastructure/Migrations/*.cs` sind als `generated_code` von den Stilregeln ausgenommen. Nie von Hand ändern.
- Bash: `#!/usr/bin/env bash`, `set -euo pipefail`, Kopfkommentar mit Zweck und Aufruf, nur Bash-3.2-Mittel (macOS), `[[ … ]]`, Variablen in Anführungszeichen, `</dev/null` bei `docker compose exec`/`docker run` in Schleifen.

**Linting:**
- Backend: `backend/Directory.Build.props`: `Nullable=enable`, `ImplicitUsings=enable`, `EnforceCodeStyleInBuild=true`, lokal `TreatWarningsAsErrors=false`; CI baut mit `/warnaserror`. Build muss warnungsfrei bleiben.
- Frontend: `frontend/eslint.config.js` (flat config, `tseslint.config`): `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended, `@typescript-eslint/no-unused-vars` mit `^_`-Ausnahme für Argumente und Variablen; ignoriert `dist`, `dev-dist`, `node_modules`.
- TypeScript strikt (`frontend/tsconfig.json`): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`.
- Design-Gate: `frontend/scripts/design-classes.mjs` (`npm run design:classes`) bricht ab bei alten Tailwind-Klassen, `style={`, Hex-Farben in Strings, Einzelfall-`px` (`-[..px]`) und `bg-glass*` ohne Fallback. `npm run design:check` prüft `DESIGN.md`-Lint (`@google/design.md@0.4.0`, Warnungen zählen als Fehler) und dass `frontend/src/design-tokens.css` dem Export entspricht. Token-Datei nur per `npm run design:export` erzeugen.
- Shell: kein ShellCheck im Gate.

## Import Organization

**Order (Frontend, beobachtet):**
1. Node-Bordmittel mit `node:`-Präfix (nur in `frontend/e2e/`, Konfig): `import { X509Certificate } from 'node:crypto'`
2. Externe Pakete (`@tanstack/react-query`, `lucide-react`, `react-router-dom`, `@playwright/test`)
3. Interne Module über `@/…` (`@/components/ui/...`, `@/lib/...`)
4. Typ-Importe mit `import type` (`import type { Learner } from '@/types'`) oder inline `type` (`import { expect, test, type Page } from '@playwright/test'`)

**Order (C#):** `System.*` zuerst, dann `Microsoft.*`, dann `WordQuest.*` (`dotnet_sort_system_directives_first`).

**Path Aliases:**
- `@/*` → `frontend/src/*` (`frontend/tsconfig.json`, `frontend/vite.config.ts`). In `src/` nie `../`. Ausnahme: `frontend/e2e/` importiert Geschwister relativ (`./axe`, `./global-setup`, `./pictures`).

## Error Handling

**Backend:**
- Endpoints liefern `IResult`: `Results.ValidationProblem(Dictionary<string,string[]>)` mit Feldschlüssel wie im Request, `Results.NotFound`, `Results.Problem`. Konflikte und „nicht gefunden“ sind 4xx, nie unbehandelte 500.
- Längenprüfungen im Endpoint gegen Konstanten der Domänenregeln (`ContentRules.MaxDescriptionLength` in `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs`), damit nichts als Datenbankfehler endet.
- Domänenservices melden Befunde als Enum (`ContentTextProblem`, `LearnerProfileProblem`); die deutschen Texte vergibt der Aufrufer.
- Wenige eigene Exceptions für Kontrollfluss zwischen Service und Endpoint: `SessionCompletedException` (`backend/src/WordQuest.Infrastructure/SessionCompletedException.cs`), `AuthFailedException`, `RefreshConflictException` (`backend/src/WordQuest.Api/Auth/AuthService.cs`). Kein `Result<T>`.
- CLI-Verben melden über Exit-Code und eine deutsche Zeile auf stderr; Erfolgsmeldungen mit `✓` (`✓ Zertifizierungsstelle angelegt (gültig bis …).`). Fehlermeldungen nennen, was unverändert blieb, und wohin es weitergeht (`Es wurde nichts geändert. Wie es weitergeht, steht in der Installationsanleitung unter „…“.`). Falsche Argumente → Zeile `Aufruf: …`.
- `ArgumentNullException.ThrowIfNull` am öffentlichen Einstieg von Domänenservices.
- Meldungen an Nutzer auf Deutsch in ganzen Sätzen.

**Frontend:**
- `api<T>()` in `frontend/src/lib/api.ts` wirft `ApiError(message, status, errors?)`; `errors` enthält Feldfehler aus `ValidationProblem`. Netzfehler → Status 0 mit deutschem Text (`UNREACHABLE`), Rate-Limit → `TOO_MANY`.
- Seiten zeigen Fehler mit `ErrorNote` aus `frontend/src/components/ui/misc.tsx` (`learners.isError ? <ErrorNote message={learners.error.message} /> : null`).
- Feldfehler mit `id="<input-id>-fehler"`, `aria-invalid` und `aria-describedby` (`frontend/src/components/ui/field.tsx`).
- Speicherzugriffe defensiv (`safeRead`/`safeWrite`, leerer `catch` mit Kommentar).

**Shell (`setup.sh`, `upgrade.sh`, `restore.sh`):**
- Ausgabe nur über `say` (cyan), `warn` (gelb), `die` (rot, stderr, `exit 1`), definiert am Dateianfang von `setup.sh`.
- Wartefunktionen mit Zeitlimit melden einen verständlichen Abbruch statt Erfolg (`wait_https` → `WordQuest antwortet nicht über HTTPS.`).
- Idempotent: ein zweiter Lauf ändert Secrets und Konto nicht, `.env` nur bei geänderter Namensliste (`set_env`).

## Logging

**Framework:** `Microsoft.Extensions.Logging` (`ILogger`).

**Patterns:**
- Nur in Api/Infrastructure: `backend/src/WordQuest.Api/Program.cs`, `backend/src/WordQuest.Api/Auth/AuthService.cs`, `backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs`. Domänenmodule loggen nicht.
- Keine personenbezogenen Daten (E-Mail-Adressen) in Logs; `backend/tests/WordQuest.Api.Tests/StartupLogTests.cs` prüft Startlog-Ausgaben.
- CLI-Verben schreiben auf übergebene `TextWriter` (`Console.Out`/`Console.Error`), nicht über `ILogger`, damit Tests die Ausgabe einfangen können.
- Frontend: kein Logging-Framework.

## Comments

**When to Comment:**
- Kommentare erklären das *Warum*, auf Deutsch, Umlaute als `ae/oe/ue` umschrieben (`// Laenger endete sonst als Datenbankfehler (500, W-2).`). Nutzertexte in Strings behalten echte Umlaute.
- Verweise auf Konzept/Planung: `(Konzept §6.1)`, `(RESEARCH Pitfall 3)`, `(Review 02 MEDIUM)`, Anforderungs-/Entscheidungs-IDs wie `D-16`, `TLS-01`, `FIX-01`, `T-fpi-08`, Quick-IDs wie `(261025-fpi-03)`, Review-Befunde wie `(Codex 7)`.
- Testwerte in Konfigdateien ausdrücklich markieren (`# NUR FUER DEN TESTSTACK`, Passwörter mit `-nicht-fuer-betrieb` im Namen, `frontend/e2e/docker-compose.e2e.yml`).

**XML-Doku / TSDoc:**
- C#: `/// <summary>` an öffentlichen Typen, Enum-Membern und nicht-trivialen Methoden (`Sm2Scheduler`, `ApiFactory`, `TlsCommandTests`, `ManualTimeProvider`). `GenerateDocumentationFile=false`.
- TS: `/** … */` sparsam für Hilfsfunktionen (`renderWithProviders` in `frontend/src/test/render.tsx`), sonst Zeilenkommentare.
- Bash: Kopfkommentar je Skript mit Zweck, Bezug (IDs) und Aufrufzeile.

## Function Design

**Size:** Endpoints dünn: parsen, autorisieren (`RequireAuthorization("Guardian")`), aufrufen, mappen. Geschäftslogik in Modul-Services (`backend/src/WordQuest.Modules.*/Services/`) oder Infrastructure-Services (`LearningService.cs`, `AccountService.cs`, `PictureService.cs`). Zertifikatslogik getrennt von der CLI-Schleife (`TlsCertificates.cs` vs. `TlsCommand.cs`).

**Parameters:** Minimal-API-Handler bekommen Request-DTO, `WordQuestDbContext`, `HttpContext` und `CancellationToken ct` injiziert. Domänenservices sind rein (z. B. `Sm2Scheduler` mit `SchedulerOptions` und `Random`), Zeit kommt als Parameter oder über `TimeProvider`. CLI-Verben bekommen `args`, Ein-/Ausgabe-Writer und `TimeProvider` übergeben (testbar ohne Prozess).

**Return Values:** Endpoints `Task<IResult>`; Domänenservices Werte (`ReviewOutcome`) oder Enums für Befunde; CLI-Verben `Task<int>` (Exit-Code).

## Module Design

**Exports:**
- C#: Module `WordQuest.Modules.{Identity,Content,Learning,Gamification}` enthalten nur `Entities/` und `Services/`, ohne EF, HTTP oder NuGet. `WordQuest.Shared.Kernel` hält `Grade`, `ITenantContext`, `ITenantOwned`.
- Mandantengebundene Entitäten implementieren `ITenantOwned` und werden in `WordQuestDbContext` mit Global Query Filter registriert. `IgnoreQueryFilters()`/`SystemTenantContext` nur in Auth-, Start- und Seed-Code.
- Krypto nur mit der BCL (`PasswordHasher.cs`, `TokenHasher.cs`, X.509 in `TlsCertificates.cs`); keine Krypto-NuGets.
- TS: benannte Exports, keine Default-Exports in `src/` (Ausnahme: Konfig-Dateien, `frontend/e2e/global-setup.ts`).
- UI-Varianten mit `cva` + `cn()` (`frontend/src/components/ui/button.tsx`, `frontend/src/lib/utils.ts`); Radix-Primitives (`Slot`, Dialog, Label) als Basis.
- Datenzugriff in Seiten über TanStack Query (`useQuery({ queryKey: ['learners'], queryFn: () => api<Learner[]>('/learners') })`).

**Barrel Files:** Keine. Direkt aus der Datei importieren.

## Commits

- Deutsch mit Conventional-Präfix (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), Scope mit Plan-/Quick-ID (`fix(quick-261025-fpi): …`, `test(quick-261025-fpi-05): …`). Atomar pro Anliegen; Review-Befunde als eigener `fix(...)`-Commit.

---

*Convention analysis: 2026-10-26*
