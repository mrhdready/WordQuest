---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 1
current_phase_name: Safe Home-Network Install
status: verifying
stopped_at: Completed 02-04-PLAN.md
last_updated: "2026-10-17T19:31:00.457Z"
last_activity: 2026-10-16
last_activity_desc: Phase 1 execution started
state_head: 4eda3a1fc30af3a21cdee69f081eab04afdd0f1e
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 15
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.
**Current focus:** Phase 1 — Safe Home-Network Install

## Current Position

Phase: 1 (Safe Home-Network Install) — EXECUTING
Plan: 8 of 8
Status: Phase complete — ready for verification
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
| Phase 01 P04 | 25min | 3 tasks | 7 files |
| Phase 01 P06 | 23min | 3 tasks | 19 files |
| Phase 01 P07 | 18min | 3 tasks | 19 files |
| Phase 01 P08 | 20min | 3 tasks | 18 files |
| Phase 02 P01 | 23min | 3 tasks | 12 files |
| Phase 02 P02 | 18min | 2 tasks | 16 files |
| Phase 02 P03 | 23min | 3 tasks | 14 files |
| Phase 02 P04 | 22min | 3 tasks | 16 files |

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
- [Phase 01]: 429 wird in api() zentral auf einen deutschen Wartehinweis gemappt (Wortlaut wie PIN-Sperre), nicht nur auf der Kinder-Anmeldung
- [Phase 01]: Text direkt auf dem Backdrop in text-ink statt text-ink-soft (ink-soft auf backdrop-blue 4,14:1)
- [Phase 01]: Zurueck zur Profilwahl als runder Knopf oben (button-round) statt Zelle im Ziffernfeld
- [Phase 01]: Design-Migration abgeschlossen: --color/--text/--font-weight/--radius-* vor dem Token-Import geleert, design:classes ueber ganz src ins Gate
- [Phase 01]: 01-06: Tab-Leiste bricht bei 320 px neben dem + zweizeilig um; --wq-tab-bar-clearance waechst unter sm um eine Zeile
- [Phase 01]: 01-06: body als grid mit min-height 100% statt height 100% (axe elmPartiallyObscured bei Seiten knapp ueber Bildschirmhoehe)
- [Phase 01]: 01-06: Passwortwechsel widerruft keine Sitzungen; Pruefung gegen haeufige Passwoerter bleibt bekannte Luecke D-18
- [Phase 01]: 01-07: PIN-, Namens- und Tageslimit-Regeln fuer Kinderprofile stehen in AccountRules (Identity-Modul); Endpoints mappen nur LearnerProfileProblem-Codes auf Feldtexte
- [Phase 01]: 01-07: Kinderliste ohne Card, weil ListGroup/EmptyState selbst Glas sind (DESIGN.md: kein Glas auf Glas)
- [Phase 01]: 01-08: Auth-Limit aus Auth:RequestsPerMinute (Standard 10), nur der e2e-Teststack hebt es an; Produktion unveraendert
- [Phase 01]: 01-08: Bearbeiten-Seite liest das Kind aus ['learners']; Ladefehler (ErrorNote) getrennt von unbekannter ID (EmptyState)
- [Phase 02]: 02-01: AnsweredAt als Concurrency-Token statt xmin, keine Migration
- [Phase 02]: 02-01: Neue Karte gilt erst mit der ersten Antwort als eingefuehrt (LastReviewedAt gesetzt, FirstSeenAt = Antwortzeit); Altbestand ohne Antwort kostet kein Budget
- [Phase 02]: 02-01: Gutschrift XP/Muenzen nur per ExecuteUpdateAsync in Transaktion ueber CreateExecutionStrategy; Abschluss atomar beansprucht
- [Phase 02]: D-18 umgesetzt: OrphanCleanup vor MigrateAsync, nur solange 20261017182305_ReferentialIntegrity aussteht; Migration unverändert aus dotnet ef
- [Phase 02]: Startblock aus Program.cs läuft unter WebApplicationFactory (gemessen in 02-02); Migrationstests nutzen den echten Startpfad
- [Phase 02]: ConfirmDialog-Buttons flex-auto statt flex-1: mit Basis 0 brach die Zeile nie um (02-03)
- [Phase 02]: Dialog-Kontrast in e2e ohne Seiteninhalt messen (Backdrop-Farben und primary-deep), weil axe bei Glas ueber wechselndem Inhalt nicht misst (02-03)
- [Phase 02]: 02-04: Set-Seite zeigt Erfassung, Import und Liste erst mit gefundenem Set; Titel aus ['sets'], 404 im Dialog bleibt bis zum Schliessen (useSetGone)
- [Phase 02]: 02-04: ContentRules.CheckText (200 Zeichen nach Trimmen) ist die eine Laengenregel fuer Titel und Woerter; CSV-Import ueber 200 Zeichen bleibt 500 (gemeldet, nicht gebaut)

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

Last session: 2026-10-17T19:31:00.415Z
Stopped at: Completed 02-04-PLAN.md
Resume file: None
