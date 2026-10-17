---
phase: 02-reliable-learning-clean-family-data
plan: 07
subsystem: learning
tags: [streak, mastery, overview, traffic-light, problem-details, validation, gate]
status: complete

requires:
  - phase: 02-06
    provides: "Stand nach FIX-01; AuthEndpointTests, SiblingIsolationTests, Gate-Skripte backend-test.sh und proxy-xff-check.sh"
provides:
  - "StreakRules.CurrentStreak(profile, today): angezeigte Serie ohne Schreibwirkung (FIX-05, D-12)"
  - "MasteryRules.IsMastered / IsWordMastered im Learning-Modul, einzige Stelle der Meisterschaftsregel (FIX-06, D-05, D-16)"
  - "Übersicht: Streak aus CurrentStreak, cardsMastered/cardsTotal zählen Wörter (= grüne Ampel); Ampel und Übersicht über dieselbe Hilfsfunktion WordStatesAsync"
  - "Texte Serie 0/1/n und „Sicher gelernt: m von n Wörtern“ / „Wörter sitzen sicher“"
  - "POST /sets/{id}/entries: fehlendes Wort, Emoji > 16, Beispiel > 500 ergeben 400 statt 500"
  - "Fehlender oder unlesbarer JSON-Body bzw. nicht lesbarer Parameter: in jeder Umgebung 400 „Die Anfrage ist unvollständig oder nicht lesbar.“"
  - "Phasen-Gate: funktional gleichwertiger lokaler Lauf der CI-Befehle, alle e2e-Specs, Install-Smoke, Proxy-Prüfung grün"
affects: [03]

actuals:
  tokens: 12900
  tasks: 3
  commits: 6
plan_head_before: 98d2ecb0ec31821f59bdadb75b5735e354275c17
plan_head_after: ebdca52cca2e2dbefed8e58a923a4990b980b79e

tech-stack:
  added: []
  patterns:
    - "Angezeigte Werte beim Lesen aus einer reinen Domänenfunktion berechnen, gespeichert wird nur beim fachlichen Ereignis (Rundenabschluss)"
    - "Eine Lade-Hilfe (WordStatesAsync) für alle Auswertungen je Wort, damit Übersicht und Ampel nicht auseinanderlaufen"
    - "BadHttpRequestException zentral: ThrowOnBadRequest, StatusCodeSelector, SuppressDiagnosticsCallback, CustomizeProblemDetails"

key-files:
  created:
    - backend/src/WordQuest.Modules.Learning/Services/MasteryRules.cs
    - backend/tests/WordQuest.Learning.Tests/MasteryRulesTests.cs
    - backend/tests/WordQuest.Api.Tests/OverviewTests.cs
  modified:
    - backend/src/WordQuest.Modules.Gamification/Services/StreakRules.cs
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs
    - backend/src/WordQuest.Api/Program.cs
    - backend/src/WordQuest.Modules.Content/Services/ContentRules.cs
    - backend/tests/WordQuest.Learning.Tests/GamificationTests.cs
    - backend/tests/WordQuest.Api.Tests/AuthEndpointTests.cs
    - backend/tests/WordQuest.Api.Tests/SetEditTests.cs
    - frontend/src/features/learn/LearnHomePage.tsx
    - frontend/src/features/learn/LearnHomePage.test.tsx
    - frontend/src/features/manage/ProgressPage.tsx
    - frontend/src/features/manage/ProgressPage.test.tsx
    - frontend/e2e/children.spec.ts
    - frontend/e2e/learn.spec.ts
    - frontend/e2e/manage.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "Angezeigte Serie: gap ≤ 1 (auch rückwärts laufendes Datum) oder gap 2 mit verfügbarem Retter → gespeicherte Serie, sonst 0; dieselbe Retter-Regel wie RegisterActivity"
  - "Übersicht zählt Wörter mit IsWordMastered; Feldnamen cardsMastered/cardsTotal bleiben (U7)"
  - "Fehlendes Wort beim Hinzufügen gilt als leer und bekommt den Bestandstext „Beide Spalten muessen befuellt sein.“ (Test aus 02-05 bleibt)"
  - "ThrowOnBadRequest überall an, damit Development und Production gleich antworten; BadHttpRequestException wird nicht als Error protokolliert"
  - "FIX-04, FIX-05, FIX-06 und QUAL-01 als erledigt markiert; QUAL-01 per D-19 über den lokalen CI-gleichwertigen Lauf, der echte CI-Lauf folgt mit dem Push in Phase 3"

requirements-completed: [FIX-04, FIX-05, FIX-06, QUAL-01]

duration: 27min
completed: 2026-10-17
---

# Phase 2 Plan 07: Richtige Zahlen und Phasen-Gate – Zusammenfassung

**Die Startseite zeigt nach einer Pause ohne Retter „Starte heute deine Serie!“ statt der alten Serie (`StreakRules.CurrentStreak`, ohne Schreibwirkung). Übersicht und Ampel zählen mit `MasteryRules` dieselben sicher gelernten Wörter. Zwei direkte API-Pfade, die bisher 500 ergaben, liefern jetzt 400 mit deutschem Text. Das automatische Phasen-Gate ist grün.**

## Leistung

- **Dauer:** ca. 27 min (2026-10-17T20:28Z bis 20:55Z), Container-Builds und Smoke eingeschlossen
- **Tasks:** 3 von 3, dazu zwei Übertrags-Fixes, ein Doku-Commit und ein Commit für den Review-Befund
- **Dateien:** 19 (3 neu, 16 geändert), +642 / −60 Zeilen ohne `.planning`

## Task-Commits

1. **Task 1: Tracer aktuelle Serie** – `5bc7057` (fix)
2. **Task 2: Eine Meisterschaftsregel, Wörter statt Karten** – `128b18b` (fix)
3. **Übertrag (a): Vokabel per API ohne Wort / mit zu langem Zusatzfeld** – `87274f1` (fix)
4. **Übertrag (b): fehlender oder kaputter JSON-Body** – `4652102` (fix)
5. **Konzept zu (a) und (b)** – `61a25a5` (docs)
6. **Review-Befund 1** – `ebdca52` (fix)

Task 3 (Gate-Lauf) hat keinen eigenen Code-Commit: Der Konzept-Abgleich fand keinen offenen Treffer mehr (siehe unten). Sechs Commits statt „ein atomarer Commit“ (Plan-Ziel, D-01), weil der Ausführungsauftrag einen Commit je Task bzw. Anliegen verlangt. Kein Push.

## TDD-Belege

**Task 1, Schritt 1 (vor dem Code):**
- `StreakRulesTests`: Build rot, `error CS0117: 'StreakRules' does not contain a definition for 'CurrentStreak'` (7 Stellen).
- `OverviewTests` (nur Api-Projekt gebaut, damit das Verhalten sichtbar wird): `Failed: 2, Passed: 3`. Rot: `Uebersicht_zeigt_die_aktuelle_Serie(daysAgo: 3, expected: 0)` und `Uebersicht_schreibt_die_gerissene_Serie_nicht_zurueck`, je `Expected: 0, Actual: 5`. Gestern, vorgestern mit Retter und „nie aktiv“ waren schon vorher richtig.
- e2e „Serie startet bei 0 und zählt nach der ersten Runde“ gegen den alten Stack: `1 failed`, `getByText('Starte heute deine Serie!')` nicht gefunden.
- Danach: `backend-test.sh` mit Filter Exit 0, Build ohne Warnung, Learning.Tests 14 passed, Api.Tests 5 passed; `children.spec.ts` 8 passed; design:classes „keine alten Klassen“, lint, typecheck, build Exit 0.
- Tracer-Gate: Verify end-to-end grün, erst danach Task 2.

**Task 2, Schritt 1 (vor dem Code):**
- vitest `LearnHomePage ProgressPage`: `4 failed | 10 passed (14)`. Rot: die drei Meisterschaftstexte 0/0, 0/1, 2/5 und „Wörter sitzen sicher“. Die Serien-Texte waren nach Task 1 schon grün.
- `MasteryRulesTests`: Build rot, `error CS0103: The name 'MasteryRules' does not exist`.
- `OverviewTests` (Api-Projekt): `Failed: 1, Passed: 5`, `Uebersicht_zaehlt_sicher_gelernte_Woerter_wie_die_Ampel` mit `Expected: 1, Actual: 3`: Die alte Übersicht zählte drei gemeisterte Karten statt eines Wortes.
- Danach: Backend-Filter (MasteryRules, Overview, LearnerEndpoint) Learning.Tests 10 passed, Api.Tests 53 passed; vitest 14 passed; `learn.spec.ts` + `manage.spec.ts` 24 passed.

**Übertrag (a) und (b), vor dem Code:** `Failed: 11, Passed: 1` (Api-Projekt).
- (b) Alle sechs Fälle von `Anfrage_ohne_lesbaren_Body_ergibt_400_mit_deutschem_Text` (login ohne Body, leer, `{x`, `null`; learner-login ohne Body; refresh `{x`) ergaben `InternalServerError`.
- (a) Alle fünf Fälle von `Hinzufuegen_ohne_Wort_oder_mit_zu_langem_Zusatzfeld_ergibt_400_statt_500` ergaben `InternalServerError`.
- Grün schon vorher: `Hinzufuegen_mit_Zusatzfeldern_an_der_Grenze_ergibt_201` (16 bzw. 500 Zeichen). Der Fall sichert ab, dass die neue Prüfung nicht strenger ist als die Spalten.
- Danach: Filter Auth/SetEdit/RateLimit `Passed: 50, Failed: 0`.

**Übertrag (b) am laufenden Stack geprüft (vor dem Fix), wie im Auftrag verlangt:**
- e2e-Stack (`ASPNETCORE_ENVIRONMENT=Development`, über nginx 127.0.0.1:18080): `login`, `learner-login`, `refresh`, `logout` je ohne Body, mit leerem JSON-Body, `{x` und `null` → **500**; `text/plain` → 415.
- Production-Probe (dasselbe API-Image mit `ASPNETCORE_ENVIRONMENT=Production`, eigene Datenbank im e2e-Netz): dieselben Fälle → **400**, aber englisch `"title":"Bad Request"` ohne `detail`.
- Ursache: `RouteHandlerOptions.ThrowOnBadRequest` ist nur in Development an, und der Exception-Handler machte daraus 500.
- Nach dem Fix in beiden Umgebungen: alle 16 Fälle 400 mit `"title":"Ungültige Anfrage","detail":"Die Anfrage ist unvollständig oder nicht lesbar."`, `text/plain` weiter 415. Im Production-Log steht für diese Anfragen kein `fail:`. Die zwei `fail:`-Zeilen im Log stammen vom Start: Die Probe-Datenbank existierte noch nicht.

## Automatisches Gate

**Status: grün.** Das ist ein funktional gleichwertiger lokaler Lauf der CI-Befehle aus `.github/workflows/ci.yml` (D-19), nicht wörtlich derselbe: `--logger "trx;LogFileName=test-results.trx"` und `--collect:"XPlat Code Coverage"` (ci.yml Zeilen 62-63) entfallen, weil sie nur Artefakte für den Upload erzeugen. Die CI wertet keine Coverage-Schwelle aus. Der echte CI-Lauf folgt mit dem Push (Phase 3).

| Schritt | Befehl | Stand | Exit | Ergebnis |
|---|---|---|---|---|
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` (Release, `/warnaserror`, PostgreSQL 17) | `ebdca52` | 0 | `0 Warning(s)`, `0 Error(s)`; Learning.Tests **128 passed**, 0 failed, 0 skipped; Api.Tests **229 passed**, 0 failed, 0 skipped |
| Frontend (Node 22) | `docker run … node:22 sh -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'` | `61a25a5` | 0 | `v22.23.3`; vitest **14 Dateien, 216 passed**; DESIGN.md `errors: 0, warnings: 0` (keine Kontrast-Warnung); „keine alten Klassen“ |
| e2e, frischer Stack | `npm --prefix frontend run e2e:stack && npm --prefix frontend run e2e` | `ebdca52` | 0 / 0 | **46 passed, 1 skipped** (`first-run.spec.ts`, läuft nur im Install-Smoke), 0 failed, 0 flaky, kein 429 |
| e2e-Stack abbauen | `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v` | – | 0 | – |
| Install-Smoke | `bash .planning/phases/01-…/smoke/setup-smoke.sh` | `ebdca52` | 0 | `IMAGE OK`, `LOGIN OK`, `RESET OK`, `STARTABBRUCH OK`, `BACKUP OK`, `FIRST RUN OK`, `DEMO-ABBRUCH OK`, `RATE-LIMIT OK`, `SMOKE OK` |
| Proxy-Prüfung | `bash .planning/phases/02-…/gate/proxy-xff-check.sh` | `ebdca52` | 0 | `PROXY-XFF OK` |
| Aufräumen | `bash .planning/phases/02-…/gate/backend-test.sh down` | – | 0 | `wq-p2 entfernt.`; danach `docker ps` ohne `wq-p2-db`, `wq-smoke`, `wq-xff`, `wordquest-e2e`, `wq-prodprobe` (0 Treffer) |
| Keine neue Dependency | `git diff --quiet 98d2ecb -- frontend/package.json frontend/package-lock.json backend/**/*.csproj` | – | 0 | – |

Zwischen `61a25a5` und `ebdca52` hat sich im Frontend nichts geändert (`git diff --quiet 61a25a5 ebdca52 -- frontend`, Exit 0). Das Frontend-Gate gilt deshalb auch für den Endstand. Das Backend-Gate lief nach dem Review-Fix erneut. Der Lauf davor (`61a25a5`) hatte dieselben Zahlen.

**axe (WCAG 2.2 AA):** `@axe-core/playwright` 4.13.0, 0 Verstöße auf allen geprüften Seiten des e2e-Laufs, darunter die neuen bzw. geänderten:
- Lern-Startseite mit Serie 0 und Serie 3 (`learn.spec.ts` „Startseite: axe 0 mit Serie 0 und Serie 3“)
- `/verwalten/fortschritt` mit „Wörter sitzen sicher“ (`manage.spec.ts` „Fortschritt: axe 0“)
- Profilwahl, Ziffernfeld und Lern-Startseite (`learn.spec.ts` „Anmeldung per Tastatur“)

**Konzept-Abgleich (Task 3, Schritt 1):**
- Vor diesem Plan führte `grep -n 'FIX-0[1-69]\|PAR-0[34]'` FIX-05 (§8, „Bekannter Fehler: Eine gerissene Serie …“) und FIX-06 (§9, „Heute steht die Regel an zwei Stellen …“) noch als offen. Beide sind in Task 2 ersetzt.
- Danach 8 Treffer (Zeilen 219, 282, 432, 451, 600, 604, 650, 659). Alle beschreiben den umgesetzten Stand.
- `… | grep -c 'bekannter Fehler\|Bekannter Fehler\|geplant für v1.0\|v1.0 geplant'` ergibt **0**.
- In Zeile 432 steht weiter „Kein Streak-Zähler vor Tag 3 — geplant, nicht umgesetzt“. Das ist kein FIX-05-Bestandteil, der Plan lässt es ausdrücklich offen.

## Phasenabnahme (manuell)

**Status: offen.** Die Phase gilt trotz grünem Gate nicht als vollständig verifiziert.

| Prüfung | Quelle | Status | Datum / Gerät / Ergebnis |
|---|---|---|---|
| Dialoge „Kind löschen“ auf dem Tablet und bei echtem Browser-Zoom 200 % nur per Tastatur | 02-03 Human-Check | offen | UNBEKANNT: nicht durchgeführt |
| Dialoge „Set umbenennen“, „Set löschen“ auf dem Tablet und bei 200 % Zoom per Tastatur | 02-04 Human-Check | offen | UNBEKANNT: nicht durchgeführt |
| Dialoge „Vokabel bearbeiten“, „Vokabel löschen“ auf dem Tablet und bei 200 % Zoom per Tastatur | 02-05 Human-Check | offen | UNBEKANNT: nicht durchgeführt |
| Zwei echte Geräte im Heimnetz (Gerät A gesperrt, Gerät B meldet sich an) | 02-VALIDATION Manual-Only, FIX-01 | offen | UNBEKANNT: nicht durchgeführt |
| Traefik-Stack mit Zertifikat (echte Client-IP, gefälschter X-Forwarded-For wirkungslos) | 02-VALIDATION Manual-Only, FIX-01 | offen | UNBEKANNT: nicht durchgeführt |
| Dialoge PAR-03/PAR-04 auf dem Tablet und bei 200 % Browser-Zoom | 02-VALIDATION Manual-Only | offen | UNBEKANNT: nicht durchgeführt (deckt sich mit den drei Human-Checks oben) |
| Migration auf einem Raspberry Pi 5 mit bestehender Phase-1-Installation | 02-VALIDATION Manual-Only, FIX-02/PAR-03 | offen | UNBEKANNT: nicht durchgeführt |
| Serie am nächsten Tag (echter Tageswechsel, Tag 2 und 3 ausgesetzt ohne Retter → „Starte heute deine Serie!“) | 02-VALIDATION Manual-Only, FIX-05 | offen | UNBEKANNT: nicht durchgeführt; automatisiert belegt über gesetztes `LastActiveDate` (`OverviewTests`) |

`keyboard-zoom.spec.ts` prüft mit kleinerem Viewport (640 × 400) den Reflow. Echten Browser-Zoom und das Tablet ersetzt es nicht.

## Abweichungen vom Plan

### Automatisch behoben

**1. [Regel 2 – FIX-04-Geist, Auftrag] Übertrag (a): POST `/sets/{id}/entries` ergab 500**
- **Gefunden bei:** Review von 02-05 (Befund ohne Änderung).
- **Problem:** Fehlte `sourceText`/`targetText`, endete `BuildEntry` mit einer NullReferenceException. Emoji über 16 und Beispiele über 500 Zeichen endeten als Datenbankfehler.
- **Fix:** `BuildEntry` macht aus einem fehlenden Wort einen leeren Text. Die bestehende Leerprüfung greift dann mit ihrem Bestandstext, der Test „Hinzufuegen_mit_leerer_Spalte_behaelt_den_Bestandstext“ aus 02-05 bleibt gültig. `ContentRules.MaxEmojiLength = 16` und `MaxExampleLength = 500` passen zu den Spalten. Die Feldfehler `emoji`, `exampleSource`, `exampleTarget` sind deutsch.
- **Nebenwirkung:** Der CSV-Import-Bestätigungspfad nutzt dasselbe `BuildEntry`. Eine Zeile ohne Wort wird dort jetzt übersprungen statt 500.
- **Commit:** `87274f1`

**2. [Regel 1 – Bug, Auftrag] Übertrag (b): fehlender oder kaputter JSON-Body ergab 500**
- Im echten e2e-Stack (Development) kam 500, in Production englisch „Bad Request“ (Belege oben).
- **Fix:** Zentral in `Program.cs`. `ThrowOnBadRequest = true` gilt in jeder Umgebung. `StatusCodeSelector` übernimmt den Status der `BadHttpRequestException`, 413 und 415 bleiben also erhalten. `SuppressDiagnosticsCallback` verhindert einen Error-Logeintrag. `CustomizeProblemDetails` setzt bei 400 einen deutschen Titel und Text. `Results.ValidationProblem` läuft nicht über den Handler und ist nicht betroffen.
- **Commit:** `4652102`, Text nach Review `ebdca52`

**3. [Doku = Code] Konzept**
- Die API-Liste nennt die Grenzen von Emoji und Beispielen, der Abschnitt „Fehlerformat“ die 400-Antwort.
- **Commit:** `61a25a5`, `ebdca52`

**4. e2e-Hilfe in `children.spec.ts`**
- `learnerLogin` ist aufgeteilt in `openAsLearner` (gibt die Seite zurück) und `learnerLogin` (schließt den Kontext). Der neue Serien-Test braucht die Kinderseite nach der Anmeldung. Die Zählung der Auth-Aufrufe im Kommentar steigt von 6 auf 8.

**5. e2e „Startseite: axe 0 mit Serie 0 und Serie 3“ ohne Service Worker**
- `page.route` sieht Antworten über den Service Worker nicht (Muster aus `manage.spec.ts` „Reflow“). Deshalb steht der Test in einem `test.describe` mit `serviceWorkers: 'block'`. Ersetzt wird nur das Feld `streak` der echten Übersicht.

### Nicht im Plan, offen gelassen

- **CSV-Import mit Wort über 200 bzw. Emoji über 16 Zeichen ergibt weiter 500** (Befund aus 02-04, `ConfirmImportAsync` prüft keine Länge). Anders als (a) ist das über die Oberfläche erreichbar. Nicht geändert: Ob solche Zeilen schon in der Vorschau als Problem markiert, beim Bestätigen übersprungen oder mit 400 abgelehnt werden, ist eine Produktentscheidung. Zuordnung: FIX-04-Geist, aber nicht der Wortlaut von FIX-04 (Session-/Item-IDs, Doppel-Tipp). Empfehlung: in `CsvVocabularyParser` dieselben Grenzen aus `ContentRules` als Zeilenproblem melden.

## Review (AGENTS.md „Review“, D-02)

Geprüft hat eine unabhängige zweite Instanz (`claude -p`, nur Lesen: Read/Grep/Glob, `git diff/show/log`). Grundlage war der Diff `98d2ecb..61a25a5` ohne `.planning`, geprüft gegen FIX-05, FIX-06, die Überträge (a) und (b) und AGENTS.md. Ergebnis: **kein HIGH, kein MEDIUM, vier LOW.**

| # | Schwere | Befund | Umgang |
|---|---|---|---|
| 1 | LOW | `ThrowOnBadRequest` gilt für jede Bindung. Ein nicht lesbarer Query-Parameter (z. B. `setId=abc` an der Ampel) bekam den Text „…keine lesbaren Daten“. | Behoben (`ebdca52`): Text jetzt „Die Anfrage ist unvollständig oder nicht lesbar.“, Kommentar und Konzept nennen auch Parameter. |
| 2 | LOW | Die Tests belegen 400 nur in Development (WebApplicationFactory-Standard), nicht in Production. | Ohne Teständerung zurückgewiesen. Production bricht in `Program.cs` beim Test-Passwort `devpassword` vor dem Start ab (SecretCheck). Production ist stattdessen mechanisch per `curl` gegen das gebaute API-Image mit `ASPNETCORE_ENVIRONMENT=Production` belegt: 16 von 16 Fällen 400 mit deutschem Text (oben). |
| 3 | LOW | Die Ampel für ein Set lädt alle Lernstände des Kindes, die Übersicht alle Karten der Familie. | Ohne Änderung akzeptiert (T-02-30): Familiengröße im Heimnetz, kein Defekt. |
| 4 | LOW | `cardsTotal` zählt nur Wörter, die Karten haben. | Ohne Änderung: `VocabularyEntry.CreateDefaultCards` legt immer zwei Karten an. Anlegen, Import und Seed laufen alle darüber. |

Ohne Befund geprüft (laut Reviewer):
- CurrentStreak gegen D-12, einschließlich Monatswechsel und rückwärts laufendem Datum; keine Schreibwirkung
- Texte 0/1/n, `tone="neutral"`
- MasteryRules als einzige Stelle; Ampel und Übersicht laufen über dieselbe Ladefunktion, `LastReviewedAt == null` gilt in beiden Pfaden als neu
- Mandanten- und Geschwistertrennung unverändert
- Nebenwirkungen auf 413, 415 und `ValidationProblem`
- Logs ohne personenbezogene Daten, Konventionen, Doku = Code

## Bedrohungen

- T-02-28: `SiblingIsolationTests` im Gate-Lauf grün.
- T-02-29: Das Frontend formatiert nur Serverwerte; vitest prüft Texte zu gesetzten Werten.
- T-02-30: akzeptiert.
- T-02-31: Domänenmodule loggen nicht; `SuppressDiagnosticsCallback` blendet nur `BadHttpRequestException` aus.
- T-02-SC: keine neue Dependency; `node:22` nur als Wegwerf-Container.
- Neue Fläche: keine. Die 400-Antwort verrät nichts über den Body.

## Self-Check: PASSED
