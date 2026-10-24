---
last_mapped_commit: a397d4db9d120da68a269a147900eabb05e0a42e
last_mapped_at: 2026-10-24
---
# Codebase Concerns

**Analysis Date:** 2026-10-24

Stand: Branch `v1-fertig`, nach Phase 03.1.1 und den Quicks 261023-a8x/k4m. Jeder Punkt ist gegen den aktuellen Code geprüft. Erledigte Befunde aus `.planning/v1.0-CODEX-REVIEW.md` (u. a. Set-Scope, Concurrency-Token `LastReviewedAt`, atomarer PIN-Zähler, CSV-Kopfzeile, Ladefehler `SetsPage`, nginx-Header, Abmelde-Kette, `retryOn401` beim Login, `queryClient.clear()`) sowie Demo-Konto und DB-Passwort-Fallback stehen hier nicht mehr.

## Tech Debt

**Refresh-Tokens werden nie gelöscht:**
- Issue: `IssueAsync` und `RefreshAsync` legen bei jeder Anmeldung bzw. Rotation eine Zeile an; widerrufene und abgelaufene Tokens bleiben für immer. Es gibt kein `ExecuteDeleteAsync` auf `RefreshTokens` (einzige Löschungen: `PictureService.cs:56`, `LearnerEndpoints.cs:183`).
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:278-292`, `backend/src/WordQuest.Api/Auth/AuthService.cs:135-142`
- Impact: Tabelle wächst linear mit Nutzung (bei 15-min-Access-Token rund eine Zeile je Viertelstunde aktiver Nutzung pro Gerät). Heute unkritisch, verstärkt aber den nächsten Punkt.
- Fix approach: Beim Start in `OrphanCleanup` (`backend/src/WordQuest.Infrastructure/OrphanCleanup.cs`) Tokens mit `ExpiresAt < now - Puffer` löschen. Vorsicht: Die Reuse-Erkennung braucht widerrufene Tokens bis zu deren `ExpiresAt` (30 Tage, `AuthOptions.cs:21`).

**`LogoutAsync` lädt alle Tokens des Kontos:**
- Issue: Für die Abmelde-Kette wird die komplette Token-Historie des Nutzers als Dictionary in den Speicher gelesen und dann im Code verfolgt.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:255-274`
- Impact: Kosten wachsen mit der nie bereinigten Historie (siehe oben). Für eine Familie heute vernachlässigbar.
- Fix approach: Abfrage auf `CreatedAt >= <CreatedAt des vorgelegten Tokens>` begrenzen, oder rekursive CTE über `ReplacedByTokenHash`; zusammen mit dem Aufräumen oben erledigt sich das weitgehend.

**Datenzugriff direkt in Set-Endpoints:**
- Issue: `SetEndpoints` arbeitet direkt mit `WordQuestDbContext` (27 Zugriffe), inkl. Positionsvergabe und Karten-Erzeugung beim Anlegen und CSV-Commit. Andere Bereiche (`AccountEndpoints`, `PictureEndpoints`) delegieren vollständig an Services.
- Files: `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:43-77`, `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:166-196`, `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs:328-365`
- Impact: Abweichung von der AGENTS.md-Regel „Endpoints parsen, autorisieren, rufen auf, mappen“; die Positionslogik ist doppelt (Einzel-Eintrag und Import).
- Fix approach: Bei der nächsten fachlichen Änderung an Sets einen `ContentService` nach Muster `LearningService` herausziehen; nicht als Selbstzweck.

**Große Dateien:**
- Issue: `frontend/src/features/manage/SetDetailPage.tsx` (1038 Zeilen) bündelt Eintragsliste, Formular, CSV-Import und Bildverwaltung; `backend/src/WordQuest.Infrastructure/LearningService.cs` (675 Zeilen).
- Impact: Hohe Änderungsdichte, Merge-Konflikte, schwer reviewbar; Test-Datei `SetDetailPage.test.tsx` hat 1593 Zeilen.
- Fix approach: `SetDetailPage` in Teilkomponenten unter `frontend/src/features/manage/` (Import-Dialog, Bild-Bereich) aufteilen, wenn dort die nächste Änderung ansteht.

**`curl` ohne Zeitlimit im Update:**
- Issue: Download des Release-Pakets ohne `--max-time`/`--connect-timeout` (03.1-06 R-02, bewusst offen).
- Files: `upgrade.sh:86-88`
- Impact: Hängender Server oder Netz lässt `upgrade.sh` unbegrenzt warten.
- Fix approach: `--connect-timeout 15 --max-time 300` an beide Aufrufe.

## Known Bugs

**Refresh widerruft alle Tokens, wenn Abmelden oder PIN-Wechsel das Rennen gewinnt:**
- Symptoms: Andere Geräte desselben Kontos werden abgemeldet.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:181-185`
- Trigger: Ein Refresh wartet auf `LockUserAsync`, während Abmelden (`AuthService.cs:237-275`) oder `SaveAndRevokeRefreshTokensAsync` (`backend/src/WordQuest.Infrastructure/AccountService.cs:107-115`) den Token widerruft. Danach sieht der Refresh `RevokedAt != null` ohne `ReplacedByTokenHash` und behandelt das als Diebstahl → `RevokeAllAsync`.
- Workaround: Neu anmelden. Fix approach: Widerruf ohne Nachfolger (`ReplacedByTokenHash == null`) nicht als Reuse werten, nur 401 liefern; Reuse-Erkennung auf rotierte Tokens beschränken. Mit Integrationstest gegen PostgreSQL absichern.

**Anmeldung mit alten Zugangsdaten während Passwort-Reset/PIN-Wechsel:**
- Symptoms: Ein Login, dessen Passwort-/PIN-Prüfung vor dem Widerruf bestanden hat, schreibt seinen Refresh-Token danach fest und bleibt angemeldet.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:40-66`, `backend/src/WordQuest.Api/Auth/AuthService.cs:278-292` (kein `LockUserAsync` in den Login-Pfaden)
- Trigger: Paralleler Login und Reset im selben Moment (im Konzept als bekannte Lücke dokumentiert).
- Workaround: Gerät erneut abmelden oder Reset wiederholen. Fix approach: `IssueAsync` unter `LockUserAsync` laufen lassen und Hash/PIN unter der Sperre erneut lesen.

**Mehrere Tabs: verspätete Antwort meldet alle Tabs ab:**
- Symptoms: Trifft die Refresh-Antwort an einen Tab erst nach dessen nächstem Versuch ein, endet die Sitzung in allen Tabs.
- Files: `frontend/src/lib/api.ts:131`, `frontend/src/lib/api.ts:161`, `backend/src/WordQuest.Api/Auth/AuthService.cs:167-176` (409-Gnadenfenster)
- Trigger: Langsames Netz mit zwei offenen Tabs (261023-a8x, Grenze im Konzept). Ebenso 409 ohne zweiten Tab, wenn die Commit-Bestätigung verloren geht (03.1-02).
- Workaround: Neu anmelden.

## Security Considerations

**Tokens im `localStorage` bei HTTP-Standardbetrieb:**
- Risk: Jedes XSS liest Access- und Refresh-Token aus. Im Standardweg (`docker-compose.quick.yml`) läuft alles über HTTP im Heimnetz, Tokens gehen unverschlüsselt über WLAN.
- Files: `frontend/src/lib/api.ts:36-43`, `frontend/src/lib/api.ts:44-80`, `frontend/nginx-security-headers.conf`, `docker-compose.quick.yml`
- Current mitigation: Strikte CSP ohne Inline-Skripte, Header in allen nginx-Locations (03.1-04), Refresh-Rotation mit Reuse-Erkennung, 15-min-Access-Token (`backend/src/WordQuest.Api/Auth/AuthOptions.cs:15`). Bewusster, dokumentierter Kompromiss (Offline-Start).
- Recommendations: CSP bei jeder Frontend-Änderung streng halten (keine `unsafe-inline`, keine neuen Script-Quellen); HTTPS-Variante (`docker-compose.yml`) für Netze mit Gästen empfehlen.

**Bildprüfung strukturell, kein Decoder (D-16):**
- Risk: Ein Upload mit gültiger Signatur, schlüssigem Kopf/Ende, aber manipuliertem Inhalt wird gespeichert und an Browser ausgeliefert; Decoder-Lücken im Browser wären erreichbar.
- Files: `backend/src/WordQuest.Modules.Content/Services/PictureRules.cs:5-56`, `backend/src/WordQuest.Infrastructure/PictureService.cs`
- Current mitigation: Typ nur aus Bytes (PNG/JPEG/WebP), 300 KB-Grenze (`PictureRules.cs:20`), Auslieferung mit Bild-Content-Type und `nosniff`, nur Eltern laden hoch (mandantengebunden), Client fällt bei Dekodierfehler aufs Emoji zurück.
- Recommendations: Akzeptiert, solange nur Eltern hochladen. Ein Decoder bräuchte eine neue Dependency (Freigabe nötig).

**Rate-Limit nur im Speicher, per IP:**
- Risk: Neustart setzt Zähler zurück; hinter fremdem Proxy außerhalb privater Netze greift `X-Forwarded-For` nicht.
- Files: `backend/src/WordQuest.Api/Program.cs:138-157`
- Current mitigation: Genau eine API-Instanz (Rahmenbedingung), `KnownIPNetworks` auf RFC-1918, `ForwardLimit = 1`, PIN-Sperre pro Profil atomar (`AuthService.cs:96-102`).
- Recommendations: Nicht ändern, solange nur eine Instanz läuft; bei mehreren Instanzen verteiltes Limit nötig.

## Performance Bottlenecks

Kein messbarer Engpass belegt. Einziger Wachstumspfad: Token-Historie (siehe Tech Debt), die `LogoutAsync` vollständig lädt (`backend/src/WordQuest.Api/Auth/AuthService.cs:261-264`).

## Fragile Areas

**Auth-Rotation und Sperrreihenfolge:**
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:112-235`, `backend/src/WordQuest.Infrastructure/AccountService.cs:107-115`, `backend/src/WordQuest.Infrastructure/TransactionExtensions.cs`, `frontend/src/lib/api.ts`
- Why fragile: Korrektheit hängt an `LockUserAsync` + bedingtem `ExecuteUpdateAsync` + 409-Gnadenfenster + Session-Kennung im Frontend. Jede Änderung an einem Teil kann Rennen wieder öffnen (vgl. Codex-Befunde 1, 2, 4, 5).
- Safe modification: Jede neue Token-Schreibstelle unter `LockUserAsync`; Interleavings als Integrationstest gegen PostgreSQL (`backend/tests/`) und in `frontend/src/lib/api.test.ts`.
- Test coverage: Gut für Rotation/Logout; Login-Pfad unter Sperre fehlt (siehe Known Bugs).

**Dump-Prüfung in `restore.sh`/`upgrade.sh`:**
- Files: `restore.sh:24-37`, `upgrade.sh:48-58`
- Why fragile: Erkennt Vollständigkeit an der Endzeile von pg_dump in den letzten 20 Zeilen; Images `postgres:17-alpine` und `prodrigestivill/postgres-backup-local:17` sind ohne Digest gepinnt (`docker-compose.quick.yml:24`, `docker-compose.quick.yml:78`, `docker-compose.yml:13`, `docker-compose.yml:107`), ebenso `traefik:v3` (`docker-compose.yml:78`). Ein Rot-Lauf des Restore-Smoke aus 03.1-05 ist ursächlich unbelegt.
- Safe modification: Release-Smoke nach jedem Image-Wechsel laufen lassen; bei erneutem Rot Arbeitskopie und Dump sichern.

**Query-Cache ohne Nutzerbezug:**
- Files: `frontend/src/App.tsx:41`
- Why fragile: Query-Keys tragen keine Nutzer-Id; der Schutz beim Anmeldewechsel beruht auf `queryClient.clear()` plus Neu-Rendern von `AppRoutes`. Eine per `memo` abgekapselte Komponente mit `useQuery` sähe kurz alte Daten (261023-k4m, Review INFO 4).
- Safe modification: Keine `memo`-Grenze über `useQuery`-Komponenten ziehen, oder Nutzer-Id in Query-Keys aufnehmen.

**Service-Worker-API-Cache (nur HTTPS):**
- Files: `frontend/vite.config.ts:37-43`, `frontend/src/lib/api.ts:64-72`
- Why fragile: `wq-api` cached API-GETs 7 Tage; Leeren beim Abmelden und vor jeder Anmeldung ist automatisiert getestet, aber die manuelle Abnahme in der HTTPS-Variante steht aus.

## Scaling Limits

**Genau eine API-Instanz:**
- Current capacity: Eine Familie, eine Instanz auf ARM64-Heimhardware.
- Limit: Migration beim Start (`backend/src/WordQuest.Api/Program.cs:255-267`) und In-Memory-Rate-Limiter (`Program.cs:147-157`) setzen eine Instanz voraus.
- Scaling path: Nicht vorgesehen (Rahmenbedingung in `AGENTS.md`).

**Bilder in PostgreSQL:**
- Current capacity: max. 300 KB je Eintrag (`PictureRules.cs:20`), Tabelle `VocabularyPictures` (`backend/src/WordQuest.Infrastructure/Configurations/ContentConfigurations.cs:72-85`).
- Limit: Dumps und Restore wachsen mit jedem Bild; auf SD-Karte/NAS spürbar bei vielen Tausend Bildern.
- Scaling path: Beobachten; Sicherungsgröße in der Doku nennen.

## Dependencies at Risk

**Unveränderliche Image-Tags fehlen:**
- Risk: `postgres:17-alpine`, `prodrigestivill/postgres-backup-local:17`, `traefik:v3` ziehen bei jedem Pull neue Minor-/Patch-Stände.
- Impact: Geändertes Dump-Format oder Traefik-Verhalten bricht Restore/Upgrade ohne Codeänderung.
- Migration plan: Digest-Pins in `docker-compose.quick.yml` und `docker-compose.yml`, Aktualisierung bewusst pro Release.

## Missing Critical Features

**Manuelle Abnahmen auf echter Hardware offen:**
- Problem: Offen sind laut SUMMARYs: Installation durch Dritte auf Pi/NAS, echter Download/Update von GitHub inkl. https-Zweig von `upgrade.sh`, zwei echte Tabs über HTTP nach 15 Minuten, `wq-api` in der HTTPS-Variante (`.planning/phases/03.1-release-hardening/03.1-07-SUMMARY.md`), Bilder A1–A3: Handy-Kamera trotz `Permissions-Policy: camera=()`, HEIC vom iPhone, Safari-Rückfall auf JPEG (`.planning/phases/03.1.1-vocabulary-pictures/03.1.1-05-SUMMARY.md`).
- Blocks: IMG-01 bleibt `[ ]`, Phase 03.1.1 auf `human_needed`; Push des Tags `v1.0.0` (master muss vorher auf `v1-fertig`, `.planning/STATE.md`).

**Keine Sicherung außerhalb des Hosts:**
- Problem: Dumps landen unter `./backups` auf demselben Gerät (`docker-compose.quick.yml:78`).
- Blocks: Schutz gegen Verlust von Host oder Datenträger. UNBEKANNT: ob die Doku eine externe Kopie anleitet.

## Test Coverage Gaps

**e2e-Läufe über 15 Minuten:**
- What's not tested: Ein geteilter Storage-State aus einer einzigen Eltern-Anmeldung je Lauf; dauert die Suite länger als das Access-Token (15 min), rotieren Specs denselben Refresh-Token und scheitern in Folge.
- Files: `frontend/e2e/global-setup.ts:7-22`
- Risk: Rotes e2e auf überlastetem Rechner ohne Defekt im Code (nicht aufgetreten).
- Priority: Low. Fix: Anmeldung je Spec-Datei oder frischer Storage-State nach Ablauf.

**Login-Rennen gegen Reset:**
- What's not tested: Login/Learner-Login parallel zu Passwort-Reset bzw. PIN-Wechsel.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:40-110`
- Risk: Bekannte Lücke bleibt unbemerkt bei Umbauten.
- Priority: Medium.

**Logout gewinnt gegen Refresh:**
- What's not tested: Erwartung „nur dieser Token ungültig, andere Geräte bleiben angemeldet“.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:181-185`
- Risk: Fix des Known Bugs ohne Regressionstest.
- Priority: Medium (zusammen mit dem Fix).

---

*Concerns audit: 2026-10-24*
