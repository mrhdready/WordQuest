# Phase 2: Reliable Learning & Clean Family Data - Context

**Gathered:** 2026-10-16 (aus Anforderungen, Phase-1-Ergebnissen und Entscheidungen von Dennis in der Session; kein discuss-phase-Lauf, autonomer Lauf)
**Status:** Ready for planning

<domain>
## Phase Boundary

Kinder lernen ohne Aussperrung, Abstürze, hängende Karten oder falsche Zahlen. Ein Elternteil kann ein Kind löschen sowie Sets und Einträge korrigieren, ohne verwaiste Daten oder verlorenen Lernstand. Belegt durch Integrationstests gegen echtes PostgreSQL. Anforderungen: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-09, PAR-03, PAR-04, QUAL-01.

Nicht in dieser Phase: Release, GHCR, upgrade.sh/restore.sh (Phase 3), alles aus v2.

</domain>

<decisions>
## Implementation Decisions

### Ablauf
- **D-01:** Autonomer Lauf auf Branch `v1-fertig`: atomare Commits pro Plan erlaubt, **kein Push**. Pläne laufen sequenziell im Arbeitsbaum (`workflow.use_worktrees=false`), weil sie Docker-Stacks und Ports teilen.
- **D-02:** Jeder Plan ist ein vertikaler Slice (API + UI + Tests), Tracer zuerst. Jede Code-Änderung bekommt vor der Fertig-Meldung ein Subagent-Review (AGENTS.md).

### Lernen (FIX-03, FIX-09, Schließen)
- **D-03:** Entscheidung Dennis (2026-10-16) zu „Schließen“ in einer angefangenen Runde: mit mindestens einer beantworteten Karte wird die Runde regulär abgeschlossen (Serie zählt, Bonus rechnet der Server), danach Startseite; ohne Antwort wird nur navigiert. Bereits umgesetzt in 01-04 — nicht ändern.
- **D-04:** FIX-09 ist Anforderung: Ein Abbruch verbraucht das Tageslimit für neue Karten nicht. Neue Karten zählen erst, wenn sie beantwortet sind. FIX-03 gehört zur selben Ursache (Phase-1-Befund 01-04-SUMMARY „Verwaiste neue Karten“: `StartSessionAsync` legt `ReviewState` im Zustand `New` beim Start an; `Compose` wählt sie nie wieder aus; `dueToday` zählt sie trotzdem). Beide in einem Plan lösen; die Recherche bestimmt den kleinsten Weg (Vorschlag: ReviewState erst bei der ersten Antwort anlegen oder `New` wieder auswählbar machen) — Bewertung und Terminierung bleiben auf dem Server.
- **D-05:** FIX-06: Die Meisterschaftsregel (ease ≥ 2.1, wie in REQUIREMENTS.md) wird genau einmal im Domänenmodul definiert und von Eltern-Übersicht und Ampel benutzt. Die Recherche prüft, welche weiteren Bedingungen die heutigen Stellen haben (z. B. nur gesehene Karten), damit neue Karten mit Start-Ease nicht als gemeistert zählen; die bestehende Semantik bleibt, nur die doppelte Definition verschwindet.

### Familie und Daten (FIX-02, PAR-03, PAR-04)
- **D-06:** Datenintegrität in der Datenbank (AGENTS.md): Fremdschlüssel mit `ON DELETE CASCADE` statt handgeschriebener Löschlisten. Der Phase-1-Review hat gezeigt, dass `ReviewState` keinen Fremdschlüssel auf Card/Learner hat (`LearningConfigurations.cs`). Migration per `dotnet ef migrations add`, nie von Hand ändern. Vor dem Anlegen der FKs müssen vorhandene Waisen in Altinstallationen bereinigt werden, sonst scheitert sie — wo, regelt D-18 (beim Start vor `MigrateAsync`, nicht in der Migration).
- **D-07:** PAR-03: Kind löschen löscht hart, inklusive aller Lerndaten (Review-States, Sitzungen, XP/Serie, Refresh-Tokens). Bestätigungsdialog Pflicht. Dialog mit dem bereits installierten `@radix-ui/react-dialog` als neuer Baustein in `components/ui/` nach DESIGN.md (Glas-Sheet), keine neue Dependency.
- **D-08:** PAR-04: Set umbenennen und Eintrag korrigieren ändern den Datensatz an Ort und Stelle (gleiche IDs), damit der Lernstand am Wort bleibt. Kein Löschen-und-neu-Anlegen.
- **D-09:** Neue Formulare (Set umbenennen, Eintrag bearbeiten, Kind-löschen-Dialog) folgen der Edge-Case-Matrix (ein Feld falsch, rotieren; exakte Fehlertexte; Enter-Submit eigener Pfad; Happy Path zuletzt) plus axe 0 Verstöße, Tastatur-Durchgang und 200 % Zoom (Muster: `frontend/e2e/keyboard-zoom.spec.ts`, falls aus der Phase-1-Nachbesserung vorhanden).

### Robustheit (FIX-01, FIX-04, FIX-05)
- **D-10:** FIX-01: Rate-Limit pro echter Client-IP. Die API steht hinter nginx (Schnellstart) bzw. Traefik (Fortgeschrittene); `ForwardedHeaders` nur für den Proxy im Compose-Netz vertrauen, nicht für beliebige Absender. Token-Refresh verbraucht das Login-Budget nicht. Die Fehlertexte bleiben wie in Phase 1 (429-Text in `api.ts`). Die angehobene Grenze im e2e-Stack (`Auth__RequestsPerMinute: "1000"`) darf bleiben, wenn dort alle Anfragen von einer IP kommen.
- **D-11:** FIX-04: Ungültige Sitzungs-/Item-IDs und Doppel-Tipps liefern 4xx/409 mit deutschem Satz, nie 500. Die Oberfläche zeigt eine lesbare Meldung.
- **D-12:** FIX-05: Nach einem verpassten Tag zeigt die Startseite die aktuelle Serie (0 bzw. unterbrochen), nicht die alte als laufend. Zeitzone wie im Bestand (IANA, `InvariantGlobalization=false`).

### Tests (QUAL-01)
- **D-13:** Das Integrationstest-Projekt `backend/tests/WordQuest.Api.Tests` existiert seit Phase 1 (WebApplicationFactory, echtes PostgreSQL, eigene DB je Factory; CI mit Postgres-Service). Die STATE-Notiz „only a pure domain test project exists“ ist überholt. QUAL-01 heißt: Tests für Login, Refresh, Trennung zwischen Geschwistern und je FIX-Anforderung ergänzen, alle grün in CI.
- **D-14:** Lokales Gate ohne .NET-SDK und mit belegtem Port 5432: Backend-Tests im Container gegen eigenes `postgres:17-alpine` im Docker-Netz (`WQ_TEST_DB='Host=<db-container>;Port=5432;Username=wordquest;Password=devpassword'`), nicht über `docker-compose.dev.yml` auf 5432.
- **D-15:** Keine neuen Dependencies. Freigegeben bleiben nur die aus Phase 1.

### Nach der Recherche (2026-10-17, Orchestrator-Entscheidungen im autonomen Lauf; Dennis kann vor der Ausführung widersprechen)
- **D-16:** FIX-06: Eltern-Übersicht und Ampel zählen dieselbe Einheit, nämlich **Wörter** (Erfolgskriterium 3: „count the same words as mastered“). Die Kartenregel (ease ≥ 2.1 plus die bestehenden Zusatzbedingungen) steht einmal im Domänenmodul; die Wort-Aggregation ebenfalls einmal. Das präzisiert D-05: „bestehende Semantik bleibt“ gilt für die Kartenregel, nicht für die Zähleinheit der Übersicht.
- **D-17:** Bestätigungsdialog für alle drei Löschungen (Kind, Set, Eintrag) mit demselben Dialog-Baustein. Set löschen bekommt eine Oberfläche (heute fehlt sie), weil Erfolgskriterium 4 das Löschen eines Sets durch Eltern verlangt.
- **D-18:** Entscheidung Dennis (2026-10-17): Die Migrationsdatei bleibt unberührt (AGENTS.md „Migrationen nie von Hand ändern“). Verwaiste Zeilen räumt die API beim Start **vor** `MigrateAsync` per SQL auf (idempotent, nur wenn die Tabellen existieren; nach den FKs gibt es keine Waisen mehr, der Schritt ist dann ein No-op). Gilt auch für den CLI-Pfad, falls der vor der Migration läuft. Mit Test gegen eine Datenbank mit Waisen.
- **D-19:** QUAL-01-Beleg ist ein lokaler Lauf mit denselben Befehlen wie `.github/workflows/ci.yml` (kein Push in diesem Lauf, CI läuft nur auf `master`).

### Claude's Discretion
- Schnitt und Reihenfolge der Pläne, exakte Fehlertexte im Stil des Bestands (ganze deutsche Sätze), Form der Startbereinigung für Altdaten-Waisen (D-18).

</decisions>

<specifics>
## Specific Ideas

- Offene Punkte aus Phase 1, die hier passen: `refreshAccessToken` meldet bei 429 ab (gehört zu FIX-01); 429-Text „in einer Minute“ dupliziert das Fenster (FIX-01); `addEntry`/`removeEntry`-Fehler werden in der Set-Detailseite nicht angezeigt (passt zu PAR-04, wenn ohnehin angefasst).
- FIX-07-Doppelwertung hat noch keinen automatisierten Test (Phase-1-Verifikation) — gehört zu FIX-04/QUAL-01.

</specifics>

<canonical_refs>
## Canonical References

- `AGENTS.md` (Projektregeln, Gate, DESIGN.md-Pflicht)
- `DESIGN.md` (normativ), `.planning/phases/01-safe-home-network-install/01-UI-SPEC.md` (UI-Vertrag Phase 1, Texte und Muster)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 2 Erfolgskriterien)
- `.planning/phases/01-safe-home-network-install/01-04-SUMMARY.md` (Schließen, verwaiste neue Karten), `01-08-SUMMARY.md` (Rate-Limit konfigurierbar), `01-REVIEW.md`, `01-SECURITY.md`
- `Documentation/WordQuest_Konzept_und_Architektur.md`
- `.planning/codebase/CONCERNS.md`

</canonical_refs>
