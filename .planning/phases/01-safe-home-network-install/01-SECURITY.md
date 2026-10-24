---
phase: "01"
slug: "safe-home-network-install"
status: verified
verdict: SECURED
threats_total: 50
threats_closed: 38
threats_accepted: 12
# threats_open = offene Threats mit Severity >= workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
block_on: high
code_range: "0b49bf2..62852db"
created: "2026-10-16"
---

# Phase 01 — Sicherheit

> Sicherheitsvertrag der Phase: Threat-Register, akzeptierte Risiken und Prüfspur. Geprüft wurde der Code im Bereich `0b49bf2..62852db` gegen die Threat-Register aus `01-01-PLAN.md` bis `01-08-PLAN.md`. Jede Mitigation ist mit Datei und Zeile belegt.

---

## Vertrauensgrenzen

| Grenze | Beschreibung | Daten |
|--------|--------------|-------|
| npm-Registry/NuGet → Entwicklungsrechner/CI | Dev-Dependencies, `npx @google/design.md`, `Microsoft.AspNetCore.Mvc.Testing` | fremder Code |
| Terminal (Elternteil) → setup.sh → API-Container | E-Mail und Passwort, Passwort per stdin an `create-owner` | Zugangsdaten |
| Host-Dateisystem → Container | Secret-Dateien als read-only Mounts, Sicherungsordner | DB-Passwort, JWT-Schlüssel, Dumps |
| Betreiber-Terminal → API-Container | `reset-password` über `docker compose exec` | neues Passwort (einmalig) |
| Umgebung/Secret-Dateien → API-Start | Startprüfung der Secrets | Secrets |
| Browser/direkter Client → API | Login, PIN-Login, Passwortwechsel, Kind anlegen und ändern | Passwörter, PINs, Namen, IDs |
| Access-Token → Identität/Mandant | Nutzer-Id und Mandant nur aus dem Token | Claims |
| API-Antwort → Browser | Fehlertexte des Servers im DOM | Servertexte |
| Teststack/e2e-Lauf → Host | Testsecrets, storageState mit Eltern-Tokens | Testzugänge |

---

## Threat-Register

| Threat ID | Kategorie | Komponente | Severity | Disposition | Beleg | Status |
|-----------|-----------|------------|----------|-------------|-------|--------|
| T-01-01 | Tampering | `npx @google/design.md` in Skripten | medium | mitigate | `frontend/package.json:12-14`: alle `design:*`-Aufrufe mit `@0.4.0`; sonst kein Skript-Aufruf ohne Version (`AGENTS.md:81-87` ist nur Doku) | closed |
| T-01-02 | Information Disclosure | `frontend/e2e/docker-compose.e2e.yml` | low | mitigate | Kopfkommentar `:1-4`, Port `127.0.0.1:18080` `:59`; die Testwerte `:16,34,35` kommen sonst nirgends im Repo vor (`git grep`) | closed |
| T-01-03 | Denial of Service | Zoom-Sperre im viewport-meta | medium | mitigate | `frontend/index.html:6-9` ohne `maximum-scale`/`user-scalable`; axe mit `wcag2aa` (Regel meta-viewport) in `frontend/e2e/axe.ts:5,8` | closed |
| T-01-SC (01-01) | Tampering | sieben npm-Dev-Dependencies | high | mitigate | exakte Versionen `frontend/package.json:34,36,38-40,48,54`, Override `:56-57`; Lockfile versioniert, CI `npm ci` (`.github/workflows/ci.yml:87`); Checkpoint und `npm view`-Prüfung in `01-01-SUMMARY.md:125-129` (Freigabe über Dennis' stehende Freigabe genau dieser sieben Pakete) | closed |
| T-01-04 | Information Disclosure | setup.sh → create-owner (Passwort) | high | mitigate | `setup.sh:123,130` `IFS= read -rsp`; `setup.sh:141` Übergabe per `printf` an stdin, nie als Argument; `AccountCommands.cs:46` liest stdin, Meldungen `:75-79` ohne Passwort; Tests `AccountCommandTests.cs:54,71,87`; Smoke `setup-smoke.sh:65` | closed |
| T-01-36 | Denial of Service | Passwort nur aus Leerzeichen | low | mitigate | `AccountRules.cs:55-56`; `AccountService.cs:45-48`; CLI Exit 2 `AccountCommands.cs:78`; Tests `AccountCommandTests.cs:78`, `AccountRulesTests.cs:12,21` | closed |
| T-01-05 | Spoofing | Demo-Zugangsdaten im Heimnetz | high | mitigate | Standard `false`: `docker-compose.quick.yml:54`, `docker-compose.yml:44`, `.env.example:28`, `Program.cs:191`; Abbruch bei `true` `setup.sh:76-78`; Smoke Demo-Login = 401 `setup-smoke.sh:74-75` | closed |
| T-01-06 | Elevation of Privilege | create-owner (zweites Elternkonto) | medium | mitigate | `AccountService.cs:35-38` → Exit 3 `AccountCommands.cs:79`; Test `AccountCommandTests.cs:63-69`; Smoke `setup-smoke.sh:86-91`; Restrisiko Race → R-09 | closed |
| T-01-07 | Information Disclosure | Secret-Dateien `./secrets` | medium | mitigate | `setup.sh:22-23` (0700), `:49` (0644); Datei-Secrets `docker-compose.quick.yml:100-104` (Compose mountet read-only); Regression `smoke.mjs --installer` am 2026-10-16 mit Exit 0 | closed |
| T-01-08 | Elevation of Privilege | SystemTenantContext in AccountCommands | medium | mitigate | nur `AccountCommands.cs:37` (Einstieg `Program.cs:141-145`, vor der Pipeline), `Program.cs:186` (Start), `DesignTimeDbContextFactory.cs:26`; `AccountService.cs` ohne `IgnoreQueryFilters`; HTTP-Pfad mit `HttpTenantContext` `Program.cs:59` | closed |
| T-01-09 | Information Disclosure | `devpassword` in CI/ApiFactory | low | accept | `.github/workflows/ci.yml:18-19,26`; außerhalb von Development abgewiesen `SecretCheck.cs:18`; → R-01 | closed (akzeptiert) |
| T-01-SC (01-02) | Tampering | NuGet `Microsoft.AspNetCore.Mvc.Testing` | low | mitigate | `WordQuest.Api.Tests.csproj:14` mit fester Version 10.0.12; übrige Pakete identisch mit `WordQuest.Learning.Tests.csproj:15-30`; Prüfung `01-02-SUMMARY.md:113-115` | closed |
| T-01-10 | Information Disclosure | `frontend/playwright/.auth/guardian.json` | medium | mitigate | `.gitignore:39-40` (`git check-ignore` trifft); baseURL lokal `playwright.config.ts:13`; Port nur 127.0.0.1 `docker-compose.e2e.yml:59` | closed |
| T-01-11 | Tampering | Servertexte in ApiError.message | low | mitigate | `git grep 'dangerouslySetInnerHTML\|innerHTML' frontend/src` → 0 Treffer; Ausgabe nur als React-Text | closed |
| T-01-12 | Information Disclosure | technische Fehlertexte | low | mitigate | `frontend/src/lib/api.ts:152` (5xx → deutscher Allgemeintext), `:167-168` (unlesbarer Körper); Rest `:166` siehe W-4 | closed |
| T-01-SC (01-03) | Tampering | Paketinstallationen | low | accept | keine Änderung an package.json/csproj in 01-03 (`git log`); → R-08 | closed (akzeptiert) |
| T-01-13 | Information Disclosure | Punktanzeige des Ziffernfelds | medium | mitigate | `ProfilePickerPage.tsx:108` (4 bis 6, nur aus der Eingabelänge); API liefert nur `HasPin` (`Contracts.cs:33`); e2e `learn.spec.ts:113-117` | closed |
| T-01-14 | Spoofing | PIN raten per Tastatur | medium | transfer | Server: Sperre `AuthService.cs:73-85` mit `MaxPinAttempts`/`PinLockoutMinutes` (`appsettings.json:15-16`), Rate-Limit `AuthEndpoints.cs:13-15`; die UI nutzt nur `learner-login` | closed |
| T-01-15 | Tampering | globaler keydown-Listener | low | mitigate | `ProfilePickerPage.tsx:88` (nur mit gewähltem Profil), `:90` (Modifier), `:96` (Enter auf Button), `:102-103` (Anmelden und Entfernen im Effekt) | closed |
| T-01-16 | Information Disclosure | PIN über Heimnetz-HTTP | low | accept | Konzept §15 „Transport“ `Documentation/WordQuest_Konzept_und_Architektur.md:644`, `.planning/PROJECT.md:67`; TLS-Weg OPS2-01; → R-02 | closed (akzeptiert) |
| T-01-40 | Denial of Service | Ziffern-Tasten im PIN-Formular | medium | mitigate | `type="button"` `ProfilePickerPage.tsx:152,207,216,220`; einziges `type="submit"` `:231`; e2e zählt learner-login `learn.spec.ts:21-27,75,79,128,137` | closed |
| T-01-SC (01-04) | Tampering | Paketinstallationen | low | accept | keine Änderung an package.json/csproj in 01-04; → R-08 | closed (akzeptiert) |
| T-01-17 | Spoofing | API-Start mit Standard-Secrets | high | mitigate | `Program.cs:17-31` (außerhalb von Development: ExitCode 1, `return`) vor `BuildConnectionString` `:48`, `Build()` `:137` und CLI `:141`; Liste `SecretCheck.cs:15-25`, Länge `:45-56`; Tests `SecretCheckTests.cs:9-27`; Smoke `setup-smoke.sh:112-138` | closed |
| T-01-37 | Elevation of Privilege | expliziter `ConnectionStrings__Default` | high | mitigate | `Program.cs:22-24`; `SecretCheck.cs:62-78` (`NpgsqlConnectionStringBuilder`); Tests `SecretCheckTests.cs:43-61`; Smoke (c) `setup-smoke.sh:135-137` | closed |
| T-01-18 | Information Disclosure | Reset-Passwort | high | mitigate | `AccountService.cs:93` (`RandomNumberGenerator.GetString`, 16 Zeichen `:19`), nur Hash `:94`; einmal auf stdout `AccountCommands.cs:59-60`; `AccountService` hat keinen Logger (`:15`); Test `ResetPasswordCommandTests.cs:71-73` | closed |
| T-01-19 | Spoofing | Refresh-Tokens nach Reset | medium | mitigate | Widerruf `AccountService.cs:97-106`; Refresh lehnt widerrufene Tokens ab `AuthService.cs:115`; Test 401 `ResetPasswordCommandTests.cs:77` | closed |
| T-01-41 | Spoofing | Access-Tokens nach Reset | low | accept | `AccountService.cs:75-77`; `README.md:112`; Konzept `:643`; `01-05-SUMMARY.md:137`; → R-07 | closed (akzeptiert) |
| T-01-20 | Information Disclosure | Dumps in `./backups` | high | mitigate | `setup.sh:54-57` (Besitzerprüfung, 0700); `README.md:88-96`; `.gitignore:24`; Smoke `setup-smoke.sh:142-143` | closed |
| T-01-21 | Information Disclosure | E-Mail-Aufzählung über reset-password | low | accept | nur über die CLI erreichbar (`AccountCommands.cs:50-57`), kein HTTP-Endpunkt; → R-03 | closed (akzeptiert) |
| T-01-SC (01-05) | Tampering | Image `prodrigestivill/postgres-backup-local:17` | medium | mitigate | `docker-compose.quick.yml:78` = `docker-compose.yml:98` = Bestand `0b49bf2:docker-compose.yml:99`; Digest-Pinning v2 (OPS2-02) | closed |
| T-01-22 | Elevation of Privilege | Passwortwechsel ohne aktuelles Passwort | high | mitigate | `AccountService.cs:141-144`; `AccountEndpoints.cs:34-37`; Test `AccountEndpointTests.cs:116` | closed |
| T-01-23 | Spoofing | Raten mit gestohlenem Token | medium | mitigate | `AccountEndpoints.cs:16` `RequireRateLimiting("auth")`; Policy `Program.cs:107-114`; Test `RateLimitTests.cs:63` | closed |
| T-01-24 | Elevation of Privilege | Passwort eines anderen Kontos | high | mitigate | Id nur aus dem Token `AccountEndpoints.cs:29`; Policy Guardian `:15`; Filter `WordQuestDbContext.cs:45`; Tests `AccountEndpointTests.cs:105` (Kind 403), `:213` (fremde Id im Körper ignoriert) | closed |
| T-01-25 | Spoofing | Sitzungen bleiben nach Passwortwechsel | low | accept | `AccountService.cs:113-114`; Konzept `:641`; → R-04 | closed (akzeptiert) |
| T-01-42 | Denial of Service | Leerzeichen-Passwort am Endpoint | medium | mitigate | `AccountService.cs:131-134` vor `Hash` `:146`; `AccountEndpoints.cs:38-41`; Tests `AccountEndpointTests.cs:144`, `AccountPage.test.tsx:101` | closed |
| T-01-26 | Information Disclosure | schwache, häufige Passwörter | low | accept | Konzept `:641` „Bekannte Lücke“ (D-18); Mindestlänge `AccountRules.cs:14`; → R-05 | closed (akzeptiert) |
| T-01-SC (01-06) | Tampering | Paketinstallationen | low | accept | keine Änderung an package.json/csproj in 01-06; → R-08 | closed (akzeptiert) |
| T-01-27 | Elevation of Privilege | Kind in fremdem Mandanten | high | mitigate | TenantId aus dem Token `LearnerEndpoints.cs:56`; Policy `:23-24`; Filter `WordQuestDbContext.cs:46`; Tests `LearnerEndpointTests.cs:213` (403), `:224` (fremde Familie sieht das Kind nicht) | closed |
| T-01-28 | Spoofing | schwache oder leere PIN per POST | medium | mitigate | `LearnerEndpoints.cs:49-50` (`pinRequired: true`); Regel `AccountRules.cs:64-65,88-98`; Tests `LearnerEndpointTests.cs:128,138`; Sperre bleibt `AuthService.cs:73-85` | closed |
| T-01-29 | Denial of Service | überlanger Name | low | mitigate | `AccountRules.cs:83-86` → 400 `LearnerEndpoints.cs:154`; Test `LearnerEndpointTests.cs:156` | closed |
| T-01-30 | Information Disclosure | PIN im sichtbaren Formularfeld | low | accept | `01-UI-SPEC.md:276`; `ChildFormPage.tsx:79,196`; → R-06 | closed (akzeptiert) |
| T-01-38 | Information Disclosure | Eltern-Passwort des Smoke-Stacks als Umgebungsvariable | low | mitigate | nur für einen Aufruf gesetzt `setup-smoke.sh:154-156`; nie ausgegeben `:94-100`; `trap cleanup` mit `down -v` und `rm -rf` `:25-30`; `.gitignore:40` | closed |
| T-01-SC (01-07) | Tampering | Paketinstallationen | low | accept | keine Änderung an package.json/csproj in 01-07; → R-08 | closed (akzeptiert) |
| T-01-31 | Elevation of Privilege | IDOR per PATCH | high | mitigate | `LearnerEndpoints.cs:95-102` (gefilterter Kontext → 404); Policy `:25`; Tests `LearnerEndpointTests.cs:400` (404, nichts geändert), `:413` (Kind 403) | closed |
| T-01-32 | Spoofing | schwache PIN per PATCH | medium | mitigate | dieselbe Regel `LearnerEndpoints.cs:105-106`; Theorie über POST und PATCH `LearnerEndpointTests.cs:279` | closed |
| T-01-33 | Tampering | Teiländerung bei ungültiger Anfrage | low | mitigate | Prüfung `LearnerEndpoints.cs:104-110` vor der ersten Zuweisung `:112`; Test `LearnerEndpointTests.cs:384` | closed |
| T-01-34 | Information Disclosure | bestehende PIN im Formular | low | mitigate | API liefert nur `HasPin` (`Contracts.cs:33`, `LearnerEndpoints.cs:37`); Feld leer `ChildFormPage.tsx:79`, nach dem Speichern geleert `:112`, `autoComplete="off"` `:196` | closed |
| T-01-35 | Denial of Service | Selbstaussperrung durch Rate-Limit in Tests | low | mitigate | `docker-compose.e2e.yml:40-43`; eigene Factory je Testklasse (`RateLimitTests.cs:18`); Konzept `:597`; Ursache FIX-01 (Phase 2) | closed |
| T-01-39 | Spoofing | angehobenes Auth-Limit | medium | mitigate | Standard 10 `appsettings.json:17`, Fallback `Program.cs:98`, Abbruch bei < 1 `:99-103`; einziger höherer Wert `docker-compose.e2e.yml:43` (`git grep RequestsPerMinute`); Tests `RateLimitTests.cs:44,63`; PIN-Sperre unabhängig `AuthService.cs:73-85` | closed |
| T-01-SC (01-08) | Tampering | Paketinstallationen | low | accept | keine Änderung an package.json/csproj in 01-08; Lockfile-Update `e95f8b6` außerhalb des Plans siehe W-3; → R-08 | closed (akzeptiert) |

*Status: open · closed · closed (akzeptiert) · open — unter Schwelle `high` (nicht blockierend)*
*Severity: critical > high > medium > low. Nur offene Threats ab `high` zählen für `threats_open`.*

---

## Akzeptierte Risiken

| Risk ID | Threat | Begründung | Akzeptanz dokumentiert in | Erfasst |
|---------|--------|------------|---------------------------|---------|
| R-01 | T-01-09 | `devpassword` nur für die lokale Dev-DB und den CI-Dienst; außerhalb von Development verweigert die API diesen Wert | `01-02-PLAN.md` Threat-Register; `SecretCheck.cs:18` | 2026-10-16 |
| R-02 | T-01-16 | PIN geht im Standardbetrieb unverschlüsselt über Heimnetz-HTTP; der TLS-Weg ist v2 (OPS2-01) | `01-04-PLAN.md`; `.planning/PROJECT.md:67`; Konzept §15 „Transport“ | 2026-10-16 |
| R-03 | T-01-21 | `reset-password` verrät, ob es ein Elternkonto zur Adresse gibt; nötig ist dafür Shell-Zugriff auf Host oder Container, wo DB und Secrets ohnehin liegen | `01-05-PLAN.md` Threat-Register | 2026-10-16 |
| R-04 | T-01-25 | Andere Sitzungen bleiben nach einem Passwortwechsel bestehen (UI-SPEC); Sitzungsende nach dem Wechsel ist ASVS L2, das Projekt ist L1 | `01-06-PLAN.md`; Konzept `:641` | 2026-10-16 |
| R-05 | T-01-26 | Keine Prüfung gegen Listen häufiger Passwörter in v1, Mindestlänge 8 | `01-06-PLAN.md` (D-18); Konzept `:641`; `01-06-SUMMARY.md` | 2026-10-16 |
| R-06 | T-01-30 | PIN-Feld ist sichtbar, weil Eltern dem Kind die Zahl sagen; das Feld wird nie vorbefüllt | `01-07-PLAN.md`; `01-UI-SPEC.md:276` | 2026-10-16 |
| R-07 | T-01-41 | Access-Tokens bleiben nach einem Reset bis zu 15 Minuten gültig; eine sofortige Sperre bräuchte eine DB-Prüfung je Anfrage | `01-05-PLAN.md`; `01-05-SUMMARY.md:137`; `README.md:112`; Konzept `:643` | 2026-10-16 |
| R-08 | T-01-SC (01-03, 01-04, 01-06, 01-07, 01-08) | Keine Paketinstallation in diesen Plänen; die Pakete kommen aus dem Checkpoint in 01-01 | jeweiliges Threat-Register; `git log` ohne Änderung an package.json/csproj | 2026-10-16 |
| R-09 | T-01-06 (Restrisiko) | „Nur ein Elternkonto“ wird erst geprüft, dann eingefügt, ohne DB-Absicherung; setup.sh ruft nacheinander auf, Zugriff braucht Host-Rechte; ein Unique-Index wäre eine Produktentscheidung | `01-02-SUMMARY.md:197` (Review M4) | 2026-10-16 |

*Akzeptierte Risiken tauchen in späteren Audits nicht erneut auf.*

---

## Hinweise ohne Threat-Zuordnung (nicht blockierend)

| ID | Fundstelle | Hinweis |
|----|------------|---------|
| W-1 | `backend/src/WordQuest.Api/SecretCheck.cs:14-25` | Die Liste enthält die Testsecrets aus dem Repo nicht (`frontend/e2e/docker-compose.e2e.yml:16,34,35`, `backend/tests/WordQuest.Api.Tests/ApiFactory.cs:35`), obwohl der Kommentar „Werte, die im Repository stehen“ sagt. Der e2e-Stack läuft mit `Production` und würde mit diesen Werten in der Liste nicht starten. Entweder den Kommentar berichtigen und das Risiko akzeptieren oder den Teststack anders absichern. |
| W-2 | `setup.sh:76` | Der Demo-Abbruch vergleicht exakt mit `true`. .NET liest Bool-Werte ohne Rücksicht auf Groß- und Kleinschreibung (`True`, `TRUE`), ein Wert in Anführungszeichen kommt ebenfalls durch. Der alte Vorlagenwert `true` wird erkannt. |
| W-3 | Commit `e95f8b6` | `npm audit fix` (nur Lockfile: source-map-js 1.2.2, serialize-javascript 7.1.2) außerhalb jedes Plans. Formal widerspricht das „keine Installation“ in T-01-SC (01-08), sicherheitlich ist es eine Verbesserung. |
| W-4 | `frontend/src/lib/api.ts:166` | Bei einer 4xx-Antwort ohne `detail`/`errors` wird ein englischer `title` angezeigt. Bereits in `01-03-SUMMARY.md` unter „Offen“ geführt. |

Die SUMMARY-Dateien der Phase haben keinen Abschnitt `## Threat Flags`.

---

## Prüfspur

| Datum | Threats gesamt | Geschlossen | Akzeptiert | Offen | Durchgeführt von |
|-------|----------------|-------------|------------|-------|------------------|
| 2026-10-16 | 50 | 38 | 12 | 0 | gsd-security-auditor (Claude Opus 5.5), ASVS L1, block_on high |

Beobachtet: `node .planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/smoke.mjs --installer` → Exit 0, `{"executable":true,"newSecretsReadable":true,"existingSecretsReadable":true,"privateDirectory":true,"contentsPreserved":true}`.
Nicht selbst ausgeführt: dotnet-Tests (lokal kein SDK) und `setup-smoke.sh` (Docker-Build). Die Belege dafür stammen aus `01-05-SUMMARY.md` (Smoke Exit 0 mit IMAGE/LOGIN/RESET/STARTABBRUCH/BACKUP OK) und `01-08-SUMMARY.md` (Api.Tests 130/130, Learning.Tests 104/104).

---

## Freigabe

- [x] Alle Threats haben eine Disposition (mitigate / accept / transfer)
- [x] Akzeptierte Risiken stehen im Abschnitt „Akzeptierte Risiken“
- [x] `threats_open: 0` bestätigt
- [x] `status: verified` im Frontmatter gesetzt

**Freigabe:** verified 2026-10-16
