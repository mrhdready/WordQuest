---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 1
current_phase_name: Safe Home-Network Install
status: executing
stopped_at: Completed 01-05-PLAN.md
last_updated: "2026-10-16T15:04:01.078Z"
last_activity: 2026-10-16
last_activity_desc: Phase 1 execution started
state_head: ed3f4a2806df43af55a42c265a85127419d34f9d
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 8
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.
**Current focus:** Phase 1 — Safe Home-Network Install

## Current Position

Phase: 1 (Safe Home-Network Install) — EXECUTING
Plan: 5 of 8
Status: Ready to execute
Last activity: 2026-10-16 — Phase 1 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 1 P01 | 15min | 3 tasks | 20 files |
| Phase 01 P02 | 17min | 3 tasks | 19 files |
| Phase 01 P03 | 29min | 3 tasks | 17 files |
| Phase 01 P05 | 135min | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 3 phases (below the standard 4-6) because the scope was cut to 21 requirements; no filler phases
- [Roadmap]: QUAL-02 sits in Phase 1 where the password-change and edit-child forms are built; Phase 2's new forms (rename set, edit entry, delete child) follow the same edge-case matrix + axe house rule as a success criterion
- [Roadmap]: QUAL-01 sits in Phase 2 because it must cover each FIX requirement; delete child (PAR-03) shares Phase 2 with the cascade fix (FIX-02)
- [Phase 1]: 01-01: 1,5-px-Verlaufsrand der Glasflaechen entfaellt (::before blockiert axe-Kontrastberechnung)
- [Phase 1]: 01-01: playwright-core per npm overrides auf 1.64.0 gepinnt
- [Phase 1]: 01-01: tailwind-merge kennt type-* nicht; Schriftstufen nicht per className ueberschreiben
- [Phase 01]: Npgsql-Verbindung aus WQ_DB_* mit GSS Encryption Mode=Disable (libgssapi-Fehler im Alpine-Image)
- [Phase 01]: ApiFactory migriert selbst; WebApplicationFactory haelt Program.cs bei Build an
- [Phase 01]: Api.Tests: je Testfall eigene ApiFactory/Datenbank, wenn Erwartung vom DB-Stand abhaengt
- [Phase 01]: 01-03: Eltern-Tab-Leiste im Fluss unter <main> statt sticky (sticky verdeckt Ziele: axe target-size; eigener Scrollbereich macht Kontrast unmessbar) - Abnahme end-of-phase
- [Phase 01]: 01-03: checkPage misst den Fallback nach abgeschlossenen CSS-Uebergaengen
- [Phase 01]: 01-03: Formularfelder ueber Field (Render-Prop), Serverfeldfehler aus ApiError.errors am Feld
- [Phase 01]: 01-05: Reset setzt Hash und widerruft Refresh-Tokens in einem SaveChanges; Access-Tokens laufen regulaer ab (15 min)
- [Phase 01]: 01-05: SecretCheck direkt nach CreateBuilder ausserhalb von Development, expliziter ConnectionStrings__Default ueber Passwort-Teil geprueft

### Pending Todos

- Quick 261006-r7l: axe auf `/lernen` nachholen — erledigt sich mit Plan 01-04 (axe-Werkzeug seit 01-01 vorhanden, `checkPage` auf den Lernseiten).
- [Phase 3, REL-01]: Umstieg alter Schnellstart-Installationen — deren `pgdata`-Volume nutzt `POSTGRES_PASSWORD=wordquest`, die API verweigert diesen Wert seit 01-05. `upgrade.sh` braucht dafür einen Weg (Quelle: Review 01-05).
- [Phase-1-Abschluss]: manuelle Abnahme Tab-Leiste bei 200 % Zoom, leere Zustände, Glas-Wirkung auf dem Tablet; `hostname -I` und Backup-Dienst auf einem Raspberry Pi prüfen.

### Quick Tasks

| ID | Aufgabe | Stand | Nachweis |
|----|---------|-------|----------|
| 261006-r7l | Installer, Container-Secrets und HTTP-Lernen | Umgesetzt; axe-Lauf offen | [Zusammenfassung](quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/261006-r7l-SUMMARY.md) |

### Blockers/Concerns

- [Phase 2]: Only a pure domain test project exists; QUAL-01 needs a new integration test project with real PostgreSQL

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-16T15:04:01.041Z
Stopped at: Completed 01-05-PLAN.md
Resume file: None
