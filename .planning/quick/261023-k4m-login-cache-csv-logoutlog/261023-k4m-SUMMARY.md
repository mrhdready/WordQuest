---
phase: quick-261023-k4m
plan: "01"
status: complete
requirements: [HARD-01]
commits: [1bb2f13, 96dd482, 43719a0, 45b5e55, 7546493, 0cdca65, 5320c27, a2b5de3, eebc236]
---

# 261023-k4m: Login ohne Doppelzaehlung, Query-Cache beim Anmeldewechsel, CSV-Lesesperre, Commit ohne Request-Token

**Vier offene Punkte geschlossen, jeder mit rotem Test vor dem Fix. Das Gate ist
gruen, im e2e-API-Log steht kein `fail:`.**

## 1. Login zaehlt doppelt fuers Rate-Limit (03.1-02 INFO 7)

`loginAsGuardian` und `loginAsLearner` (`frontend/src/lib/auth.tsx`) rufen `api()`
mit `retryOn401: false` auf.

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Rot (43719a0) | `vitest run src/lib/auth.test.tsx …` in `node:22` | 2 failed: `expected [ '/api/v1/auth/login', …(2) ] to deeply equal [ '/api/v1/auth/login' ]`, ebenso `learner-login` |
| Gruen (7546493) | dito | 11 passed |

## 2. Query-Cache beim Sitzungsende (03.1-02 INFO 8)

`App` (`frontend/src/App.tsx`) abonniert `tokenStore`; aendert sich die Kennung
der Anmeldung (`wq.session`, `null` = abgemeldet, `''` = angemeldet ohne Kennung
von vor 03.1-02), ruft es `queryClient.clear()`. Abmelden, Refresh 400/401
(`tokenStore.clear()`), neue Anmeldung und andere Fenster (`storage`) laufen
ueber dieses Ereignis; die Rotation aendert die Kennung nicht. Geleert wird im
Ereignis, React rendert erst danach.

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Rot (43719a0) | `vitest run src/lib/auth.test.tsx -t 'anderes Kind'` | 1 failed: `Unable to find an element with the text: Farben` (Kind B sieht die gecachten Sets von Kind A). Im Lauf der ganzen Datei scheitert derselbe Test schon an „Tiere“: eine haengende `['sets']`-Abfrage des vorigen Tests liegt noch im Cache, dieselbe Ursache |
| Gruen (0cdca65) | dito, ganze Datei | 11 passed |

Erste Fassung verglich nur `wq.session`; Anmeldungen ohne Kennung waeren dabei
`null` → `null` geblieben. Deshalb `currentSession()` mit `refresh`.

## 3. CSV-Mehrfachauswahl (Codex MEDIUM)

`readingRef` in `ImportPanel` (`SetDetailPage.tsx`) wie `busyRef` in
`EntryPicture.choose`: eine weitere Auswahl waehrend des Lesens wird ignoriert,
„Datei wählen“ bleibt aktiv und fokussierbar.

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Rot (45b5e55) | `vitest run src/features/manage/SetDetailPage.test.tsx` | 1 failed: `expected "vi.fn()" to not be called at all, but actually been called 1 times` |
| Gruen (a2b5de3) | dito | gruen (Frontend-Gate unten) |

## 4. Logout-Abbruch loggt `fail:` (261022-d7w)

Ursache: `InTransactionAsync` (`TransactionExtensions.cs`) rief
`transaction.CommitAsync(ct)` mit dem Request-Token. Bricht der Client nach der
Arbeit ab, wirft `RelationalTransaction.CommitAsync` eine
`OperationCanceledException`, und EF loggt sie als Fehler in
`Microsoft.EntityFrameworkCore.Database.Transaction` (20205). Betrifft jeden
Aufrufer (`AuthService` Refresh/Logout, `AccountService`, `LearningService`),
nicht nur Logout. Gemessen mit einer temporaeren Probe (nicht committet): Abbruch
vor `BeginTransaction` und waehrend eines Befehls erzeugt **keine** Fehlerzeile
(EF loggt das als Debug), nur der Commit.

Fix: `CommitAsync(CancellationToken.None)`. Die Arbeit bricht weiter mit `ct` ab;
ist sie getan, wird sie festgeschrieben. Echte SQL-Fehler bleiben `fail:`
(bestehender Test `Fehlerhaftes_SQL_im_Betrieb_wird_weiter_als_Fehler_geloggt`).

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Rot (1bb2f13) | `backend-test.sh 'FullyQualifiedName~StartupLogTests'` | Exit 1, 1 failed / 3 passed: `OperationCanceledException` aus `RelationalTransaction.CommitAsync`; Probe mit abgefangener Exception: Fehlerzeile `Microsoft.EntityFrameworkCore.Database.Tr…` |
| Gruen (96dd482) | dito | Exit 0, 4 passed |

## Review

Unabhaengig per `claude -p`, nur lesend (Read/Grep/Glob, `git diff/log/show`),
gegen die vier Kriterien und `git diff fa16468..a2b5de3`. Ergebnis: **0 HIGH,
0 MEDIUM, 4 LOW, 7 INFO**.

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 2 | Cache-Test nutzt `save` ohne Kennung, Weg ueber `saveLogin` und Rotation ungetestet | LOW | **behoben** (eebc236): Test ueber `saveLogin`, Rotation darf den Cache nicht leeren |
| 3 | Reihenfolge Listener/Rerender ist eine stille Annahme | INFO | **behoben** (eebc236): Kommentar in `App.tsx` |
| 7 | Zweite Auswahl waehrend des Lesens ohne Rueckmeldung | LOW | **zurueckgewiesen**: Lesen dauert bei hoechstens 1 MB Sekundenbruchteile, das Textfeld ist dabei gesperrt; ein Hinweis waere Scope ueber den Auftrag |
| 8 | Backend-Test rot durch Exception, nicht durch die Logzeile | LOW | **zurueckgewiesen**: Test prueft beides (Exception und `_logs.Errors`); die Logzeile ist per Probe belegt (oben) |
| 9 | Refresh: Rotation wird auch festgeschrieben, wenn der Client nach dem letzten Befehl abbricht | INFO | **Doku** (eebc236): Konzept verweist auf die Grenze der verlorenen Bestaetigung; das Fenster war vorher zwischen Commit und Antwort genauso offen |
| 11 | Doku-Satz gilt nur fuer Abbruch zwischen Arbeit und Commit | LOW | keine Aenderung: so formuliert; Abbruch davor per Probe ohne Fehlerzeile |
| 1, 4–6, 10 | AK 1 und 3 erfuellt, Observer nach `clear()`, Kennung ohne `wq.session`, Sicherheit | INFO | keine Aenderung |

Kein zweites Review: Die Review-Fixes sind Test, Kommentar und ein Doku-Satz; das
Frontend-Gate lief danach vollstaendig.

## Gate

| Gate | Stand | Exit | Ergebnis |
|---|---|---|---|
| Backend `backend-test.sh` (Build `/warnaserror` + Tests) | 5320c27 (Backend seit 96dd482 unveraendert) | 0 | 0 Warnungen; Learning **166 passed**, Api **312 passed** |
| Frontend in `node:22`: `npm ci && lint && typecheck && build && test && design:check && design:classes` | eebc236 | 0 | vitest 16 Dateien, **324 passed**; design lint `errors: 0, warnings: 0`; „keine alten Klassen“ |
| e2e mit axe `npm run e2e:stack && npm run e2e` | Arbeitsbaum = a2b5de3 | 0 | **65 passed, 1 skipped** (`first-run`), axe-Specs mit 0 Verstoessen; API-Log: **0× `fail:`**, 1× `warn: Startup` (Demo-Daten, gewollt im Teststack); danach `down -v` |
| Install-Smoke `setup-smoke.sh` | a2b5de3 | 0 | LOGIN, RESET, STARTABBRUCH, BACKUP, FIRST RUN, DEMO-ABBRUCH, RATE-LIMIT, **SMOKE OK** |

Im e2e-Lauf kam diesmal kein Logout mit 499 vor (ein `GET /sets` mit 499 ohne
`fail:`); der Beleg fuer Punkt 4 ist der Integrationstest.

## Offene Punkte / Grenzen

- Query-Keys tragen keine Nutzer-Id; eine per `memo` abgekapselte Komponente mit
  `useQuery` saehe nach `clear()` erst beim naechsten Rendern neue Daten (Review
  INFO 4). Heute rendert `AppRoutes` bei jedem Anmeldewechsel neu.
- Tag `v1.0.0` steht auf f70271c und enthaelt diesen Quick nicht.
