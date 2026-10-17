---
phase: 02-reliable-learning-clean-family-data
reviewed: 2026-10-17T21:13:50Z
depth: deep
diff_base: c3534f1
diff_head: 3f55d4f
files_reviewed: 65
files_reviewed_list:
  - backend/src/WordQuest.Api/Contracts/Contracts.cs
  - backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs
  - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
  - backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs
  - backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs
  - backend/src/WordQuest.Api/Program.cs
  - backend/src/WordQuest.Infrastructure/Configurations/GamificationConfigurations.cs
  - backend/src/WordQuest.Infrastructure/Configurations/IdentityConfigurations.cs
  - backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs
  - backend/src/WordQuest.Infrastructure/LearningService.cs
  - backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.Designer.cs
  - backend/src/WordQuest.Infrastructure/Migrations/20261017182305_ReferentialIntegrity.cs
  - backend/src/WordQuest.Infrastructure/Migrations/WordQuestDbContextModelSnapshot.cs
  - backend/src/WordQuest.Infrastructure/OrphanCleanup.cs
  - backend/src/WordQuest.Modules.Content/Services/ContentRules.cs
  - backend/src/WordQuest.Modules.Content/Services/ContentTextProblem.cs
  - backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs
  - backend/src/WordQuest.Modules.Gamification/Services/StreakRules.cs
  - backend/src/WordQuest.Modules.Learning/Entities/ReviewState.cs
  - backend/src/WordQuest.Modules.Learning/Services/MasteryRules.cs
  - backend/tests/WordQuest.Api.Tests/ApiFactory.cs
  - backend/tests/WordQuest.Api.Tests/AuthEndpointTests.cs
  - backend/tests/WordQuest.Api.Tests/LearnerDeleteTests.cs
  - backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs
  - backend/tests/WordQuest.Api.Tests/MigrationTests.cs
  - backend/tests/WordQuest.Api.Tests/OverviewTests.cs
  - backend/tests/WordQuest.Api.Tests/RateLimitTests.cs
  - backend/tests/WordQuest.Api.Tests/SessionEndpointTests.cs
  - backend/tests/WordQuest.Api.Tests/SetDeleteTests.cs
  - backend/tests/WordQuest.Api.Tests/SetEditTests.cs
  - backend/tests/WordQuest.Api.Tests/SiblingIsolationTests.cs
  - backend/tests/WordQuest.Api.Tests/TestData.cs
  - backend/tests/WordQuest.Learning.Tests/ContentRulesTests.cs
  - backend/tests/WordQuest.Learning.Tests/CsvVocabularyParserTests.cs
  - backend/tests/WordQuest.Learning.Tests/GamificationTests.cs
  - backend/tests/WordQuest.Learning.Tests/MasteryRulesTests.cs
  - docker-compose.yml
  - frontend/e2e/axe.ts
  - frontend/e2e/children.spec.ts
  - frontend/e2e/docker-compose.e2e.yml
  - frontend/e2e/keyboard-zoom.spec.ts
  - frontend/e2e/learn.spec.ts
  - frontend/e2e/manage.spec.ts
  - frontend/nginx-traefik-realip.conf
  - frontend/nginx.conf
  - frontend/src/components/ui/dialog.test.tsx
  - frontend/src/components/ui/dialog.tsx
  - frontend/src/components/ui/misc.tsx
  - frontend/src/design-tokens.css
  - frontend/src/features/learn/LearnHomePage.test.tsx
  - frontend/src/features/learn/LearnHomePage.tsx
  - frontend/src/features/learn/SessionPage.test.tsx
  - frontend/src/features/learn/SessionPage.tsx
  - frontend/src/features/manage/ChildFormPage.test.tsx
  - frontend/src/features/manage/ChildFormPage.tsx
  - frontend/src/features/manage/ChildrenPage.test.tsx
  - frontend/src/features/manage/ChildrenPage.tsx
  - frontend/src/features/manage/ProgressPage.test.tsx
  - frontend/src/features/manage/ProgressPage.tsx
  - frontend/src/features/manage/SetDetailPage.test.tsx
  - frontend/src/features/manage/SetDetailPage.tsx
  - frontend/src/features/manage/SetsPage.test.tsx
  - frontend/src/features/manage/SetsPage.tsx
  - frontend/src/lib/api.test.ts
  - frontend/src/lib/api.ts
findings:
  critical: 0
  high: 0
  medium: 1
  low: 4
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 02: Code Review Report (phasenweit)

**Reviewed:** 2026-10-17T21:13:50Z
**Depth:** deep (planübergreifend, Aufrufketten Endpoint ↔ LearningService ↔ Datenbank ↔ Frontend, Proxy-Kette nginx/Traefik ↔ API)
**Files Reviewed:** 65
**Status:** issues_found

## Summary

Geprüft wurde `git diff c3534f1..3f55d4f` über `backend`, `frontend/src`, `frontend/e2e`, `frontend/nginx*.conf` und `docker-compose*.yml`, also alle 41 Commits seit dem Phasen-Plan. Kontext: PLANs und SUMMARYs 02-01 bis 02-07, `02-CONTEXT.md`, `02-UI-SPEC.md`, `AGENTS.md`. Nicht erneut aufgeführt sind Befunde, die in den Review-Abschnitten der SUMMARYs als behoben oder als Restgrenze akzeptiert stehen: `sync` speichert halb, Cram-Antwort verbraucht Budget, zwei Runden auf dieselbe neue Karte ergeben 409, Altkind ohne `GamificationProfile`, T-02-35 (Set zwischen Prüfung und Speichern gelöscht), n×10 Passwortversuche bei mehreren Adressen, `traefik:v3` als fließender Tag. Ebenfalls nicht erneut aufgeführt ist der Phase-3-Hinweis zur fehlenden `nginx-traefik-realip.conf` (02-06-PLAN Z. 105).

Die Kernpunkte der Phase halten der Prüfung stand: Die XP-Gutschrift läuft atomar, das Concurrency-Token `AnsweredAt` und der Abschluss-Claim sind richtig gebaut, die Sperrreihenfolge ist deadlockfrei, die Fremdschlüssel sind vollständig, und die Waisenbereinigung deckt jeden neuen Fremdschlüssel in der richtigen Reihenfolge ab. Auch die Mandantentrennung und die Proxy-Kette sind korrekt. Es gibt keinen BLOCKER. Am schwersten wiegt ein Prozessbefund: `CsvVocabularyParser.cs` enthält ein wörtliches NUL-Byte, deshalb behandelt git die Datei als binär. Die letzten beiden Commits dieser Phase (`0445f5b`, `3f55d4f`) ändern genau diese Datei, und ihr Diff ist in `git diff`, im Subagent-Review und in einem späteren PR unsichtbar. Dazu kommen ein verbliebener 500er an den Import-Endpunkten, Fokusverlust in den Dialogen während einer Anfrage, Domänenregeln in Endpoints und eine Fortschrittsseite, die Ladefehler verschweigt.

Schweregrade: high = BLOCKER, medium/low = WARNING, info = INFO. Keiner der Befunde wurde im laufenden Stack ausgeführt. Belegt sind sie durch den Codepfad mit Datei und Zeile bzw. durch das zitierte Test- oder git-Verhalten.

## Medium

### WR-01: NUL-Byte im Quelltext macht `CsvVocabularyParser.cs` für git binär, Phase-2-Änderungen daran sind im Diff unsichtbar

**Klassifikation:** WARNING · **Konfidenz:** hoch (beobachtet)
**File:** `backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs:80`

**Mechanismus:** Der Duplikat-Schlüssel steht als `!seen.Add($"{source}<NUL>{target}")` mit einem echten Steuerzeichen 0x00 im String-Literal. `file` meldet die Datei als `data`, und `git diff --stat c3534f1 HEAD` zeigt `CsvVocabularyParser.cs | Bin 5001 -> 5542 bytes`. Den Inhalt zeigt erst `git diff --text`. Ein `.gitattributes` gibt es nicht.

**Wirkung:** In dieser Phase haben zwei Commits die Datei geändert, `0445f5b` mit neuen Längenregeln und `3f55d4f` mit dem Umlaut im Problemtext. Beide Änderungen sind in `git diff`, in `gh pr diff` und auf GitHub nicht lesbar. Das Pflicht-Review nach AGENTS.md („gegen den Diff“) bekommt den Diff dieser Datei nicht zu sehen. Das Byte selbst ist alt, aber jede künftige Änderung am CSV-Import läuft am Review vorbei.

**Fix:** Escape statt Rohbyte. Am Verhalten ändert sich nichts:
```csharp
: !seen.Add($"{source}\0{target}")
```
Danach `file …/CsvVocabularyParser.cs` → „C# source, UTF-8 text“ und `git diff` zeigt Text.

## Low

### WR-02: Import-Endpunkte liefern 500 bei fehlendem Feld im JSON

**Klassifikation:** WARNING · **Konfidenz:** hoch (Codepfad, nicht ausgeführt)
**Files:** `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:285-288`, `:311`, `:329-335`, `backend/src/WordQuest.Api/Contracts/Contracts.cs:88`, `:97`, `backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs:41`

**Mechanismus:** 02-07 hat „Body fehlt/kaputt“ global auf 400 gebracht und `BuildEntry` gegen fehlende Wörter abgesichert („Zwei direkte API-Pfade, die bisher 500 ergaben, liefern jetzt 400“). Ein vorhandener Body, in dem ein Feld fehlt, bindet System.Text.Json aber ohne Fehler mit `null`:
- `POST /sets/import/preview` mit `{}` → `Content == null` → `CsvVocabularyParser.Parse` wirft `ArgumentNullException` (Z. 41) → 500.
- `POST /sets/{id}/import` mit `{}` oder `{"entries":null}` → `foreach` über `null` (Z. 311) → `NullReferenceException` → 500.
- `POST /sets/{id}/import` mit `{"entries":[null]}` → `BuildEntry(setId, null, …)` liest `request.SourceText` (Z. 334) → 500.

Die Oberfläche schickt diese Formen nie, deshalb Low. D-11 („nie 500“) und der 02-07-Ansatz sind für diese beiden Endpunkte aber nicht zu Ende geführt.

**Fix:** Im Endpoint vor der Nutzung, im Stil der Nachbarn:
```csharp
if (request.Content is null)
    return Results.ValidationProblem(new Dictionary<string, string[]> { ["content"] = ["Es fehlt der Text zum Importieren."] });
// ConfirmImportAsync
if (request.Entries is null)
    return Results.ValidationProblem(new Dictionary<string, string[]> { ["entries"] = ["Es fehlen die Vokabeln."] });
foreach (CreateEntryRequest? row in request.Entries) { if (row is null) continue; … }
```
Dazu je ein Fall in `SetEditTests` (`{}` → 400 mit deutschem Text).

### WR-03: Dialoge verlieren während der Anfrage den Tastaturfokus

**Klassifikation:** WARNING · **Konfidenz:** mittel (Mechanismus im Code belegt, das Fokusverhalten des Browsers nicht im Stack gemessen)
**Files:** `frontend/src/components/ui/dialog.tsx:107-120`, `frontend/src/features/manage/SetDetailPage.tsx:395`, `:522`, Beleg im Test: `frontend/e2e/keyboard-zoom.spec.ts:192`

**Mechanismus:** `ConfirmDialog` setzt während `busy` beide Buttons auf `disabled`, auch den gerade fokussierten „Endgültig löschen“. In „Set umbenennen“ und „Vokabel bearbeiten“ wird ebenso der Submit-Button gesperrt, wenn er per Klick oder Leertaste ausgelöst wurde. Ein fokussiertes Element, das `disabled` wird, verliert nach der Focus-Fixup-Regel von HTML den Fokus an `body`. Radix-`FocusScope` holt den Fokus nur zurück, wenn ein Knoten entfernt wird (MutationObserver), nicht wenn er gesperrt wird. Nach einer Fehlerantwort steht `ErrorNote` (`role="alert"`) zwar im Dialog, der Fokus liegt aber außerhalb. Der e2e-Test für genau diesen Fall prüft die Fokuslage nicht, sondern setzt den Fokus selbst (`await cancel.focus()`, Z. 192). Ob der Fokus von allein im Dialog bleibt, ist damit nicht belegt.

**Fehlerszenario:** Ein Elternteil mit Tastatur oder Screenreader löscht ein Kind, der Server antwortet mit 500. Die Meldung wird angesagt, der Fokus steht auf dem Seitenkörper hinter dem Dialog. Erst der nächste Tab-Druck holt ihn über die Fokusfalle zurück. Das berührt WCAG 2.4.3 (Fokusreihenfolge), und die Projektregel verlangt bei Dialogen einen Tastatur-Durchgang.

**Fix (minimal):** Nach einem Fehler den Fokus gezielt setzen, in `ConfirmDialog`:
```tsx
useEffect(() => { if (error) cancelRef.current?.focus() }, [error])
```
Analog setzen die Formulardialoge den Fokus bei einem Fehler ohne Feldbezug auf „Abbrechen“. Den e2e-Schritt so ändern, dass er `await expect(cancel).toBeFocused()` prüft statt `cancel.focus()` aufzurufen. Alternative: Buttons nicht sperren, sondern `aria-disabled`. Die `busyRef`-Riegel verhindern den Doppelklick schon.

### WR-04: Domänenregeln stehen in `LearnerEndpoints`, die Budgetregel steht zweimal

**Klassifikation:** WARNING · **Konfidenz:** hoch
**Files:** `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:227-235`, `:270-278`, `:294-313`, Gegenstück `backend/src/WordQuest.Infrastructure/LearningService.cs:51-68`, `:74-80`

**Mechanismus:** AGENTS.md: „Geschäftslogik gehört in Modul-Services oder einen Infrastructure-Service (Muster: `LearningService`), nie in Endpoints.“ In `OverviewAsync` stehen die Zählregel „eingeführt heute“ (`LastReviewedAt != null && FirstSeenAt >= dayStart`) und die Fälligkeitsregel (`Review`/`Relearning`, `DueAt <= now`) als zweite Kopie der Abfragen in `StartSessionAsync`. Beide Seiten verweisen nur per Kommentar aufeinander („Dieselbe Regel zaehlt die Uebersicht“). Die Ampelschwellen (`lapses >= 3 || worstEase < 1.8`, Default-Ease `2.5` statt `SchedulerOptions.InitialEaseFactor`) und die Wort-Aggregation (D-16: „die Wort-Aggregation ebenfalls einmal“) liegen ebenfalls im Endpoint. FIX-06 hat genau diese Art Doppeldefinition für die Meisterschaft beseitigt. Für das Tagesbudget (FIX-09) besteht sie weiter, und ändert sich eine Seite, zeigen Startseite und Rundenstart wieder verschiedene Zahlen.

**Fix:** Die beiden Prädikate einmal als `Expression<Func<ReviewState,bool>>` bzw. als Methoden in `LearningService` ablegen, etwa `IntroducedTodayAsync(learnerId)` und `DueCountAsync(learnerId)`. Endpoint und Rundenstart rufen sie auf. `WordStatesAsync` und die Ampelstufe ziehen in `LearningService` bzw. die Schwellen nach `MasteryRules`. Bestehende Tests bleiben unverändert grün.

### WR-05: Fortschrittsseite verschweigt Ladefehler, die Ampel meldet für ein gelöschtes Kind „alles neu“

**Klassifikation:** WARNING · **Konfidenz:** hoch (Codepfad)
**Files:** `frontend/src/features/manage/ProgressPage.tsx:82`, `:107-109`, `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:261-287`, `:294-305`

**Mechanismus:** `ProgressPage` rendert die Übersichtskarte nur bei `overview.data` und die Ampel nur bei `trafficLight.data`. Ein `isError` wird für keine der beiden Abfragen angezeigt. Das ist die Regel „Ladefehler ist nicht ‚gibt es nicht‘“ (Phase-1 WR-03), die in dieser Phase für `learners` und `LearnHomePage` umgesetzt wurde. `TrafficLightAsync` prüft nicht, ob es das Kind gibt: `WordStatesAsync` liefert für eine unbekannte `learnerId` alle Wörter der Familie ohne Lernstand, und die Antwort lautet 200 mit Status `new` für jedes Wort. `OverviewAsync` antwortet im selben Fall 404, mit einem Text für das Kindergerät („Bitte melde dich ab.“).

**Fehlerszenario:** Ein Elternteil löscht ein Kind in Tab A, Tab B zeigt noch die Fortschrittsseite mit dem Kind (`learners` ist dort veraltet). Nach dem nächsten Refetch fehlt die Übersichtskarte ohne Hinweis, und darunter steht der ganze Wortschatz mit „neu“. Das sieht aus, als wäre der Lernstand zurückgesetzt. Dasselbe Bild entsteht bei einem 5xx der Übersicht.

**Fix:** In `ProgressPage` vor den Karten `overview.isError && !overview.data` bzw. dasselbe für `trafficLight` als `ErrorNote` zeigen (Muster `LearnHomePage`). Im Backend vor der Aggregation:
```csharp
if (!await db.LearnerProfiles.AnyAsync(p => p.Id == learnerId, ct))
    return Results.Problem(title: "Nicht gefunden", detail: "Dieses Kind gibt es nicht (mehr).", statusCode: StatusCodes.Status404NotFound);
```
Zusätzlich ein Test in `OverviewTests`: Ampel für ein unbekanntes Kind ergibt 404.

## Info

### IN-01: Antworten auf eine abgeschlossene Runde werden weiter gewertet und gutgeschrieben

**Files:** `backend/src/WordQuest.Infrastructure/LearningService.cs:157-164`, `:244`, `:268-272`
`SubmitAnswerAsync` prüft `session.CompletedAt` nicht. Nach „Schließen“ (D-03 schließt mit offenen Aufgaben ab) lassen sich die restlichen Aufgaben aus einem zweiten Tab oder per API noch beantworten. Sie terminieren, protokollieren und vergeben XP, der Rundenbonus bleibt einmalig. Folgen hat das kaum, aber „abgeschlossen“ ist damit nicht endgültig. Fix: `if (session.CompletedAt is not null) return null;` bzw. 409 mit eigenem Text, dazu ein Test.

### IN-02: Rennen Löschen ↔ Lernen kann über die neuen Fremdschlüssel 500 oder ein irreführendes 409 ergeben

**Files:** `backend/src/WordQuest.Api/Endpoints/SessionEndpoints.cs:101`, `:206-208`, `backend/src/WordQuest.Infrastructure/LearningService.cs:169-171`, `:268-272`, `:132-133`
T-02-35 akzeptiert das Rennen nur für das Set beim Rundenstart. Seit `ReferentialIntegrity` gilt dasselbe für Karte und Kind: Wird die Karte zwischen dem Laden (Z. 169) und `SaveChanges` gelöscht, scheitert das INSERT in `review_state`/`review_log` mit 23503 (nicht abgefangen → 500). Kommt das UPDATE der per Kaskade gelöschten `session_item` zuerst, gibt es 0 Zeilen, das wird zur Concurrency-Exception und damit zu 409 „Diese Antwort ist schon angekommen“. Beim Start (Z. 132-133) gilt dasselbe für `session_item.card_id`. Das Fenster ist sehr schmal. Fix, falls gewünscht: `PostgresErrorCodes.ForeignKeyViolation` in `AnswerAsync`/`StartAsync` auf 404 mit `CardGone` bzw. `SessionGone` abbilden, sonst als Restgrenze neben T-02-35 eintragen.

### IN-03: Uneinheitliche Fehlerform in `SetEndpoints`

**File:** `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:166-169`, `:302`
`ConfirmImportAsync` antwortet mit nacktem `Results.NotFound()`, alle Nachbarn mit `SetNotFound()`. Die Leerprüfung in `AddEntryAsync` meldet unter dem Schlüssel `entry` den Text „Beide Spalten muessen befuellt sein.“ in ASCII-Umschrift. Das ist ein nutzersichtbarer Text, und `3f55d4f` hat denselben Fall im CSV-Parser gerade auf „befüllten“ umgestellt. Der Test `SetEditTests.cs:423` hält den alten Text fest. Fix: `SetNotFound()` verwenden. Die Leerprüfung entfällt zugunsten von `WordProblems` (Feldschlüssel `sourceText`/`targetText`, deutsche Texte), Test anpassen.

### IN-04: Netzfehler beim Token-Refresh zeigt „Das hat nicht geklappt“ statt „Server nicht erreichbar“

**File:** `frontend/src/lib/api.ts:97-99`, Vergleich `:144-147`
Scheitert der Refresh am Netz, wirft `refreshAccessToken` `ApiError(GENERIC, 0)`. Der gleiche Netzfehler bei jeder anderen Anfrage ergibt `UNREACHABLE`. Gerade im Heimnetz-Betrieb ist „Der Server ist gerade nicht erreichbar“ der hilfreichere Satz. Fix: `throw new ApiError(UNREACHABLE, 0)`, Fall in `api.test.ts` anpassen.

### IN-05: `SetDetailPage.tsx` wächst zur Sammeldatei, `useGone` ist in `ChildFormPage` nachgebaut

**Files:** `frontend/src/features/manage/SetDetailPage.tsx` (765 Zeilen: Seite, `useGone`, `RenameSet`, `EditEntry`, `DeleteEntry`, `DeleteSet`, `ImportPanel`), `frontend/src/features/manage/ChildFormPage.tsx:82-142`
AGENTS.md: „Keine Gott-Klassen und keine Gott-Dateien.“ `DeleteChild` baut den 404-Merker samt Invalidierung beim Schließen (`gone`/`setGone`, Z. 89, 119, 142) von Hand nach, den `useGone` (SetDetailPage Z. 274) schon kapselt. Fix: `useGone` nach `lib/` oder `components/ui/` verschieben und in beiden Seiten nutzen. Die Dialogkomponenten der Set-Seite kommen in eigene Dateien unter `features/manage/`.

## Geprüft, ohne Befund

- **XP-Gutschrift:** `CreditAsync` schreibt `xp = xp + n` per `ExecuteUpdateAsync` in derselben Transaktion wie Aufgabe, Lernstand und Protokoll. Mit `acceptAllChangesOnSuccess: false` funktioniert auch der Wiederholungslauf der Ausführungsstrategie. Der Test mit zwei gleichzeitigen Aufgaben hält Zeilensperren und belegt, dass keine Gutschrift verloren geht.
- **`AnsweredAt`-Token / 409:** Das UPDATE prüft `answered_at IS NULL`, die zweite Antwort trifft 0 Zeilen, `DbUpdateConcurrencyException` wird zu 409, und nichts wird geschrieben. Der Pfad ist für eine neue Karte (PK `review_state`) und für eine Wiederholung (reines Token) mit Sperr-Tests belegt. Der Frontend-Riegel `sending` (SessionPage) verhindert den Doppel-Tipp vor dem nächsten Rendern.
- **Abschluss:** Der Claim `UPDATE … WHERE completed_at IS NULL` vergibt Bonus und Serie genau einmal (Test mit zwei gleichzeitigen Abschlüssen).
- **Sperrreihenfolge:** Antwort `session_item → learning_session → gamification_profile`, Abschluss `learning_session → gamification_profile`. Es gibt keinen Zyklus und damit keinen Deadlock zwischen Antwort und Abschluss derselben Runde.
- **Mandantentrennung:** `ExecuteDeleteAsync` beim Kind-Löschen läuft unter dem Query-Filter und mit Rollenbedingung. `ResolveLearnerAsync`, Set- und Eintragsabfragen sind gefiltert. `UpdateEntryAsync`/`DeleteEntryAsync` prüfen zusätzlich `SetId`. `MayActFor` trennt Geschwister. `StampTenant` setzt den Mandanten auf neuen `ReviewState`.
- **Fremdschlüssel/Migration:** Alle zehn neuen Fremdschlüssel aus `ReferentialIntegrity` haben eine passende Bereinigungszeile in `OrphanCleanup`. Die Reihenfolge stimmt: erst Runden ohne Kind (Aufgaben per bestehender Kaskade), danach Protokolle ohne Runde auf `NULL`. Die Bereinigung läuft nur, solange die Migration fehlt, und ist idempotent (eigener Test). Die Migrationsdatei ist unverändert generiert (D-18). Die Kaskaden decken Kind löschen (Konto → Profil → Lernstand, Protokoll, Runden, XP, Tokens) und Set/Vokabel löschen (Eintrag → Karte → Lernstand, Protokoll, Aufgaben, `learning_session.set_id` → `NULL`) vollständig ab.
- **Proxy- und Rate-Limit-Kette:** Im Schnellstart ersetzt nginx `X-Forwarded-For` durch `$remote_addr`, die API vertraut nur privaten Netzen mit `ForwardLimit = 1`, und die API ist nicht veröffentlicht. In der Traefik-Variante verwirft Traefik ohne `trustedIPs` fremde XFF-Köpfe. nginx nimmt mit `real_ip_recursive off` den letzten Wert, und `web` ist nicht veröffentlicht. `UseForwardedHeaders` steht vor `UseRateLimiter`. IPv4-gemappte Adressen des Dual-Stack-Kestrel bildet `ForwardedHeadersMiddleware` selbst ab. Refresh und Logout sind vom Limit ausgenommen, und `refreshAccessToken` meldet bei 429/5xx nicht mehr ab.
- **Dialog-Fokus (ohne Fehlerfall):** Startfokus „Abbrechen“, Fokusrückgabe an den Auslöser, an die Set-Überschrift (Zeile weg) bzw. an „Alle Sets“/„Alle Kinder“ (404). Der Klick auf die Abdunklung schließt nicht, Esc ist während `busy` gesperrt. Das ist e2e und in `dialog.test.tsx` belegt.
- **FIX-05/FIX-06:** `StreakRules.CurrentStreak` wendet dieselbe Retter- und Monatsregel an wie `RegisterActivity` und schreibt nichts. Übersicht und Ampel zählen Wörter über `MasteryRules.IsWordMastered`. Nie beantwortete Altbestände gelten in beiden als neu.

---

_Reviewed: 2026-10-17T21:13:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
