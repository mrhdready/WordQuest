---
phase: 02-reliable-learning-clean-family-data
verified: 2026-10-17T21:11:27Z
status: human_needed
score: 5/5 must-haves verified
covered_files: [".planning/phases/02-reliable-learning-clean-family-data/02-01-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-01-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/02-02-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-02-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/02-03-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-03-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/02-04-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-04-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/02-05-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-05-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/02-06-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-06-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/02-07-PLAN.md",".planning/phases/02-reliable-learning-clean-family-data/02-07-SUMMARY.md",".planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh",".planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh","DESIGN.md","Documentation/WordQuest_Konzept_und_Architektur.md","backend/src/WordQuest.Api/Contracts/Contracts.cs","backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs","backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs","backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs","backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs","backend/src/WordQuest.Api/Program.cs","backend/src/WordQuest.Infrastructure/Configurations/GamificationConfigurations.cs","backend/src/WordQuest.Infrastructure/Configurations/IdentityConfigurations.cs","backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs","backend/src/WordQuest.Infrastructure/LearningService.cs","backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.Designer.cs","backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.cs","backend/src/WordQuest.Infrastructure/Migrations/WordQuestDbContextModelSnapshot.cs","backend/src/WordQuest.Infrastructure/OrphanCleanup.cs","backend/src/WordQuest.Modules.Content/Services/ContentRules.cs","backend/src/WordQuest.Modules.Content/Services/ContentTextProblem.cs","backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs","backend/src/WordQuest.Modules.Gamification/Services/StreakRules.cs","backend/src/WordQuest.Modules.Learning/Entities/ReviewState.cs","backend/src/WordQuest.Modules.Learning/Services/MasteryRules.cs","backend/tests/WordQuest.Api.Tests/ApiFactory.cs","backend/tests/WordQuest.Api.Tests/AuthEndpointTests.cs","backend/tests/WordQuest.Api.Tests/LearnerDeleteTests.cs","backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs","backend/tests/WordQuest.Api.Tests/MigrationTests.cs","backend/tests/WordQuest.Api.Tests/OverviewTests.cs","backend/tests/WordQuest.Api.Tests/RateLimitTests.cs","backend/tests/WordQuest.Api.Tests/SessionEndpointTests.cs","backend/tests/WordQuest.Api.Tests/SetDeleteTests.cs","backend/tests/WordQuest.Api.Tests/SetEditTests.cs","backend/tests/WordQuest.Api.Tests/SiblingIsolationTests.cs","backend/tests/WordQuest.Api.Tests/TestData.cs","backend/tests/WordQuest.Learning.Tests/ContentRulesTests.cs","backend/tests/WordQuest.Learning.Tests/CsvVocabularyParserTests.cs","backend/tests/WordQuest.Learning.Tests/GamificationTests.cs","backend/tests/WordQuest.Learning.Tests/MasteryRulesTests.cs","docker-compose.yml","frontend/e2e/axe.ts","frontend/e2e/children.spec.ts","frontend/e2e/docker-compose.e2e.yml","frontend/e2e/keyboard-zoom.spec.ts","frontend/e2e/learn.spec.ts","frontend/e2e/manage.spec.ts","frontend/nginx-traefik-realip.conf","frontend/nginx.conf","frontend/src/components/ui/dialog.test.tsx","frontend/src/components/ui/dialog.tsx","frontend/src/components/ui/misc.tsx","frontend/src/design-tokens.css","frontend/src/features/learn/LearnHomePage.test.tsx","frontend/src/features/learn/LearnHomePage.tsx","frontend/src/features/learn/SessionPage.test.tsx","frontend/src/features/learn/SessionPage.tsx","frontend/src/features/manage/ChildFormPage.test.tsx","frontend/src/features/manage/ChildFormPage.tsx","frontend/src/features/manage/ChildrenPage.test.tsx","frontend/src/features/manage/ChildrenPage.tsx","frontend/src/features/manage/ProgressPage.test.tsx","frontend/src/features/manage/ProgressPage.tsx","frontend/src/features/manage/SetDetailPage.test.tsx","frontend/src/features/manage/SetDetailPage.tsx","frontend/src/features/manage/SetsPage.test.tsx","frontend/src/features/manage/SetsPage.tsx","frontend/src/lib/api.test.ts","frontend/src/lib/api.ts"]
covered_digest: "v3:sha256:6919db724be4c1151e119880abf97b5f396b473bed4de764fa82104c7ea76947"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Dialoge „Kind löschen“, „Set umbenennen“, „Set löschen“, „Vokabel bearbeiten“, „Vokabel löschen“ auf einem echten Tablet und am Desktop bei echtem Browser-Zoom 200 % nur mit der Tastatur bedienen; dabei je ein Kind, Set und Wort mit sehr langem Namen (100 bzw. 200 Zeichen ohne Leerzeichen) verwenden"
    expected: "Startfokus auf „Abbrechen“, Tab bleibt im Dialog, Fokusring sichtbar, Esc schließt ohne Löschen, Enter auf „Abbrechen“ löscht nicht, Fehlertext lesbar; Sheet passt in die Höhe und scrollt innen, jeder Button erreichbar; lange Namen brechen um, nichts wird abgeschnitten, kein waagerechtes Scrollen; Bildschirmtastatur verdeckt keine Eingabe"
    why_human: "Backstop-Truths aus 02-03, 02-04, 02-05 und Manual-Only aus 02-VALIDATION. keyboard-zoom.spec emuliert 200 % per Viewport 640 × 400; echtes Zoomverhalten, Bildschirmtastatur und Touch-Bedienung sieht kein Test. Die e2e-Läufe selbst sind übernommen, nicht selbst beobachtet"
  - test: "Zwei echte Geräte im Heimnetz (Schnellstart-Stack): auf Gerät A elfmal ein falsches Elternpasswort, sofort danach auf Gerät B anmelden"
    expected: "Gerät A sieht „Zu viele Versuche. Bitte in einer Minute nochmal probieren.“, Gerät B meldet sich in derselben Minute normal an; ein auf Gerät A laufendes Kind bleibt beim Token-Refresh angemeldet"
    why_human: "FIX-01 / Erfolgskriterium 1. Automatisiert sind RateLimitTests (gesetzte Client-IP im TestServer), proxy-xff-check.sh (nginx-Stufe) und der Install-Smoke mit zwei Absendern im Compose-Netz; echte WLAN-Geräte hinter nginx nicht"
  - test: "Traefik-Stack (docker-compose.yml) mit echter Domain und Let's-Encrypt-Zertifikat: von Gerät A bis zur Sperre falsche Passwörter, Gerät B anmelden, von Gerät A per curl mit zusätzlichem Kopf X-Forwarded-For: 10.9.9.9 anmelden"
    expected: "Gerät A 429, Gerät B meldet sich an, der gefälschte Kopf öffnet keinen neuen Topf (weiter 429)"
    why_human: "proxy-xff-check.sh prüft nur nginx mit nachgestelltem Traefik-Kopf, nicht Traefik selbst; braucht Domain, Ports 80/443 und Zertifikat"
  - test: "Raspberry Pi 5 mit bestehender Phase-1-Installation: Sicherung prüfen, Images neu bauen, docker compose up -d"
    expected: "API startet, Log zeigt die Migration ReferentialIntegrity ohne Fehler (OrphanCleanup läuft davor), Kinder lernen mit unverändertem Lernstand weiter, ein Testkind lässt sich löschen"
    why_human: "ARM64-Hardware und echte Altdaten fehlen in der Testumgebung; MigrationTests belegen den Startpfad mit Waisen auf x86 gegen PostgreSQL 17"
  - test: "Serie über einen echten Tageswechsel: Kind lernt an Tag 1, setzt Tag 2 und 3 aus (Monat ohne verfügbaren Retter), öffnet an Tag 4 die Startseite; Elternteil öffnet /verwalten/fortschritt"
    expected: "Kind sieht „Starte heute deine Serie!“ ohne Flamme, Eltern sehen „Keine laufende Serie“; nach der ersten Runde an Tag 4 „1 Tag“"
    why_human: "Automatisiert nur über gesetztes LastActiveDate (OverviewTests, GamificationTests); echte Mitternacht in der eingestellten IANA-Zeitzone nicht"
  - test: "Prohibition 02-01 (judgment-tier, status unresolved) bestätigen: Bewertung und Terminierung entscheidet allein der Server, das Frontend rechnet nichts nach und wählt keine Karten aus"
    expected: "Verbot hält"
    why_human: "Nicht-autoritatives LLM-Urteil „hält“: SessionPage zeigt nur result.correct/hadTypo/correctAnswer aus der Server-Antwort, Kartenauswahl nur über POST /sessions; kein mechanischer Gate-Test (unverified-prohibition — human review recommended)"
---

# Phase 2: Reliable Learning & Clean Family Data — Verifikationsbericht

**Phasenziel:** Kinder lernen ohne Aussperrung, Abstürze, hängende Karten oder falsche Zahlen, und ein Elternteil kann ein Kind löschen oder Sets und Einträge korrigieren, ohne verwaiste Daten oder verlorenen Lernstand, belegt durch Integrationstests gegen echtes PostgreSQL.
**Verifiziert:** 2026-10-17T21:11:27Z
**Status:** human_needed
**Re-Verifikation:** Nein — Erstverifikation

**Hinweis MVP-Modus:** ROADMAP führt die Phase mit `Mode: mvp`, das Ziel ist aber keine User Story (`user-story.validate` → `false`). Wie bei Phase 1 lief die normale Goal-Backward-Prüfung gegen die fünf Erfolgskriterien.

**Evidenzbasis:**
- Selbst ausgeführt (2026-10-17, HEAD `3f55d4f`):
  - `bash .planning/phases/02-…/gate/backend-test.sh` → Exit 0; Release-Build `0 Warning(s)`, `0 Error(s)`; Learning.Tests **132/132**, Api.Tests **230/230**, 0 übersprungen.
  - `cd frontend && npm run lint && npm run typecheck && npm test && npm run design:check && npm run design:classes` → alle Exit 0; vitest **14 Dateien, 216/216**; DESIGN.md `errors: 0, warnings: 0`; „keine alten Klassen“.
  - `bash .planning/phases/02-…/gate/proxy-xff-check.sh` → Exit 0, `PROXY-XFF OK` (Heimnetz: API sieht Absender, Traefik-Variante: API sieht nur den letzten Wert).
  - `npx playwright test --list` → **47 Tests in 7 Dateien** (nur gelistet, nicht ausgeführt).
  - `verify.artifacts` / `verify.key-links` über alle 7 Pläne, `check.decision-coverage-verify` (19/19), Code-Lektüre der Kernpfade.
- Nicht selbst ausgeführt (Auftrag: e2e-Stack nicht starten, Port 18080 belegt):
  - Letzter **vollständiger** e2e-Lauf laut 02-07-SUMMARY auf `ebdca52`: 46 bestanden, 1 übersprungen (`first-run.spec`, nur im Install-Smoke). Install-Smoke `SMOKE OK` inkl. `RATE-LIMIT OK` ebenfalls dort.
  - Laut Koordinator auf `3f55d4f`: 23 bestanden, 1 übersprungen, darin `manage.spec` 17/17. Das ist ein Teillauf (47 Tests gelistet). Welche Specs außer `manage.spec` liefen: UNBEKANNT. Zwischen `ebdca52` und `3f55d4f` ändern sich im Frontend nur 2 Zeilen in `frontend/e2e/manage.spec.ts`, sonst Backend (CSV-Import) und Doku; der Teillauf deckt die geänderte Spec ab.
  - Kein Artefakt: `frontend/test-results/.last-run.json` existiert nicht.

## Zielerreichung

### Beobachtbare Wahrheiten (ROADMAP-Erfolgskriterien)

| # | Wahrheit | Status | Beleg |
|---|----------|--------|-------|
| 1 | Vertippt sich ein Familienmitglied wiederholt, können die anderen sich von ihren Geräten anmelden; Token-Refresh zählt nie gegen das Login-Limit | ✓ VERIFIED | `Program.cs:119-127` `ForwardLimit = 1`, nur private Netze + Loopback; `Program.cs:195` `UseForwardedHeaders` vor `UseRateLimiter` (`:207`); Partition `RemoteIpAddress` (`:131-132`). `frontend/nginx.conf:47` `X-Forwarded-For $remote_addr` überschreibt jeden Gerätekopf; API in `docker-compose.quick.yml` nicht veröffentlicht (nur `web` hat `ports:`). Traefik: `nginx-traefik-realip.conf` (`real_ip_recursive off`), eingebunden nur in `docker-compose.yml:69`. `AuthEndpoints.cs:23-24` `/refresh`, `/logout` mit `DisableRateLimiting`. `api.ts:105-109` meldet nur bei 400/401 ab, sonst `ApiError(GENERIC)`. Tests (selbst grün): `Locked_device_does_not_lock_another_device_behind_the_proxy`, `Forwarded_header_from_untrusted_sender_does_not_open_a_new_bucket`, `Prepended_forwarded_value_does_not_open_a_new_bucket`, `Refresh_and_logout_are_never_rate_limited`, `Device_with_exhausted_login_budget_can_still_refresh`; vitest `api.test.ts` „Token-Refresh“; `proxy-xff-check.sh` selbst `PROXY-XFF OK`. Echte Geräte und Traefik → Human-Items 2, 3 |
| 2 | Gezeigte, nicht beantwortete Karte kommt wieder statt `New` zu bleiben; Doppel-Tipp oder ungültige Runden-/Item-ID ergibt sauberes 4xx/409 mit lesbarer Meldung, nie 500 | ✓ VERIFIED | `LearningService.StartSessionAsync` legt keinen `ReviewState` mehr an; `alreadySeen` schließt nur `State != New` aus, eindeutige Ordnung `ThenBy(c => c.Id)`; Tagesbudget zählt nur `LastReviewedAt != null && FirstSeenAt >= dayStart`. Erste Antwort legt Lernstand an und setzt `FirstSeenAt`. `SessionEndpoints.cs` liefert 404 (Runde/Karte/Kind/Set, deutsche Sätze), 400 `size`, 409 bei `DbUpdateConcurrencyException` bzw. Unique-Verletzung (`IsConcurrencyToken` auf `AnsweredAt`, `LearningConfigurations.cs:91`). XP/Münzen als `wert = wert + n` per `ExecuteUpdateAsync` in einer Transaktion; Abschluss beansprucht die Runde mit `CompletedAt == null`. Frontend: `SessionPage.tsx` Ref `sending` gegen zweiten Tipp/Enter. Tests (selbst grün, Verhalten belegt): `Abgebrochene_Runde_bietet_dieselben_neuen_Karten_wieder_an`, `Tageslimit_sinkt_erst_mit_der_ersten_Antwort`, `Altbestand_von_heute_verbraucht_kein_Tageslimit`, `Unbekannte_Runde_ergibt_404_mit_Text`, `Fremde_Aufgabe_ergibt_404_mit_Text`, `Waehrend_der_Runde_geloeschte_Karte_ergibt_404_statt_500`, `Gleichzeitige_Antworten_auf_dieselbe_Aufgabe_ergeben_200_und_409` (deterministisch über `LockRowsAsync`, prüft eine review_log-Zeile und XP), `Gleichzeitige_Antworten_auf_zwei_Aufgaben_verlieren_keine_Gutschrift`, `Gleichzeitige_Abschluesse_vergeben_den_Bonus_einmal`; vitest `SessionPage.test.tsx` „Lernrunde“ |
| 3 | Nach verpasstem Tag zeigt die Startseite die tatsächliche Serie; Eltern-Übersicht und Ampel zählen dieselben Wörter als gemeistert (ease ≥ 2.1, einmal definiert) | ✓ VERIFIED | `StreakRules.CurrentStreak` (rein, ohne Schreibwirkung), genutzt in `LearnerEndpoints.cs:248`. `MasteryRules.cs` einzige Definition (`MinEaseFactor = 2.1`, `MinRepetitions = 3`, `MaxLapses = 1`, Wort = alle Richtungen); einzige Aufrufer `LearnerEndpoints.cs:252` (Übersicht) und `:277` (Ampel), beide über dieselbe Ladefunktion `WordStatesAsync`. Grep über `backend/src` findet keine zweite `2.1`-/Ease-Regel. Gemeistert impliziert nicht „red“ (Lapses ≤ 1, Ease ≥ 2.1 > 1.8), also Übersicht == grüne Ampel. Texte: `LearnHomePage.tsx:60-81` („Starte heute deine Serie!“, „Sicher gelernt: m von n Wörtern/Wort“), `ProgressPage.tsx:88,100`. Tests (selbst grün): `Uebersicht_zeigt_die_aktuelle_Serie` (Theory 1/2/3 Tage), `Uebersicht_schreibt_die_gerissene_Serie_nicht_zurueck`, `Uebersicht_zaehlt_sicher_gelernte_Woerter_wie_die_Ampel`, `GamificationTests.CurrentStreak*` (7 Fälle inkl. Monatswechsel), `MasteryRulesTests`. Echter Tageswechsel → Human-Item 5 |
| 4 | Nach Löschen von Set, Eintrag oder Kind (mit Bestätigung) erscheint kein entferntes Wort in einer Runde und keine Lernhistorie des Kindes bleibt; Umbenennen/Korrigieren behält den Lernstand; neue Formulare und Löschdialog bestehen Matrix und axe | ✓ VERIFIED | Fremdschlüssel per `dotnet ef` (`20261017182305_ReferentialIntegrity.cs`: 10 `AddForeignKey`, kein `Sql(`, ein einziger Commit `7fb13ac`): Cascade auf `card`, `learner_profile`, `app_user`; `SetNull` für Rundenbezug. `LearnerEndpoints.cs:177-189` löscht nur `app_user` mit Rolle Learner per `ExecuteDeleteAsync`; keine Löschlisten (`RemoveRange` 0 Treffer). `OrphanCleanup.RunAsync` direkt vor `MigrateAsync` (`Program.cs:236-237`), nur wenn `ReferentialIntegrity` noch nicht angewandt. PATCH Set / PUT Vokabel ändern an Ort und Stelle (`SetEndpoints.cs:23,26`). UI: `ConfirmDialog` (`dialog.tsx`, `alertdialog`, `returnFocusRef`, Scrim-Klick blockiert, `busy` sperrt Esc/Abbrechen) in `ChildFormPage.tsx:113-138` und `SetDetailPage.tsx` (Set, Vokabel). Tests (selbst grün): `Elternteil_loescht_Kind_samt_Lerndaten_und_Geschwister_bleibt_unveraendert`, `Geraet_des_geloeschten_Kindes_bekommt_401_und_404`, `Set_loeschen_entfernt_Lerndaten_…`, `Vokabel_loeschen_entfernt_die_Lerndaten_ihrer_zwei_Karten`, `Rundenstart_mit_geloeschtem_oder_unbekanntem_Set_ergibt_404_ohne_Runde`, `Umbenennen_behaelt_IDs_und_Lernstand`, `Vokabel_korrigieren_behaelt_IDs_Lernstand_und_Zusatzfelder`, `Altinstallation_mit_Waisen_startet_und_behaelt_gueltige_Zeilen`, `Wiederholte_Bereinigung_aendert_nichts_…`. Matrix: vitest `ChildFormPage.test.tsx` „Kind löschen“, `SetDetailPage.test.tsx` „Set umbenennen“, „Set löschen“, „Vokabel bearbeiten“, „Vokabel löschen“, „Erfassung“ (selbst grün). axe/Tastatur/200 %: `manage.spec.ts` „Set-Dialoge barrierefrei“, „Vokabel-Dialoge barrierefrei“, `children.spec.ts`, `keyboard-zoom.spec.ts` drei Dialog-Tests — gelistet, Lauf übernommen (s. Evidenzbasis) |
| 5 | API-Integrationstests laufen gegen echtes PostgreSQL in CI und decken Login, Refresh, Geschwister-Trennung und jede FIX-Anforderung ab, alle grün | ✓ VERIFIED | Nach D-19 gilt ein lokaler Lauf mit den CI-Befehlen (CI läuft nur auf `master`, kein Push). `backend-test.sh` = `dotnet build -c Release /warnaserror` + `dotnet test --no-build` gegen `postgres:17-alpine` wie `ci.yml:22,57,60`; entfallen sind nur TRX-Logger und Coverage-Sammlung (Artefakte). Selbst grün: 230 Api.Tests. Abdeckung: Login/Kinder-Login/Sperre/Refresh-Rotation/Wiederverwendung (`AuthEndpointTests`), Geschwister (`SiblingIsolationTests`: Start, Antwort, Abschluss, Sync, Übersicht 403, Lernstand/XP unverändert), FIX-01 (`RateLimitTests`), FIX-02 (`SetDeleteTests`), FIX-03/04/09 (`SessionEndpointTests`), FIX-05/06 (`OverviewTests`). Der echte CI-Lauf folgt mit dem Push (Phase 3) |

**Score:** 5/5 Wahrheiten verifiziert (0 present, behavior-unverified)

**Einschränkung zu 4:** Der axe- und 200-%-Teil stützt sich auf übernommene e2e-Läufe (vollständig auf `ebdca52`, Teillauf auf `3f55d4f`). Selbst beobachtet sind nur die gelisteten Tests und die vitest-Matrizen.

### Plan-Must-Haves

- Artefakte 36/37, Key-Links 24/25 laut `gsd-tools`. Die je eine Abweichung ist ein Werkzeug-Fehlalarm: Der Glob `Migrations/*_ReferentialIntegrity.cs` wird nicht aufgelöst. Manuell: Datei `20261017182305_ReferentialIntegrity.cs` vorhanden, 10 `AddForeignKey`, Designer und Snapshot dazu → VERIFIED / WIRED.
- Verhaltens-Truths mit Zustandswechsel oder Reihenfolge-Invariante (Doppel-Antwort, gleichzeitige Gutschrift, einmaliger Abschlussbonus, Startbereinigung idempotent, Serie ohne Schreibwirkung) sind durch selbst ausgeführte, benannte Integrationstests belegt, nicht nur durch Vorhandensein.
- Backstop-Truth 02-01 („Ansehen ohne Antwort ist unbegrenzt, steht im Konzept §6.3“): ausdrücklich belegt in `Documentation/WordQuest_Konzept_und_Architektur.md:282`.
- Backstop-Truths 02-03/04/05 (lange Namen, Dialoge bei 200 %): e2e-Tests vorhanden („Dialog Kind löschen bei 200 %“, „Dialoge der Set-Seite bei 200 %“, „Dialoge der Vokabelzeile bei 200 %“, „Langer Set-Titel bei 320 px“, „Lange Vokabel bei 320 px“), Lauf übernommen; echte Geräte → Human-Item 1.

### Prohibitions

| Plan | Verbot | Tier | Urteil | Beleg |
|------|--------|------|--------|-------|
| 02-01 | Bewertung und Terminierung allein auf dem Server | judgment (unresolved) | hält (nicht-autoritativ, Flag: unverified-prohibition — human review recommended) | `SessionPage.tsx:284-305` zeigt nur Serverfelder; Diff im Lernbereich ändert nur Fehleransicht und Sende-Riegel |
| 02-02 | Keine Tabelle-für-Tabelle-Löschung | resolved | hält | `RemoveRange` 0 Treffer; `SetEndpoints.cs:129,275` entfernen nur die Wurzel (Set, Eintrag), `LearnerEndpoints.cs:181` nur `app_user` |

### Erforderliche Artefakte

| Artefakt | Erwartung | Status | Details |
|----------|-----------|--------|---------|
| `backend/src/WordQuest.Infrastructure/LearningService.cs` | Auswahl ohne Anlage, Budget, atomare Gutschrift | ✓ VERIFIED | s. SK 2 |
| `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs` | 404/400/409 | ✓ VERIFIED | alle Texte als Konstanten, kein 500-Pfad im Code |
| `backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.cs` | per `dotnet ef`, unverändert | ✓ VERIFIED | Werkzeug-Fehlalarm (Glob), manuell geprüft |
| `backend/src/WordQuest.Infrastructure/OrphanCleanup.cs` | idempotente Bereinigung vor Migration | ✓ VERIFIED | `Program.cs:236` |
| `backend/src/WordQuest.Modules.Learning/Services/MasteryRules.cs` | eine Regel | ✓ VERIFIED | zwei Aufrufer, beide in `LearnerEndpoints.cs` |
| `backend/src/WordQuest.Modules.Gamification/Services/StreakRules.cs` | `CurrentStreak` rein | ✓ VERIFIED | einziger Aufrufer `LearnerEndpoints.cs:248` |
| `backend/src/WordQuest.Modules.Content/Services/ContentRules.cs` | Längenregel 200 | ✓ VERIFIED | in Create/Update/AddEntry/UpdateEntry |
| `frontend/src/components/ui/dialog.tsx` | gemeinsamer Dialog-Baustein | ✓ VERIFIED | drei Aufrufer (Kind, Set, Vokabel) |
| `frontend/nginx.conf`, `frontend/nginx-traefik-realip.conf` | XFF-Kette | ✓ VERIFIED | `PROXY-XFF OK` selbst |
| `gate/backend-test.sh`, `gate/proxy-xff-check.sh` | Gate-Hilfen | ✓ VERIFIED | selbst ausgeführt, Exit 0 |
| Übrige Plan-Artefakte (Tests, Seiten) | — | ✓ VERIFIED | `verify.artifacts` ohne Befund |

### Key-Link-Verifikation (Auszug)

| Von | Nach | Via | Status |
|-----|------|-----|--------|
| `SessionPage.tsx` | `SessionEndpoints.cs` | `POST /sessions/{id}/answers`, `ApiError.message = detail` | WIRED |
| `LearnerEndpoints.cs` | `LearningService.cs` | gleiche Budgetregel `LastReviewedAt != null`, `dueToday` = Review/Relearning | WIRED |
| `Program.cs` | `OrphanCleanup.cs` | direkt vor `MigrateAsync` | WIRED |
| `ChildFormPage.tsx` / `SetDetailPage.tsx` | `LearnerEndpoints.cs` / `SetEndpoints.cs` | `DELETE`, `PATCH`, `PUT` | WIRED |
| `Program.cs` | Rate-Limiter-Partition | `UseForwardedHeaders` vor `UseRateLimiter` | WIRED |
| `docker-compose.yml` | `nginx-traefik-realip.conf` | Volume im Dienst `web`, nicht in `docker-compose.quick.yml` | WIRED |
| `LearnerEndpoints.cs` | `MasteryRules.cs`, `StreakRules.cs` | `IsWordMastered`, `CurrentStreak` | WIRED |

### Datenfluss (Level 4)

| Artefakt | Wert | Quelle | Echte Daten | Status |
|----------|------|--------|-------------|--------|
| `LearnHomePage.tsx` | `streak`, `cardsMastered/cardsTotal` | `GET /learners/{id}/overview` → `StreakRules`/`WordStatesAsync` über EF | ja | ✓ FLOWING |
| `ProgressPage.tsx` | Kennzahl „m/n Wörter sitzen sicher“, Ampel | Übersicht + `traffic-light` | ja | ✓ FLOWING |
| `SessionPage.tsx` | Fehlertext 404/409 | `detail` der Problem-Antwort | ja | ✓ FLOWING |

### Verhaltens-Stichproben

| Verhalten | Befehl | Ergebnis | Status |
|-----------|--------|----------|--------|
| Backend-Build + alle Tests gegen PostgreSQL 17 | `bash …/gate/backend-test.sh` | 0 Warnungen; 132/132, 230/230; Exit 0 | ✓ PASS |
| Frontend lint, typecheck, vitest, Design-Gates | `npm run lint && … && npm run design:classes` | alle Exit 0; 216/216 | ✓ PASS |
| XFF-Kette nginx beider Stacks | `bash …/gate/proxy-xff-check.sh` | `PROXY-XFF OK` | ✓ PASS |
| e2e-Specs vorhanden | `npx playwright test --list` | 47 Tests, 7 Dateien | ✓ PASS |
| e2e-Lauf | — | vollständig auf `ebdca52` 46 + 1 skip (SUMMARY), Teillauf `3f55d4f` 23 + 1 skip (Koordinator) | ? übernommen |
| Install-Smoke | — | `SMOKE OK` auf `ebdca52` (SUMMARY) | ? übernommen |

### Probe-Ausführung

Keine `scripts/*/tests/probe-*.sh` vorhanden, keine Probes in PLAN/SUMMARY deklariert. Die Phasen-Prüfskripte unter `gate/` wurden selbst ausgeführt (s. o.).

### Anforderungsabdeckung

| Anforderung | Plan | Status | Beleg |
|-------------|------|--------|-------|
| FIX-01 | 02-06 | ✓ SATISFIED | SK 1 |
| FIX-02 | 02-02, 02-04, 02-05 | ✓ SATISFIED | SK 4, `SetDeleteTests` |
| FIX-03 | 02-01 | ✓ SATISFIED | SK 2 |
| FIX-04 | 02-01, 02-02, 02-03 | ✓ SATISFIED | SK 2, Gerät des gelöschten Kindes 401/404 |
| FIX-05 | 02-07 | ✓ SATISFIED (echter Tageswechsel offen) | SK 3 |
| FIX-06 | 02-07 | ✓ SATISFIED | SK 3 |
| FIX-09 | 02-01 | ✓ SATISFIED | SK 2, Konzept §6.3 Restgrenze |
| PAR-03 | 02-02, 02-03 | ✓ SATISFIED | SK 4 |
| PAR-04 | 02-04, 02-05 | ✓ SATISFIED | SK 4 |
| QUAL-01 | 02-01, 02-02, 02-04 bis 02-07 | ✓ SATISFIED (lokal nach D-19) | SK 5 |

Keine verwaisten Anforderungen: alle 10 Phase-2-IDs aus `REQUIREMENTS.md:101-112` stehen in mindestens einem Plan.

### Entscheidungen D-16 bis D-19

| Entscheidung | Status | Beleg |
|--------------|--------|-------|
| D-16 Wörter als Zähleinheit, Regel und Aggregation je einmal | ✓ eingehalten | `MasteryRules`, `WordStatesAsync` für Übersicht und Ampel |
| D-17 ein Dialog-Baustein für alle drei Löschungen, Set löschen mit Oberfläche | ✓ eingehalten | `ConfirmDialog` in `ChildFormPage`, `SetDetailPage` (`DeleteSet`, `DeleteEntry`) |
| D-18 Migration unberührt, Bereinigung vor `MigrateAsync`, mit Test | ✓ eingehalten | ein Commit auf der Migration, kein `Sql(`; `MigrationTests` (3) grün |
| D-19 lokaler Lauf mit CI-Befehlen als QUAL-01-Beleg | ✓ eingehalten | selbst wiederholt (Backend, Frontend ohne `npm ci`/`build`, s. Hinweis) |

Decision Coverage (`check.decision-coverage-verify`): 19/19 Entscheidungen in den Artefakten wiedergefunden.

Hinweis zu D-19: Der eigene Frontend-Lauf folgte dem Auftrag und enthielt `npm ci` und `npm run build` nicht. Beides lief laut 02-07-SUMMARY auf `61a25a5` in `node:22` grün; seitdem keine Änderung unter `frontend/src`.

### Test-Qualität

| Testdatei | Anforderung | Aktiv | Übersprungen | Zirkulär | Stärke | Urteil |
|-----------|-------------|-------|--------------|----------|--------|--------|
| `SessionEndpointTests.cs` | FIX-03/04/09 | 19 | 0 | nein | Wert + Verhalten (Zeilen, XP, Texte) | ok |
| `RateLimitTests.cs`, `AuthEndpointTests.cs` | FIX-01, QUAL-01 | 7 + 10 | 0 | nein | Status + Verhalten | ok |
| `LearnerDeleteTests.cs`, `SetDeleteTests.cs`, `MigrationTests.cs` | PAR-03, FIX-02, D-18 | 6 + 10 + 3 | 0 | nein | Zeilen je Tabelle | ok |
| `SetEditTests.cs` | PAR-04 | 17 | 0 | nein | IDs + Lernstand | ok |
| `OverviewTests.cs`, `MasteryRulesTests.cs`, `GamificationTests.cs` | FIX-05/06 | 4 + … | 0 | nein | Wert | ok |
| `SiblingIsolationTests.cs` | QUAL-01 | 1 (mehrere Endpunkte) | 0 | nein | Status + unveränderter Zustand | ok |

Keine `skip`/`only`/`fixme` in den Dateien der Phase. Keine zirkulären Erwartungswerte gefunden.

### Anti-Patterns

| Datei | Zeile | Muster | Schwere | Auswirkung |
|-------|-------|--------|---------|------------|
| 67 geänderte Dateien der Phase | — | TBD/FIXME/XXX/TODO/HACK, Platzhalter, skip | — | keine Treffer |
| `Documentation/WordQuest_Konzept_und_Architektur.md` | 511 | „API-Integrationstests gegen echtes PostgreSQL sind für v1.0 geplant (`QUAL-01`)“ | ⚠️ Warning | Doku widerspricht dem Code (QUAL-01 ist umgesetzt, Tests gibt es seit Phase 1). Stammt aus `e457360b` (2026-09-24). Die 02-07-Truth nennt nur FIX-/PAR-IDs und gilt deshalb wörtlich, die AGENTS-Regel „Doku = Code“ nicht |
| `.planning/phases/02-…/02-07-SUMMARY.md` | 192, 125 | führt „CSV-Import … ergibt weiter 500“ als offen und Gate-Zahlen 128/229 | ⚠️ Warning | überholt durch `0445f5b`/`3f55d4f` (Test `Import_bestaetigen_mit_zu_langer_Zeile_uebernimmt_nur_die_gueltigen`, jetzt 132/230). Planungsdoku nachziehen |
| `frontend/src/features/manage/SetDetailPage.tsx` | 1-765 | 765 Zeilen, 8 Komponenten in einer Datei | ℹ️ Info | AGENTS „keine Gott-Dateien“; Unterkomponenten sind sauber getrennt, aber in einer Datei. Kein Defekt |
| `backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs` | 80 | wörtliches NUL-Byte im Schlüssel `$"{source}␀{target}"` | ℹ️ Info | seit `3d0684a`; git behandelt die Datei als binär (`git diff --stat` zeigt `Bin`), Text-Diffs und Reviews der CSV-Fixes `0445f5b`/`3f55d4f` sehen den Inhalt nicht. `\0` als Escape wäre gleichwertig |

Keine Blocker.

### Menschliche Prüfung erforderlich

1. **Tablet und echter 200-%-Zoom für alle fünf Dialoge** — Kind löschen, Set umbenennen, Set löschen, Vokabel bearbeiten, Vokabel löschen; nur Tastatur; lange Namen. Erwartung: Fokus, Esc/Enter, Umbruch, Sheet scrollt innen.
2. **Zwei echte Geräte im Heimnetz** — Gerät A bis zur Sperre, Gerät B meldet sich in derselben Minute an.
3. **Traefik mit Zertifikat** — echte Client-IP, gefälschter `X-Forwarded-For` wirkungslos.
4. **Migration auf dem Pi** — bestehende Phase-1-Installation, `ReferentialIntegrity` läuft, Lernstand bleibt, Testkind löschbar.
5. **Serie über einen echten Tageswechsel** — Tag 2 und 3 aussetzen ohne Retter → „Starte heute deine Serie!“ / „Keine laufende Serie“.
6. **Prohibition 02-01 bestätigen** — Server bewertet und terminiert allein (LLM-Urteil: hält).

### Zusammenfassung

Keine Lücken. Alle fünf Erfolgskriterien sind im Code verdrahtet und durch selbst ausgeführte Tests belegt: Backend 132 + 230 grün gegen PostgreSQL 17 bei warnungsfreiem Release-Build, Frontend-Gate grün mit 216 vitest-Fällen, Proxy-Prüfung grün. Die Lern-Fixes (FIX-03/04/09) und die Nebenläufigkeit sind durch deterministische HTTP-Tests mit Zeilensperre abgedeckt. Löschen läuft über Fremdschlüssel aus einer unveränderten `dotnet ef`-Migration mit Startbereinigung davor (D-18). Die Meisterschaftsregel steht genau einmal, Übersicht und Ampel zählen dieselben Wörter. Zwei Einschränkungen: Die e2e-Belege für axe, Tastatur und 200 % sind übernommen (vollständig auf `ebdca52`, Teillauf auf `3f55d4f`), und die Doku hat zwei veraltete Stellen (Konzept Z. 511 zu QUAL-01, 02-07-SUMMARY zum CSV-Import). Offen sind sechs menschliche Prüfungen: Tablet/Zoom, zwei Geräte, Traefik, Pi-Migration, echter Tageswechsel und die Bestätigung der Prohibition 02-01.

---

_Verifiziert: 2026-10-17T21:11:27Z_
_Verifier: Claude (gsd-verifier)_
