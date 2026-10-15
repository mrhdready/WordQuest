# Phase 1: Safe Home-Network Install - Research

**Researched:** 2026-10-15
**Domain:** Tailwind-4-Theme aus `DESIGN.md` (Liquid Glass), .NET-10-Minimal-API (Konten, CLI-Befehle, Secret-Prüfung), Docker-Compose-Heimnetzbetrieb mit Backup, Frontend-Tests (Vitest, Playwright, axe)
**Confidence:** HIGH für Bestand, Export-Verhalten, Tailwind-Auflösung und Tooling (in dieser Session ausgeführt); MEDIUM für Glas-Kontrast im echten Rendering; LOW nur bei den im Assumptions Log gelisteten Punkten

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ablauf
- **D-01:** Plan 1 ist DESIGN-01: Tailwind-Theme aus `DESIGN.md` exportieren (`npx @google/design.md export --format css-tailwind DESIGN.md`), Bausteine in `frontend/src/components/ui/` und alle Seiten auf die Tokens umstellen (Liquid Glass, Fallback, Abstands-Skala, A1–A12). Erst danach entstehen die neuen Formulare, damit sie gleich im neuen Design gebaut werden.
- **D-02:** Autonomer Lauf auf Branch `v1-fertig`: atomare Commits pro Plan erlaubt, **kein Push**.

#### Design
- **D-03:** `DESIGN.md` ist normativ (Liquid Glass für alles, deckender Fallback bei `prefers-reduced-transparency` und ohne `backdrop-filter`). Keine Inline-Styles, kein Hex im JSX, keine Einzelfall-`px`.
- **D-04:** `01-UI-SPEC.md` (Revision 2026-10-15) ist der UI-Vertrag; wo er `DESIGN.md` widerspricht, gilt `DESIGN.md`.

#### Konten und Secrets
- **D-05:** Passwort-Mindestlänge 8 Zeichen (App, `setup.sh`, Reset-Befehl) (UI-SPEC Q4).
- **D-06:** Reset-Befehl erzeugt ein Passwort und gibt es genau einmal aus; kein interaktives Tippen im Container (UI-SPEC Q5).
- **D-07:** Terminal-Texte in `setup.sh` mit echten Umlauten, bestehende Zeilen einmal angleichen (UI-SPEC Q6).

#### Kinder
- **D-08:** PAR-05: Kind anlegen im selben Formular wie Kind bearbeiten (Modus "Anlegen", PIN Pflicht, Button "Kind anlegen") (UI-SPEC Q3).
- **D-09:** PIN 4–6 Ziffern, serverseitig validiert; kein Auto-Absenden bei 4 Ziffern mehr, sondern Taste "Los geht’s" (UI-SPEC D9).

#### Tests und Werkzeuge
- **D-10:** Freigegebene neue Dev-Dependencies im Frontend: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `@axe-core/playwright`. Keine weiteren ohne Rückfrage.
- **D-11:** Formular-Tests mit Edge-Case-Matrix (ein Feld falsch, rotieren; exakte Fehlertexte; Enter-Submit eigener Pfad; Happy Path zuletzt) und axe 0 Verstöße (WCAG 2.2 AA) auf jeder berührten Seite, plus Tastatur-Durchgang und 200 % Zoom.
- **D-12:** Backend-Tests wie im Bestand: Unit-Tests für Domänenlogik, Integrationstests mit `WebApplicationFactory` gegen echtes PostgreSQL. Gate läuft in Docker (`mcr.microsoft.com/dotnet/sdk:10.0`, `node:22-alpine`), weil der Host kein .NET-SDK hat.

### Claude's Discretion
- Schnitt der Pläne nach Plan 1, Reihenfolge der Backend-Arbeiten, Form des Backup-Containers (Rahmen: einfach für Laien, keine neue Infrastruktur über Docker Compose hinaus).

### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md enthält keinen Abschnitt "Deferred Ideas". Außerhalb des Scopes laut REQUIREMENTS.md/ROADMAP.md: FIX-08 und FIX-09 (Phase 2), alles aus v2 und "Out of Scope".
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DESIGN-01 | Frontend folgt `DESIGN.md`: Theme aus `DESIGN.md` exportiert, Komponenten/Seiten nur mit Tokens, axe 0 WCAG-2.2-AA-Verstöße auf jeder Seite | Export-Fallen (Font-Strings, `max-w-*`-Kollision, `font-*`-Doppelbelegung) belegt; Muster `design-tokens.css` + Namespace-Reset + `type-*`/`glass`-Utilities kompiliert; Inventar alter Klassen; axe-Grenze bei Verläufen; Kontrast-Rechnung |
| SETUP-01 | HTTP-Heimnetz als vollwertiger Betrieb: `setup.sh` erzeugt DB-Passwort und JWT-Schlüssel, tägliches Backup | `docker-compose.quick.yml` auf Secret-Dateien + bestehenden `backup`-Dienst aus `docker-compose.yml`; `COMPOSE_FILE` in `.env` belegt |
| SETUP-02 | Keine Demo-Zugangsdaten; `setup.sh` fragt E-Mail/Passwort und legt das Konto an | CLI-Verb `create-owner` im API-Binary, Passwort per stdin; `WQ_SEED_DEMO_DATA` Default aus |
| SETUP-03 | Elternteil ändert Passwort in der App | Endpoint unter Guardian-Policy, Fehler als 400 `ValidationProblem` (`currentPassword`), Logik in Infrastructure-Service |
| SETUP-04 | Operator setzt Passwort mit einem CLI-Befehl im Container zurück | `docker compose exec api dotnet WordQuest.Api.dll reset-password <E-Mail>`; Positions-Argumente werden von der Konfiguration ignoriert (Quelltext gelesen) |
| SETUP-05 | Außerhalb Development startet die API nicht mit fehlenden/Standard-Secrets | Liste der bekannten Standardwerte aus dem Bestand; Prüfung vor DB-Zugriff; Nachweis per `docker run` des Images |
| SETUP-06 | erledigt (Quick 261006-r7l) | nur Regressionsschutz: Secret-Dateien bleiben `0644` in `0700`-Verzeichnis |
| FIX-07 | erledigt (Quick 261006-r7l), axe offen | axe-Lauf auf `/lernen` im Playwright-Harness von DESIGN-01 |
| PAR-01 | Kind bearbeiten (Name, PIN zurücksetzen, Tageslimit) | `UpdateLearnerSettingsRequest` um `DisplayName` erweitern; DB-Limit 100 Zeichen beachten |
| PAR-02 | PIN 4–6 Ziffern serverseitig | `^[0-9]{4,6}$` (nicht `\d`), Schlüssel `pin`, gilt für Anlegen und Bearbeiten; Integrationstest gegen echte API |
| PAR-05 | Kind anlegen (Name, PIN, Tageslimit) | `CreateLearnerRequest` um `DailyNewLimit` erweitern, PIN Pflicht |
| QUAL-02 | Formulartests mit Edge-Case-Matrix + axe | Vitest-Einbau in bestehende `vite.config.ts`, manuelles `cleanup`, `fetch`-Stub; Playwright + AxeBuilder gegen gebauten Stack |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Projektsprache Deutsch (Doku, Commits, Kommentare, Nutzertexte); Bezeichner englisch. Kommentare im Code mit `ae/oe/ue` wie im Bestand; Nutzertexte nach UI-SPEC mit echten Umlauten (UI-SPEC-Copy ist Vertrag).
- Kein Commit/Push ohne Freigabe; hier gilt D-02 (Commits pro Plan erlaubt, kein Push). Neue Dependencies nur mit Freigabe (Frontend-Liste D-10; Backend: keine Liste, siehe Open Questions).
- Einfachheit zuerst; Leiter: nötig? → Bestand → stdlib → Plattform → installierte Dependency → eigener Code.
- DDD-light: Module ohne EF/HTTP/NuGet; Geschäftslogik in Modul-Services oder Infrastructure-Service (Muster `LearningService`), nie in Endpoints. Keine Repositories, Domain Events, `Result<T>`.
- Endpoints liefern `IResult`; „nicht gefunden“/Konflikte als 4xx, nie unbehandelter 500. Meldungen deutsch, ganze Sätze.
- Mandantentrennung über EF Global Query Filters; `IgnoreQueryFilters()`/`SystemTenantContext` nur in Auth- und Start-/Seed-Code (CLI-Verben zählen zu Start-/Wartungscode).
- Krypto nur BCL: PBKDF2 (`PasswordHasher.cs`), SHA256 (`TokenHasher.cs`). Secrets über `ReadSecret()` (`<NAME>_FILE` zuerst).
- Logging nur Api/Infrastructure, keine personenbezogenen Daten (keine E-Mail-Adressen) in Logs.
- C#: `sealed`, `sealed record` für DTOs, `Async`-Suffix, `_camelCase`, ein Haupttyp pro Datei, `Guid.CreateVersion7()`, Build ohne Warnungen (`/warnaserror`).
- TS: keine Semikolons, einfache Anführungszeichen, Trailing Commas, Importe über `@/…`, `import type`.
- Design: `DESIGN.md` normativ; abgeleitete Dateien aus `DESIGN.md` erzeugen, nicht von Hand angleichen; Gate `npx @google/design.md lint DESIGN.md` + Export, Kontrast-Warnungen blockierend; bei Änderungen an `DESIGN.md` vorher `npx @google/design.md diff`.
- Gate: `dotnet build backend/WordQuest.slnx -c Release /warnaserror`, `dotnet test …`, `cd frontend && npm ci && npm run lint && npm run typecheck && npm run build`; UI zusätzlich axe (WCAG 2.2 AA) + Tastatur + 200 % Zoom; Commit-Trailer `A11y-Check:`.
- Jede Code-Änderung bekommt vor der Fertig-Meldung ein Review durch einen Subagenten (Projektentscheidung 2026-09-24).
- Doku in `Documentation/` und `README.md` muss dem Code entsprechen; Verhaltensänderung → Doku in derselben Änderung.
- `AGENTS.md`/`.claude/CLAUDE.md` nicht mit `<!-- GSD:…-start -->`-Markern versehen.

## Summary

Der Bestand trägt die Phase weitgehend: `docker-compose.yml` hat bereits Secret-Dateien und einen täglichen Backup-Dienst, `ReadSecret()` liest Dateien, `PasswordHasher` ist fertig, `Program` ist für `WebApplicationFactory` vorbereitet. Es fehlen: ein Weg, ein Konto ohne HTTP-Endpunkt anzulegen und zurückzusetzen, eine Startprüfung für Standard-Secrets, PIN- und Namensregeln am Server, die HTTP-Variante mit Secrets und Backup, Frontend-Testwerkzeuge und das neue Design.

Der wichtigste Befund betrifft DESIGN-01: Der Export von `@google/design.md` 0.4.0 lässt sich **nicht** unverändert als Tailwind-Theme verwenden. Er setzt Schrift-Stapel als einen CSS-String (Schrift fällt auf den Browser-Standard zurück), die benannten Abstände `xs…3xl` kapern `max-w-md`/`max-w-3xl` (16 px bzw. 64 px statt Containerbreite), und `font-headline` setzt nur die Schriftfamilie, nie das Gewicht. Alle drei Effekte wurden in dieser Session mit Tailwind 4.3.3 kompiliert und belegt; das Muster in „Architecture Patterns“ (generierte Datei + Namespace-Reset + zwei kleine `@utility`-Blöcke) löst sie ohne Handpflege der Token-Werte.

Für axe gilt: Über dem Verlaufs-Hintergrund meldet axe `color-contrast` als „incomplete“ (`bgGradient`), nicht als Verstoß. „0 Verstöße“ beweist auf Glas also keinen Kontrast. Die Rechnung mit den exportierten Farben zeigt: Text auf Glas ab 50 % hält 4,5:1 auch am ungünstigsten Blob (knapp: `primary` 4,57:1, `border-control` 3,11:1 inkl. `saturate(200%)`); `primary` als Text auf `glass-clear` (32 %) fällt mit 3,88:1 durch. Der Planer braucht deshalb einen zusätzlichen axe-Lauf mit einfarbigem Hintergrund je Blob-Farbe.

**Primary recommendation:** Generierte `frontend/src/design-tokens.css` (Export + `sed` für die Font-Zeilen, eingecheckt, Drift-Check im Gate) plus Theme-Reset und `type-*`/`glass`-Utilities in `index.css`; Konto-Logik in einem `AccountService` (Infrastructure), aufgerufen von Endpoint und zwei CLI-Verben im API-Binary; `docker-compose.quick.yml` übernimmt Secrets und den `backup`-Dienst unverändert aus `docker-compose.yml`, `setup.sh` schreibt `COMPOSE_FILE` in `.env`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design-Tokens, Glas, Fallback | Browser / Client (CSS) | CDN/Static (nginx liefert Build) | Reines CSS; Tokens zur Build-Zeit in Tailwind |
| Passwort ändern (SETUP-03) | API / Backend | Browser (Formular, Spiegelprüfung) | Server prüft altes Passwort und Mindestlänge maßgeblich |
| Konto anlegen / Passwort-Reset (SETUP-02/04) | API-Binary als CLI (Container) | Host-Shell (`setup.sh`) | Kein HTTP-Endpunkt ohne Anmeldung; Vertrauensgrenze ist Host-Zugriff |
| Secret-Prüfung beim Start (SETUP-05) | API / Backend (Startcode) | Host (`setup.sh` erzeugt) | Muss vor jedem DB-Zugriff greifen |
| Secrets erzeugen, Betriebsmodus wählen (SETUP-01) | Host-Shell (`setup.sh`) | Docker Compose (Datei-Mounts) | Bestand: `setup.sh` + `secrets/` |
| Tägliches Backup | Docker Compose (Dienst `backup`) | Database / Storage | `pg_dump` gegen `db`, nicht über die API |
| Kind anlegen/bearbeiten, PIN-Regel (PAR-01/02/05) | API / Backend | Browser (Formular) | Server entscheidet (AGENTS.md); Frontend spiegelt |
| Kinder-Anmeldung „Los geht’s“ | Browser / Client | API (`/auth/learner-login`) | Nur Eingabelogik ändert sich |
| Formular- und axe-Tests | Testwerkzeuge (Vitest/jsdom; Playwright gegen Stack) | — | Kein Produktionscode |

## Standard Stack

### Core (alles bereits im Projekt)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss / @tailwindcss/vite | 4.3.3 (Lockfile) | Theme aus `@theme`, Utilities | Bestand `[VERIFIED: frontend/package-lock.json]` |
| @google/design.md (per `npx`, keine Dependency) | 0.4.0 | `lint`, `export --format css-tailwind`, `diff` | Vorgabe AGENTS.md; `npm view` liefert 0.4.0 `[VERIFIED: npm registry]` |
| ASP.NET Core / EF Core / Npgsql | 10.0.12 / 10.0.12 / 10.0.3 | API, Persistenz | Bestand `[VERIFIED: *.csproj]` |
| prodrigestivill/postgres-backup-local | Tag `17` | tägliches `pg_dump` mit Aufbewahrung | Bestand in `docker-compose.yml:98-116`; arm64 vorhanden `[VERIFIED: Docker Hub API]` |
| xunit / xunit.runner.visualstudio | 2.9.3 / 4.0.0 | Backend-Tests | Bestand `[VERIFIED: WordQuest.Learning.Tests.csproj]` |

### Supporting (neu)
| Library | Version (empfohlen) | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.3 | Testrunner in Vite-Konfig | Formular-Tests (QUAL-02); Peer `vite ^8` passt zu Vite 8.3.0 `[VERIFIED: npm registry]` |
| jsdom | 30.1.2 | DOM für Vitest | `environment: 'jsdom'`; Engines `^22.22.2` — Node 22 aktuell 22.23.3 `[VERIFIED: npm registry, nodejs.org]` |
| @testing-library/react | 16.3.3 | Rendern/Abfragen | Peer `@testing-library/dom ^10` ist **Pflicht-Peer** (nicht optional) `[VERIFIED: npm registry]` |
| @testing-library/user-event | 14.6.7 | Tippen, Enter, Klick | Enter-Submit-Pfad |
| @playwright/test | 1.64.0 | E2E gegen Stack | axe-Läufe, Tastatur, Zoom |
| @axe-core/playwright | 4.13.0 | axe im Browser | WCAG-2.2-AA-Tags |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 | `WebApplicationFactory` | API-Integrationstests (D-12) — **nicht in D-10, Freigabe nötig** |

Versionswahl: Für vitest, jsdom, user-event, @playwright/test und @axe-core/playwright ist die jeweils neueste Version jünger als 7 Tage (teils heute veröffentlicht); empfohlen ist die jeweils jüngste Version mit mindestens 7 Tagen Alter (Zahlen oben, `npm view <pkg> time`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `prodrigestivill/postgres-backup-local` | `postgres:17-alpine` mit Shell-Schleife (`pg_dump; sleep 86400`) | Kein Fremd-Image (letztes Update des Tags `17`: 2025-09-26), aber zweites Backup-Format neben `docker-compose.yml`; `restore.sh` (Phase 3) müsste beide kennen. Empfehlung: Bestand übernehmen. |
| CLI-Verb im API-Binary | eigener Reset-Endpunkt / Shell-SQL via `psql` | Endpunkt wäre ohne Anmeldung erreichbar; SQL koppelt Shell an Tabellennamen und Hash-Format |
| Testcontainers | Postgres als CI-Service / Docker-Netz im Gate | Testcontainers wäre neue Dependency und braucht Docker-Socket im SDK-Container |
| `@testing-library/jest-dom` | Assertions mit `expect(...).toBe(...)` und `getBy*` | jest-dom ist nicht freigegeben (D-10) |
| benannte Abstände `p-md` | Tailwind-Stufen `p-4` (= 16 px) | siehe Pattern 2: benannte Abstände kollidieren mit `max-w-*` |

**Installation:**
```bash
cd frontend
npm install -D vitest@5.0.3 jsdom@30.1.2 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/user-event@14.6.7 @playwright/test@1.64.0 @axe-core/playwright@4.13.0
npx playwright install chromium   # Browser-Binary, keine npm-Dependency
```

## Package Legitimacy Audit

Prüfung: `gsd-tools query package-legitimacy check --ecosystem npm …` (2026-10-15), `npm view`.

| Package | Registry | Age (latest) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| vitest | npm | 5.0.5 heute | 125 Mio./Woche | github.com/vitest-dev/vitest | SUS (too-new) | Flagged — 5.0.3 pinnen; checkpoint |
| @testing-library/react | npm | 16.3.3, 2026-08-27 | 70 Mio./Woche | github.com/testing-library/react-testing-library | OK | Approved |
| @testing-library/user-event | npm | 14.6.8, 2026-10-13 | 59 Mio./Woche | github.com/testing-library/user-event | SUS (too-new) | Flagged — 14.6.7 pinnen; checkpoint |
| @testing-library/dom | npm | 10.4.2, 2026-09-13 | 85 Mio./Woche | github.com/testing-library/dom-testing-library | OK | Pflicht-Peer von RTL, **nicht in D-10** → Freigabe |
| jsdom | npm | 30.1.3 heute | 114 Mio./Woche | github.com/jsdom/jsdom | SUS (too-new) | Flagged — 30.1.2 pinnen; checkpoint |
| @playwright/test | npm | 1.64.1, 2026-10-14 | 76 Mio./Woche | github.com/microsoft/playwright | SUS (too-new) | Flagged — 1.64.0 pinnen; checkpoint |
| @axe-core/playwright | npm | 4.14.0 heute | 14 Mio./Woche | github.com/dequelabs/axe-core-npm | SUS (too-new) | Flagged — 4.13.0 pinnen; checkpoint |
| Microsoft.AspNetCore.Mvc.Testing | NuGet | 10.0.12 vorhanden | — | github.com/dotnet/aspnetcore | nicht geprüft (Seam nur npm) | Freigabe nötig |

**Packages removed due to [SLOP] verdict:** keine
**Packages flagged as suspicious [SUS]:** alle nur wegen „too-new“ der jeweils neuesten Version; kein `postinstall` bei allen sieben (`signals.postinstall: null`). Planer setzt vor der Installation einen `checkpoint:human-verify` mit den gepinnten Versionen. Alle Namen stammen aus der Nutzerfreigabe D-10 bzw. offizieller Doku (Microsoft Learn für Mvc.Testing).

## Architecture Patterns

### System Architecture Diagram

```
 Host-Shell (Laie)                     Docker Compose (COMPOSE_FILE aus .env)
 ─────────────────                     ─────────────────────────────────────────
 ./setup.sh ──(1) secrets/*.txt 0644 in 0700 ──────────────► Datei-Mounts /run/secrets/*
     │      ──(2) .env (COMPOSE_FILE, Prefix, Port)
     │      ──(3) docker compose up -d ──► db (postgres:17-alpine) ◄── backup (@daily pg_dump → ./backups)
     │                                     ▲
     │                                     │ EF Core (Migration beim Start)
     │                                api (dotnet WordQuest.Api.dll)
     │                                 ├─ Start: Secret-Prüfung (SETUP-05) → Abbruch mit Namen des Secrets
     │                                 ├─ Verb create-owner/reset-password → AccountService → Exit-Code, stdout
     │                                 └─ HTTP: /api/v1/... (Guardian/Learner-Policies, Mandantenfilter)
     └─(4) printf pw | docker compose exec -T api dotnet WordQuest.Api.dll create-owner <mail>
                                            ▲
 Browser ── http://<host>:8080 ──► web (nginx) ── /api/ ──┘
   React: index.css (design-tokens.css + glass/type) → Seiten → api() → ApiError{message,status,errors}
```

### Recommended Project Structure (nur Neues/Geändertes)
```
frontend/
├── src/design-tokens.css          # GENERIERT aus DESIGN.md, nie von Hand ändern
├── src/index.css                  # Reset der Default-Namespaces, Import Tokens, @utility glass/type-*, Backdrop, Fokus
├── src/components/ui/field.tsx    # neu laut UI-SPEC
├── src/features/manage/…          # ChildrenPage, ChildFormPage (Anlegen+Bearbeiten), AccountPage
├── src/**/*.test.tsx              # Vitest (jsdom)
├── e2e/*.spec.ts                  # Playwright + axe gegen gebauten Stack
└── playwright.config.ts
backend/
├── src/WordQuest.Modules.Identity/Services/AccountRules.cs (oder PinPolicy/PasswordPolicy)  # reine Regeln
├── src/WordQuest.Infrastructure/AccountService.cs        # Owner anlegen, Passwort ändern/zurücksetzen
└── tests/WordQuest.Api.Tests/                            # neu: WebApplicationFactory + echtes PostgreSQL
```

### Pattern 1: Tokens generieren, nie von Hand angleichen
**What:** Export in eine eigene Datei, Font-Zeilen per `sed` reparieren, Datei einchecken, Drift im Gate prüfen.
**Warum:** Der Exporter wickelt jeden `fontFamily`-Wert in ein CSS-String-Literal (`cssStringLiteral` im Quelltext von 0.4.0) `[VERIFIED: @google/design.md dist/index.js, TailwindV4EmitterHandler]`. Ausgabe in dieser Session:
`--font-body-md: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif";` `[VERIFIED: npx @google/design.md@0.4.0 export]` — ein String in `font-family` ist ein einziger Familienname, der Stapel greift nicht `[ASSUMED: CSS-Fonts-Semantik]`.
`.dockerignore` schließt `*.md` aus (`DESIGN.md` fehlt im Docker-Build-Kontext) `[VERIFIED: .dockerignore]` → die generierte CSS-Datei muss eingecheckt sein.
```bash
# frontend/package.json → scripts (Pfad relativ zu frontend/)
"design:export": "npx -y @google/design.md@0.4.0 export --format css-tailwind ../DESIGN.md | sed -E 's/^(  --font-[a-z-]+): \"(.*)\";$/\\1: \\2;/' > src/design-tokens.css",
"design:check":  "npx -y @google/design.md@0.4.0 export --format css-tailwind ../DESIGN.md | sed -E 's/^(  --font-[a-z-]+): \"(.*)\";$/\\1: \\2;/' | diff - src/design-tokens.css"
```
Das `sed` trifft nur Zeilen mit Anführungszeichen; `--font-weight-*` sind Zahlen ohne Anführungszeichen `[VERIFIED: Exportausgabe]`. Nach `sed` enthielt die Datei 0 doppelte Anführungszeichen `[VERIFIED: grep -c]`.

### Pattern 2: Default-Namespaces leeren, Kollisionen zurücksetzen
**What:** Vor dem Token-Import Tailwinds Standardfarben, Schriftgrößen, Gewichte und Radien leeren; nach dem Import die sieben benannten Abstände `xs…3xl` zurücksetzen.
**Warum (alles mit Tailwind 4.3.3 kompiliert):**
- Mit den exportierten `--spacing-md`/`--spacing-3xl` wird `max-w-md` zu `max-width: var(--spacing-md)` (16 px) und `max-w-3xl` zu `var(--spacing-3xl)` (64 px) `[VERIFIED: @tailwindcss/node compile]`. Betroffen im Bestand: `ManageLayout.tsx:16` (`max-w-3xl`), `GuardianLoginPage.tsx:33` (`max-w-md`), sechs `max-w-lg` `[VERIFIED: grep]`.
- Nach `--spacing-xs: initial; … --spacing-3xl: initial;` löst `max-w-md` wieder auf `var(--container-md)` auf `[VERIFIED: compile]`. Die UI-SPEC nutzt ohnehin Tailwind-Stufen (`gap-1/2/4`, `p-6`, `mt-4`), die 1:1 der Skala 4/8/16/24/32/48/64 entsprechen (Stufen 1/2/4/6/8/12/16).
- Benannte Maße ohne Kollision bleiben nutzbar: `px-screen-margin`, `bottom-float-bottom`, `min-h-touch-min` `[VERIFIED: compile]`.
- Nach `--color-*: initial; --text-*: initial; --font-weight-*: initial; --radius-*: initial;` vor dem Import erzeugen `text-white`, `bg-red-500`, `text-sm`, `font-bold`, `rounded-2xl` **kein CSS** mehr, `bg-primary` funktioniert `[VERIFIED: compile]`. Achtung: Tailwind verwirft unbekannte Klassen still — Build, Lint und Typecheck bleiben grün (siehe Pitfall 1).
```css
/* frontend/src/index.css (Skizze) */
@import 'tailwindcss';
@theme { --color-*: initial; --text-*: initial; --font-weight-*: initial; --radius-*: initial; }
@import './design-tokens.css';
/* Benannte Abstaende kollidieren mit max-w-* (Containerbreiten); Skala laeuft ueber Tailwind-Stufen 1/2/4/6/8/12/16 */
@theme { --spacing-xs: initial; --spacing-sm: initial; --spacing-md: initial; --spacing-lg: initial; --spacing-xl: initial; --spacing-2xl: initial; --spacing-3xl: initial; }
```

### Pattern 3: Eine Schriftstufe = eine Klasse (`type-*`)
**What:** Funktionale Utility, die Größe, Zeilenhöhe, Gewicht und Laufweite aus den Token-Namensräumen zieht.
**Warum:** `font-headline` setzt nur `font-family: var(--font-headline)`; das Gewicht `--font-weight-headline` ist über `font-*` nicht erreichbar `[VERIFIED: compile]`. Zusätzlich behandelt `tailwind-merge` 3.7.0 `text-body-md` als Textfarbe: `cn('text-ink', 'text-body-md')` ergibt `"text-body-md"` — die Farbe geht verloren `[VERIFIED: twMerge-Lauf]`. `type-headline` kollidiert mit nichts (`cn('text-on-primary','type-headline')` behält beide) `[VERIFIED: twMerge-Lauf]`.
```css
@utility type-* {
  font-size: --value(--text-*);
  line-height: --value(--leading-*);
  font-weight: --value(--font-weight-*);
  letter-spacing: --value(--tracking-*);
}
```
Ergebnis: `type-display` mit vier Deklarationen, `type-body-md` ohne `letter-spacing` (kein Token) `[VERIFIED: compile]`. Schriftfamilie einmal global: `body { font-family: var(--font-body-md); }`.

### Pattern 4: Glas mit Pflicht-Fallback als eine Utility
```css
@utility glass {
  background-color: var(--color-glass);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  backdrop-filter: blur(28px) saturate(200%);
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background-color: var(--color-glass-opaque);
  }
  @media (prefers-reduced-transparency: reduce) {
    background-color: var(--color-glass-opaque);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```
Kompiliert unverändert in `@layer utilities` `[VERIFIED: compile]`. Varianten (`glass-clear`, `glass-sheet`, `glass-selected`) gleich gebaut oder als `glass-*`-Funktionsutility über `--value(--color-glass-*)`. Werte `blur(28px) saturate(200%)`, Schatten und Lichtkante stehen in `DESIGN.md` nur als Prosa (Abschnitt „Elevation & Depth“); die Spezifikation sieht für Elevation genau das vor („defines the required styling (spread, blur, color)“) `[VERIFIED: @google/design.md dist/spec.md:254-258]`. Sie gehören einmal zentral in `index.css`, nicht in Komponenten.
Browser: `-webkit-backdrop-filter` ab Safari 9, unpräfixiert ab Safari 18; `prefers-reduced-transparency` ab Chrome 118, Firefox nur hinter Flag, **Safari/iOS gar nicht** `[VERIFIED: mdn/browser-compat-data]`. Auf iPads greift „Transparenz reduzieren“ also nicht.

### Pattern 5: CLI-Verben im API-Binary (SETUP-02/04)
**What:** `Program.cs` verzweigt nach `builder.Build()` und vor dem Start-Block, wenn `args` ein Verb tragen; nutzt einen `WordQuestDbContext` mit `SystemTenantContext` wie der Start-Block (`Program.cs:142-147`) und ruft `AccountService`.
**Warum sicher:** `WebApplication.CreateBuilder(args)` gibt `args` an den Kommandozeilen-Provider; Argumente ohne Präfix und ohne `=` werden ignoriert („Ignore invalid formats“) `[VERIFIED: dotnet/runtime CommandLineConfigurationProvider.cs, Load()]`. `reset-password eltern@example.de` wird also nicht zur Konfiguration.
Aufruf: Image-Einstieg ist `ENTRYPOINT ["dotnet", "WordQuest.Api.dll"]`, Arbeitsverzeichnis `/app`, Benutzer `wordquest` `[VERIFIED: backend/Dockerfile:26,39,45]`; `docker compose exec` erbt Umgebung und Secret-Mounts des laufenden Containers `[ASSUMED]`.
```csharp
// Program.cs, nach builder.Build() (Skizze; Verbnamen sind Empfehlung)
if (args is ["reset-password", string resetEmail] or ["create-owner", string ownerEmail])
{
    await using var db = new WordQuestDbContext(
        app.Services.GetRequiredService<DbContextOptions<WordQuestDbContext>>(), new SystemTenantContext());
    var accounts = new AccountService(db, TimeProvider.System);
    Environment.ExitCode = args[0] == "reset-password"
        ? await AccountCommands.ResetPasswordAsync(accounts, resetEmail, Console.Out)
        : await AccountCommands.CreateOwnerAsync(accounts, ownerEmail, Console.In, Console.Out);
    return;
}
```
`create-owner` liest das Passwort aus stdin (`Console.In.ReadLine()`), damit es weder in der Prozessliste noch in der Shell-History steht; `setup.sh`: `printf '%s\n' "$pw" | docker compose exec -T api dotnet WordQuest.Api.dll create-owner "$email"` (`printf` ist Bash-Builtin). Reset-Passwort per `RandomNumberGenerator.GetString(ReadOnlySpan<char> choices, int length)` (ab .NET 8) `[CITED: learn.microsoft.com/.../randomnumbergenerator.getstring]`, Alphabet ohne verwechselbare Zeichen (`0/O`, `1/l/I`), 16 Zeichen. Reset widerruft alle Refresh-Tokens des Kontos (Muster `RevokeAllAsync`, `AuthService.cs:186-192`).
E-Mail wie beim Login normalisieren: `email.Trim().ToLowerInvariant()` `[VERIFIED: AuthService.cs:33]`.

### Pattern 6: Secret-Prüfung vor jedem DB-Zugriff (SETUP-05)
Bekannte Standardwerte im Bestand (wörtlich):
- `string password = ReadSecret("WQ_DB_PASSWORD", "devpassword")!;` `[VERIFIED: Program.cs:186]`
- `POSTGRES_PASSWORD: ${WQ_DB_PASSWORD:-wordquest}` `[VERIFIED: docker-compose.quick.yml:26]`
- `WQ_JWT_SIGNING_KEY: ${WQ_JWT_SIGNING_KEY:-nur-zum-ausprobieren-bitte-nicht-im-echtbetrieb-verwenden}` `[VERIFIED: docker-compose.quick.yml:48]`
- `"WQ_JWT_SIGNING_KEY": "entwicklungsschluessel-bitte-nur-lokal-verwenden-32+"` `[VERIFIED: Properties/launchSettings.json:11]`
- `"ConnectionStrings": { "Default": "Host=localhost;Port=5432;Database=wordquest;Username=wordquest;Password=devpassword" }` `[VERIFIED: appsettings.Development.json:9-11]`
Regel: Wenn `!builder.Environment.IsDevelopment()` und Wert leer oder in obiger Liste → Abbruch mit UI-SPEC-Text, der den Variablennamen nennt. Die Prüfung als kleine reine Funktion (Name, Wert, IsDevelopment → Fehlertext oder null) ist unit-testbar; Ende-zu-Ende-Beleg per `docker run` des Images (kein DB-Zugriff nötig, weil die Prüfung vorher greift). Lücke: Wer `ConnectionStrings__Default` direkt setzt, umgeht `WQ_DB_PASSWORD` (`Program.cs:176-180`); für Phase 1 reicht der `WQ_*`-Pfad, weil Compose nur diesen nutzt.

### Pattern 7: Heimnetz-Compose = Bestand aus `docker-compose.yml`
- `db`/`api` auf `POSTGRES_PASSWORD_FILE` bzw. `WQ_DB_PASSWORD_FILE`/`WQ_JWT_SIGNING_KEY_FILE` mit `secrets:` umstellen, `WQ_SEED_DEMO_DATA` entfernen, Dienst `backup` wörtlich übernehmen (`SCHEDULE: "@daily"`, `BACKUP_KEEP_DAYS: 14`, `BACKUP_KEEP_WEEKS: 8`, `BACKUP_KEEP_MONTHS: 6`, `./backups:/backups`) `[VERIFIED: docker-compose.yml:98-116]`.
- Backup-Image läuft als root (kein `USER` im `debian.Dockerfile`) → Bind-Mount `./backups` ist ohne `chown` beschreibbar `[VERIFIED: raw debian.Dockerfile, grep USER leer]`. Ablage `daily/wordquest-YYYYMMDD.sql.gz` (Muster `daily/DB-YYYYMMDD.sql.gz`), manueller Lauf mit `/backup.sh` `[CITED: github.com/prodrigestivill/docker-postgres-backup-local README]`. Ziel muss POSIX-Dateisystem sein (kein SMB/exFAT) `[CITED: dto.]`.
- `setup.sh` schreibt `COMPOSE_FILE=docker-compose.quick.yml` in `.env`; danach funktionieren `docker compose exec api …` und später `upgrade.sh` ohne `-f` `[VERIFIED: docker compose v5.5.1, Testverzeichnis mit nur .env + other.yml → Dienst "hello" erkannt]`.

### Anti-Patterns to Avoid
- **Export direkt nach `index.css` kopieren:** bricht Schrift und `max-w-*` (Pattern 1/2).
- **`text-<stufe>` für Schriftgrößen:** `tailwind-merge` löscht daneben stehende Textfarben.
- **Glas pro Taste/Zeile:** 12 Ziffern-Tasten mit je eigenem `backdrop-filter` sind 12 Blur-Ebenen; auf günstigen Tablets prüfen (DESIGN.md Do's), notfalls Fallback.
- **Passwortprüfung im Endpoint:** Logik gehört in `AccountService`, Endpoint mappt nur.
- **401 bei falschem aktuellem Passwort:** `api()` versucht dann einen Refresh (`api.ts:122`); 400 `ValidationProblem` mit Schlüssel `currentPassword` verwenden (UI-SPEC).
- **`\d` in .NET-Regex für die PIN:** matcht auch nicht-lateinische Ziffern; `[0-9]` verwenden `[ASSUMED: .NET-Regex-Semantik]`.
- **Neues Konto per HTTP ohne Anmeldung („Setup-Wizard“):** ist v2 (ACC2-02), nicht Phase 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tailwind-Theme | handgepflegte `@theme`-Werte | `npm run design:export` + `design:check` | AGENTS.md: abgeleitete Dateien nur erzeugen |
| Tägliches Backup + Aufbewahrung | Cron/Shell-Schleife mit `find -mtime` | `prodrigestivill/postgres-backup-local` aus `docker-compose.yml` | gleiches Format für beide Modi, Phase 3 `restore.sh` |
| Compose-Datei merken | Wrapper-Skript pro Befehl | `COMPOSE_FILE` in `.env` | Compose liest es selbst |
| Passwort-Hash | neues Verfahren | `PasswordHasher.Hash/Verify` | Bestand, BCL |
| Zufallspasswort | `Random`/`Guid` | `RandomNumberGenerator.GetString` | kryptographisch |
| Fortschrittsbalken mit `style={{ width }}` | Inline-Style (`misc.tsx:26`) | natives `<progress>` mit CSS-Pseudo-Elementen | Inline-Styles verboten (D-03), Rolle eingebaut |
| Glas-Kontrastprüfung | eigenes Skript im Repo | axe mit einfarbigem Hintergrund je Blob (Pitfall 3) | axe rechnet Alpha-Stapel selbst |
| Browser-Emulation „reduzierte Transparenz“ | CSS-Hacks | CDP `Emulation.setEmulatedMedia` (Code Examples) | Playwright `emulateMedia` kennt die Option nicht |

**Key insight:** Fast alles, was die Phase braucht, existiert schon im Repo (`docker-compose.yml`, `PasswordHasher`, `ReadSecret`, `SystemTenantContext`, `Results.ValidationProblem`-Muster). Neu sind nur Verdrahtung, Regeln und Tests.

## Common Pitfalls

### Pitfall 1: Alte Klassen verschwinden still
**What goes wrong:** Nach dem Reset erzeugen `bg-surface-raised`, `text-white`, `text-sm`, `rounded-2xl` kein CSS; Seiten sehen kaputt aus, Gate ist grün.
**Inventar (2026-10-15, `frontend/src`):** 65 Treffer alter Farbnamen in Klassen (`surface`, `surface-raised`, `brand*`, `border-subtle`, `success*`, `warn*`, `danger*`) über 12 Dateien; `text-white` 3×; `rounded-2xl` 8×, `rounded-[var(--radius-card)]` 4×; Schriftgrößen `text-xs…6xl` 61×, Gewichte 37×; Abstände `-3` 25 Treffer/8 Dateien, `-5` 22/10, `-7` 1, `-10` 3/2; `style={{` 1× (`misc.tsx:26`) `[VERIFIED: grep]`.
**How to avoid:** Gate-Grep, der 0 Treffer verlangt, z. B. `grep -rnE '\b(bg|text|border|outline)-(surface|surface-raised|brand|brand-strong|brand-soft|border-subtle|success|success-soft|warn|warn-soft|danger|danger-soft|white)\b|\btext-(xs|sm|base|lg|[2-9]?xl)\b|\bfont-(medium|semibold|bold|extrabold|black)\b|rounded-(2xl|3xl|\[)|style=\{|\b-?(p|m)[xytblrse]?-(3|5|7|10)\b|\bgap(-[xy])?-(3|5|7|10)\b' frontend/src --include='*.tsx'`. Zusätzlich visuelle Prüfung im axe-Lauf.

### Pitfall 2: Schrift fällt auf Serifen zurück
**What goes wrong:** Exportierte `--font-*`-Werte sind Strings. **How to avoid:** `sed`-Schritt im Export-Skript; `design:check` erkennt Abweichung. **Warning sign:** Times-artige Schrift im Screenshot.

### Pitfall 3: axe meldet Glas-Kontrast nicht als Verstoß
**What goes wrong:** axe-core setzt bei Hintergrund-Verläufen `incomplete` mit Grund `bgGradient` (`elementHasImage` in `axe.js`) `[VERIFIED: axe-core 4.13.0 Paketquelle]`. Der Liquid-Glass-Hintergrund besteht aus Radialverläufen → Texte auf Glas landen in `incomplete`, nicht in `violations`.
**How to avoid:** (a) Hauptlauf: `violations` = 0 und `incomplete` (`color-contrast`) mit Anzahl ausweisen; (b) Kontrastlauf: per `page.addStyleTag` den Body-Hintergrund nacheinander auf jede Blob-Farbe einfarbig setzen (`--color-backdrop-blue` ist der ungünstigste) und `color-contrast` muss 0 Verstöße haben.
**Rechnung mit exportierten Farben, inkl. `saturate(200%)`, ungünstigster Blob `backdrop-blue`:** `ink` auf `glass` 11,62:1; `ink-soft` 6,45:1; `primary` 4,57:1; `danger-text` 4,62:1; `border-control` (Nicht-Text) 3,11:1. Auf `glass-clear` (32 %): `ink` 9,84:1, `ink-soft` 5,47:1, **`primary` 3,88:1 (zu wenig)**, `border-control` 2,63:1. Weiß auf `primary-light` 5,76:1 (Verlaufsbutton ok). `danger-text` auf `surface-error` 6,31:1 `[VERIFIED: eigenes Skript, WCAG-Formel, Werte aus dem Export]`. Folge: kein `primary`-Text und keine Feldgrenze auf `glass-clear`.

### Pitfall 4: Bestehende Schnelltest-Installationen
**What goes wrong:** `POSTGRES_PASSWORD_FILE` wirkt nur beim ersten Initialisieren des Volumes. Ein Volume aus dem alten `docker-compose.quick.yml` (Passwort `wordquest`, Projektname `wordquest-quick`) passt nicht zum neu erzeugten Secret → API kann sich nicht verbinden `[ASSUMED: Verhalten des offiziellen Postgres-Images]`.
**How to avoid:** Entscheidung nötig (Open Question 4): Hinweis „alter Schnelltest: `docker compose -f docker-compose.quick.yml down -v`“ oder Passwort per `psql ALTER USER` übernehmen.

### Pitfall 5: Rate-Limit in Integrationstests
**What goes wrong:** Policy `auth` erlaubt `PermitLimit = 10` pro Minute pro `RemoteIpAddress ?? "unknown"` `[VERIFIED: Program.cs:74-85]`; im TestServer ist die IP leer → alle Logins eines Testlaufs teilen sich 10 pro Minute → 429.
**How to avoid:** Wenige Logins, Token pro Testklasse wiederverwenden; Tests sequentiell gegen eine DB (Hausregel).

### Pitfall 6: Konfiguration im Test kommt zu spät
**What goes wrong:** Werte aus `ConfigureAppConfiguration` der Factory sind vor `Build()` nicht sichtbar `[CITED: learn.microsoft.com/aspnet/core/test/integration-tests]`; `Program.cs` liest den Connection-String vorher.
**How to avoid:** `CreateHost` überschreiben und `ConfigureHostConfiguration` nutzen (funktioniert, weil `Program.cs` `args` an `CreateBuilder` gibt) oder Umgebungsvariable `ConnectionStrings__Default` setzen. Standard-Umgebung der Factory ist `Development` `[CITED: dto.]` → Dev-Fallbacks und `WQ_SEED_DEMO_DATA: true` aus `appsettings.Development.json:12` greifen; Seed per Host-Konfiguration auf `false`.

### Pitfall 7: Namenslänge
**What goes wrong:** `DisplayName` hat `HasMaxLength(100)` `[VERIFIED: IdentityConfigurations.cs:25]`; ein längerer Name endet heute als unbehandelte DB-Ausnahme (500). Die UI-SPEC sagt „Der Server kennt kein Längenlimit“ — die Datenbank kennt eines.
**How to avoid:** Server prüft ≤ 100 Zeichen → 400 `displayName`; Text braucht Freigabe (Open Question 3).

### Pitfall 8: RTL räumt unter Vitest nicht automatisch auf
Automatisches `cleanup` nur, wenn das Framework ein globales `afterEach` bereitstellt `[CITED: testing-library.com/docs/react-testing-library/api#cleanup]`; Vitest tut das nur mit `globals: true` `[ASSUMED]`. Empfehlung: Setup-Datei mit `afterEach(cleanup)`.

### Pitfall 9: `fetch` in jsdom-Tests
`api()` ruft `fetch('/api/v1/...')` relativ auf (`api.ts:3,116`). Unter Vitest/Node gibt es keine Basis-URL → immer `vi.stubGlobal('fetch', …)` je Test; damit wird auch die neue `errors`-Zuordnung in `ApiError` mitgetestet `[ASSUMED]`.

### Pitfall 10: Images aus dem Branch existieren nicht in der Registry
`setup.sh` zieht `${WQ_IMAGE_PREFIX}-api:${WQ_VERSION:-master}`; die neuen CLI-Verben gibt es nur in lokal gebauten Images (kein Push, D-02). Für den Beleg: Overlay `docker-compose.build.yml` (passt auf `docker-compose.quick.yml`, gleiche Dienstnamen `api`/`web` `[VERIFIED: docker-compose.build.yml]`) und `COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml` als Shell-Variable vor `setup.sh`. Das explizite `docker compose pull` in `setup.sh:71` scheitert dann; `docker compose up -d` lädt fehlende Images selbst (Default `pull_policy: missing`) `[ASSUMED]` → `pull` durch `up -d` ersetzen oder überspringen, wenn Build-Overlay aktiv.

## Code Examples

### Vitest in bestehende `vite.config.ts`
```ts
// Source: vitest.dev/config ("add /// <reference types="vitest/config" /> to include the test types")
/// <reference types="vitest/config" />
// … bestehende Konfiguration unverändert, zusätzlich:
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
```
`src/test/setup.ts`: `import { afterEach } from 'vitest'`, `import { cleanup } from '@testing-library/react'`, `afterEach(cleanup)`. Skript `"test": "vitest run"`. `tsconfig.json` `include` deckt `src` und `vite.config.ts` schon ab `[VERIFIED: frontend/tsconfig.json]`; für `e2e/` und `playwright.config.ts` ergänzen.

### axe-Lauf mit Playwright
```ts
// Source: @axe-core/playwright README (AxeBuilder.withTags/analyze) [ASSUMED API-Form]
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('Konto: 0 WCAG-2.2-AA-Verstoesse', async ({ page }) => {
  await page.goto('/verwalten/konto')
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(result.violations).toEqual([])
})
```
Tags laut UI-SPEC „axe-Lauf“. Reduzierte Transparenz in Chromium: `const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })` — in dieser Session mit Chromium 153 geprüft: `matchMedia('(prefers-reduced-transparency: reduce)').matches` vorher `false`, nachher `true` `[VERIFIED: Playwright 1.64.0 Lauf]`. `page.emulateMedia` hat keine solche Option `[CITED: playwright.dev/docs/api/class-page#page-emulate-media]`.

### Testdaten für den axe-Lauf
Nach `setup.sh` (legt Elternkonto an) in `globalSetup` per `request`-Kontext: Login, Set + Einträge über `/api/v1/sets…`, Kind über `POST /api/v1/learners` anlegen; kein Demo-Seed nötig. Seiten: `/login`, `/` (Profilwahl und Ziffernfeld), Lernstart, `/lernen` (FIX-07-Nachweis), `/verwalten`, `/verwalten/sets/:id`, `/verwalten/fortschritt`, `/verwalten/kinder`, `/verwalten/kinder/neu`, `/verwalten/kinder/:id`, `/verwalten/konto`.

### `ValidationProblem` mit festem Schlüssel
```csharp
// Muster aus LearnerEndpoints.cs:50-53 (Bestand)
return Results.ValidationProblem(new Dictionary<string, string[]>
{
    ["pin"] = ["Die PIN muss aus 4 bis 6 Ziffern bestehen."],
});
```
Schlüssel bleiben wie geschrieben (camelCase von Hand); Texte aus UI-SPEC „Felder, Hilfetexte und Fehlertexte“. Das Frontend liest heute nur `detail ?? title` (`api.ts:134-141`); `title` einer `ValidationProblem`-Antwort ist englisch → `ApiError` um `errors` erweitern (UI-SPEC „Hinweise für den Planer“).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | `@theme` in CSS, `@utility` mit `--value()` | Tailwind 4 | Token-Datei direkt importierbar |
| PIN fix 4 Stellen, Auto-Absenden (`PIN_LENGTH = 4`, `ProfilePickerPage.tsx:12`) | 4–6 Ziffern, Taste „Los geht’s“ | diese Phase | Kinder mit 4 Ziffern brauchen einen Tipp mehr (UI-SPEC) |
| Schnelltest mit Klartext-Passwörtern und Demo-Daten | Heimnetz-Betrieb mit Secret-Dateien, Backup, eigenem Konto | diese Phase | `docker-compose.quick.yml`-Kopf, README:41-62/119-121 und `Documentation/WordQuest_Konzept_und_Architektur.md:486,619` anpassen |

**Deprecated/outdated:**
- `user-scalable=no, maximum-scale=1.0` in `index.html:7`: verhindert Zoom (WCAG 1.4.4); entfernen (UI-SPEC D7).
- Kommentar „Diese Datei ist ABSICHTLICH anspruchslos … nicht zum Betrieb“ (`docker-compose.quick.yml:8-16`): wird falsch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ein String in `font-family` gilt als ein Familienname, der Stapel greift nicht | Pattern 1 | gering: `sed`-Schritt schadet auch sonst nicht |
| A2 | `docker compose exec` erbt Umgebung und Secret-Mounts des laufenden Containers; Ausgabe landet nicht in `docker logs` | Pattern 5, Security | CLI findet kein DB-Passwort; Reset-Passwort in Logs |
| A3 | `\d` matcht in .NET Unicode-Ziffern | Anti-Patterns | gering: `[0-9]` ist in jedem Fall korrekt |
| A4 | Postgres-Image ignoriert `POSTGRES_PASSWORD(_FILE)` bei bestehendem Volume | Pitfall 4 | Migration bestehender Installationen schlägt fehl |
| A5 | Vitest stellt `afterEach` nur mit `globals: true` global bereit | Pitfall 8 | gering: manuelles `cleanup` schadet nicht |
| A6 | `docker compose up -d` lädt fehlende Images selbst (`pull_policy: missing`) | Pitfall 10 | `setup.sh` startet ohne Images |
| A7 | `hostname -I` liefert auf Raspberry Pi OS die LAN-IP; auf NAS-Busybox evtl. nicht | Open Q5 | Abschlusstext zeigt falsche Adresse |
| A8 | `@axe-core/playwright`-API `new AxeBuilder({ page }).withTags().analyze()` | Code Examples | nur Syntax, kein Konzeptrisiko |
| A9 | ASVS 5.0 verlangt schon auf L1 eine Prüfung neuer Passwörter gegen eine Liste häufiger Passwörter | Security Domain | Scope-Frage, siehe Open Question 9 |

## Open Questions

1. **FIX-08 (Tastatur am Ziffernfeld) in Phase 1?**
   - Was wir wissen: UI-SPEC verlangt „Physische Tastatur: Ziffern, Rücktaste und Enter werden angenommen“; REQUIREMENTS ordnet FIX-08 Phase 2 zu; `ProfilePickerPage` wird in Phase 1 ohnehin umgebaut (D-09).
   - Empfehlung: Nutzer entscheiden lassen; ohne Antwort nur D-09 umsetzen und die UI-SPEC-Zeile als Phase 2 markieren.
2. **Neue Dependencies außerhalb D-10:** `Microsoft.AspNetCore.Mvc.Testing` (für D-12 zwingend) und `@testing-library/dom` (Pflicht-Peer von `@testing-library/react`). Empfehlung: Freigabe einholen (Checkpoint vor dem Plan, der sie installiert).
3. **Namenslänge:** DB erlaubt 100 Zeichen. Empfehlung: Server lehnt längere Namen mit 400 ab; Text-Vorschlag „Der Name darf höchstens 100 Zeichen lang sein.“ braucht Freigabe (nicht in UI-SPEC).
4. **Bestehende Installationen mit altem Schnelltest-Volume:** Gibt es welche (Familie des Owners)? `UNBEKANNT: ob produktive Daten in einem wordquest-quick-Volume liegen`. Empfehlung: nachfragen; ohne produktive Daten genügt ein Hinweis in README.
5. **Lieferweg und Moduswahl von `setup.sh`:** Repo-Klon (heute nötig: `setup.sh` kopiert `.env.example`) oder Einzeldateien per `curl` (README:41)? Empfehlung: `./setup.sh` = Heimnetz (Standard), `./setup.sh --domain` = bisheriger TLS-Weg mit Hostname/ACME-Fragen; Lieferweg bleibt Repo-Klon bis REL-03 (Phase 3).
6. **Demo-Seed:** nur Default ändern (Bestand: Opt-in bleibt) oder Seed ganz auf Development beschränken? Empfehlung: Default `false` in allen Compose-Dateien und `.env.example`; Opt-in bleibt (chirurgisch).
7. **Anzeigename des Elternkontos:** `User.DisplayName` ist Pflicht (`User.cs:28`), `setup.sh` fragt laut UI-SPEC keinen Namen. Empfehlung: festes „Elternteil“ (keine neue Frage).
8. **Lichtkante (1,5 px Verlaufsrand):** mit Pseudo-Element und `mask-composite` machbar, aber Aufwand je Fläche. Empfehlung: zuerst als Teil der `glass`-Utility; bei Problemen Vereinfachung (nur Inset-Schatten) dem Nutzer vorlegen.
9. **ASVS-Passwortliste (A9):** nicht in den Anforderungen. Empfehlung: nicht umsetzen, als bekannte Lücke benennen.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | Gate, Stack, Smoke | ✓ | 29.8.2 | — |
| Docker Compose | Stack, `COMPOSE_FILE` | ✓ | v5.5.1 | — |
| Node (Host) | Vitest, Playwright, design.md | ✓ | 26.7.0 (CI: 22.23.3) | `node:22-alpine` |
| npm | Installation | ✓ | 11.19.0 | — |
| .NET SDK (Host) | Backend-Gate | ✗ | — | `mcr.microsoft.com/dotnet/sdk:10.0` (D-12) |
| Playwright-Browser | E2E/axe | teilweise: Cache hat chromium 1243, `@playwright/test` 1.64.0 verlangt `chromium_headless_shell-1248` `[VERIFIED: Fehlermeldung]` | — | `npx playwright install chromium` oder `mcr.microsoft.com/playwright:v1.64.0-noble` (arm64/amd64 vorhanden) `[VERIFIED: MCR-Tagliste]` |
| PostgreSQL für Integrationstests | D-12 | via Docker | `postgres:17-alpine` (arm64 ✓) | CI: `services: postgres` |
| @google/design.md | Export/Lint | ✓ per `npx` | 0.4.0; `lint DESIGN.md` → 0 errors, 0 warnings `[VERIFIED]` | — |
| graphify | Graph-Kontext | CLI vorhanden, im Projekt deaktiviert | — | ohne Graph gearbeitet |

**Missing dependencies with no fallback:** keine.
**Missing dependencies with fallback:** .NET SDK (Container), Playwright-Browser (Download oder Image).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: xUnit 2.9.3 (`WordQuest.Learning.Tests`); neu `WordQuest.Api.Tests` mit Mvc.Testing 10.0.12. Frontend: Vitest 5.0.3 + jsdom; Playwright 1.64.0 + @axe-core/playwright 4.13.0 |
| Config file | Backend: `.csproj`; Frontend: `vite.config.ts` (`test`-Block), `playwright.config.ts` — beide neu (Wave 0) |
| Quick run command | `cd frontend && npx vitest run` / Backend im Container: `dotnet test backend/WordQuest.slnx -c Release --filter <Klasse>` |
| Full suite command | Gate aus AGENTS.md + `cd frontend && npm test` + `npx playwright test` gegen gebauten Stack + `npm run design:check` + `npx @google/design.md@0.4.0 lint DESIGN.md` |

Backend-Gate im Container mit echter DB (Skizze):
```bash
docker network create wq-test
docker run -d --rm --name wq-test-db --network wq-test -e POSTGRES_USER=wordquest -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=wordquest postgres:17-alpine
docker run --rm --network wq-test -e ConnectionStrings__Default='Host=wq-test-db;Port=5432;Database=wordquest_test;Username=wordquest;Password=devpassword' \
  -v "$PWD":/src:ro mcr.microsoft.com/dotnet/sdk:10.0 sh -c 'cp -r /src /work && cd /work && dotnet test backend/WordQuest.slnx -c Release'
```
CI: Job `backend` bekommt `services: postgres` und dieselbe Umgebungsvariable; Job `frontend` zusätzlich `npm test`. AGENTS.md-Gate um `npm test` ergänzen (Gate = CI).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DESIGN-01 | Tokens aktuell | Drift | `cd frontend && npm run design:check` (Exit 0, leerer Diff) | ❌ Wave 0 (Skript) |
| DESIGN-01 | DESIGN.md gültig, keine Kontrast-Warnung | Lint | `npx -y @google/design.md@0.4.0 lint DESIGN.md` → `"warnings": 0` | ✅ |
| DESIGN-01 | keine alten Klassen/Inline-Styles | statisch | Grep aus Pitfall 1 → 0 Treffer | ❌ Wave 0 (als npm-Skript oder Plan-Check) |
| DESIGN-01 | axe 0 auf allen Seiten, Glas-Kontrast je Blob, Fallback-Modus | e2e | `cd frontend && npx playwright test e2e/a11y.spec.ts` | ❌ Wave 0 |
| FIX-07 | axe auf `/lernen` | e2e | Teil von `e2e/a11y.spec.ts` | ❌ Wave 0 |
| SETUP-01 | Secrets erzeugt, Backup-Datei vorhanden | Smoke (Docker) | `docker compose exec backup /backup.sh && ls backups/daily/wordquest-*.sql.gz` | ❌ |
| SETUP-02 | Konto aus `setup.sh`, kein Demo-Konto | Smoke + Integration | `printf 'mail\npw\npw\n' \| ./setup.sh`; `curl -X POST …/auth/login` mit Konto → 200, mit `demo@wordquest.local`/`demo1234` → 401 | ❌ |
| SETUP-03 | neues Passwort gilt, altes nicht; falsches aktuelles → 400 `currentPassword` | Integration + Vitest-Matrix | `dotnet test --filter AccountEndpointTests`; `npx vitest run src/features/manage/AccountPage.test.tsx` | ❌ |
| SETUP-04 | Reset per Befehl, Login mit Ergebnis | Smoke + Integration | `docker compose exec -T api dotnet WordQuest.Api.dll reset-password <mail>` → Passwort parsen → Login 200; `AccountService`-Test | ❌ |
| SETUP-05 | Startabbruch mit Namen des Secrets | Unit + Smoke | Unit für Prüffunktion; `docker run --rm -e ASPNETCORE_ENVIRONMENT=Production -e WQ_DB_PASSWORD=devpassword -e WQ_JWT_SIGNING_KEY=<32+ zufällig> <api-image>; echo $?` → ≠ 0, Ausgabe enthält `WQ_DB_PASSWORD` | ❌ |
| SETUP-06 | Regression Rechte | Smoke | `node .planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/smoke.mjs --installer` (aus diesem Verzeichnis) | ✅ |
| PAR-01 | Name/Limit/PIN ändern, Kind meldet sich mit neuer PIN an | Integration + Vitest-Matrix | `dotnet test --filter LearnerEndpointTests`; `npx vitest run src/features/manage/ChildFormPage.test.tsx` | ❌ |
| PAR-02 | PIN ≠ 4–6 Ziffern → 400 `pin`, auch direkt an der API | Integration | `dotnet test --filter LearnerEndpointTests` (Fälle 3, 7 Ziffern, Buchstaben, Leerzeichen, Anlegen ohne PIN) | ❌ |
| PAR-05 | Kind anlegen mit Limit und PIN | Integration + Vitest | wie PAR-01, Modus „Anlegen“ | ❌ |
| QUAL-02 | Matrix + axe + Tastatur + 200 % Zoom | Vitest + e2e + manuell | `npx vitest run`; `npx playwright test`; Tastatur/Zoom als Playwright-Schritte (Tab-Reihenfolge, `page.setViewportSize({ width: 320 })`) plus manueller Durchgang | ❌ |

### Sampling Rate
- **Per task commit:** `npx vitest run` (Frontend-Tasks) bzw. gefilterter `dotnet test` im Container (Backend-Tasks); `npm run design:check` bei CSS-Änderungen.
- **Per wave merge:** volles Gate aus AGENTS.md + `npm test`.
- **Phase gate:** Gate grün, Playwright/axe gegen gebauten Stack (`docker compose -f docker-compose.quick.yml -f docker-compose.build.yml up -d --build`), Smoke SETUP-01/02/04/05, dann `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `frontend/src/design-tokens.css` + Skripte `design:export`/`design:check`
- [ ] `frontend/vite.config.ts` `test`-Block, `frontend/src/test/setup.ts`, Skript `test`
- [ ] `frontend/playwright.config.ts`, `frontend/e2e/a11y.spec.ts`, `globalSetup` für Testdaten
- [ ] `backend/tests/WordQuest.Api.Tests/` (Factory mit `CreateHost`-Override, eigene DB pro Lauf), Eintrag in `backend/WordQuest.slnx`
- [ ] `.github/workflows/ci.yml`: Postgres-Service im Backend-Job, `npm test` im Frontend-Job
- [ ] Framework-Installation: siehe „Installation“ (nach Checkpoint)

## Security Domain

### Applicable ASVS Categories (Level 1 laut `.planning/config.json`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V6 Authentication | ja | `PasswordHasher` (PBKDF2, 210 000 Iterationen, `PasswordHasher.cs:14`), Mindestlänge 8 an einer Stelle im Server, Einfügen erlaubt, keine Kompositionsregeln |
| V3/V7 Session Management | ja | Reset widerruft alle Refresh-Tokens; Passwortwechsel lässt Sitzung bestehen (UI-SPEC; „andere Sitzungen beenden“ ist erst L2) |
| V4/V8 Access Control | ja | Guardian-Policy für Passwortwechsel und Kinder; Mandantenfilter; CLI nur mit Host-Zugriff |
| V5/V1-2 Input Validation | ja | PIN `^[0-9]{4,6}$`, Name nicht leer und ≤ 100, Limit 3–15 (Server klemmt, Bestand), E-Mail im CLI via `MailAddress.TryCreate` |
| V6/V11 Cryptography | ja | nur BCL: `RandomNumberGenerator` für Passwörter und Secrets (`setup.sh`: `openssl rand`/`/dev/urandom`, Bestand) |
| V13/V14 Configuration | ja | Startabbruch bei Standard-Secrets außerhalb Development; Secrets als Dateien, nicht als Umgebungsvariablen |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Betrieb mit bekanntem JWT-Schlüssel → Token fälschbar | Spoofing | SETUP-05-Prüfung, `setup.sh` erzeugt 48 Zeichen |
| Demo-Konto `demo@wordquest.local`/`demo1234` (`DemoDataSeeder.cs:19-21`) offen im Heimnetz | Spoofing | Seed-Default aus, Smoke prüft 401 |
| Passwort im Prozess-Listing oder in der Shell-History | Information Disclosure | stdin statt Argument; `read -s` im Skript |
| PIN-Raten unter Geschwistern | Spoofing | Bestand: 10 Fehlversuche → 15 min Sperre (`appsettings.json`), neue PIN hebt Sperre auf (`LearnerEndpoints.cs:117-122`) |
| E-Mail-Adressen in Logs | Information Disclosure | neue Codepfade loggen keine E-Mail (Bestand `AuthService.cs:47` tut es noch — v2 OPS2-03, nur erwähnen) |
| Backup-Dateien lesbar für andere Host-Nutzer | Information Disclosure | `backups/` im Installationsverzeichnis; Rechte des Containers (root, umask) prüfen und im README nennen |

## Sources

### Primary (HIGH confidence)
- Repo-Dateien, in dieser Session gelesen: `Program.cs`, `AuthService.cs`, `AuthEndpoints.cs`, `LearnerEndpoints.cs`, `Contracts.cs`, `DemoDataSeeder.cs`, `User.cs`, `LearnerProfile.cs`, `PasswordHasher.cs`, `IdentityConfigurations.cs`, `WordQuestDbContext.cs`, `backend/Dockerfile`, alle Compose-Dateien, `setup.sh`, `.env.example`, `.dockerignore`, `ci.yml`, `frontend/*` (Konfiguration, `index.css`, `components/ui/*`, betroffene Seiten, `api.ts`, `auth.tsx`)
- `npx @google/design.md@0.4.0 export|lint` und Quelltext `dist/index.js` (Tailwind-v4-Emitter), `dist/spec.md`
- Kompilierläufe mit `@tailwindcss/node` 4.3.3, `tailwind-merge` 3.7.0, Playwright 1.64.0/Chromium 153, axe-core 4.13.0 Paketquelle (Scratchpad, nicht im Repo)
- dotnet/runtime `CommandLineConfigurationProvider.cs`; mdn/browser-compat-data (`prefers-reduced-transparency`, `backdrop-filter`); npm-Registry, NuGet-API, Docker-Hub- und MCR-API; `gsd-tools package-legitimacy`

### Secondary (MEDIUM confidence)
- learn.microsoft.com: Integrationstests (ASP.NET Core 10), `RandomNumberGenerator.GetString`
- playwright.dev `page.emulateMedia`; vitest.dev/config; testing-library.com `cleanup`; README prodrigestivill/docker-postgres-backup-local

### Tertiary (LOW confidence)
- Assumptions Log A1–A9

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Versionen und Peers per Registry geprüft; Mvc.Testing/`@testing-library/dom` brauchen Freigabe
- Architecture: HIGH — Export-, Tailwind- und Merge-Verhalten ausgeführt; CLI-Verb-Muster gegen Quelltext geprüft
- Pitfalls: HIGH für Tailwind/axe/Rate-Limit; MEDIUM für Volume-Migration und Pull-Verhalten (A4, A6)

**Research date:** 2026-10-15
**Valid until:** 2026-11-14 (Tooling-Versionen bewegen sich schnell; vor Installation `npm view` erneut)
