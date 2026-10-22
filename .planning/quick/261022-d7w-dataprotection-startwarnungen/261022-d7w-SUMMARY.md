---
task: 261022-d7w
phase: quick-261022-d7w
plan: "01"
subsystem: startup, learning, auth
tags: [logging, dataprotection, ef-core, distraktoren]
status: complete
date: 2026-10-22
requirements_completed: []
requirements_touched: []
key-files:
  created: []
  modified:
    - backend/src/WordQuest.Api/Program.cs
    - backend/tests/WordQuest.Api.Tests/StartupLogTests.cs
    - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
    - backend/src/WordQuest.Infrastructure/LearningService.cs
    - backend/tests/WordQuest.Api.Tests/SessionEndpointTests.cs
    - backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - .planning/STATE.md
decisions:
  - "DataProtection: nur das Vorladen des Schluesselrings beim Start entfernt (DataProtectionHostedService), kein Log-Filter, kein Volume. Nutzt spaeter etwas DataProtection, kommen die Warnungen beim ersten Zugriff wieder (Dennis-Auftrag 2026-10-22)"
  - "EF 10102 Distraktoren: Defekt, Vorrat zufaellig per EF.Functions.Random() aus dem ganzen Set"
  - "EF 10102 Profilauswahl: fachlich egal (nur Anzahl zaehlt), OrderBy(t => t.Id) beseitigt nur die Warnung"
metrics:
  started: 2026-10-22T10:45:00Z  # dazwischen Docker-Ausfall (Checkpoint)
  completed: 2026-10-22T21:15:00Z
actuals:
  tokens: 6000  # chars/4 ueber den eigenen Diff (git diff inkl. Kontext) (7 Dateien, +82/-11 Zeilen)
  tasks: 4
  commits: 6  # gemessen 4ae3b74..f8dc4db; davon 4 aus diesem Quick, 3b79ca5 und 43a17f2 (docs 03.1.1) aus der parallelen Planer-Sitzung
plan_head_before: 4ae3b74fb6669622674158e48cea5d3cbb877355
plan_head_after: f8dc4db
---

# DataProtection-Warnungen beim Start, EF-Warnung 10102

## A. Wer DataProtection nutzt

**Niemand in WordQuest.** `grep -rn "DataProtection\|Antiforgery\|AddSession\|AddCookie\|IDataProtect" backend/src`
trifft nur `obj/`-Assets. JWT läuft mit eigenem HMAC-Schlüssel (`JwtTokenService`),
Refresh-Token liegen als SHA256-Hash (`AuthService.cs:122`). Der Bild-Upload aus
03.1.1 kommt ohne `IFormFile`/Antiforgery aus (`03.1.1-01-PLAN.md:108`).

**Woher die Registrierung kommt** (ASP.NET Core release/10.0, in dieser Sitzung abgerufen):

- `Program.cs:91` ruft `AddAuthentication(...)` auf. Das ruft `services.AddDataProtection();`
  auf (https://raw.githubusercontent.com/dotnet/aspnetcore/release/10.0/src/Security/Authentication/Core/src/AuthenticationServiceCollectionExtensions.cs, Z. 24).
- `AddDataProtectionServices` registriert `DataProtectionHostedService` als `IHostedService`
  (https://raw.githubusercontent.com/dotnet/aspnetcore/release/10.0/src/DataProtection/DataProtection/src/DataProtectionServiceCollectionExtensions.cs, Z. 77).
- Dessen `StartAsync` ruft `_keyRingProvider.GetCurrentKeyRing()` auf, um den Ring
  vorzuladen (https://raw.githubusercontent.com/dotnet/aspnetcore/release/10.0/src/DataProtection/DataProtection/src/Internal/DataProtectionHostedService.cs, Z. 29–35).
  Deshalb entstehen beim Start ein Schlüssel und beide Warnungen.

**Lösung (a6f7c25, f8dc4db):** `Program.cs` entfernt nach `AddAuthentication` genau
diesen Deskriptor (`!IsKeyedService` und Typname). Kein Log-Filter, kein Volume, keine
Dependency. Ein späterer Zugriff auf DataProtection würde den Ring weiterhin bei
Bedarf anlegen und die Warnungen dann zeigen. Gerade dann sind sie berechtigt,
weil die Schlüssel ins Volume gehören. Einen Filter haben wir verworfen: Er würde
genau dieses Signal verstecken.

**Grenze:** Der Abgleich läuft über den Namen des internen Typs. Ändert ein
Framework-Update ihn, entfernt der Code nichts mehr, und `StartupLogTests` schlägt fehl.
Der Test prüft dafür den Namensraum und nicht den Typnamen.

## B. EF-Warnung 10102 (Skip/Take ohne OrderBy)

**Messung:** Ein temporärer Lauf mit `ConfigureWarnings(w => w.Throw(CoreEventId.RowLimitingOperationWithoutOrderByWarning))`
wurde nicht committet.
- Api-Suite: 3 von 279 rot, nämlich die 2 Session-Tests mit Auswahlspielen (`BuildChoicesAsync`)
  und der Starttest A.
- `GET /api/v1/auth/profiles` per temporärem Probe-Test: 500 mit `Throw`, 200 ohne.
  Kein bestehender Test ruft diesen Endpunkt auf.
- Weitere Fundstellen gibt es nicht: `LearningService.cs:68/76` sortieren, `:132` läuft über
  `InNewCardOrder`, `SessionComposer` und `CsvVocabularyParser` arbeiten im Speicher.

| Abfrage | Bewertung | Änderung |
|---|---|---|
| `LearningService.BuildChoicesAsync` `Take(40)` (2×) | **Defekt.** Der Vorrat waren die ersten 40 Wörter in Tabellenreihenfolge. In Sets mit mehr als 41 Wörtern kam ein späteres Wort nie als falsche Option vor. Stand es in der Auswahl, war es also immer die richtige Antwort (Konzept §7.1). | Roter Test, dann `.OrderBy(_ => EF.Functions.Random())` (d940187) |
| `AuthEndpoints.GetProfilesAsync` `Take(2)` Mandanten-Ids | Fachlich egal, es zählt nur `Count != 1`. Die Warnung stand aber bei jedem Aufruf der Kinder-Anmeldung im Log. | `.OrderBy(t => t.Id)` (205e81c), kein Test |

Nach dem Fix: Api-Suite mit `Throw` und Probe **280 passed**. Im e2e-API-Log
(Development, Debug-Level, 56 Tests inkl. Kinder-Anmeldung und Spiele) steht
0× `10102`.

## Rot-Beleg (SDK-Container, `backend-test.sh`)

| Test | Rot (vor Fix) | Grund | Grün |
|---|---|---|---|
| `StartupLogTests.Erster_Start_loggt_keine_Warnung_von_DataProtection` (Log-Assertion) | 1 failed | genau die zwei Einträge `FileSystemXmlRepository` „Storing keys in a directory '/root/.aspnet/DataProtection-Keys' …“ und `XmlKeyManager` „No XML encryptor configured …“ | 3 passed (`~StartupLogTests`) |
| derselbe Test, Dienst-Assertion allein (Log-Assertion temporär aus, Program.cs auf 4ae3b74) | 1 failed, `StartupLogTests.cs:52` | `DataProtectionHostedService` läuft | s. o. |
| `SessionEndpointTests.Falsche_Antwortoptionen_kommen_aus_dem_ganzen_Set` | 1 failed | „Nur 41 von 50 Woertern kamen als falsche Option vor.“ | grün in der Api-Suite |

## Gate

- Backend auf **f8dc4db** (`backend-test.sh`): Build Release `/warnaserror` mit 0 Warnungen und
  0 Fehlern. Learning.Tests **148 passed**, Api.Tests **279 passed** (vorher 277, +2).
- Frontend auf 205e81c (Frontend seit 4ae3b74 unverändert): `npm ci`, lint, typecheck und build grün,
  vitest **267 passed** (15 Dateien). `design:check` mit errors 0 und warnings 0,
  `design:classes` meldet „keine alten Klassen“.
- e2e mit axe auf 205e81c (`npm run e2e:stack && npm run e2e`): **56 passed, 1 skipped**
  (first-run nur in den Smokes). Stack danach mit `down -v` entfernt. Im API-Log
  0× `warn: Microsoft.AspNetCore.DataProtection`, 0× 10102. f8dc4db ändert gegenüber
  205e81c nur die `IsKeyedService`-Bedingung und den Test.
- Install-Smoke `setup-smoke.sh` auf f8dc4db: **IMAGE OK, STARTLOG OK, SMOKE OK**, Exit 0.
  API-Log des ersten Starts: `info: Migrations[20402]` ×2, `info: Startup` ×1,
  `info: Hosting.Lifetime` ×4, **kein `warn:`, kein `fail:`**.

## Barrierefreiheit

Es gibt keine sichtbare UI-Änderung, das Frontend ist unverändert. Die Distraktoren ändern nur,
welche Wörter als Option erscheinen. Die axe-Prüfungen der e2e-Läufe sind grün (oben).

## Review (`claude -p`, nur lesend, gegen die Kriterien und `4ae3b74..205e81c` ohne 03.1.1)

| # | Schwere | Befund | Behandlung |
|---|---|---|---|
| 1 | MEDIUM | Die Log-Assertion ist nur im Container bzw. bei neuem Schlüssel rot, auf einem Entwickler-Rechner mit vorhandenem Schlüssel auch ohne Fix grün. | **Behoben** (f8dc4db): Der Test prüft zusätzlich, dass kein `IHostedService` aus dem Namensraum `Microsoft.AspNetCore.DataProtection` läuft. Für sich rot belegt (Tabelle oben). |
| 2 | LOW | `ImplementationType` wirft bei Keyed-Registrierungen. | **Behoben** (f8dc4db): zuerst `!descriptor.IsKeyedService` |
| 3 | LOW | Ein späteres `AddDataProtection` (z. B. über `AddAntiforgery`) meldet den Dienst per `TryAddEnumerable` wieder an. | **Zurückgewiesen:** Dann nutzt WordQuest DataProtection wirklich, und die Warnungen sollen erscheinen, weil die Schlüssel ins Volume gehören. Der Test aus #1 macht das sichtbar. |
| 4–11 | INFO | Sicherheit ist nicht berührt, die Smoke-Regex passt, die alte `fail:`-Prüfung und der Gegentest wirken weiter. Die Bewertung zu 10102 ist richtig, `EF.Functions.Random()` passt, der Test ist nicht flaky (≈ e^-28). Es gibt keine weiteren Fundstellen, Konventionen und Doku sind eingehalten. #5: Typname nicht gegen die DLL geprüft. | #5 erledigt: Der Rot-/Grün-Lauf belegt den Namen, und der Smoke zeigt keine Warnung mehr. |

## Deviations from Plan

**1. Docker-Ausfall mitten im Lauf:** Die Platte lief voll, und Docker Desktop startete nicht mehr.
Ein Checkpoint ging an den Orchestrator, der Docker zurückgesetzt hat. Danach wurden Images
und `wq-p2-db` neu angelegt.

**2. Mess-Lauf mit temporären Änderungen:** `ConfigureWarnings(Throw)` in `Program.cs` und
`TmpProfilesProbe.cs` wurden nach jedem Lauf zurückgenommen und nie committet.

**3. [Rule 1] Review-Befunde 1 und 2** wurden als eigener Commit f8dc4db behoben, vor dem Smoke-Lauf.

## Offen

- Im e2e-API-Log steht 1× `fail: Microsoft.EntityFrameworkCore.Database.Transaction[20205]`
  bei `POST /api/v1/auth/logout` mit Status 499: Der Client (Playwright) hat die Verbindung
  während des Commits geschlossen. Das hängt nicht mit diesem Quick zusammen. Ob ein Abbruch
  durch den Client beim Logout `fail:` loggen soll, ist nicht geprüft.
  UNBEKANNT: ob das schon vor diesem Quick vorkam.
- Tag-Kandidat fe24d8b enthält p4z, v4n, fke, cb3, q7a und d7w nicht. Kein Push, kein Tag.
- Parallele Sitzung: 3b79ca5 und 43a17f2 (docs 03.1.1) liegen zwischen den Commits dieses
  Quicks und wurden nicht angefasst. Die untracked Dateien `.planning/milestone.lock`, `.planning/state.json`
  und `.planning/phases/03.1.1-vocabulary-pictures/.gitkeep` stammen nicht von hier.

## Self-Check: PASSED

Die Dateien sind vorhanden (PLAN, SUMMARY, StartupLogTests.cs, SessionEndpointTests.cs).
Die Commits a6f7c25, d940187, 205e81c und f8dc4db sind Vorfahren von HEAD.
