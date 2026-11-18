# AGENTS.md — WordQuest

Anbieterneutrale Arbeitsregeln für jeden Coding-Agenten (Claude Code, Codex, Cursor, Copilot, Gemini …). Tool-spezifische Ergänzungen stehen in der Datei des jeweiligen Tools (z. B. `.claude/CLAUDE.md`) und erweitern diese Datei nur.

## Sprache

- Projektsprache ist **Deutsch**: Antworten, Dokumentation, Commit-Messages, Code-Kommentare, Texte für Nutzer.
- Code-Bezeichner (Klassen, Methoden, Variablen) bleiben englisch.
- Die offene Frage zur Sprachwahl steht in Issue [#20](https://github.com/mrhdready/WordQuest/issues/20).

## Freigabe

- **Kein Commit und kein Push ohne ausdrückliche Freigabe** durch den Nutzer. Eine Freigabe gilt für den genannten Vorgang, nicht pauschal für alle folgenden.
- Ebenso nur mit Freigabe: Force-Push, Branches löschen, Dateien oder Ordner löschen, die der Agent nicht selbst angelegt hat, neue Dependencies, neue Ordner/Features/Integrationen, die nicht beauftragt waren.
- Vor dem Überschreiben oder Löschen das Ziel ansehen.
- Issue-Pflege nach `## Issues (GitHub)` braucht keine Einzelfreigabe: anlegen, zuweisen, Status-Label setzen, kommentieren. Push, PR und Merge bleiben freigabepflichtig.

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
- **Standard-Betriebsweg:** Heimnetz über HTTPS mit eigener Zertifizierungsstelle (`docker-compose.quick.yml`, Dienst `certs`). Ohne installierte Zertifizierungsstelle registriert sich kein Service Worker, die App muss deshalb als reine Browser-App vollständig funktionieren.
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

## Issues (GitHub)

Offene Arbeit steht **nur** in den GitHub Issues von `mrhdready/WordQuest`: Bugs, Features, technische Schulden, Abnahmen und offene Fragen. Daneben gibt es im Repo keine Planungsdateien, TODO-Listen oder Statusdateien. Die Vorgeschichte aus der Zeit mit GSD steht in [`Documentation/gsd_migration.md`](Documentation/gsd_migration.md). Die Befehle unten nutzen die GitHub-CLI `gh`. Die Weboberfläche von GitHub geht genauso.

**Anlegen**
- Was auffällt und nicht in der laufenden Änderung erledigt wird, wird ein Issue. Ein Satz in einer Zusammenfassung oder ein `TODO` im Code reicht nicht.
- Vorher nach einem bestehenden Issue suchen: `gh issue list --state all --search "<Begriff>"`. Gibt es eins, kommt der neue Befund dort als Kommentar dazu.
- Ein Issue behandelt ein Anliegen. Der Titel sagt, was nicht stimmt oder was fehlt. Der Text nennt den Ist-Zustand, die betroffenen Dateien, ein prüfbares Akzeptanzkriterium und die Quelle.
- Labels für die Art: `bug`, `enhancement`, `documentation`, `question`, bei Barrieren zusätzlich `accessibility`. `v2` markiert Kandidaten, die noch nicht eingeplant sind.
- Was über den laufenden Auftrag hinausgeht, wird ein eigenes Issue (Ideen mit `v2`). Es wird nicht still Teil der laufenden Arbeit.

**Zuweisen und Status**
- Wer an einem Issue arbeitet, weist es sich **vor** Arbeitsbeginn zu, setzt `status: in Arbeit` und schreibt einen kurzen Startkommentar: `gh issue edit <n> --add-assignee @me --add-label "status: in Arbeit"`. Ist das Issue schon jemand anderem zugewiesen, wird es nur nach Absprache übernommen. Das gilt für Menschen und für KI-Agenten. Ein Agent arbeitet über das GitHub-Konto des Menschen, der ihn startet, und nennt sich in jedem Kommentar mit Tool-Namen (z. B. „Codex im Auftrag von <Konto>“).
- Den Stand zeigt genau ein Status-Label:
  - `status: in Arbeit`: jemand arbeitet daran
  - `status: im Review`: die Änderung liegt als PR vor und wird geprüft
  - `status: blockiert`: es geht nicht weiter, der Grund steht im Kommentar
  - `status: wartet auf Freigabe`: ein Mensch muss entscheiden oder freigeben
- Bei jedem Wechsel wird das alte Label entfernt, das neue gesetzt und ein kurzer Kommentar geschrieben: wer (bei KI mit Tool), was passiert ist, Branch oder PR, nächster Schritt.
  ```bash
  gh issue edit 12 --remove-label "status: in Arbeit" --add-label "status: im Review"
  gh issue comment 12 --body "Codex im Auftrag von <Konto>: PR #50 offen, wartet auf Review."
  ```
- Wer die Arbeit abgibt oder abbricht, entfernt Zuweisung und Status-Label und hält den erreichten Stand im Kommentar fest.

**Abschließen**
- Der Branch trägt die Issue-Nummer (z. B. `fix/12-login-reset`). Der PR verweist auf das Issue und schließt es mit `Fixes #12`.
- Geschlossen wird erst, wenn das Akzeptanzkriterium belegt ist (Gate, Test, beobachtetes Verhalten). Der Beleg steht im PR oder im letzten Kommentar.
- Beim Schließen wird das Status-Label entfernt.
- Ohne Umsetzung wird nur mit Begründung geschlossen: `gh issue close <n> --reason "not planned" --comment "<Grund>"`.
- Issues, die eine Entscheidung des Owners brauchen (`question`, `status: wartet auf Freigabe`), schließt nur ein Mensch.

## Entwicklungsvorgehen

**Spec → Test → Code → Gate.** Jede Änderung beginnt mit einem prüfbaren Akzeptanzkriterium (aus dem Issue), dann der Test, dann der Code, dann das Gate unten.

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

**Vertikale Slices.** Jedes Feature-Issue liefert eine Fähigkeit, die man durchgängig sieht (API + UI + Tests), keine technische Schicht.

**Chirurgische Änderungen.** Nur anfassen, was der Auftrag braucht, Stil des Bestands übernehmen, Unbeteiligtes nicht „verbessern“, sondern erwähnen.

## Gate

Vor jeder Fertig-Meldung ausführen (entspricht der CI in `.github/workflows/ci.yml`):

```bash
dotnet build backend/WordQuest.slnx -c Release /warnaserror
dotnet test backend/WordQuest.slnx -c Release
cd frontend && npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes
```

Die Backend-Tests brauchen ein laufendes PostgreSQL (`docker compose -f docker-compose.dev.yml up -d`); die Verbindung kommt aus `WQ_TEST_DB` (Standard `Host=localhost;Port=5432;Username=wordquest;Password=devpassword`), jede Test-Factory legt darauf eine eigene Datenbank an. Ohne lokales .NET-SDK laufen Build und Tests im Container `mcr.microsoft.com/dotnet/sdk:10.0` mit `-e WQ_TEST_DB='Host=host.docker.internal;Port=5432;Username=wordquest;Password=devpassword'`.

UI-Änderungen brauchen zusätzlich einen axe-Check (WCAG 2.2 AA) der berührten Seiten gegen den gebauten Stack, Ergebnis wird festgehalten: `cd frontend && npm run e2e:stack && npm run e2e` (Playwright mit `@axe-core/playwright`, danach `docker compose -f e2e/docker-compose.e2e.yml down -v`). `npm run design:check` deckt den `DESIGN.md`-Lint und -Export ab (siehe Design).

Änderungen an Installation und Betrieb (`setup.sh`, `upgrade.sh`, `restore.sh`, Compose-Dateien, nginx, Release-Paket) brauchen zusätzlich die Smokes aus `scripts/smoke/`. Sie laufen bisher nur lokal, nicht in der CI (Issue [#44](https://github.com/mrhdready/WordQuest/issues/44)):

```bash
bash scripts/smoke/setup-functions-check.sh   # Funktionen aus setup.sh, ohne Stack
bash scripts/smoke/setup-smoke.sh             # frische Installation bis zur ersten Lernantwort
bash scripts/smoke/release-smoke.sh           # Installation, Update und Sicherung aus dem Release-Paket
bash scripts/smoke/proxy-xff-check.sh         # nginx: X-Forwarded-For, Sicherheits-Header, HTTPS-Umleitung, Mounts
```

Ohne lokales .NET-SDK laufen Backend-Build und -Tests mit `bash scripts/smoke/backend-test.sh` im SDK-Container gegen ein eigenes PostgreSQL.

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
