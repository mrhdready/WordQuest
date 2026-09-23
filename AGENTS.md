# AGENTS.md — WordQuest

Anbieterneutrale Arbeitsregeln für jeden Coding-Agenten (Claude Code, Codex, Cursor, Copilot, Gemini …). Tool-spezifische Ergänzungen stehen in der Datei des jeweiligen Tools (z. B. `.claude/CLAUDE.md`) und erweitern diese Datei nur.

## Sprache

- Projektsprache ist **Deutsch**: Antworten, Dokumentation, Commit-Messages, Code-Kommentare, Texte für Nutzer.
- Code-Bezeichner (Klassen, Methoden, Variablen) bleiben englisch.
- Offene Punkte zur Sprachwahl stehen in [`Documentation/questions.md`](Documentation/questions.md).

## Freigabe

- **Kein Commit und kein Push ohne ausdrückliche Freigabe** durch den Nutzer. Eine Freigabe gilt für den genannten Vorgang, nicht pauschal für alle folgenden.
- Ebenso nur mit Freigabe: Force-Push, Branches löschen, Dateien oder Ordner löschen, die der Agent nicht selbst angelegt hat, neue Dependencies, neue Ordner/Features/Integrationen, die nicht beauftragt waren.
- Vor dem Überschreiben oder Löschen das Ziel ansehen.

## Skills

- Quelle für Agent-Skills ist [skills.sh](https://skills.sh). Installation per `npx skills`, keine von Hand kopierten oder selbst nachgebauten Varianten.
- Ein Skill liefert Technik, nicht Scope: verlangt er mehr als der Auftrag, gilt der Auftrag.

## Projekt

WordQuest ist eine einfache Vokabel-Lern-App für Kinder, die Eltern ohne besonderes Know-how in ihrem Heimnetz aufsetzen können. Ein Elternteil verwaltet Vokabel-Sets (manuell oder CSV-Import) und Kinderprofile. Kinder melden sich per Profilauswahl + PIN an und lernen mit SM-2-Wiederholung, XP, Streaks und Leveln. Betrieb als Docker-Compose-Stack auf einem Heimserver (Raspberry Pi 5, NAS).

**Kernwert:** Eltern ohne besonderes Know-how können WordQuest in ihrem Heimnetz aufsetzen, und ihre Kinder lernen damit sicher und zuverlässig.

**Rahmenbedingungen:**
- **Einfachheit:** Jede Ergänzung muss Installation und Betrieb für Laien machbar halten. Im Zweifel weglassen.
- **Stack:** .NET 10 / EF Core / React / PostgreSQL / Docker Compose bleiben.
- **Hosting:** ARM64-Heimhardware, genau eine API-Instanz (Migration beim Start und In-Memory-Rate-Limiter setzen das voraus).
- **Standard-Betriebsweg:** Heimnetz über HTTP (`docker-compose.quick.yml`). Die Variante mit Traefik + Let's Encrypt (`docker-compose.yml`) ist für Fortgeschrittene. Ohne HTTPS registriert sich kein Service Worker, die App muss deshalb als reine Browser-App vollständig funktionieren.
- **Barrierefreiheit:** WCAG 2.2 AA als Untergrenze bei jeder UI-Änderung.

## Grundregeln für die Entwicklung

**Vorher denken**
- Annahmen ausdrücklich nennen. Gibt es mehrere Deutungen, werden sie vorgelegt und nicht still eine gewählt. Bei Unklarheit anhalten und fragen.
- Gibt es einen einfacheren Weg, wird er genannt.
- Vor jedem Vorschlag prüfen, ob es das schon gibt. Doppelarbeit vermeiden.
- Fehlende Information wird als `UNBEKANNT: <was fehlt>` benannt und nicht plausibel aufgefüllt.

**Einfachheit zuerst**
- Minimaler Code für den Auftrag. Keine spekulativen Features, keine Abstraktion für einen einzigen Fall, keine „Flexibilität“, die niemand verlangt hat, keine Fehlerbehandlung für unmögliche Fälle.
- Reihenfolge der Lösung: Braucht es das überhaupt? → Gibt es das schon im Projekt? → Standardbibliothek? → Plattform-Funktion? → bereits installierte Dependency? → erst dann eigener Code.
- Keine neue Dependency für etwas, das wenige Zeilen lösen.

**Konsistenz**
- Bestehende Muster und Komponenten wiederverwenden (UI-Bausteine, Fehlerbehandlung, API-Formen, Benennung). Eine Abweichung von etablierten Konventionen braucht eine Freigabe.

**Modular**
- Klar abgegrenzte Einheiten mit einer Verantwortung, schmale Schnittstellen statt geteiltem Zustand. Keine Gott-Klassen und keine Gott-Dateien.

**Chirurgische Änderungen**
- Nur anfassen, was der Auftrag braucht. Stil des Bestands übernehmen. Angrenzenden Code nicht „verbessern“, sondern erwähnen. Eigene Überbleibsel entfernen, fremden toten Code nur melden.
- Formatter und Linter nur auf die eigenen berührten Dateien anwenden, kein repo-weiter Lauf als Nebenwirkung.

**Zielgerichtet und belegt**
- Jede Aufgabe bekommt ein prüfbares Ziel („Bug beheben“ → „Test reproduziert den Bug, danach grün“).
- „Fertig“ nennt ein mechanisch geprüftes Kriterium (Test + Ergebnis, Befehl + Exit-Code, beobachtetes Verhalten im laufenden System), keine Selbsteinschätzung.
- Ehrlich berichten: Fehlschläge mit genauer Anzahl und Ursache, nichts schönen, nichts Unbelegtes behaupten.

**Barrierefreiheit**
- Jede sichtbare UI-Änderung wird gegen WCAG 2.2 AA geprüft: axe auf den berührten Seiten mit 0 Verstößen (oder begründet), bei interaktiven Änderungen zusätzlich Tastatur-Durchgang und 200 % Zoom. Ergebnis in der Fertig-Meldung bzw. im PR.

**Sicherheit**
- Keine Secrets, Zugangsdaten oder Umgebungswerte im Code. Eingaben an Vertrauensgrenzen (API) validieren. Keine personenbezogenen Daten in Logs.

## Review

- **Jede Code-Änderung bekommt vor der Fertig-Meldung ein Review durch einen Subagenten** (bzw. eine zweite, unabhängige Agent-Instanz bei Tools ohne Subagenten). Das Review arbeitet gegen die Anforderung bzw. das Akzeptanzkriterium und den Diff, nicht gegen die Selbstbeschreibung des Autors.
- Das Review prüft mindestens: Korrektheit gegen das Akzeptanzkriterium, Sicherheit (Auth, Secrets, Eingaben, Mandantentrennung), Einhaltung dieser Regeln (Einfachheit, Architektur, Konventionen), Tests und Barrierefreiheit bei UI.
- Befunde werden behoben oder begründet zurückgewiesen. Beides steht in der Fertig-Meldung.
- Das Review ersetzt nichts: Gate, Beleg je Akzeptanzkriterium und das echte Ausführen der Änderung bleiben Pflicht.
- Bewusste Projektentscheidung (2026-09-24): Das weicht vom Harness-Default ab, der ein Review nur bei strukturellem Signal vorsieht.

## Design (`DESIGN.md`)

**Bevor weiterer UI-Code entsteht, wird eine `DESIGN.md` angelegt.** Solange sie fehlt, gibt es keine neuen oder geänderten Komponenten, Stylesheets oder Seiten.

- **Format:** `DESIGN.md` im Repo-Root im [google-labs-code-Format](https://github.com/google-labs-code/design.md): YAML-Front-Matter mit `colors`, `typography`, `spacing`, `rounded`, `components`, Token-Referenzen wie `{colors.primary}`. Das Format ist `version: alpha`; das Schema kommt per `npx @google/design.md spec`, nicht aus dem Gedächtnis.
- **Bestand zuerst:** Die Tokens werden aus dem vorhandenen Design abgeleitet (Tailwind-Theme in `frontend/src/index.css`, Bausteine in `frontend/src/components/ui/`, z. B. 44 px Mindesthöhe für Buttons). Weicht der Bestand von einem Vorschlag ab, werden beide Fundstellen mit Datei und Zeile vorgelegt, und der Nutzer entscheidet. Nichts wird still überschrieben.
- **Normativ:** Die Tokens in `DESIGN.md` sind die eine Quelle für Farben, Abstände, Schrift und Radien. Keine Inline-Styles, kein Hex im JSX, keine Einzelfall-`px`. Fehlt eine Stufe, wird sie zentral ergänzt.
- **Absichtlich fehlende Sektionen** werden unter `omitted:` mit Grund eingetragen.
- **Abgeleitete Dateien** (Tailwind-Theme) werden aus `DESIGN.md` erzeugt, nicht von Hand angeglichen: `npx @google/design.md export --format css-tailwind DESIGN.md`.
- **Gate:** `npx @google/design.md lint DESIGN.md` und der Export gehören ins Gate. Kontrast-Verstöße erscheinen nur als `warning` bei Exit-Code 0, deshalb die Ausgabe lesen und Kontrast-Warnungen als blockierend behandeln (Text ≥ 4.5:1).
- Bei Änderungen an einer bestehenden `DESIGN.md` vorher `npx @google/design.md diff <alt> DESIGN.md` laufen lassen und den `regression`-Key prüfen.

## GSD (Pflicht)

Das Projekt arbeitet mit **GSD** (npm-Paket `@opengsd/gsd-core`): Planung, Phasen, Ausführung und Verifikation laufen über GSD, der Stand liegt in `.planning/`.

**Zu Beginn jeder Session prüft der Agent, ob GSD für sein Tool installiert ist**, bevor er plant oder Code ändert:

```bash
# global (Config-Verzeichnis des Tools) oder lokal (im Repo)
for d in ~/.claude ~/.codex ~/.cursor ~/.gemini ~/.copilot ~/.config/opencode \
         ./.claude ./.codex ./.cursor ./.gemini ./.github ./.opencode; do
  f="$d/gsd-core/bin/gsd-tools.cjs"
  [ -f "$f" ] && node "$f" runtime-identity --raw && break
done
```

- Treffer: Die Ausgabe enthält `"packageName":"@opengsd/gsd-core"`. Weiter mit den GSD-Befehlen des Tools.
- Kein Treffer: **nicht ohne GSD weiterarbeiten.** Den Nutzer auffordern, GSD zu installieren, und den passenden Befehl nennen, z. B.:
  - Claude Code: `npx @opengsd/gsd-core@latest --claude --global`
  - Codex: `npx @opengsd/gsd-core@latest --codex --global`
  - Cursor: `npx @opengsd/gsd-core@latest --cursor --global`
  - Gemini CLI: `npx @opengsd/gsd-core@latest --gemini --global`
  - Copilot: `npx @opengsd/gsd-core@latest --copilot --global`
  - alle Tools: `npx @opengsd/gsd-core@latest --all --global`
  - `--local` statt `--global` installiert nur in dieses Repo.
- Der Agent installiert GSD nicht selbst, das ist eine neue Installation und braucht die Freigabe des Nutzers (siehe Freigabe).

## Planung

`.planning/` ist die einzige Quelle für Planungsstand (GSD-Struktur):
- `PROJECT.md`: Kontext, Entscheidungen, Scope
- `REQUIREMENTS.md`: v1/v2-Anforderungen mit IDs und Zuordnung
- `ROADMAP.md`: Phasen mit Erfolgskriterien
- `STATE.md`: aktueller Stand
- `codebase/`: Codebase-Map (Stack, Architektur, Konventionen, Schwachstellen)
- `research/`: Recherche zu einem größeren Scope; Input für v2, nicht v1-Scope

Arbeit lässt sich einer Anforderungs-ID zuordnen. Was darüber hinausgeht, kommt als v2 in `REQUIREMENTS.md` und nicht still in die laufende Phase.

## Entwicklungsvorgehen

**Spec → Test → Code → Gate.** Jede Änderung beginnt mit einem prüfbaren Akzeptanzkriterium (Anforderung bzw. Erfolgskriterium der Phase), dann der Test, dann der Code, dann das Gate unten.

**Testgetrieben:**
- Bugfix: zuerst ein roter Test, der den Bug reproduziert, dann der Fix.
- Domänenlogik (SM-2, Bewertung, Gamification-Regeln) → Unit-Tests in `backend/tests/WordQuest.Learning.Tests/`.
- Endpoints, Auth, Trennung zwischen Familien und Geschwistern, Persistenz → Integrationstests mit `WebApplicationFactory` gegen echtes PostgreSQL (`Program` ist dafür `public partial`).
- UI-Formulare → Frontend-Tests mit Edge-Case-Matrix (pro Fall genau ein Feld falsch, durch alle Felder rotieren; Enter-Submit als eigener Pfad; exakte Fehlertexte; Happy Path zuletzt) plus axe-Check.
- „Fertig“ heißt: Gate grün, nicht Selbsteinschätzung.

**Architektur: DDD-light, kein volles DDD.**
- Die Module (`Identity`, `Content`, `Learning`, `Gamification`) sind grobe Bounded Contexts: Entitäten plus reine Domänenservices, ohne EF, ohne HTTP, ohne NuGet-Abhängigkeiten.
- Fachbegriffe im Code verwenden (`VocabularyEntry` ≠ `Card`, `ReviewState`, `Grade`).
- Keine Aggregate-Maschinerie, keine Repositories, keine Domain Events, kein `Result<T>`. Nicht geplant, nicht einführen.
- Geschäftslogik gehört in Modul-Services oder einen Infrastructure-Service (Muster: `LearningService`), nie in Endpoints. Endpoints parsen, autorisieren, rufen auf, mappen.
- Datenintegrität gehört in die Datenbank (Fremdschlüssel, Constraints), nicht in handgeschriebene Löschlisten.
- Bewertung und Terminierung entscheidet der Server, das Frontend zeigt nur an.

**Vertikale Slices.** Jede Phase liefert eine Fähigkeit, die man durchgängig sieht (API + UI + Tests), keine technische Schicht.

**Chirurgische Änderungen.** Nur anfassen, was der Auftrag braucht, Stil des Bestands übernehmen, Unbeteiligtes nicht „verbessern“, sondern erwähnen.

## Gate

Vor jeder Fertig-Meldung ausführen (entspricht der CI in `.github/workflows/ci.yml`):

```bash
dotnet build backend/WordQuest.slnx -c Release /warnaserror
dotnet test backend/WordQuest.slnx -c Release
cd frontend && npm ci && npm run lint && npm run typecheck && npm run build
```

UI-Änderungen brauchen zusätzlich einen axe-Check (WCAG 2.2 AA) der berührten Seiten, Ergebnis wird festgehalten, sowie den `DESIGN.md`-Lint und -Export (siehe Design).

## Lokale Entwicklung

- Voraussetzungen: .NET 10 SDK, Node 22, Docker.
- Datenbank: `docker compose -f docker-compose.dev.yml up -d` (PostgreSQL auf 5432).
- API: `dotnet run` in `backend/src/WordQuest.Api` → `http://localhost:5080` (Dev-Signing-Key in `Properties/launchSettings.json`).
- Frontend: `npm run dev` in `frontend/` → `http://localhost:5173`, leitet `/api` an 5080 weiter.
- Migrationen (aus `backend/`): `dotnet ef migrations add <Name> --project src/WordQuest.Infrastructure --startup-project src/WordQuest.Api`. Die API wendet Migrationen beim Start an. Dateien in `Migrations/` nie von Hand ändern.

## Stack-Hinweise

- NuGet-Versionen stehen in der jeweiligen `.csproj`; Central Package Management ist aus (`backend/Directory.Packages.props`), dort keine Versionen eintragen.
- Solution-Datei: `backend/WordQuest.slnx`.
- `InvariantGlobalization=false` ist Absicht (deutsche Texte, IANA-Zeitzonen).
- Krypto nur mit der BCL: PBKDF2-HMAC-SHA256 (`PasswordHasher.cs`), SHA256 für Token (`TokenHasher.cs`).
- Secrets: `ReadSecret()` in `Program.cs` liest zuerst `<NAME>_FILE`, dann die Umgebungsvariable. Keine Zugangsdaten im Code; konfigurierbare Werte gehören in `.env` (Vorlage `.env.example`).
- Mandantentrennung: EF Global Query Filters auf jeder `ITenantOwned`-Entität (`WordQuestDbContext`). Neue mandantengebundene Entitäten dort registrieren. `IgnoreQueryFilters()` / `SystemTenantContext` nur in Auth- und Start-/Seed-Code.
- Frontend: React 19, React Router 7, TanStack Query, Tailwind 4, Radix-Primitives in `components/ui/`, `vite-plugin-pwa`. Token liegen bewusst im localStorage (dokumentierter Kompromiss), deshalb muss die CSP streng bleiben.

## Konventionen

**C#**
- Ein Haupttyp pro Datei, Dateiname = Typname. Endpoint-Dateien: `<Bereich>Endpoints.cs` mit `Map*Endpoints(this IEndpointRouteBuilder)`.
- Klassen standardmäßig `sealed`; DTOs/Werte als `sealed record`; Interfaces mit `I`-Präfix.
- Async-Methoden enden auf `Async`; private Felder `_camelCase`; Konstanten PascalCase.
- File-scoped Namespaces passend zum Ordner; Zugriffsmodifizierer Pflicht; explizite Typen für Built-ins, `var` nur bei offensichtlichem Typ.
- Entity-IDs: `Guid.CreateVersion7()`. Enums mit expliziten Werten und XML-Doku pro Member.
- `ArgumentNullException.ThrowIfNull` am öffentlichen Einstieg von Domänenservices.
- Build bleibt warnungsfrei (CI mit `/warnaserror`, `EnforceCodeStyleInBuild=true`).

**TypeScript / React**
- Seiten in PascalCase mit Suffix `Page`; UI-Primitives und Libs kleingeschrieben.
- Keine Semikolons, einfache Anführungszeichen, Trailing Commas, 2 Leerzeichen Einrückung.
- Importe immer über `@/…`, nie `../`; Typ-Importe mit `import type` (`verbatimModuleSyntax`).
- Gemeinsame API-Typen in `frontend/src/types.ts`. Ungenutzte Variablen/Argumente mit `_` präfixen.

**Fehler**
- Endpoints liefern `IResult`: `Results.ValidationProblem`, `Results.NotFound`, `Results.Problem`. „Nicht gefunden“ und Konflikte werden 4xx, nie ein unbehandelter 500.
- Meldungen an Nutzer auf Deutsch, in ganzen Sätzen.
- Das Frontend wirft `ApiError(message, status)` aus `api<T>()`.

**Logging**
- Nur in Api/Infrastructure; Domänenmodule loggen nicht. Keine personenbezogenen Daten (z. B. E-Mail-Adressen) in Logs.

**Kommentare und Commits**
- Kommentare erklären das *Warum*, auf Deutsch; Umlaute im Code wie im Bestand umschreiben (`ae/oe/ue`). Konzept-Verweise als `(Konzept §6.4)`.
- Commit-Messages auf Deutsch mit Conventional-Präfix (`feat:`, `fix:`, `docs:`, `chore:` …), atomar pro Anliegen.

## Dokumentation

- Maßgebliche Doku ist Markdown in `Documentation/` (Index: `Documentation/README.md`). Kein `.docx`.
- `Documentation/WordQuest_Konzept_und_Architektur.md` ist das Konzept; es markiert, was umgesetzt ist und was nicht.
- Jede Faktenaussage in der Doku muss dem Code entsprechen. Ändert Code das Verhalten, wird die Doku in derselben Änderung angepasst.

## Pflege dieser Datei

- Neue Regeln kommen hierher, nicht in tool-spezifische Dateien.
- GSD (`generate-claude-md`) überschreibt diese Datei und `.claude/CLAUDE.md` nicht, solange sie keine `<!-- GSD:…-start -->`-Marker enthalten. Keine solchen Marker einfügen.
