---
phase: quick-261023-a8x
plan: "01"
status: complete
requirements: [HARD-01]
commits: [7f442c1, bc8d598, 440a4cd, d3de3f8, 1af66ba, f91a453, 8539125]
---

# 261023-a8x: Abmelden ueber die ganze Kette, 409-Frist ohne Abmeldung aller Tabs

**Abmelden widerruft jetzt die ganze Token-Kette ab dem vorgelegten Token.
Laeuft die 409-Wartezeit ohne Nachfolger ab, bleibt die Anmeldung aller Tabs
erhalten; die Aktion meldet einen wiederholbaren Fehler. Der verbrauchte Token
wird nicht noch einmal gesendet, der naechste Versuch meldet lokal ab. Beide
Codex-Befunde vom 2026-10-23 hatten einen roten Test vor dem Fix, das Gate ist
gruen.**

## Befund 1 (HIGH): Abmelden mit mehrfach rotiertem Token

`LogoutAsync` (`backend/src/WordQuest.Api/Auth/AuthService.cs`) liest unter der
Kontosperre alle Tokens des Kontos (Hash -> Nachfolger) und widerruft die Kette
ab dem vorgelegten Token bis zum Ende.

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Rot (7f442c1) | `backend-test.sh 'FullyQualifiedName~Abmelden'` | Exit 1, **1 failed / 3 passed**: `Abmelden_mit_mehrfach_rotiertem_Token_widerruft_die_ganze_Kette` → `Expected: 0, Actual: 1` (R2 aktiv) |
| Gruen (bc8d598) | `backend-test.sh 'FullyQualifiedName~AuthEndpointTests'` | Exit 0, **29 passed** |

## Befund 2 (MEDIUM): 409-Frist loescht die Anmeldung aller Tabs

Befund bestaetigt: `tokenStore.clear()` leert den gemeinsamen localStorage, die
verspaetete Antwort an Tab A wird danach verworfen (`tokenStore.refresh !==
refreshToken`). Der Kommentar „nur diesen Tab abmelden“ war falsch.

Nicht einfach „Tokens behalten“: Ein spaeterer Refresh mit dem schon rotierten
Token nach Ablauf der 10-s-Gnadenfrist ist fuer den Server Wiederverwendung und
widerruft alle Anmeldungen des Kontos (auch andere Geraete). Deshalb:

- Frist abgelaufen → `ApiError(409)` „Die Anmeldung wird gerade in einem
  anderen Fenster erneuert. Versuche es gleich noch einmal.“, Speicher bleibt,
  der Tab merkt sich den Token (`abandoned`, `api.ts`).
- Naechster Refresh mit genau diesem Token → lokal abmelden ohne Serveraufruf.
- Speichert der andere Tab inzwischen seinen Nachfolger, wiederholt `mayRetry`
  mit dem neuen Access-Token, ohne eigenen Refresh.

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Rot (440a4cd) | `vitest run src/lib/api.test.ts` in `node:22` | Exit 1, **3 failed / 25 passed**: Codex-Szenario → `expected null to be 'r1'`; Frist ohne Nachfolger und Frist nach Uhrzeit → `expected 401 to be 409` |
| Gruen (d3de3f8) | Frontend-Gate in `node:22` | Exit 0, 16 Dateien, **319 passed** |

## Review

Unabhaengig per `claude -p`, nur lesend (Read/Grep/Glob, `git diff/log/show`),
gegen beide Befunde und `git diff b38ac5c..1af66ba`. Ergebnis: **1 MEDIUM,
1 LOW, 5 INFO**.

| # | Befund | Schwere | Umgang |
|---|---|---|---|
| 1 | `retry: 1` in `App.tsx`: TanStack wiederholt eine Abfrage nach ~1 s, die Wiederholung trifft den verbrauchten Token und meldet alle Tabs ab; die Frist waechst nur von 3 auf ~4 s | MEDIUM | **behoben**: roter Test (f91a453, `TypeError: retryQuery is not a function`, 1 failed / 28 passed), Fix `retryQuery` (einmal wiederholen, nach 409 nicht) in `api.ts`, `App.tsx`, Konzept (8539125) |
| 2 | `LogoutAsync` laedt alle Tokens des Kontos, alte werden nie geloescht | LOW | **stehen gelassen**, Schuld in STATE.md (`AuthService.cs:262-264`): fuer Heimnetz-Groessen unkritisch; bei Bedarf ab `CreatedAt` des vorgelegten Tokens filtern oder rekursive CTE |
| 3–7 | Unique-Index auf `token_hash`, Mandantentrennung, Kantenfaelle Frontend, Tests ohne Fix rot, Doku == Code | INFO | keine Aenderung |

Kein zweites Review: Der Review-Fix ist eine Zeile Logik mit eigenem Rotbeleg,
das Gate lief danach vollstaendig.

## Gate

| Gate | Stand | Exit | Ergebnis |
|---|---|---|---|
| Backend `backend-test.sh` (Build `/warnaserror` + Tests) | 1af66ba (Backend seither unveraendert) | 0 | 0 Warnungen; Learning **166 passed**, Api **311 passed** |
| Frontend in `node:22`: `npm ci && lint && typecheck && build && test && design:check && design:classes` | 8539125 | 0 | vitest 16 Dateien, **320 passed**; design lint `errors: 0, warnings: 0`; „keine alten Klassen“ |
| e2e mit axe `npm run e2e:stack && npm run e2e` | 8539125 | 0 | **65 passed, 1 skipped** (`first-run`), axe-Specs mit 0 Verstoessen; danach `down -v` |
| Install-Smoke `setup-smoke.sh` | 8539125 | 0 | LOGIN, RESET, STARTABBRUCH, BACKUP, FIRST RUN, DEMO-ABBRUCH, RATE-LIMIT, **SMOKE OK** |

Keine sichtbare UI-Aenderung ausser einem neuen Fehlertext, der ueber die
bestehende Fehleranzeige laeuft; axe lief trotzdem im e2e-Gate.

## Offene Punkte / Grenzen

- Trifft die Antwort an den anderen Tab erst nach dem naechsten Versuch dieses
  Tabs ein, sind weiterhin alle Tabs abgemeldet (im Konzept als Grenze).
- Tag `v1.0.0` steht auf f70271c und enthaelt diesen Quick nicht.
