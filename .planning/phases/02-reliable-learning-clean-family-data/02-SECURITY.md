---
phase: "02"
slug: "reliable-learning-clean-family-data"
status: verified
verdict: SECURED
threats_total: 44
threats_closed: 33
threats_accepted: 11
# threats_open = offene Threats mit Severity >= workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
block_on: high
code_range: "c3534f1..3f55d4f"
created: "2026-10-17"
---

# Phase 02 — Sicherheit

> Sicherheitsvertrag der Phase: Threat-Register, akzeptierte Risiken und Prüfspur. Geprüft wurde der Code im Bereich `c3534f1..3f55d4f` gegen die Threat-Register aus `02-01-PLAN.md` bis `02-07-PLAN.md`. Jede Mitigation ist mit Datei und Zeile belegt, dazu der Test, der sie abdeckt.

---

## Vertrauensgrenzen

| Grenze | Beschreibung | Daten |
|--------|--------------|-------|
| Browser/direkter Client → `/api/v1/sessions*` | Rundenstart, Antwort, Abschluss, Sync | Sitzungs-, Aufgaben-, Kind- und Set-IDs, `size`, `clientAnswerId` |
| Browser/direkter Client → `DELETE /api/v1/learners/{id}` | Kind endgültig löschen | Kind-ID |
| Browser/direkter Client → `PATCH/DELETE /api/v1/sets/{id}` | Set umbenennen und löschen | Set-ID, Titel |
| Browser/direkter Client → `POST/PUT/DELETE /api/v1/sets/{setId}/entries…`, Import | Vokabeln anlegen, korrigieren, löschen; CSV-Import | Set-ID, Entry-ID, Wörter, CSV-Inhalt |
| Access-Token → Mandant, Rolle, Kind | Mandant und Rolle nur aus dem Token; Geschwister teilen den Mandanten | Claims |
| Altinstallation → Startbereinigung und Migration | Bestandsdaten unbekannter Qualität (Waisen) | Lerndaten |
| Gerät im Heimnetz → nginx → API | X-Forwarded-For vom Gerät ist nicht vertrauenswürdig; nginx setzt den Kopf selbst | Client-IP |
| Gerät → Traefik → nginx → API | Traefik setzt die Geräteadresse; nginx übernimmt sie nur von privaten Netzen | Client-IP |
| Browser → `POST /auth/refresh`, `/auth/logout` | seit FIX-01 ohne Rate-Limit | Refresh-Token |
| Server-Antwort → Anzeige | Kindername, Set-Titel, Vokabeltext und Fehlertexte im DOM | Servertexte |
| Server → Frontend | Serie und Meisterschaft entscheidet der Server, das Frontend zeigt nur an | Kennzahlen |

---

## Threat-Register

| Threat ID | Kategorie | Komponente | Severity | Disposition | Beleg | Status |
|-----------|-----------|------------|----------|-------------|-------|--------|
| T-02-01 | Elevation of Privilege | Sitzungs-Endpunkte: Kind handelt für ein Geschwisterkind | high | mitigate | `MayActFor` `SessionEndpoints.cs:224-237` vor jedem Service-Aufruf: Start `:49-52` (nach der size-Prüfung `:44-47`, vor der Set-Prüfung `:57`), Antwort `:88-91`, Abschluss `:120-123`, Sync `:152-155`; der Service prüft zusätzlich `LearnerId` (`LearningService.cs:159,293`); Mandantenfilter `WordQuestDbContext.cs:53-54`; Tests `SiblingIsolationTests.cs:60-101`, `SessionEndpointTests.cs:347,377` | closed |
| T-02-02 | Tampering | Doppelwertung durch gleichzeitige oder wiederholte Antworten | medium | mitigate | Concurrency-Token `LearningConfigurations.cs:91`, Unique-Index `client_answer_id` `:97-99`; Wiederholung ohne Wertung `LearningService.cs:182-196`; 409 `SessionEndpoints.cs:101-104,188-191,206-208`; Tests `SessionEndpointTests.cs:408` (200, 0 XP, eine review_log-Zeile), `:428`, `:447` (Zeilensperre: 200 + 409, XP einmal), `:477` | closed |
| T-02-34 | Tampering | Lost Update auf learning_session und gamification_profile | medium | mitigate | `wert = wert + n` per `ExecuteUpdateAsync` `LearningService.cs:396-414` in der Transaktion `:268-271`; Abschluss atomar beansprucht `:311-328` (`CompletedAt == null`); Tests `SessionEndpointTests.cs:505` (zwei Aufgaben), `:531` (zwei Abschlüsse) | closed |
| T-02-03 | Information Disclosure | 500 mit Technikdetails bei ungültigen IDs | low | mitigate | Service liefert `null` (`LearningService.cs:161-164,172-175,294-297`) → 404 mit deutschem `detail` `SessionEndpoints.cs:194-195`; 5xx im Frontend generisch `frontend/src/lib/api.ts:162`; Tests `SessionEndpointTests.cs:332,347,359,377` | closed |
| T-02-04 | Denial of Service | `size` negativ oder sehr groß | low | mitigate | `SessionEndpoints.cs:44-47` (1–50, `:21`) vor jeder Abfrage; Test `SessionEndpointTests.cs:390` (0, -1, 51 → 400; 1, 50 → 200) | closed |
| T-02-05 | Tampering | Tageslimit umgehen durch Ansehen ohne Antwort | low | accept | Konzept §6.3 `Documentation/WordQuest_Konzept_und_Architektur.md:282` („Bewusste Restgrenze“); → R-10 | closed (akzeptiert) |
| T-02-SC (02-01) | Tampering | npm/NuGet-Installationen | low | accept | keine Änderung an `*.csproj`, `package.json`, `package-lock.json` oder Dockerfiles im Bereich; → R-15 | closed (akzeptiert) |
| T-02-06 | Elevation of Privilege | IDOR: Kind einer anderen Familie löschen | high | mitigate | Policy Guardian `LearnerEndpoints.cs:26`; `ExecuteDeleteAsync` über den gefilterten `db.Users` `:179-181` (Filter `WordQuestDbContext.cs:45`); Tests `LearnerDeleteTests.cs:143` (404, Kind bleibt), `:156` (Kinder-Token 403) | closed |
| T-02-07 | Tampering | Elternkonto über den Kind-Endpunkt löschen | high | mitigate | `u.Role == UserRole.Learner` `LearnerEndpoints.cs:180`; Test `LearnerDeleteTests.cs:168` (Owner-ID → 404, Owner bleibt) | closed |
| T-02-08 | Information Disclosure | Lerndaten und Anmeldungen eines gelöschten Kindes bleiben | medium | mitigate | Fremdschlüssel mit Cascade `Migrations/20261017182305_ReferentialIntegrity.cs:38-116` (u. a. `refresh_token → app_user` `:62-68`); Test `LearnerDeleteTests.cs:114` zählt acht Tabellen inkl. `refresh_token` (`:95-102`), Geschwister unverändert | closed |
| T-02-09 | Spoofing | Gerät des gelöschten Kindes nutzt noch Tokens | low | mitigate | Refresh-Token per Cascade weg; Test `LearnerDeleteTests.cs:199` (Refresh 401, Übersicht und Rundenstart 404 mit Text). Restfenster bis 15 min: Lese-Endpunkte ohne Kindbezug (`GET /sets`, `/sets/{id}/entries`, `SetEndpoints.cs:19-20`) liefern weiter die Vokabeln der Familie | closed |
| T-02-10 | Denial of Service | Migration scheitert auf Altdaten mit Waisen | high | mitigate | `OrphanCleanup.RunAsync` vor `MigrateAsync` `Program.cs:236-237`; `OrphanCleanup.cs:46-57`; Tests über den echten Startpfad `MigrationTests.cs:108` (Waisen aller Arten), `:136` (wiederholter Lauf), `:155` (ohne Datenbank); e2e-Stack und Install-Smoke mit Exit 0 (`02-07-SUMMARY.md:127,129`) | closed |
| T-02-37 | Tampering | Startbereinigung löscht gültige Daten oder nimmt Eingabe an | medium | mitigate | konstantes SQL nur mit Anti-Joins `OrphanCleanup.cs:25-38`, `ExecuteSqlRawAsync` ohne Parameter `:56`; läuft nur vor `ReferentialIntegrity` `:51`; Tests `MigrationTests.cs:108` (gültige Zeilen je Tabelle erhalten), `:136` (Wiederholung ändert nichts) | closed |
| T-02-35 | Elevation of Privilege / Denial of Service | Rundenstart mit unbekannter oder fremder `setId` | medium | mitigate | gefilterte `AnyAsync`-Prüfung `SessionEndpoints.cs:57-60` vor dem Service; Tests `SetDeleteTests.cs:248` (gelöscht, zufällig), `:265` (fremd), `:280` (eigen), jeweils mit Zählung der learning_session-Zeilen; Restgrenze → R-11 | closed |
| T-02-SC (02-02) | Tampering | npm/NuGet-Installationen | low | accept | keine Dependency-Änderung; `dotnet-ef` nur im Wegwerf-Container; → R-15 | closed (akzeptiert) |
| T-02-11 | Tampering | Versehentliches Löschen eines Kindes | medium | mitigate | Startfokus „Abbrechen“ `frontend/src/components/ui/dialog.tsx:101`, Klick auf die Abdunklung schließt nicht `:50-51`, Buttons `type="button"` `:109,117`; Auslöser außerhalb des Formulars `ChildFormPage.tsx:80-81`; 404-Text bleibt bis zum Schließen `:93-103,119`; Tests `dialog.test.tsx:60,70,100,132`, `ChildFormPage.test.tsx:547,574`; e2e `children.spec.ts:128,160` | closed |
| T-02-32 | Cross-Site Scripting | Kindername in Dialog und Erfolgsmeldung | low | mitigate | `git grep 'dangerouslySetInnerHTML\|innerHTML\|insertAdjacentHTML' -- frontend/src` → 0 Treffer; Titel und Beschreibung als Textknoten `dialog.tsx:53-56` | closed |
| T-02-33 | Elevation of Privilege | Löschen ohne Elternrechte über die Oberfläche | low | transfer | Prüfung beim Server: Policy `LearnerEndpoints.cs:26`, Mandantenfilter und Rolle `:179-181`; Tests `LearnerDeleteTests.cs:143,156,168` | closed |
| T-02-SC (02-03) | Tampering | npm-Installationen | low | accept | keine Dependency-Änderung; `@google/design.md@0.4.0` fest versioniert `frontend/package.json:12-14`; → R-15 | closed (akzeptiert) |
| T-02-12 | Elevation of Privilege | IDOR: Set einer anderen Familie umbenennen oder löschen | high | mitigate | Policy Guardian `SetEndpoints.cs:23-24`; gefiltertes Laden → 404 `:85-89` (PATCH), `:121-125` (DELETE); Tests `SetEditTests.cs:188` (fremd und unbekannt → 404, Titel unverändert), `:204` (Kind 403), `SetDeleteTests.cs:179` (fremd und unbekannt → 404, Set bleibt), `:196` (Kind 403) | closed |
| T-02-13 | Tampering | Titel über 200 Zeichen oder leer | medium | mitigate | `ContentRules.CheckText` `ContentRules.cs:24-33` (Grenze `:15` = `HasMaxLength(200)` `ContentConfigurations.cs:14`) vor dem Speichern in POST `SetEndpoints.cs:49-52` und PATCH `:79-82`; Tests `SetEditTests.cs:159` (leer), `:172` (201 → 400, 200 → 200), `:217` (POST 201 → 400) | closed |
| T-02-14 | Information Disclosure | Details einer Datenbankausnahme in der Antwort | low | mitigate | Längenfehler beim Titel als 400 (T-02-13); andere 500 nur generisch: `UseExceptionHandler` `Program.cs:192` ohne Ausnahmetext (beobachtet, siehe Prüfspur), Frontend `api.ts:162`; weitere 500-Pfade bei `POST /sets` → W-2 | closed |
| T-02-15 | Tampering | Versehentliches Löschen eines Sets samt Lernstand | medium | mitigate | `DeleteSet` `SetDetailPage.tsx:602`, `ConfirmDialog` `:648`; 404 bleibt bis zum Schließen `:274-290`; Tests `SetDetailPage.test.tsx:347` (Enter → kein DELETE), `:367` (Abdunklung), `:384` (404), `:411` (Doppelklick); e2e `manage.spec.ts:243` | closed |
| T-02-16 | Cross-Site Scripting | Set-Titel in Überschrift, Dialog und Erfolgsmeldung | low | mitigate | `git grep` wie T-02-32 → 0 Treffer; Ausgabe nur als React-Text | closed |
| T-02-SC (02-04) | Tampering | npm/NuGet-Installationen | low | accept | keine Dependency-Änderung; → R-15 | closed (akzeptiert) |
| T-02-17 | Elevation of Privilege | IDOR: Vokabel einer anderen Familie oder eines anderen Sets | high | mitigate | Policy Guardian `SetEndpoints.cs:25-27`; Laden mit `e.Id == entryId && e.SetId == setId` über den Mandantenfilter `:198-199` (PUT), `:267-268` (DELETE); POST prüft das Set gefiltert `:153-156`; Tests `SetEditTests.cs:330` (PUT fremd, unbekannt, falsches eigenes Set → 404, unverändert), `:352` (Kind 403), `:399` (POST fremdes Set 404), `SetDeleteTests.cs:212` (DELETE fremd und unbekannt 404), `:231` (Kind 403). Für DELETE mit falschem eigenem Set gibt es keinen eigenen Test; der Code hat dieselbe Bedingung | closed |
| T-02-18 | Tampering | Wörter über 200 Zeichen oder leer | medium | mitigate | `WordProblems` über `ContentRules.CheckText` `SetEndpoints.cs:227-247` vor dem Speichern in PUT `:192-195` und POST `:164-176` (dazu Emoji 16, Beispiel 500 `:214-224`); Import `:315`, Parser `CsvVocabularyParser.cs:75-79`; Tests `SetEditTests.cs:296,313,384,448,464,485`, `CsvVocabularyParserTests` (Grenzfälle) | closed |
| T-02-19 | Tampering | Korrektur verändert Lernstand oder Karten-Identität | medium | mitigate | nur `SourceText`/`TargetText` `SetEndpoints.cs:205-207`; Test `SetEditTests.cs:230` (IDs, review_state und Zusatzfelder gleich) | closed |
| T-02-20 | Tampering | Versehentliches Löschen einer Vokabel | low | mitigate | `DeleteEntry` `SetDetailPage.tsx:532`, `ConfirmDialog` `:587`; Tests `SetDetailPage.test.tsx:692,713,730,756`; e2e `manage.spec.ts:299` | closed |
| T-02-21 | Cross-Site Scripting | Vokabeltext in Zeile, Dialog und Erfolgsmeldung | low | mitigate | `git grep` wie T-02-32 → 0 Treffer; Dialogtitel als Text `SetDetailPage.tsx:589` | closed |
| T-02-SC (02-05) | Tampering | npm/NuGet-Installationen | low | accept | keine Dependency-Änderung; → R-15 | closed (akzeptiert) |
| T-02-22 | Spoofing | X-Forwarded-For-Fälschung gegen das Login-Limit | high | mitigate | nginx setzt `X-Forwarded-For $remote_addr` `frontend/nginx.conf:47`; API mit `ForwardLimit = 1` und Vertrauen nur für 10/8, 172.16/12, 192.168/16 und Loopback `Program.cs:119-127`; `UseForwardedHeaders` `:195` vor `UseRateLimiter` `:207`; API ohne veröffentlichten Port (`docker-compose.quick.yml:41-68`, nur `web` `:71-72`); Tests `RateLimitTests.cs:129-142` (fremder Absender mit Kopf → 429), `:144-158` (vorangestellter Wert aus 172.x → 429); Smoke `setup-smoke.sh:213-216`; Prüfskript `gate/proxy-xff-check.sh:70-80`; zum Pfad `/health/` → W-4 | closed |
| T-02-23 | Denial of Service | Ein Gerät sperrt die ganze Familie aus | high | mitigate | Partition pro `RemoteIpAddress` `Program.cs:131-132`; Test `RateLimitTests.cs:112-127` (Proxy 172.18.0.3 und 192.168.240.3, Gerät B → 401); Smoke `setup-smoke.sh:217-220` (zweiter Absender 401); zwei echte Geräte → W-6 | closed |
| T-02-24 | Elevation of Privilege | Brute-Force über `/auth/refresh` ohne Limit | low | accept | 256 Bit `TokenHasher.cs:13`, SHA256 `:16`; Wiederverwendung widerruft alle Tokens `AuthService.cs:115-119`, Test `AuthEndpointTests.cs:182`; Ausnahme `AuthEndpoints.cs:20-24`, Tests `RateLimitTests.cs:160-187`; → R-12 | closed (akzeptiert) |
| T-02-25 | Denial of Service | userland-proxy: alle Geräte teilen einen Topf | low | accept | Konzept `:604` („Grenze“); PIN-Sperre pro Profil `AuthService.cs:73-84`; → R-13 | closed (akzeptiert) |
| T-02-26 | Elevation of Privilege | Kind handelt für ein Geschwisterkind (Runde, Antwort, Abschluss, Sync, Übersicht) | high | mitigate | `MayActFor` `SessionEndpoints.cs:224-237`; Forbid `LearnerEndpoints.cs:199-202` (Übersicht); Policy Guardian `:29` (Ampel); Test `SiblingIsolationTests.cs:60-101` (sechs Endpunkte 403, Snapshot von B unverändert) | closed |
| T-02-27 | Spoofing | Gestohlenes, rotiertes Refresh-Token wird erneut benutzt | medium | mitigate | Rotation `AuthService.cs:170-174`, Erkennung und Widerruf `:115-119`; Tests `AuthEndpointTests.cs:166` (Rotation), `:182` (altes Token 401, alle widerrufen), `:197` (nach Abmelden 401) | closed |
| T-02-36 | Spoofing | Traefik-Kette; realip-Datei im Heimnetz-Stack | medium | mitigate | `real_ip_recursive off`, `set_real_ip_from` nur private Netze `frontend/nginx-traefik-realip.conf:11-15`; nur in `docker-compose.yml:69` eingebunden, `web` dort ohne `ports` `:59-75`; Traefik-Kommando ohne `forwardedHeaders.*` `:82-94` (Warnhinweis `:79-81`); das Image kopiert nur `nginx.conf` (`frontend/Dockerfile:17`); Prüfskript `gate/proxy-xff-check.sh:82-117`; Mutation `real_ip_recursive on` fällt auf (`02-06-SUMMARY.md:99`); Traefik-Stufe selbst → W-6 | closed |
| T-02-SC (02-06) | Tampering | npm/NuGet und Container-Images | low | accept | keine csproj-Änderung (`Microsoft.AspNetCore.HttpOverrides` aus dem Shared Framework); Prüfskript nutzt `nginxinc/nginx-unprivileged:alpine` = Basis von `frontend/Dockerfile:14`; → R-15 | closed (akzeptiert) |
| T-02-28 | Elevation of Privilege | Kind liest Übersicht oder Ampel eines Geschwisterkindes | medium | mitigate | `LearnerEndpoints.cs:199-202`, `:29`; Test `SiblingIsolationTests.cs:92-100`; Gate-Lauf `02-07-SUMMARY.md:125` (Api.Tests 229 passed) | closed |
| T-02-29 | Tampering | Frontend errechnet Serie oder Meisterschaft selbst | low | mitigate | Server rechnet `LearnerEndpoints.cs:248,252` (`StreakRules.cs:80`, `MasteryRules.cs:29`); Frontend zeigt nur an `LearnHomePage.tsx:60-63,81`, `ProgressPage.tsx:87-89,101` | closed |
| T-02-30 | Denial of Service | Übersicht und Ampel laden Familiendaten in den Speicher | low | accept | `02-RESEARCH.md:228` (Familiengröße unkritisch); → R-14 | closed (akzeptiert) |
| T-02-31 | Information Disclosure | Logausgaben der neuen Regeln | low | mitigate | kein `ILogger`/`Console` in `backend/src/WordQuest.Modules.*` (grep → 0); keine neue Log-Zeile in `git diff c3534f1..3f55d4f -- backend/src`; beobachtete Fehlerlogs ohne personenbezogene Daten, EF-Parameter als `'?'` | closed |
| T-02-SC (02-07) | Tampering | npm/NuGet, Image `node:22` im Gate | low | accept | keine Dependency-Änderung; `node:22` nur als Wegwerf-Container, CI `NODE_VERSION: "22"` `.github/workflows/ci.yml:12`; → R-15 | closed (akzeptiert) |

*Status: open · closed · closed (akzeptiert) · open — unter Schwelle `high` (nicht blockierend)*
*Severity: critical > high > medium > low. Nur offene Threats ab `high` zählen für `threats_open`.*

---

## Akzeptierte Risiken

| Risk ID | Threat | Begründung | Akzeptanz dokumentiert in | Erfasst |
|---------|--------|------------|---------------------------|---------|
| R-10 | T-02-05 | Ansehen ohne Antwort ist unbegrenzt; gewertet und aufs Tageslimit angerechnet wird erst die Antwort (D-04) | `02-01-PLAN.md` Threat-Register; Konzept `:282` | 2026-10-17 |
| R-11 | T-02-35 (Restrisiko) | Wird das Set zwischen der Prüfung (`SessionEndpoints.cs:57`) und dem Speichern gelöscht, scheitert das Speichern am Fremdschlüssel (500 mit generischem Text) | `02-02-PLAN.md` Threat-Register | 2026-10-17 |
| R-12 | T-02-24 | Refresh und Abmelden ohne Limit. Raten ist aussichtslos (256 Bit); je Aufruf fallen ein SHA256 und ein Index-Lookup an | `02-06-PLAN.md`; `02-06-SUMMARY.md:169` (Review #6); `AuthEndpoints.cs:20-24` | 2026-10-17 |
| R-13 | T-02-25 | Wo Docker die Absenderadresse nicht durchreicht (userland-proxy, Docker Desktop, Rootless, IPv6 auf ein reines IPv4-Netz), teilen sich alle Geräte wieder einen Topf. Spoofing ist nicht möglich, die PIN-Sperre pro Profil bleibt | `02-06-PLAN.md`; Konzept `:604` | 2026-10-17 |
| R-14 | T-02-30 | Übersicht und Ampel laden Karten und Lernstände einer Familie in den Speicher; bei einigen hundert Wörtern auf dem Pi 5 unkritisch | `02-07-PLAN.md`; `02-RESEARCH.md:228` | 2026-10-17 |
| R-15 | T-02-SC (02-01 bis 02-07) | Keine neue Dependency (D-15); Werkzeuge (`dotnet-ef`, `node:22`, nginx-Basisimage) laufen nur als Wegwerf-Container | jeweiliges Threat-Register; `git diff --stat c3534f1..3f55d4f` ohne Treffer auf `*.csproj`, `package.json`, `package-lock.json`, Dockerfiles | 2026-10-17 |

*Akzeptierte Risiken tauchen in späteren Audits nicht erneut auf.*

---

## Hinweise ohne Threat-Zuordnung (nicht blockierend)

| ID | Fundstelle | Hinweis |
|----|------------|---------|
| W-1 | `backend/src/WordQuest.Api/Auth/AuthService.cs:101,142` | `POST /auth/refresh` mit `{}` oder `{"refreshToken":null}` und `POST /auth/logout` mit `{}` ergeben 500 (beobachtet). `TokenHasher.Hash(null)` wirft eine `ArgumentNullException`. Das zentrale 400 (`Program.cs:144-159`) greift nur bei unlesbarem Body, nicht bei fehlendem Feld. Beide Endpunkte sind seit FIX-01 ohne Limit (`AuthEndpoints.cs:23-24`). Ein Gerät im Heimnetz kann so beliebig viele Error-Logs samt Stacktrace erzeugen. Die Antwort selbst ist generisch, ohne Ausnahmetext. Dasselbe Muster laut Code, nicht beobachtet: `/sets/import/preview` mit `{}` (`CsvVocabularyParser.cs:41`), `/sets/{id}/import` mit `{}` oder `entries:[null]` (`SetEndpoints.cs:311,314`), `/sessions/sync` mit `answers:[null]` (`SessionEndpoints.cs:159`). Entweder eine Nullprüfung, die 400 liefert, oder das Risiko akzeptieren. |
| W-2 | `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:56-59` | `POST /sets` prüft nur den Titel. Laut Code enden `description` über 2000 Zeichen oder `sourceLanguage`/`targetLanguage` über 5 Zeichen (`ContentConfigurations.cs:15-17`) als Datenbankfehler (500). Die Oberfläche sendet nur `title` (`SetsPage.tsx:42`); erreichbar ist das nur über einen direkten Aufruf mit Elternrechten. |
| W-3 | `Program.cs:131-132`; Konzept `:604` | Das Limit gilt pro IP: Ein Gerät mit mehreren Adressen bekommt je Adresse 10 Versuche pro Minute, und das Elternpasswort hat keine Sperre pro Konto. Vor FIX-01 galt ein gemeinsamer Topf. Das Konzept nennt diese Grenze, aber im Register fehlt ein Threat bzw. ein akzeptiertes Risiko dafür. |
| W-4 | `frontend/nginx.conf:52-54` | `location /health/` reicht einen vom Gerät gesendeten `X-Forwarded-For` unverändert an die API weiter, und die API übernimmt ihn (privater Absender). Unter `/health/` liegt kein rate-limitierter Endpunkt; nginx und Kestrel normalisieren Punktsegmente, ein Umweg auf `/api/` ist nicht bekannt. Vorschlag: dort ebenfalls `proxy_set_header X-Forwarded-For $remote_addr;` setzen, damit die Regel für jeden Proxy-Pfad gilt. |
| W-5 | `backend/src/WordQuest.Modules.Content/Services/CsvVocabularyParser.cs:80` | Ein literales NUL-Byte als Trenner im Schlüssel (Bestand seit `0b49bf2`) lässt git die Datei als binär behandeln; `git diff` zeigt nur `Bin …`. Änderungen am CSV-Parser (zuletzt `0445f5b`, `3f55d4f`) sind deshalb in diff-basierten Reviews unsichtbar. Vorschlag: `\0` als Escape-Sequenz. |
| W-6 | `02-VALIDATION.md:96-97` | Zwei manuelle Prüfungen sind offen: zwei echte Geräte im Heimnetz (T-02-23) und der Traefik-Stack mit Zertifikat (T-02-22, T-02-36). Kein Lauf in diesem Repo belegt, dass Traefik v3 ohne `forwardedHeaders.trustedIPs` eingehende Köpfe verwirft. UNBEKANNT: Ergebnis beider Prüfungen. |
| W-7 | Commits `0445f5b`, `3f55d4f` | Der letzte festgehaltene Gate-Lauf ist `ebdca52` (`02-07-SUMMARY.md:125-130`). Für die beiden späteren CSV-Fixes steht kein Lauf in den SUMMARYs. UNBEKANNT: Testergebnis auf `3f55d4f`. |

Die SUMMARY-Dateien der Phase haben keinen Abschnitt `## Threat Flags`.

---

## Prüfspur

| Datum | Threats gesamt | Geschlossen | Akzeptiert | Offen | Durchgeführt von |
|-------|----------------|-------------|------------|-------|------------------|
| 2026-10-17 | 44 | 33 | 11 | 0 | gsd-security-auditor (Claude Opus 5.5), ASVS L1, block_on high |

Beobachtet am e2e-Stack (`wordquest-e2e-api-1`). Das Image wurde am 2026-10-17 um 23:04:51 +0200 gebaut, also zwischen `0445f5b` und `3f55d4f`. Der Stack läuft mit `ASPNETCORE_ENVIRONMENT: Development` (`frontend/e2e/docker-compose.e2e.yml:32`):
- `POST /api/v1/auth/refresh` mit `{x` → 400, `detail` „Die Anfrage ist unvollständig oder nicht lesbar.“
- `POST /api/v1/auth/refresh` mit `{}` bzw. `{"refreshToken":null}` → 500, Body nur „An error occurred while processing your request.“; `POST /api/v1/auth/logout` mit `{}` → 500.
- API-Log zu diesen Aufrufen: `ArgumentNullException (Parameter 's')` mit Stacktrace, ohne personenbezogene Daten; EF-Parameter erscheinen als `'?'`.
- Der Stack wurde während des Audits gestoppt (nicht vom Auditor). Weitere Proben (Import, `POST /sets`) liefen deshalb nicht; W-1 (Rest) und W-2 sind nur über den Code belegt.

Mechanisch geprüft: `git grep` auf XSS-Senken in `frontend/src` → 0; `git diff --stat c3534f1..3f55d4f` auf Dependency-Dateien → leer; `ILogger`/`Console` in `backend/src/WordQuest.Modules.*` → 0; neue Log-Aufrufe im Backend-Diff → 0.

Nicht selbst ausgeführt: dotnet-Tests (lokal kein SDK), Install-Smoke, `proxy-xff-check.sh`. Die Belege dafür stammen aus `02-07-SUMMARY.md:125-130` (Stand `ebdca52`): Learning.Tests 128 passed, Api.Tests 229 passed; Frontend 216 passed; e2e 46 passed und 1 skipped; Smoke mit `RATE-LIMIT OK` und `SMOKE OK`; `PROXY-XFF OK`.

WebApplicationFactory und der e2e-Stack laufen beide in Development. Dass das 400 bei unlesbarem Body auch in Production greift, ist nur über den Code belegt (`Program.cs:144-159` ohne Umgebungszweig).

---

## Freigabe

- [x] Alle Threats haben eine Disposition (mitigate / accept / transfer)
- [x] Akzeptierte Risiken stehen im Abschnitt „Akzeptierte Risiken“
- [x] `threats_open: 0` bestätigt
- [x] `status: verified` im Frontmatter gesetzt

**Freigabe:** verified 2026-10-17
