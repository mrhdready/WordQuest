---
phase: 02-reliable-learning-clean-family-data
plan: 01
subsystem: learning
tags: [ef-core, postgres, concurrency, react, playwright, axe]
status: complete

requires:
  - phase: 01
    provides: "Lernrunde (SessionPage, LearningService), Kind-Profile mit GamificationProfile beim Anlegen, ApiFactory mit eigener Datenbank je Factory"
provides:
  - "Rundenstart ohne Lernstand-Anlage; erste Antwort legt den Lernstand an und setzt FirstSeenAt"
  - "Tagesbudget und Übersicht zählen nur beantwortete Lernstände; dueToday nur Review/Relearning"
  - "404/400/409 mit deutschem detail statt 500 auf allen Sitzungs-Endpunkten, inklusive sync"
  - "AnsweredAt als Concurrency-Token; XP/Münzen atomar per ExecuteUpdateAsync; Abschluss atomar beansprucht"
  - "SessionPage: Ref-Riegel gegen Doppel-Tipp, Fokus auf Zurück in der Fehleransicht"
  - "Gate-Hilfe gate/backend-test.sh (D-14) für alle Pläne der Phase"
  - "TestData (Familie, Kinder, Set mit Karten) für weitere Api.Tests"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 20300
  tasks: 3
  commits: 4
plan_head_before: c3534f13a014ce7182a2286e9a19242aa05d201d
plan_head_after: 27b7da46267cbec351520bfc754bd35dd82c0c27

tech-stack:
  added: []
  patterns:
    - "Schreibvorgänge mit Gutschrift: Transaktion in db.Database.CreateExecutionStrategy(), SaveChangesAsync(acceptAllChangesOnSuccess: false), danach ChangeTracker.AcceptAllChanges()"
    - "Zähler nur als wert = wert + n per ExecuteUpdateAsync"
    - "Nebenläufigkeitstests über HTTP: Zeilensperre (SELECT … FOR UPDATE) halten, auf zwei wartende Backends in pg_stat_activity warten, freigeben"
    - "Service liefert null für 'nicht gefunden', Endpoint mappt auf 404 mit deutschem detail"

key-files:
  created:
    - .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh
    - backend/tests/WordQuest.Api.Tests/TestData.cs
    - backend/tests/WordQuest.Api.Tests/SessionEndpointTests.cs
    - frontend/src/features/learn/SessionPage.test.tsx
  modified:
    - backend/src/WordQuest.Infrastructure/LearningService.cs
    - backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs
    - backend/src/WordQuest.Modules.Learning/Entities/ReviewState.cs
    - backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs
    - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
    - frontend/src/features/learn/SessionPage.tsx
    - frontend/e2e/learn.spec.ts
    - Documentation/WordQuest_Konzept_und_Architektur.md

key-decisions:
  - "AnsweredAt statt xmin als Concurrency-Token; keine Migration nötig (MigrateAsync meldete keine ausstehenden Modelländerungen)"
  - "Neue Karte gilt erst mit der ersten Antwort als eingeführt (LastReviewedAt gesetzt, FirstSeenAt = Antwortzeitpunkt); Altbestand ohne Antwort kostet kein Budget"
  - "Kartenauswahl neuer Karten mit Card.Id als eindeutigem Gleichstandsbrecher (Review-Befund)"
  - "Ampel wertet nie beantwortete Lernstände (Altbestand) als neu (Review-Befund)"

requirements-completed: [FIX-03, FIX-09]
requirements-partial: [FIX-04, QUAL-01]

duration: 23min
completed: 2026-10-17
---

# Phase 2 Plan 01: Verlässliche Lernrunde Summary

**Abgebrochene Runden geben neue Karten wieder frei und kosten kein Tageslimit; Sitzungs-Endpunkte antworten mit 404/400/409 und deutschem Text statt 500; Doppel-Tipps und gleichzeitige Antworten werten genau einmal, belegt durch deterministische HTTP-Tests gegen PostgreSQL.**

## Performance

- **Dauer:** ca. 23 min (2026-10-17T17:53:59Z bis 2026-10-17T18:16:38Z)
- **Tasks:** 3 von 3, dazu ein Commit mit Review-Befunden
- **Dateien:** 12 (4 neu, 8 geändert), 1326 Zeilen hinzu, 91 entfernt

## Accomplishments

- `StartSessionAsync` legt keinen `ReviewState` mehr an. Die erste Antwort ist der einzige Anlagepfad (`db.ReviewStates.Add` nur noch in `SubmitAnswerAsync`) und setzt `FirstSeenAt = now`, solange `LastReviewedAt` leer ist.
- Tagesbudget (Rundenstart) und `newRemainingToday` (Übersicht) zählen dieselbe Menge: `LastReviewedAt != null && FirstSeenAt >= dayStart`. `dueToday` zählt nur `Review` und `Relearning` mit `DueAt <= now`.
- Lernstände im Zustand `New` (Altbestand des früheren Starts, Cram-Antworten) werden wieder als neue Karten angeboten.
- `SessionEndpoints`: 404 für unbekannte Runde, Aufgabe, gelöschte Karte und unbekanntes/fremdes Kind; 400 für `size` außerhalb 1–50 und `sync` ohne `answers`; 409 bei gleichzeitiger Doppel-Antwort, doppelter Antwort-Id oder doppelter Anlage des Lernstands. `sync` prüft alle Aufgaben vor dem ersten Schreiben.
- XP und Münzen werden nur noch als `wert = wert + n` per `ExecuteUpdateAsync` in der Transaktion der Antwort bzw. des Abschlusses gutgeschrieben; der Abschluss wird per `UPDATE … WHERE completed_at IS NULL` beansprucht.
- `SessionPage`: gemeinsamer Ref-Riegel für Auswahl, Senden-Button und Enter; `autoFocus` auf „Zurück“ in der Fehleransicht. `close()`/`finish()` unverändert (D-03).
- Konzept §6.3 (Zählregel, Restgrenze „Ansehen ohne Antwort ist unbegrenzt“), Fehlerform der Sitzungs-Endpunkte unter dem API-Block, Ampel-Tabelle („beantwortet“ statt „vorgelegt“).

## Task Commits

1. **Task 1: Tracer abgebrochene Runde** – `c73c6f5` (fix)
2. **Task 2: Fehlerpfade 404/400/409, atomare Gutschrift** – `8270d84` (fix)
3. **Task 3: SessionPage Doppel-Tipp und Fokus, Konzept** – `a25abff` (fix, Trailer `A11y-Check`)
4. **Review-Befunde** – `27b7da4` (fix)

## Rote Läufe (Spec → Test → Code)

**Task 1, Schritt 3 (Backend, vor der Änderung):** `Failed: 5, Passed: 0, Total: 5`
- `Abgebrochene_Runde_bietet_dieselben_neuen_Karten_wieder_an`: zweiter Start ohne die Karten des ersten
- `Tageslimit_sinkt_erst_mit_der_ersten_Antwort`: newRemainingToday nach dem Start 0 statt 5
- `Altbestand_von_gestern_…`: Karte nicht im nächsten Start
- `Altbestand_von_heute_…`: newRemainingToday 4 statt 5
- `Heute_faellig_…`: dueToday 3 statt 2

**Task 1, Schritt 4 (e2e, alter Stack):** „Abgebrochene Runde: dieselbe neue Karte kommt wieder“ failed: zweiter Start lieferte keine Karte (`items[0]?.cardId` undefined); die 4 übrigen learn.spec-Tests grün.

**Task 2, Schritt 1 (Backend):** `Failed: 9, Passed: 7, Total: 16`
- 500 statt 404: gelöschte Karte, fremde Aufgabe, fremdes/unbekanntes Kind; 404 ohne detail bei unbekannter Runde
- 500 statt 409: Antwort-Id einer anderen Aufgabe; 500 statt 400: `sync` ohne `answers`; 200 statt 400 für `size` 0/-1/51
- Gleichzeitig dieselbe Aufgabe: 200 + 200 statt 200 + 409
- Gleichzeitig zwei Aufgaben: Rundenzähler 10 statt 20 (verlorene Gutschrift)
- Grün schon vorher: die 5 Task-1-Tests, `Wiederholte_Antwort_bleibt_200_ohne_neue_Wertung` (schließt die FIX-07-Testlücke aus 01-VERIFICATION) und `Gleichzeitige_Abschluesse_vergeben_den_Bonus_einmal` – **dieser Fall ist eine Absicherung des atomaren Abschlusses**: Vor der Änderung überdeckte die verlorene Gutschrift (beide schrieben denselben gelesenen Wert) die Doppelwertung, erst die atomare Gutschrift hätte den Bonus ohne Anspruch doppelt vergeben.

**Task 3, Schritt 1 (vitest):** `4 failed | 2 passed (6)` – Doppelklick und zweimal Enter: 2 statt 1 Anfrage an /answers; 409 und 404: Text korrekt, Fokus nicht auf „Zurück“. Die beiden Schließen-Fälle (D-03) waren grün.

**Task 3, Schritt 2 (e2e, frischer Stack):** „Fehleransicht bei gleichzeitiger Doppel-Antwort“ failed: `toBeFocused` – Received: inactive. (Ein erster Versuch gegen den schon benutzten Stack scheiterte, weil Max’ Tagesbudget nach „Lernen über HTTP“ verbraucht war; deshalb frischer Stack.)

## Gate-Ergebnisse (Stand `27b7da4`)

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Backend Build + Tests | `bash .planning/phases/02-…/gate/backend-test.sh` | Build 0 Warnungen (`/warnaserror`); Learning.Tests 104 passed, Api.Tests 155 passed, 0 failed |
| SessionEndpointTests | dto. mit Filter | 19 passed (Task 1: 5, Task 2: 11, Review: 3) |
| Frontend | `npm ci && lint && typecheck && build && test && design:check && design:classes` | Exit 0; vitest 13 Dateien, 112 Tests passed; design lint `errors: 0, warnings: 0`; design:classes „keine alten Klassen“ |
| e2e | `npm run e2e:stack && npm run e2e` | 31 passed, 1 skipped (`first-run.spec.ts`, läuft absichtlich nur im seedfreien Install-Smoke) |
| Migration | `git status --porcelain backend/src/WordQuest.Infrastructure/Migrations` | leer – `IsConcurrencyToken` ändert das relationale Modell nicht, `MigrateAsync` meldete keine ausstehenden Änderungen |

**axe:** @axe-core/playwright 4.13.0 (axe-core 4.13.0), Seite `/lernen` in der Fehleransicht nach 409 (`checkPageWithoutGlass`: axe WCAG 2.2 AA, Glas-Kontrast, Reflow) – **0 Verstöße**. Die bestehenden axe-Prüfungen von `/lernen` in „Lernen über HTTP“ und „Schließen …“ blieben grün.

Container `wq-p2-db`, Netz `wq-p2` und der e2e-Stack sind wieder entfernt; das NuGet-Cache-Volume `wq-nuget` bleibt für die weiteren Pläne.

## Übergang Altbestand (New-States aus dem früheren Rundenstart)

Vor diesem Plan legte jeder Start für neue Karten einen `ReviewState` im Zustand `New` an (`FirstSeenAt` = Start, `LastReviewedAt` leer). Solche Zeilen bleiben ohne Datenmigration bestehen und verhalten sich jetzt so:
- Sie zählen nicht zum Tagesbudget (kein `LastReviewedAt`), auch wenn sie heute angelegt wurden (Test `Altbestand_von_heute_verbraucht_kein_Tageslimit`).
- Sie werden wieder als neue Karten angeboten (`alreadySeen` schließt `New` aus).
- Bei der ersten Antwort wird `FirstSeenAt` auf den Antwortzeitpunkt gesetzt; die Karte zählt an diesem Tag zum Budget (Test `Altbestand_von_gestern_kommt_wieder_und_zaehlt_am_Tag_der_Antwort`).
- `dueToday` zählt sie nicht mehr, die Ampel zeigt sie als „neu“ (Test `Altbestand_ohne_Antwort_steht_in_der_Ampel_als_neu`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kartenauswahl ohne eindeutige Reihenfolge**
- **Gefunden:** Review (MITTEL 1)
- **Problem:** Ohne `setId` teilen sich Karten verschiedener Sets dieselbe `Position`; PostgreSQL garantiert bei Gleichstand keine Reihenfolge, `Take(newBudget)` konnte in der nächsten Runde andere Karten nehmen (FIX-03 nicht sicher).
- **Fix:** `.ThenBy(c => c.Id)` als Gleichstandsbrecher; Test mit zwei Sets ohne `setId`. Der Test war vor dem Fix nicht reproduzierbar rot (PostgreSQL liefert kleine Tabellen meist in physischer Reihenfolge); er sichert die Eigenschaft ab.
- **Dateien:** `LearningService.cs`, `SessionEndpointTests.cs` – **Commit:** `27b7da4`

**2. [Rule 1 - Bug] Ampel zeigte unbeantworteten Altbestand als „unsicher“**
- **Gefunden:** Review (MITTEL 2), Folge der Konzept-Anpassung „beantwortet“
- **Fix:** Ampel-Unterabfrage nur auf Lernstände mit `LastReviewedAt != null`; Test vorher rot („yellow“ statt „new“), danach grün.
- **Dateien:** `LearnerEndpoints.cs`, `SessionEndpointTests.cs`, Konzept §9 – **Commit:** `27b7da4` (Doku in `a25abff`)

**3. [Rule 2 - Testlücke] Concurrency-Token-Pfad unbelegt**
- **Gefunden:** Review (NIEDRIG 3): Der Plan-Test für „dieselbe Aufgabe gleichzeitig“ antwortet auf eine neue Karte; dort kollidiert zuerst der Primärschlüssel von `review_state` (23505), nicht `answered_at IS NULL`.
- **Fix:** Zusatztest `Gleichzeitige_Antworten_auf_eine_Wiederholung_ergeben_200_und_409` mit vorhandenem Lernstand – einzige Kollision ist das UPDATE der Aufgabe. – **Commit:** `27b7da4`

**4. [Klein] Konzept §9 Ampel-Tabelle angepasst** („vorgelegt“ → „beantwortet“), weil ein gezeigter, nicht beantworteter Eintrag jetzt neu bleibt (AGENTS.md: Doku folgt dem Code). Nicht in `files_modified` des Plans aufgeführt, aber dieselbe Datei.

**5. [Ablauf] Commits je Task statt ein Commit je Plan.** Der Plan nennt D-01 „ein atomarer Commit pro Plan“, der Ausführungsauftrag verlangt Commits je Task; ausgeführt wurde nach Auftrag (4 Commits). Der `A11y-Check`-Trailer steht im Commit von Task 3.

**6. [Kommentar] Rate-Limit-Kommentar in `learn.spec.ts`** an den tatsächlichen Stand angepasst (Teststack hebt das Limit an), weil die Datei mit zwei neuen Tests mehr als 8 Auth-Aufrufe macht.

## Review (AGENTS.md „Review“, D-02)

Unabhängige zweite Instanz (`claude -p`, nur Lesen) gegen Plan und Diff `c3534f1..a25abff`: kein BLOCKER, kein HOCH.

| Befund | Schwere | Umgang |
|---|---|---|
| Auswahl neuer Karten bei Gleichstand nicht stabil | MITTEL | behoben (Deviation 1) |
| Ampel-Doku passt nicht zum Code bei Altbestand | MITTEL | behoben im Code (Deviation 2) |
| 409-Test belegt den Concurrency-Token-Pfad nicht | NIEDRIG | behoben, Zusatztest (Deviation 3) |
| `sync` kann einen Batch halb speichern (Karte unterwegs gelöscht, 409 mitten im Batch) | NIEDRIG | zurückgewiesen für diesen Plan: Plan verlangt „nichts gespeichert“ nur für fremde `itemId` (Vorprüfung erfüllt); Endpunkt ungenutzt (v2, `LRN2-02`). Als Restgrenze unten |
| Cram-Antwort verbraucht Budget und bleibt neue Karte | NIEDRIG | zurückgewiesen: so im Plan beschlossen („beantwortet = LastReviewedAt gesetzt“); als bekannte Folge unten |
| Zwei Runden gleichzeitig auf dieselbe neue Karte → 409-Text „schon angekommen“ | NIEDRIG | zurückgewiesen: nur bei echter Gleichzeitigkeit, harmlos; als Restgrenze unten |
| Nebenbei: `MayActFor`-Text „gehoert“ in ASCII | – | Altbestand, nicht im Auftrag; nur erwähnt |

## Restgrenzen und bekannte Folgen

- Ansehen ohne Antwort ist unbegrenzt (bewusst, FIX-09, Konzept §6.3, T-02-05).
- `sync`: Jede Antwort wird in eigener Transaktion gespeichert; scheitert eine spätere Antwort (Karte inzwischen gelöscht → 404, Konflikt → 409), bleiben frühere gespeichert. Endpunkt ungenutzt.
- Cram-Modus: Eine dort beantwortete neue Karte zählt heute zum Budget (`LastReviewedAt` gesetzt) und wird trotzdem wieder als neue Karte angeboten (Zustand bleibt `New`).
- Zwei gleichzeitige Runden desselben Kindes auf dieselbe neue Karte: die zweite Antwort bekommt 409 „Diese Antwort ist schon angekommen …“ (PK `review_state`).
- Altkind ohne `GamificationProfile` mit zwei exakt gleichzeitigen Antworten: 409 statt 200 möglich (aus dem Plan übernommen).

## Offene Anforderungsteile

- **FIX-04** ist für die Lernrunde erledigt; die 404-Texte der Verwaltungs-Endpunkte folgen in 02-02 bis 02-05. Deshalb nicht als erledigt markiert.
- **QUAL-01** ist für die Sitzungen erledigt (Integrationstests gegen echtes PostgreSQL); Login, Refresh, Geschwister und die übrigen FIX folgen in 02-02 bis 02-07.

## Self-Check: PASSED

- Dateien vorhanden: `gate/backend-test.sh`, `TestData.cs`, `SessionEndpointTests.cs`, `SessionPage.test.tsx`
- Commits `c73c6f5`, `8270d84`, `a25abff`, `27b7da4` sind Vorfahren von HEAD
