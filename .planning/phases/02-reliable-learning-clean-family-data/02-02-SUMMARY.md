---
phase: 02-reliable-learning-clean-family-data
plan: 02
subsystem: data-integrity
tags: [ef-core, postgres, foreign-keys, migration, orphan-cleanup, delete]
status: complete

requires:
  - phase: 02-01
    provides: "Gate-Hilfe gate/backend-test.sh, TestData, SessionEndpoints mit 404-Texten"
provides:
  - "Fremdschlüssel mit ON DELETE CASCADE/SET NULL auf allen Lern-, Spiel- und Anmeldetabellen (Migration 20261017182305_ReferentialIntegrity, so wie dotnet ef sie erzeugt)"
  - "OrphanCleanup im Startblock direkt vor MigrateAsync, aktiv nur solange ReferentialIntegrity aussteht"
  - "DELETE /api/v1/learners/{id} (Guardian, nur Rolle Learner) mit 404 „Dieses Kind gibt es nicht (mehr).“"
  - "Übersicht eines gelöschten Kindes: 404 „Dieses Profil gibt es nicht mehr. Bitte melde dich ab.“"
  - "POST /api/v1/sessions prüft eine optionale setId mandantengefiltert: 404 „Dieses Set gibt es nicht (mehr).“"
affects: [02-03, 02-05]

actuals:
  tokens: 25385
  tasks: 2
  commits: 3
plan_head_before: f9ab58df4b06ac0bc3d2d34a95ce6ac774869692
plan_head_after: 09e7effd0c6ab60d5d3f67bfdb71b94b6b2250a5

tech-stack:
  added: []
  patterns:
    - "FK ohne Navigation in der IEntityTypeConfiguration: HasOne<Prinzipal>().WithMany().HasForeignKey(...).OnDelete(...)"
    - "Löschen über ExecuteDeleteAsync auf die Wurzelzeile, Rest per Kaskade der Datenbank"
    - "Startbereinigung für Altdaten als statische Klasse vor MigrateAsync, an die ausstehende Migration gebunden"
    - "Migrationstests über den echten Startpfad: eigene ApiFactory ohne InitializeAsync, IMigrator bis Initial, dann erster Zugriff auf Services"

key-files:
  created:
    - backend/src/WordQuest.Infrastructure/OrphanCleanup.cs
    - backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.cs
    - backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.Designer.cs
    - backend/tests/WordQuest.Api.Tests/LearnerDeleteTests.cs
    - backend/tests/WordQuest.Api.Tests/SetDeleteTests.cs
    - backend/tests/WordQuest.Api.Tests/MigrationTests.cs
  modified:
    - backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs
    - backend/src/WordQuest.Infrastructure/Configurations/GamificationConfigurations.cs
    - backend/src/WordQuest.Infrastructure/Configurations/IdentityConfigurations.cs
    - backend/src/WordQuest.Infrastructure/Migrations/WordQuestDbContextModelSnapshot.cs
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs
    - backend/src/WordQuest.Api/Program.cs
    - backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs
    - backend/tests/WordQuest.Api.Tests/ApiFactory.cs
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "D-18 (Entscheidung Dennis, 2026-10-17, 02-CONTEXT): Migration bleibt so, wie dotnet ef sie erzeugt; Waisen räumt OrphanCleanup vor MigrateAsync auf"
  - "OrphanCleanup läuft nur, solange 20261017182305_ReferentialIntegrity aussteht (Review MITTEL 1): das SQL kennt nur das Schema davor"
  - "Der Startblock aus Program.cs läuft unter WebApplicationFactory (gemessen); MigrationTests nutzen deshalb den echten Startpfad, kein Rückfallweg"

requirements-completed: [PAR-03, FIX-02]
requirements-partial: [FIX-04, QUAL-01]

duration: 18min
completed: 2026-10-17
---

# Phase 2 Plan 02: Datenintegrität und Kind löschen über die API – Zusammenfassung

**Fremdschlüssel mit Kaskade auf allen Lerndaten (Migration unverändert aus `dotnet ef`), Waisenbereinigung vor der Migration, `DELETE /api/v1/learners/{id}` und 404 statt 500 beim Rundenstart mit unbekanntem oder fremdem Set.**

## Leistung

- **Dauer:** ca. 18 min (2026-10-17T18:20Z bis 18:39Z)
- **Tasks:** 2 von 2, dazu ein Commit mit Review-Befunden
- **Dateien:** 16 (davon 3 von `dotnet ef` erzeugt bzw. geändert)

## Ergebnis

- Zehn neue Fremdschlüssel, genau nach der Tabelle in 02-RESEARCH „FIX-02 / PAR-03“: `review_state` (Karte, Kind), `review_log` (Karte, Kind; Runde `SET NULL`), `learning_session` (Kind; Set `SET NULL`), `session_item` (Karte), `gamification_profile` (Kind), `refresh_token` (Konto). Domänenklassen unverändert, keine Navigationen.
- Migration `20261017182305_ReferentialIntegrity`: nur `AddForeignKey` (10), `CreateIndex` (5), `DropForeignKey`, `DropIndex`; kein `migrationBuilder.Sql`. Direkt nach dem Erzeugen mit `git add` vorgemerkt; `git diff --quiet -- backend/src/WordQuest.Infrastructure/Migrations/` blieb bis zu jedem Commit Exit 0, und seit `7fb13ac` gibt es keine Änderung an den Migrationsdateien. Der Snapshot übernimmt auch den Concurrency-Token aus 02-01 und entfernt `ValueGeneratedOnAdd` an `GamificationProfile.Id` (jetzt Fremdschlüssel; alle Aufrufer setzen die ID ausdrücklich).
- `DELETE /api/v1/learners/{id}`: `ExecuteDeleteAsync` auf `app_user` mit `Role == UserRole.Learner` unter Mandantenfilter; den Rest entfernt die Datenbank. Kein `RemoveRange`.
- `OrphanCleanup.RunAsync` im Startblock in der Zeile direkt vor `MigrateAsync` (`Program.cs:202-203`). Ohne angewandte Migration oder mit angewandter `ReferentialIntegrity` ohne Wirkung.
- `StartAsync` prüft `setId` per `AnyAsync` unter Mandantenfilter vor dem Service; `LearningService` unverändert.
- Konzept: Datenmodell (Fremdschlüssel, `OrphanCleanup`), API-Zeile `DELETE /learners/{id}`, Fehlerform der Sitzungs-Endpunkte (setId → 404), Abschnitt „Löschung“.

## Task-Commits

1. **Task 1: Kind löschen Ende-zu-Ende (Tracer)** – `7fb13ac` (feat)
2. **Task 2: Set/Vokabel löschen, Waisenbereinigung, setId-Prüfung, Konzept** – `a06252a` (feat)
3. **Review-Befunde** – `09e7eff` (fix)

## Messung: Startblock unter WebApplicationFactory

**Ergebnis: Der Startblock aus `Program.cs` läuft unter `WebApplicationFactory`.** Beleg: `MigrationTests.Start_ohne_Datenbank_legt_sie_an_und_migriert` war schon im roten Lauf grün, ohne dass `ApiFactory.InitializeAsync` aufgerufen wurde; nur der erste Zugriff auf `Services` hat die Datenbank angelegt und migriert. Der rote Lauf des Altdaten-Falls zeigt den Aufrufer im Stack: `at Program.<Main>$(String[] args) in /src/backend/src/WordQuest.Api/Program.cs:line 200` (damals `MigrateAsync`). Der Rückfallweg aus dem Plan (Bereinigung und Migration direkt im Test) war deshalb nicht nötig; `MigrationTests` startet die API über `Services`. Der falsche Kommentar in `ApiFactory.InitializeAsync` („läuft nicht“) ist korrigiert (siehe Abweichungen).

## CLI-Prüfung (D-18)

`AccountCommands.IsCommand(args)` verzweigt in `Program.cs` vor dem Startblock und kehrt mit `return` zurück; die Verben (`has-owner`, `create-owner`, `reset-password`) migrieren nicht (Kommentar dort: „keine Migration, kein Kestrel“). Fremdschlüssel entstehen nur über den einen `MigrateAsync`-Aufruf im Startblock, und genau davor steht die Bereinigung. `AccountCommands.cs` ist unverändert (`git diff --quiet HEAD -- backend/src/WordQuest.Api/AccountCommands.cs` Exit 0).

## TDD-Belege (rot, dann grün)

**Task 1, Schritt 1 (`LearnerDeleteTests`, vor dem Code):** `Failed: 5, Passed: 0`. Alle fünf Fälle bekamen 404 statt 204/403 bzw. `detail` null: Ohne `MapDelete` passt keine Route (der Plan erwartete 405; tatsächlich 404, weil unter `/learners/{id}` sonst nur `…/settings` und `…/overview` liegen).

**Task 2, Schritte 1 und 2 (`SetDeleteTests`, `MigrationTests`, mit leerem `OrphanCleanup.RunAsync` als Kompilier-Stub):** `Failed: 4, Passed: 5`.
- `MigrationTests.Altinstallation_…` und `MigrationTests.Wiederholte_…`: `Npgsql.PostgresException : 23503: insert or update on table "gamification_profile" violates foreign key constraint "fk_gamification_profile_learner_profile_id"` aus `MigrateAsync` im Startblock.
- `Rundenstart_mit_geloeschtem_oder_unbekanntem_Set_…`: `InternalServerError` statt `NotFound` (Fremdschlüsselverletzung beim Speichern).
- `Rundenstart_mit_dem_Set_einer_anderen_Familie_…`: `OK` statt `NotFound`.
- Erwartet grün (Beleg, dass Task 1 die Löschfälle schon trägt): `Set_loeschen_…`, `Vokabel_loeschen_…`, `Antwort_auf_die_Karte_einer_geloeschten_Vokabel_ergibt_404`, `Rundenstart_mit_eigenem_Set_…`, `Start_ohne_Datenbank_…`.

**Grün:** Filter `SetDeleteTests|MigrationTests|LearnerDeleteTests` → `Passed: 14, Failed: 0`.

## Gate-Ergebnisse (Stand `09e7eff`)

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` | Build ohne Warnung (`/warnaserror`); Learning.Tests 104 passed, Api.Tests 169 passed, 0 failed |
| Task-2-Verify | dto. mit Filter `SetDeleteTests\|MigrationTests\|LearnerDeleteTests` | 14 passed, 0 failed |
| Frontend | `npm ci`, `lint`, `typecheck`, `build`, `test`, `design:check`, `design:classes` | alle Exit 0; Vitest 13 Dateien, 112 Tests passed; DESIGN.md errors 0, warnings 0 |
| e2e-Stack | `npm run e2e:stack` | api, db, web healthy; Log „Applying migration '20261017182305_ReferentialIntegrity'“, „Demo-Daten angelegt: 32 Vokabeln.“ |
| e2e | `npx playwright test` (frischer Stack, zweimal: nach Task 2 und nach dem Review-Fix) | je 31 passed, 1 skipped (`first-run.spec.ts`, absichtlich nur im Install-Smoke) |
| Install-Smoke | `bash .planning/phases/01-…/smoke/setup-smoke.sh` | Exit 0, `FIRST RUN OK`, `DEMO-ABBRUCH OK`, `SMOKE OK` |
| Migration unverändert | `git diff --quiet -- …/Migrations/` und `git diff --quiet HEAD -- …/Migrations/` | beide Exit 0 |

Keine UI-Änderung, daher kein axe-Lauf und kein A11y-Trailer. Container `wq-p2-db`, Netz `wq-p2`, e2e-Stack und Smoke-Projekt sind entfernt; das NuGet-Volume `wq-nuget` bleibt.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Regel 1 – Bug] Falscher Kommentar in `ApiFactory`**
- **Gefunden bei:** Task 2 (Messung Startblock)
- **Problem:** `ApiFactory.InitializeAsync` behauptete, der Startblock laufe unter `WebApplicationFactory` nicht. Gemessen läuft er.
- **Fix:** Kommentar auf den gemessenen Stand gebracht (Datei nicht im Plan).
- **Datei:** `backend/tests/WordQuest.Api.Tests/ApiFactory.cs`
- **Commit:** `a06252a`

**2. [Regel 1 – Bug, aus Review] Bereinigung an die ausstehende Migration gebunden**
- **Gefunden bei:** Review (MITTEL 1)
- **Problem:** Das SQL lief bei jedem Start mit mindestens einer angewandten Migration. Es kennt aber nur das Schema vor `ReferentialIntegrity`; benennt eine spätere Migration eine dieser Tabellen oder Spalten um, wäre jeder Start einer migrierten Installation gescheitert.
- **Fix:** `RunAsync` endet auch, wenn `20261017182305_ReferentialIntegrity` schon angewandt ist. Der Test zur Wiederholung prüft jetzt das SQL zweimal vor der Migration (echte Idempotenz) und den Lauf nach der Migration.
- **Dateien:** `OrphanCleanup.cs`, `MigrationTests.cs`
- **Commit:** `09e7eff`

**3. Seed der Altdaten über das EF-Modell statt Roh-SQL**
- Der Plan nannte `ExecuteSqlRawAsync` mit Spalten aus `Initial.cs`. Die Altdaten entstehen über das aktuelle EF-Modell (`TestData` plus `AddRange`), weil es heute genau dem Initial-Schema entspricht (die neue Migration ändert keine Spalte). Grenze im Test als `ponytail:`-Kommentar: Bekommt eine dieser Tabellen später eine Spalte, scheitert der Seed laut und wird dann auf Roh-SQL umgestellt.

**4. Roter Lauf Task 1 mit 404 statt 405** – siehe TDD-Belege; Ursache Routing, kein Einfluss auf das Ergebnis.

## Review (AGENTS.md „Review“, D-02)

Unabhängige zweite Instanz (`claude -p`, nur Lesen) gegen Plan, 02-CONTEXT, AGENTS.md und Diff `f9ab58d..a06252a`: kein BLOCKER, kein HOCH. Gesamturteil: „Freigabe mit Auflagen“.

| Befund | Schwere | Umgang |
|---|---|---|
| Bereinigung läuft nach der Migration bei jedem Start weiter; späteres Umbenennen bricht den Start | MITTEL | behoben (`09e7eff`), siehe Abweichung 2 |
| Altdaten-Seed über EF statt Roh-SQL (Plan) | NIEDRIG | begründet zurückgewiesen, siehe Abweichung 3; Grenze im Test kommentiert |
| Kein Waisenfall „unbekanntes Kind“ für `review_state`/`review_log` | NIEDRIG | behoben (`09e7eff`): je eine Zeile im Seed, erwartete Zählungen unverändert, grün |
| `PATCH …/settings` liefert für ein gelöschtes Kind nacktes 404 ohne `detail` | NIEDRIG | zurückgestellt nach 02-03 (Oberfläche „Kind löschen“, dort wird die veraltete Liste relevant) |
| Text „Dieses Kind gibt es nicht (mehr).“ als Literal in `LearnerEndpoints`, als Konstante in `SessionEndpoints` | NIEDRIG | zurückgewiesen: Endpunktklassen teilen bewusst keine Texte; `LearnerEndpoints` nutzt durchgängig Literale |

## Bekannte Folgen

- Auf einer frischen Datenbank loggt EF jetzt zweimal `fail: … Failed executing DbCommand … FROM "__EFMigrationsHistory"` statt einmal (die Abfrage aus `GetAppliedMigrationsAsync` in `OrphanCleanup`, dann die aus `MigrateAsync`). EF fängt den Fehler selbst ab; der Start läuft durch (e2e-Stack, Install-Smoke). Kosmetisch, kein Defekt.
- Restgrenze T-02-35 (accept): Wird ein Set genau zwischen Prüfung und Speichern gelöscht, scheitert das Speichern am Fremdschlüssel.
- Der Papierkorb der Set-Seite löscht bis 02-05 weiter ohne Rückfrage; die Daten räumt die Datenbank ab jetzt auf.

## Nächste Schritte

02-03 baut „Kind löschen“ in der Oberfläche auf `DELETE /api/v1/learners/{id}` und den 404-Texten auf; dabei den nackten 404 in `UpdateSettingsAsync` mitziehen.

## Self-Check: PASSED

Alle 6 neu angelegten Dateien vorhanden; Commits 7fb13ac, a06252a, 09e7eff sind Vorfahren von HEAD.
