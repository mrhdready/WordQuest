---
last_mapped_commit: 00d6615b8a97d9dc54b7a0451f777fbfa6e91621
last_mapped_at: 2026-10-26
---
# Codebase Concerns

**Analysis Date:** 2026-10-26

Quellen: `.planning/STATE.md` (Blockers/Concerns), `.planning/quick/261025-fpi-https-mit-eigener-ca-statt-lets-encrypt/261025-fpi-0{1..5}-SUMMARY.md` (Offene Punkte), jeweils gegen den Code geprüft. Stand: Version 1.1.0 (HTTPS mit eigener CA, Dienst `certs`, Traefik und `docker-compose.yml` entfernt).

## Tech Debt

**Refresh-Tokens werden nie gelöscht:**
- Issue: `IssueAsync` und `RefreshAsync` legen bei jeder Anmeldung bzw. Rotation eine Zeile an; widerrufene und abgelaufene Tokens bleiben für immer. Kein `ExecuteDeleteAsync` auf `RefreshTokens` im Backend.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:278` (`IssueAsync`), `backend/src/WordQuest.Api/Auth/AuthService.cs:205-216` (Rotation)
- Impact: Tabelle wächst linear mit Nutzung (bei 15-min-Access-Token etwa eine Zeile je Viertelstunde aktiver Nutzung pro Gerät). Heute unkritisch, verstärkt aber den nächsten Punkt.
- Fix approach: Beim Start in `backend/src/WordQuest.Infrastructure/OrphanCleanup.cs` Tokens mit `ExpiresAt < now - Puffer` löschen. Die Reuse-Erkennung braucht widerrufene Tokens bis zu ihrem `ExpiresAt` (30 Tage, `backend/src/WordQuest.Api/Auth/AuthOptions.cs`).

**`LogoutAsync` lädt alle Tokens des Kontos (Schuld aus 261023-a8x):**
- Issue: Für die Abmelde-Kette wird die komplette Token-Historie des Nutzers als Dictionary geladen und im Code verfolgt (Kommentar im Code nennt den Grund selbst: „weil alte Tokens nicht geloescht werden“).
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:237-275` (Abfrage `:260-264`)
- Impact: Kosten wachsen mit der nie bereinigten Historie. Für eine Familie heute vernachlässigbar.
- Fix approach: Abfrage ab `CreatedAt` des vorgelegten Tokens filtern oder rekursive CTE über `ReplacedByTokenHash`; mit dem Aufräumen oben erledigt sich das weitgehend.

**Datenzugriff direkt in Set-Endpoints:**
- Issue: `SetEndpoints` arbeitet direkt mit `WordQuestDbContext`, inkl. Positionsvergabe und Karten-Erzeugung beim Anlegen und beim CSV-Commit. Andere Bereiche (`AccountEndpoints`, `PictureEndpoints`) delegieren an Services.
- Files: `backend/src/WordQuest.Api/Endpoints/SetEndpoints.cs` (390 Zeilen)
- Impact: Abweichung von der AGENTS.md-Regel „Endpoints parsen, autorisieren, rufen auf, mappen“; Positionslogik doppelt (Einzel-Eintrag und Import).
- Fix approach: Bei der nächsten fachlichen Änderung an Sets einen `ContentService` nach Muster `backend/src/WordQuest.Infrastructure/LearningService.cs` herausziehen; nicht als Selbstzweck.

**Große Dateien:**
- Issue: `frontend/src/features/manage/SetDetailPage.tsx` (1038 Zeilen) bündelt Eintragsliste, Formular, CSV-Import und Bildverwaltung; `backend/src/WordQuest.Infrastructure/LearningService.cs` (675 Zeilen); `backend/src/WordQuest.Api/TlsCommand.cs` (334 Zeilen, neu mit 1.1.0).
- Impact: Hohe Änderungsdichte, schwer reviewbar; `frontend/src/features/manage/SetDetailPage.test.tsx` hat 1593 Zeilen.
- Fix approach: `SetDetailPage` in Teilkomponenten unter `frontend/src/features/manage/` (Import-Dialog, Bild-Bereich) aufteilen, wenn dort die nächste Änderung ansteht.

**`curl` ohne Zeitlimit im Update:**
- Issue: Download des Release-Pakets ohne `--connect-timeout`/`--max-time` (03.1-06 R-02, bewusst offen).
- Files: `upgrade.sh:86`, `upgrade.sh:88`
- Impact: Hängender Server oder Netz lässt `upgrade.sh` unbegrenzt warten.
- Fix approach: `--connect-timeout 15 --max-time 300` an beide Aufrufe.

**`setup.sh` prüft die Compose-Datei vor `docker compose pull` nicht (261025-fpi, bewusst offen):**
- Issue: Fehlt die Datei aus `COMPOSE_FILE`, kommt nur die irreführende Meldung zu `WQ_IMAGE_PREFIX`.
- Files: `setup.sh:244`
- Impact: Nur bei einer alten `.env` aus 1.0.x denkbar; laut Owner-Entscheidung OU-1 gibt es keine solchen Installationen. Kein Datenverlust.
- Fix approach: Nur wenn `setup.sh` ohnehin angefasst wird: `[ -f "$COMPOSE_FILE" ]` mit deutscher Meldung vor dem Pull.

## Known Bugs

**Refresh widerruft alle Tokens, wenn Abmelden oder PIN-Wechsel das Rennen gewinnt (offen aus 03.1):**
- Symptoms: Andere Geräte desselben Kontos werden abgemeldet.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:177-186`
- Trigger: Ein Refresh wartet auf `LockUserAsync`, während `LogoutAsync` (`AuthService.cs:237-275`) oder `SaveAndRevokeRefreshTokensAsync` (`backend/src/WordQuest.Infrastructure/AccountService.cs`) den Token widerruft. Danach sieht der Refresh `RevokedAt != null` ohne `ReplacedByTokenHash`, die Bedingung `stored.ReplacedByTokenHash is not null || stored.RevokedAt is not null` greift und `RevokeAllAsync` läuft.
- Workaround: Neu anmelden.
- Fix approach: Widerruf ohne Nachfolger (`ReplacedByTokenHash == null`) nicht als Reuse werten, nur 401 liefern; Integrationstest gegen PostgreSQL.

**Anmeldung mit alten Zugangsdaten während Passwort-Reset/PIN-Wechsel:**
- Symptoms: Ein Login, dessen Passwort-/PIN-Prüfung vor dem Widerruf bestanden hat, schreibt seinen Refresh-Token danach fest und bleibt angemeldet.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:40-110`, `AuthService.cs:278` (kein `LockUserAsync` in den Login-Pfaden)
- Trigger: Paralleler Login und Reset (im Konzept als bekannte Lücke dokumentiert).
- Workaround: Reset wiederholen. Fix approach: `IssueAsync` unter `LockUserAsync`, Hash/PIN unter der Sperre erneut lesen.

**Mehrere Tabs: verspätete Antwort meldet alle Tabs ab:**
- Symptoms: Trifft die Refresh-Antwort an einen Tab erst nach dessen nächstem Versuch ein, endet die Sitzung in allen Tabs.
- Files: `frontend/src/lib/api.ts`, `backend/src/WordQuest.Api/Auth/AuthService.cs:157-172` (409-Gnadenfenster `RotationGrace`)
- Trigger: Langsames Netz mit zwei offenen Tabs (261023-a8x); ebenso 409 ohne zweiten Tab, wenn die Commit-Bestätigung verloren geht (03.1-02).
- Workaround: Neu anmelden.

## Security Considerations

**Tokens im `localStorage`:**
- Risk: Jedes XSS liest Access- und Refresh-Token aus.
- Files: `frontend/src/lib/api.ts:37` (Kommentar zum Kompromiss), `frontend/src/lib/api.ts:104-112`, `frontend/nginx-security-headers.conf`
- Current mitigation: Transport seit 1.1.0 über HTTPS (`frontend/nginx.conf:35`, Port 8080 leitet per 301 um, `frontend/nginx.conf:30`); strikte CSP, Header in allen nginx-Locations, Refresh-Rotation mit Reuse-Erkennung, 15-min-Access-Token.
- Recommendations: CSP bei jeder Frontend-Änderung streng halten (kein `unsafe-inline`, keine neuen Script-Quellen).

**Kein HSTS, Vertrauen in die eigene CA hängt am Nutzer:**
- Risk: Ohne installierte CA klicken Nutzer die Browser-Warnung weg; ein Angreifer im WLAN könnte ein eigenes Zertifikat vorlegen, das genauso aussieht. Die Umleitung von HTTP ist per Downgrade umgehbar.
- Files: `frontend/nginx.conf:11` (bewusst kein `Strict-Transport-Security`, Owner 2026-10-25), `frontend/nginx.conf:20-24` (CA-Download über HTTP), `Documentation/Installation.md` (Fingerabdruck-Prüfung)
- Current mitigation: `setup.sh` gibt die SHA-256-Fingerabdrücke aus; Installation.md leitet den Vergleich an.
- Recommendations: Geräteabnahme abschließen (siehe Missing Critical Features), damit die Prüfschritte belegt sind.

**Bildprüfung strukturell, kein Decoder (D-16):**
- Risk: Upload mit gültiger Signatur, aber manipuliertem Inhalt wird gespeichert und ausgeliefert; Decoder-Lücken im Browser wären erreichbar.
- Files: `backend/src/WordQuest.Modules.Content/Services/PictureRules.cs`, `backend/src/WordQuest.Infrastructure/PictureService.cs`
- Current mitigation: Typ nur aus Bytes (PNG/JPEG/WebP), 300-KB-Grenze, Bild-Content-Type mit `nosniff`, nur Eltern laden hoch (mandantengebunden).
- Recommendations: Akzeptiert, solange nur Eltern hochladen. Ein Decoder bräuchte eine neue Dependency (Freigabe).

**Rate-Limit nur im Speicher, per IP:**
- Risk: Neustart setzt Zähler zurück.
- Files: `backend/src/WordQuest.Api/Program.cs:139-175`
- Current mitigation: Genau eine API-Instanz, Partition pro echter Client-IP (nginx setzt `X-Forwarded-For`, FIX-01), PIN-Sperre pro Profil atomar in `AuthService.cs`.
- Recommendations: Nicht ändern, solange nur eine Instanz läuft.

## Performance Bottlenecks

Kein messbarer Engpass belegt. Einziger Wachstumspfad: Token-Historie (siehe Tech Debt), die `LogoutAsync` vollständig lädt (`backend/src/WordQuest.Api/Auth/AuthService.cs:260-264`).

## Fragile Areas

**Auth-Rotation und Sperrreihenfolge:**
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:112-235`, `backend/src/WordQuest.Infrastructure/AccountService.cs`, `backend/src/WordQuest.Infrastructure/TransactionExtensions.cs`, `frontend/src/lib/api.ts`
- Why fragile: Korrektheit hängt an `LockUserAsync` + bedingtem `ExecuteUpdateAsync` + 409-Gnadenfenster + Session-Kennung im Frontend. Jede Änderung an einem Teil kann Rennen wieder öffnen.
- Safe modification: Jede neue Token-Schreibstelle unter `LockUserAsync`; Interleavings als Integrationstest in `backend/tests/` und in `frontend/src/lib/api.test.ts`.
- Test coverage: Gut für Rotation/Logout; Login-Pfad unter Sperre fehlt.

**Zertifikatsdienst `certs` und Namensliste:**
- Files: `backend/src/WordQuest.Api/TlsCommand.cs`, `docker-compose.quick.yml:79-94`, `setup.sh` (`tls_names`, `WQ_TLS_NAMES`)
- Why fragile: Die SAN-Liste entsteht aus Hostname, Domänen und Netz-IPs des Hosts. Die VM-Abnahme fand Gateways fremder Docker-Netze im Zertifikat (behoben in 11220f7). Eine geänderte Ausgabe von `docker network inspect` oder mehrere IPAM-Configs je Netz (Testlücke laut 261025-fpi-05) können die Liste wieder verfälschen. Exit-Code von `certs` bei `docker stop` ist UNBEKANNT (kein Smoke wertet ihn aus; `restart certs` funktioniert).
- Safe modification: Funktions-Tests von `setup.sh` (`FUNKTIONEN OK`) und `dotnet test --filter Tls` laufen lassen; die CA nie neu ausstellen, sonst verlieren alle Geräte das Vertrauen.

**Proxy-Gate verbietet Mounts unter `/etc/nginx/conf.d`:**
- Files: Proxy-Gate in der CI (`.github/workflows/ci.yml`, Block `PROXY-XFF OK`), `frontend/nginx.conf`
- Why fragile: nginx-Konfiguration wird im Image geliefert; wer sie per Volume einspielen will, scheitert am Gate (261025-fpi-02). Zertifikate unter `/etc/nginx/tls` sind nicht betroffen.

**Dump-Prüfung in `restore.sh`/`upgrade.sh`:**
- Files: `restore.sh`, `upgrade.sh`
- Why fragile: Erkennt Vollständigkeit an der Endzeile von pg_dump; `postgres:17-alpine` und `prodrigestivill/postgres-backup-local:17` sind ohne Digest gepinnt (`docker-compose.quick.yml:29`, `docker-compose.quick.yml:111`).
- Safe modification: Release-Smoke nach jedem Image-Wechsel laufen lassen.

**Query-Cache ohne Nutzerbezug:**
- Files: `frontend/src/App.tsx`
- Why fragile: Query-Keys tragen keine Nutzer-Id; der Schutz beim Anmeldewechsel beruht auf `queryClient.clear()` plus Neu-Rendern von `AppRoutes`. Eine per `memo` abgekapselte Komponente mit `useQuery` sähe kurz alte Daten.
- Safe modification: Keine `memo`-Grenze über `useQuery`-Komponenten, oder Nutzer-Id in Query-Keys.

**Service-Worker-API-Cache (nur mit vertrauter CA):**
- Files: `frontend/vite.config.ts`, `frontend/src/lib/api.ts`
- Why fragile: `wq-api` cached API-GETs 7 Tage. Leeren beim Abmelden/Anmelden ist getestet; ein e2e-Lern-Durchlauf mit aktivem Service Worker existiert seit 6fac063. Ohne installierte CA registriert sich kein Service Worker, die App muss als reine Browser-App funktionieren.

## Scaling Limits

**Genau eine API-Instanz:**
- Current capacity: Eine Familie, eine Instanz auf ARM64-Heimhardware.
- Limit: Migration beim Start (`backend/src/WordQuest.Api/Program.cs:279`) und In-Memory-Rate-Limiter (`Program.cs:161`) setzen eine Instanz voraus.
- Scaling path: Nicht vorgesehen (Rahmenbedingung in `AGENTS.md`).

**Bilder in PostgreSQL:**
- Current capacity: max. 300 KB je Eintrag (`PictureRules.cs`).
- Limit: Dumps und Restore wachsen mit jedem Bild; auf SD-Karte/NAS spürbar bei vielen Tausend Bildern.
- Scaling path: Beobachten; Sicherungsgröße in der Doku nennen.

**Zertifikatslaufzeiten:**
- Current capacity: CA bis 2036, Server-Zertifikat 800 Tage (VM-Abnahme 261025-fpi-05).
- Limit: CA-Ablauf erzwingt neue Installation der CA auf allen Geräten.
- Scaling path: Server-Zertifikat erneuert `certs` selbst (TLS-ERNEUERUNG OK); für die CA ist kein Ablauf-Pfad dokumentiert.

## Dependencies at Risk

**Unveränderliche Image-Tags fehlen:**
- Risk: `postgres:17-alpine` und `prodrigestivill/postgres-backup-local:17` ziehen bei jedem Pull neue Patch-Stände.
- Impact: Geändertes Dump-Format bricht Restore/Upgrade ohne Codeänderung.
- Migration plan: Digest-Pins in `docker-compose.quick.yml`, Aktualisierung bewusst pro Release.

## Missing Critical Features

**Geräteabnahme 1.1.0 offen, Tag v1.1.0 wartet:**
- Problem: VM-Abnahme bestanden (2026-10-26); offen sind iPhone/iPad, Android, Windows, Mac, Firefox und Browser ohne CA. `Documentation/Installation.md` enthält 9 Stellen „(noch am Gerät zu prüfen)“.
- Blocks: Tag v1.1.0 und Push (`.planning/STATE.md`, `261025-fpi-05-SUMMARY.md`).

**Weitere manuelle Abnahmen:**
- Problem: Bilder A1–A3 (Handy-Kamera trotz `Permissions-Policy: camera=()` in `frontend/nginx-security-headers.conf:10`, HEIC vom iPhone, Safari-Rückfall auf JPEG); Installation durch Dritte auf Pi/NAS.
- Blocks: IMG-01 bleibt `[ ]`, Phase 03.1.1 auf `human_needed` (`.planning/REQUIREMENTS.md:63`).

**Keine Sicherung außerhalb des Hosts:**
- Problem: Dumps landen unter `./backups` auf demselben Gerät (`docker-compose.quick.yml:122`).
- Blocks: Schutz gegen Verlust von Host oder Datenträger. UNBEKANNT: ob die Doku eine externe Kopie anleitet.

**Konzept §17 O3 offen:**
- Problem: „Wo läuft der Server? … Aufwand fürs TLS-Setup“ steht unverändert als offene Frage.
- Files: `Documentation/WordQuest_Konzept_und_Architektur.md:720`

## Test Coverage Gaps

**Ersatz für `crypto.randomUUID` ohne Test (QA2-06):**
- What's not tested: Antwort-IDs ohne Secure Context; seit HTTPS läuft kein e2e-Test mehr ohne Secure Context.
- Files: `frontend/src/lib/api.ts:69`, `frontend/src/features/learn/SessionPage.tsx:89`
- Risk: Lernantworten brechen in Browsern ohne vertraute CA bzw. über HTTP unbemerkt.
- Priority: Medium (als v2 QA2-06 in `.planning/REQUIREMENTS.md:131`).

**e2e-Läufe über 15 Minuten:**
- What's not tested: Ein geteilter Storage-State aus einer Eltern-Anmeldung je Lauf; dauert die Suite länger als das Access-Token, rotieren Specs denselben Refresh-Token.
- Files: `frontend/e2e/global-setup.ts:97`
- Risk: Rotes e2e auf langsamem Rechner ohne Code-Defekt (nicht aufgetreten).
- Priority: Low. Fix: Anmeldung je Spec-Datei.

**Login-Rennen gegen Reset:**
- What's not tested: Login/Learner-Login parallel zu Passwort-Reset bzw. PIN-Wechsel.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:40-110`
- Priority: Medium.

**Logout gewinnt gegen Refresh:**
- What's not tested: Erwartung „nur dieser Token ungültig, andere Geräte bleiben angemeldet“.
- Files: `backend/src/WordQuest.Api/Auth/AuthService.cs:177-186`
- Priority: Medium (zusammen mit dem Fix).

**Mehrere IPAM-Configs je Docker-Netz in `tls_names`:**
- What's not tested: Netz mit mehreren Subnetzen; Code behandelt den Fall laut Review korrekt.
- Files: `setup.sh`
- Priority: Low.

**Portprobe (Listener nur auf 127.0.0.1):**
- What's not tested: Automatisiert nur unter macOS nicht prüfbar; auf Linux-VM manuell belegt (261025-fpi-05), kein CI-Test.
- Files: `setup.sh:160`
- Priority: Low.

---

*Concerns audit: 2026-10-26*
