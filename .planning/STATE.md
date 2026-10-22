---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: "03.1.1"
current_phase_name: Vocabulary Pictures
status: executing
stopped_at: Completed 03.1.1-03-PLAN.md
last_updated: "2026-10-22T22:43:47.434Z"
last_activity: 2026-10-23
last_activity_desc: "03.1.1-03 ausgefuehrt (Abschnitt Bild im Dialog: waehlen, ersetzen, entfernen; Verkleinern ohne EXIF/GPS im Browser belegt; jede 413 deutsch; DELETE mit Isolation); Backend 166 + 306, vitest 314, e2e 63 passed/1 skipped"
state_head: 68960f1908fc53b800a936d8ce8b8bf31c2d9e59
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 32
  completed_plans: 30
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.
**Current focus:** Phase 03.1.1 — Vocabulary Pictures

## Current Position

Phase: 03.1.1 (Vocabulary Pictures) — EXECUTING
Plan: 3 of 5 ausgefuehrt (Phase 03.1 davor automatisch abgeschlossen, manuelle Abnahme offen)
Status: 03.1.1-03 fertig (Abschnitt „Bild“ im Dialog „Vokabel bearbeiten“: Bild waehlen per Maus/Tastatur, shrinkPicture mit EXIF-Drehung, 512 px, WebP 0.8 bzw. JPEG 0.85 auf Weiss, TypeError-Rueckfall ohne imageOrientation; api() mit Blob-Body; gespeichert ohne EXIF/XMP-Chunk, Drehung in den Pixeln, 2000 x 1000 als 512 x 256 im echten Browser dekodiert; Edge-Case-Matrix mit exakten Texten, jede 413 (auch nginx-HTML ueber 1 MB) deutsch; Vorschau folgt dem gespeicherten Stand nach dem Neuladen; DELETE /sets/{id}/entries/{entryId}/picture idempotent 204, fremd 404, Kind 403; axe 0 mit Vorschau und Fehler, 200 % mit 6 Tab-Zielen; Konzept §12/§15; Plan-Gate gruen, Review 0 BLOCKER/HIGH, M-1/M-2/L-1/L-2/L-4/L-5 behoben, L-3 begruendet zurueckgewiesen; IMG-01 offen bis 03.1.1-05 und manuelle Abnahme A1-A3). 03.1.1-02 fertig (pictureVersion in Vokabelliste und Bearbeiten per Projektion, PictureQueryTests mit DbCommandInterceptor und Kontrollfall belegt: Liste liest die Spalte data nicht; api() mit blob, lib/picture.tsx mit usePicture als data-URL und VocabPicture im festen Rahmen, Emoji bei Lade-, Netz- und Dekodierfehler; DESIGN.md vocab-thumb/vocab-picture; e2e: image/png, nosniff, no-store, 401 ohne Token, nur Cache wq-api, axe 0, 200 % mit 14 Tab-Zielen; Plan-Gate gruen, Review 1 LOW behoben (retry false), 3 INFO; IMG-01 offen bis 03.1.1-05). 03.1.1-01 fertig (Tabelle vocabulary_picture per dotnet ef ohne Navigation, Mandantenfilter, Kaskade; PUT /sets/{id}/entries/{entryId}/picture roher Body bis 300 KB, Signatur und Struktur WebP/JPEG/PNG nach D-16, 400/413/404/409; GET /pictures/{version} mit no-store; Konzept §5.2/§12/§13/§15; Plan-Gate gruen, Review ohne BLOCKER/HIGH/MEDIUM, 3 LOW begruendet zurueckgewiesen; IMG-01 offen bis 03.1.1-05). 03.1-01 fertig (Kontosperre fuer Refresh/Abmelden/Widerruf, 409-Gnadenfrist, atomarer PIN-Zaehler). 03.1-02 fertig (Oberflaeche folgt dem Token-Speicher, verspaetete Refresh-Antwort verworfen, 409 uebernimmt den Token des anderen Tabs derselben Anmeldung, wq-api beim Sitzungsende und bei neuer Anmeldung geleert; Plan-Gate gruen, Review ohne BLOCKER/HIGH/MEDIUM). 03.1-03 fertig (Set-Wahl begrenzt die ganze Runde bei kontoweiter Rueckstandsbremse, offene Runden der letzten 30 Minuten reservieren neue Karten, LastReviewedAt als Concurrency-Token mit Mindestabstand 1 µs ohne Migration; HARD-02 komplett; Plan-Gate gruen, Review ohne BLOCKER/HIGH/MEDIUM, LOW 1 behoben). 03.1-04 fertig (Sicherheits-Header aus nginx-security-headers.conf an jeder nginx-Antwort beider Varianten, auch an 404; CSV-Kopfzeile nur bei eindeutiger Zeile; Ladefehler der Set-Liste als ErrorNote mit axe 0; HARD-04 komplett; Plan-Gate gruen, e2e 55 passed, Review ohne BLOCKER/HIGH/MEDIUM, LOW-1/LOW-2 behoben). 03.1-05 fertig (Release-Paket per .github/release-package.sh mit fester Dateiliste und SHA256, CI-Job release nur bei Tags v* mit contents: write, Installation ohne Git per curl | tar xz im Release-Smoke belegt, first-run.spec.ts bis zur Zusammenfassung; HARD-05 erst nach 03.1-06/07; Plan-Gate gruen, Review ohne HIGH, R-03/R-04 behoben, R-01 zurueckgewiesen bis 03.1-06). 03.1-06 fertig (upgrade.sh laedt das neueste Release-Paket, prueft SHA256 sowie Namen und Typen vor dem Entpacken, sichert, ersetzt die sieben Dateien und startet per exec --continue neu; Release-Smoke mit echtem Pull aus registry:2 auf 127.0.0.1:18084, acht Paketfaellen und Klon-Weg; Doku ohne git pull; HARD-05 komplett; Plan-Gate gruen, Review ohne HIGH, R-03/R-05/R-06/R-08/R-09 behoben, R-01/R-02/R-04 zurueckgewiesen; Restore-Rot aus 03.1-05 nicht reproduzierbar, Diagnose eingebaut). 03.1-07 fertig (Dump-Pruefung in restore.sh/upgrade.sh: Endzeile als ganze Zeile unter den letzten 20 Zeilen per grep -c, SIGPIPE-Regression im Smoke gefunden und behoben; Kommentare ohne Repo-Klon; Prod-Stack aus dem Wegwerf-Klon auf fe24d8b mit smoke=0 post=1; volles Gate gruen: Backend 144 + 272, vitest 250, e2e 55 passed/1 skipped, SMOKE OK, PROXY-XFF OK; Befund-Nachweis 11/11 in 03.1-VALIDATION.md; zwei Reviews ohne BLOCKER/HIGH/MEDIUM). Unveraendert offen: lokales Tag v1.0.0 (nicht gepusht) wird vom Orchestrator auf den End-Commit fe24d8b versetzt; vor dem Push master auf v1-fertig bringen; manuelle Abnahme Phase 1 (01-UAT.md) und Phase 2 (02-UAT.md) offen; Nach-Release-Abnahme Phase 3 offen (03-UAT.md, 03-VALIDATION.md)
Last activity: 2026-10-23 — 03.1.1-03 ausgefuehrt (7 Commits, Plan-Gate gruen)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 1 P01 | 15min | 3 tasks | 20 files |
| Phase 01 P02 | 17min | 3 tasks | 19 files |
| Phase 01 P03 | 29min | 3 tasks | 17 files |
| Phase 01 P05 | 135min | 3 tasks | 11 files |
| Phase 01 P04 | 25min | 3 tasks | 7 files |
| Phase 01 P06 | 23min | 3 tasks | 19 files |
| Phase 01 P07 | 18min | 3 tasks | 19 files |
| Phase 01 P08 | 20min | 3 tasks | 18 files |
| Phase 02 P01 | 23min | 3 tasks | 12 files |
| Phase 02 P02 | 18min | 2 tasks | 16 files |
| Phase 02 P03 | 23min | 3 tasks | 14 files |
| Phase 02 P04 | 22min | 3 tasks | 16 files |
| Phase 02 P05 | 28min | 3 tasks | 10 files |
| Phase 02 P06 | 24min | 3 tasks | 14 files |
| Phase 02 P07 | 27min | 3 tasks | 19 files |
| Phase 03 P01 | 24min | 2 tasks | 8 files |
| Phase 03 P02 | 30min | 2 tasks | 3 files |
| Phase 03 P03 | 33min | 3 tasks | 5 files |
| Phase 03 P04 | 31min | 3 tasks | 5 files |
| Phase 03 P05 | 25min | 2 tasks | 3 files |
| Phase 03.1 P01 | 20min | 3 tasks | 10 files |
| Phase 03.1 P02 | 20min | 3 tasks | 6 files |
| Phase 03.1 P03 | 134min | 3 tasks | 7 files |
| Phase 03.1 P04 | 711min | 3 tasks | 14 files |
| Phase 03.1 P05 | 36min | 3 tasks | 8 files |
| Phase 03.1 P06 | 62min | 3 tasks | 5 files |
| Phase 03.1 P07 | 40min | 3 tasks | 8 files |
| Phase 03.1.1 P01 | 15min | 2 tasks | 15 files |
| Phase 03.1.1 P02 | 21min | 2 tasks | 14 files |
| Phase 03.1.1 P03 | 46min | 3 tasks | 13 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 3 phases (below the standard 4-6) because the scope was cut to 21 requirements; no filler phases
- [Roadmap]: QUAL-02 sits in Phase 1 where the password-change and edit-child forms are built; Phase 2's new forms (rename set, edit entry, delete child) follow the same edge-case matrix + axe house rule as a success criterion
- [Roadmap]: QUAL-01 sits in Phase 2 because it must cover each FIX requirement; delete child (PAR-03) shares Phase 2 with the cascade fix (FIX-02)
- [Phase 1]: 01-01: 1,5-px-Verlaufsrand der Glasflaechen entfaellt (::before blockiert axe-Kontrastberechnung)
- [Phase 1]: 01-01: playwright-core per npm overrides auf 1.64.0 gepinnt
- [Phase 1]: 01-01: tailwind-merge kennt type-* nicht; Schriftstufen nicht per className ueberschreiben
- [Phase 01]: Npgsql-Verbindung aus WQ_DB_* mit GSS Encryption Mode=Disable (libgssapi-Fehler im Alpine-Image)
- [Phase 01]: ApiFactory migriert selbst; WebApplicationFactory haelt Program.cs bei Build an
- [Phase 01]: Api.Tests: je Testfall eigene ApiFactory/Datenbank, wenn Erwartung vom DB-Stand abhaengt
- [Phase 01]: 01-03: Eltern-Tab-Leiste im Fluss unter <main> statt sticky (sticky verdeckt Ziele: axe target-size; eigener Scrollbereich macht Kontrast unmessbar) - Abnahme end-of-phase
- [Phase 01]: 01-03: checkPage misst den Fallback nach abgeschlossenen CSS-Uebergaengen
- [Phase 01]: 01-03: Formularfelder ueber Field (Render-Prop), Serverfeldfehler aus ApiError.errors am Feld
- [Phase 01]: 01-05: Reset setzt Hash und widerruft Refresh-Tokens in einem SaveChanges; Access-Tokens laufen regulaer ab (15 min)
- [Phase 01]: 01-05: SecretCheck direkt nach CreateBuilder ausserhalb von Development, expliziter ConnectionStrings__Default ueber Passwort-Teil geprueft
- [Phase 01]: 429 wird in api() zentral auf einen deutschen Wartehinweis gemappt (Wortlaut wie PIN-Sperre), nicht nur auf der Kinder-Anmeldung
- [Phase 01]: Text direkt auf dem Backdrop in text-ink statt text-ink-soft (ink-soft auf backdrop-blue 4,14:1)
- [Phase 01]: Zurueck zur Profilwahl als runder Knopf oben (button-round) statt Zelle im Ziffernfeld
- [Phase 01]: Design-Migration abgeschlossen: --color/--text/--font-weight/--radius-* vor dem Token-Import geleert, design:classes ueber ganz src ins Gate
- [Phase 01]: 01-06: Tab-Leiste bricht bei 320 px neben dem + zweizeilig um; --wq-tab-bar-clearance waechst unter sm um eine Zeile
- [Phase 01]: 01-06: body als grid mit min-height 100% statt height 100% (axe elmPartiallyObscured bei Seiten knapp ueber Bildschirmhoehe)
- [Phase 01]: 01-06: Passwortwechsel widerruft keine Sitzungen; Pruefung gegen haeufige Passwoerter bleibt bekannte Luecke D-18
- [Phase 01]: 01-07: PIN-, Namens- und Tageslimit-Regeln fuer Kinderprofile stehen in AccountRules (Identity-Modul); Endpoints mappen nur LearnerProfileProblem-Codes auf Feldtexte
- [Phase 01]: 01-07: Kinderliste ohne Card, weil ListGroup/EmptyState selbst Glas sind (DESIGN.md: kein Glas auf Glas)
- [Phase 01]: 01-08: Auth-Limit aus Auth:RequestsPerMinute (Standard 10), nur der e2e-Teststack hebt es an; Produktion unveraendert
- [Phase 01]: 01-08: Bearbeiten-Seite liest das Kind aus ['learners']; Ladefehler (ErrorNote) getrennt von unbekannter ID (EmptyState)
- [Phase 02]: 02-01: AnsweredAt als Concurrency-Token statt xmin, keine Migration
- [Phase 02]: 02-01: Neue Karte gilt erst mit der ersten Antwort als eingefuehrt (LastReviewedAt gesetzt, FirstSeenAt = Antwortzeit); Altbestand ohne Antwort kostet kein Budget
- [Phase 02]: 02-01: Gutschrift XP/Muenzen nur per ExecuteUpdateAsync in Transaktion ueber CreateExecutionStrategy; Abschluss atomar beansprucht
- [Phase 02]: D-18 umgesetzt: OrphanCleanup vor MigrateAsync, nur solange 20261017182305_ReferentialIntegrity aussteht; Migration unverändert aus dotnet ef
- [Phase 02]: Startblock aus Program.cs läuft unter WebApplicationFactory (gemessen in 02-02); Migrationstests nutzen den echten Startpfad
- [Phase 02]: ConfirmDialog-Buttons flex-auto statt flex-1: mit Basis 0 brach die Zeile nie um (02-03)
- [Phase 02]: Dialog-Kontrast in e2e ohne Seiteninhalt messen (Backdrop-Farben und primary-deep), weil axe bei Glas ueber wechselndem Inhalt nicht misst (02-03)
- [Phase 02]: 02-04: Set-Seite zeigt Erfassung, Import und Liste erst mit gefundenem Set; Titel aus ['sets'], 404 im Dialog bleibt bis zum Schliessen (useSetGone)
- [Phase 02]: 02-04: ContentRules.CheckText (200 Zeichen nach Trimmen) ist die eine Laengenregel fuer Titel und Woerter; CSV-Import ueber 200 Zeichen bleibt 500 (gemeldet, nicht gebaut)
- [Phase 02]: 02-05: Fokusziel der Vokabel-Dialoge ist ein Ref (angeklickter Stift/Papierkorb, nach Loeschen oder 404 die Set-Ueberschrift); useSetGone zu useGone(queryKey) verallgemeinert
- [Phase 02]: 02-05: PUT /sets/{id}/entries/{entryId} aendert nur Deutsch/Englisch (WordProblems ueber ContentRules); POST ohne Pflichtfelder bzw. mit zu langem Emoji/Beispiel bleibt per API 500 (gemeldet, nicht gebaut)
- [Phase 02]: 02-06: nginx setzt X-Forwarded-For auf $remote_addr, API mit ForwardLimit 1 und Vertrauen nur fuer private Netze; realip nur im Traefik-Stack (real_ip_recursive off)
- [Phase 02]: 02-06: /auth/refresh und /auth/logout ohne Rate-Limit; Frontend meldet nur bei Refresh 400/401 ab
- [Phase 02]: 02-07: Angezeigte Serie wird beim Lesen berechnet (StreakRules.CurrentStreak), gespeichert nur beim Rundenabschluss
- [Phase 02]: 02-07: MasteryRules im Learning-Modul ist die einzige Meisterschaftsregel; Uebersicht zaehlt Woerter (= gruene Ampel), Feldnamen bleiben
- [Phase 02]: 02-07: ThrowOnBadRequest in jeder Umgebung; unlesbarer Body/Parameter ergibt 400 mit deutschem Text
- [Phase 03]: 03-01: Installation zieht feste Version 1.0.0 aus ghcr.io/mrhdready/wordquest; Präfix-Standard in setup.sh aus .env.example, Enter übernimmt ihn
- [Phase 03]: 03-01: Release-Smoke gleicht jeden Befehl und jede zitierte Ausgabe von Documentation/Installation.md gegen den Lauf ab (page_cmd, Handgriffe mit Grund, SEITE OK)
- [Phase 03]: 03-01: REL-03/REL-04 erst mit 03-05 als erledigt markieren
- [Phase 03]: 03-02: Cross-Build mit einer FROM --platform=$BUILDPLATFORM-Zeile je Dockerfile; ci.yml unverändert
- [Phase 03]: 03-03: Vorher-Sicherung nur auf Vollstaendigkeit geprueft (gzip, Endzeile), gewaehlte Datei zusaetzlich auf app_user; fehlende DB wird vor der Vorher-Sicherung leer angelegt
- [Phase 03]: 03-03: Rueckfall bei gescheitertem Einspielen mit derselben load_dump-Funktion; bei doppeltem Fehlschlag oder Strg+C bleibt die API gestoppt, Meldung nennt ./restore.sh <Vorher-Datei>
- [Phase 03]: 03-03: Release-Smoke zaehlt nur bis SMOKE_DONE als Erfolg (Bash 3.2 meldet mit trap EXIT nach ungesetzter Variable Exit 0)
- [Phase 03]: 03-04: upgrade.sh behält die Reihenfolge aus D-05 (Sicherung, Prüfung, Pull, .env, up -d, Health); .env erst nach Bereitschaft zu schreiben ist verworfen (Abbruch hinterließe alte Version neben migrierter DB)
- [Phase 03]: 03-04: Regel für künftige Releases: Compose-Änderungen bleiben mit der Vorversion lauffähig, kein Postgres-Major ohne eigenen Plan; sonst trägt der Weg zurück aus upgrade.sh (alte Version in .env, restore.sh) nicht
- [Phase 03]: 03-04: Sicherung vor dem Update mit umask 077 statt chmod an backups/; db vor der Sicherung mit --no-recreate
- [Phase 03]: 03-05: REL-01, REL-02, REL-03 erledigt (Code und Smoke belegen sie); REL-04 bleibt offen bis zur Veroeffentlichung der Images (Nach-Release-Abnahme)
- [Phase 03]: 03-05: automatisches Phasen-Gate gruen (16 Schritte, Exit 0); Voraussetzung fuer das lokale Tag v1.0.0 erfuellt, das Tag setzt der Orchestrator; vor dem Push master auf den Stand von v1-fertig bringen
- [Phase 03.1]: 03.1-01: Kontosperre (SELECT ... FOR UPDATE auf app_user) als gemeinsamer Riegel fuer Refresh, Abmelden und Widerruf; bedingte Beanspruchung zusaetzlich (D-04)
- [Phase 03.1]: 03.1-01: Gnadenfrist 10 s mit 409 nur fuer den unmittelbaren Vorgaenger mit aktivem Nachfolger (D-06, D-17); Restrisiko im Konzept
- [Phase 03.1]: 03.1-01: Npgsql wiederholt 40P01 unter EnableRetryOnFailure (Test mit Interceptor); Login-Pfade bleiben ohne eigene Sperre, Luecke Anmeldung mit alten Zugangsdaten waehrend Widerruf im Konzept
- [Phase 03.1]: 03.1-01: HARD-03 erledigt; HARD-01 nur serverseitig, Clientteil in 03.1-02
- [Phase 03.1]: 03.1-02: Oberflaeche folgt dem Token-Speicher per useSyncExternalStore; Refresh-Antwort nur bei unveraendertem Speicher; 409 uebernimmt nur in derselben Anmeldung (wq.session), Frist 3 s nach Uhrzeit
- [Phase 03.1]: 03.1-02: wq.session auf Gleichheit verglichen, Altsitzungen ohne Kennung erneuern weiter; neue Anmeldung ueber tokenStore.saveLogin loescht wq-api vor dem Speichern
- [Phase 03.1]: 03.1-03: Reservierung neuer Karten schliesst jede beantwortete Karte aus (LastReviewedAt gesetzt), auch aus dem Klassenarbeit-Modus
- [Phase 03.1]: 03.1-03: D-10 ueber LastReviewedAt als Concurrency-Token mit Mindestabstand 1 µs, keine Migration
- [Phase 03.1]: 03.1-04: BusyBox-nc hält die Eingabe 5 s offen, sonst bricht nginx die Upstream-Weiterleitung mit 499 ab
- [Phase 03.1]: 03.1-04: Verweis in upgrade.sh schon hier auf den Anker location /api/ gesetzt (Review LOW-2)
- [Phase 03.1]: 03.1-05: Installationszeile im Release-Smoke aus der Seitenzeile erzeugt (nur Adresse ersetzt, bash -o pipefail -c)
- [Phase 03.1]: 03.1-05: Job release checkt mit persist-credentials: false aus; gh nimmt GH_TOKEN (Review R-04)
- [Phase 03.1]: 03.1-05: README nennt WQ_RELEASE_URL nach Plan schon jetzt; gelesen wird es erst ab 03.1-06 (Review R-01 zurueckgewiesen)
- [Phase 03.1]: 03.1-06: Downgrade-Schutz nicht eingebaut (gh setzt Latest automatisch nach Datum und Version); Entpacken mit --no-same-owner
- [Phase 03.1]: 03.1-06: Restore-Rot aus 03.1-05 nicht reproduzierbar (0/450 Sonde, 0/1500 Pipeline); Diagnose und behaltener Ordner im Release-Smoke
- [Phase 03.1]: 03.1-07: Dump-Endzeile als ganze Zeile unter den letzten 20 Zeilen, per grep -c gezaehlt (kein grep -q hinter tail unter pipefail)
- [Phase 03.1]: 03.1-07: Release-Smoke wartet beim Aufraeumen, bis Docker Desktop Port 18084 freigibt
- [Phase 03.1]: 03.1-07: Kandidat fuer das Tag v1.0.0 ist fe24d8b (Prod-Stack und volles Gate auf diesem Commit)
- [Quick 261021-p4z]: Kinder-PIN genau 4 Ziffern, vierte Ziffer sendet ab (Dennis, 2026-10-21); Enter auf fokussierter Ziffern-Taste verworfen
- [Quick 261021-v4n]: „Los geht’s“ auf der Kinder-Anmeldung entfaellt, Statuszeile sagt „Einen Moment …“; PIN-Felder der Eltern maxLength 4 (Dennis, 2026-10-21)
- [Quick 261022-fke]: „Einen Moment …“ waehrend der Kinder-Anmeldung sichtbar; dieselbe Statuszeile, Ziffernanzahl bleibt sr-only, Zeile reserviert (Dennis, 2026-10-22)
- [Quick 261022-cb3]: CSV-Import mit „Datei wählen“ (.csv/.txt, hoechstens 1 MB), gelesen im Browser, strikt UTF-8 sonst windows-1252; API unveraendert (Dennis, 2026-10-22)
- [Quick 261022-q7a]: „?“ am Antwortende zaehlt wie „.“ und „!“ nicht (beide Seiten); CSV-Datei mit UTF-16-BOM wird als UTF-16 gelesen; erster Start legt die Migrationshistorie vor OrphanCleanup/MigrateAsync an, damit keine erwartbaren fail:-Zeilen erscheinen (Dennis, 2026-10-22)
- [Phase 03.1.1]: 03.1.1-01: Gleichzeitige Ersetzung bleibt last-writer-wins; 409 nur beim gleichzeitigen ersten Upload; Concurrency beim Ersetzen ergibt 409 wie geplant
- [Phase 03.1.1]: 03.1.1-02: usePicture ohne Wiederholung (retry false), sonst bleibt der Rahmen offline leer statt Emoji (Review LOW-1)
- [Phase 03.1.1]: 03.1.1-03: Vorschau im Dialog folgt nach dem Neuladen der Liste der gespeicherten Version (gleichzeitige Ersetzung, letzter Upload gewinnt)
- [Phase 03.1.1]: 03.1.1-03: Jede 413 (Endpoint oder nginx ueber 1 MB) zeigt im Dialog denselben deutschen Text; nginx bleibt bei 1m
- [Phase 03.1.1]: 03.1.1-03: shrinkPicture dekodiert bei TypeError (imageOrientation from-image unbekannt) einmal ohne Option

### Pending Todos

- Quick 261006-r7l: axe auf `/lernen` nachholen — erledigt sich mit Plan 01-04 (axe-Werkzeug seit 01-01 vorhanden, `checkPage` auf den Lernseiten).
- [Phase-1-Abschluss]: manuelle Abnahme Tab-Leiste bei 200 % Zoom, leere Zustände, Glas-Wirkung auf dem Tablet; `hostname -I` und Backup-Dienst auf einem Raspberry Pi prüfen.
- [Phase-3-Nach-Release]: Nach-Release-Abnahme aus 03-VALIDATION.md (veroeffentlichte Images arm64/amd64, Pi-Installation nur nach der Seite, Person ohne Vorwissen, root-eigene Tagesdumps mit restore.sh, upgrade.sh aus GHCR, Traefik-Variante). Vor dem Push master auf den Stand von v1-fertig bringen (die Seite klont den Standardbranch).
- [Phase-3.1-02 offen]: TanStack-Query-Cache beim Sitzungsende nicht geleert (`App.tsx`, ein anderes Profil im selben Tab sieht kurz die alte Liste); Login-Anfragen mit `retryOn401` zaehlen bei bestehender Sitzung doppelt fuers Rate-Limit (`auth.tsx`). Review INFO 7/8, Einzelheiten in 03.1-02-SUMMARY.

### Quick Tasks

| ID | Aufgabe | Stand | Nachweis |
|----|---------|-------|----------|
| 261006-r7l | Installer, Container-Secrets und HTTP-Lernen | Umgesetzt; axe-Lauf offen | [Zusammenfassung](quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/261006-r7l-SUMMARY.md) |
| 261021-p4z | Kinder-PIN genau 4 Ziffern, Anmeldung mit der vierten Ziffer (PAR-02, FIX-08) | Umgesetzt; Gate, e2e/axe, Install- und Release-Smoke gruen; Frage zu „Los geht’s“ in 261021-v4n beantwortet | [Zusammenfassung](quick/261021-p4z-kinder-pin-genau-4-ziffern/261021-p4z-SUMMARY.md) |
| 261021-v4n | Kinder-Anmeldung ohne „Los geht’s“, PIN-Felder der Eltern auf 4 Zeichen, Doku ohne Alt-PINs (PAR-02, FIX-08) | Umgesetzt; Gate, e2e/axe, Install- und Release-Smoke gruen; Frage zu sichtbarer Warteanzeige in 261022-fke beantwortet | [Zusammenfassung](quick/261021-v4n-pin-ohne-los-gehts-button/261021-v4n-SUMMARY.md) |
| 261022-fke | Sichtbare Warteanzeige „Einen Moment …“ auf der Kinder-Anmeldung (PAR-02, FIX-08) | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen | [Zusammenfassung](quick/261022-fke-sichtbare-warteanzeige-pin-anmeldung/261022-fke-SUMMARY.md) |
| 261022-cb3 | CSV-Import: Datei wählen statt Text einfügen (Konzept M2) | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen; Frage zu UTF-16 in 261022-q7a beantwortet | [Zusammenfassung](quick/261022-cb3-csv-datei-waehlen/261022-cb3-SUMMARY.md) |
| 261022-q7a | „?“ am Antwortende ignorieren (Konzept §6.4), UTF-16 im CSV-Import (M2), erster Start ohne fail:-Zeilen | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen | [Zusammenfassung](quick/261022-q7a-fragezeichen-utf16-migrationslog/261022-q7a-SUMMARY.md) |
| 261022-d7w | Start ohne warn:-Zeilen von DataProtection (Vorladen entfernt), EF-Warnung 10102: Distraktoren aus dem ganzen Set, Profilauswahl sortiert | Umgesetzt; Gate, e2e/axe, Install-Smoke (STARTLOG ohne warn:) gruen | [Zusammenfassung](quick/261022-d7w-dataprotection-startwarnungen/261022-d7w-SUMMARY.md) |

### Blockers/Concerns

- [Phase 2]: Only a pure domain test project exists; QUAL-01 needs a new integration test project with real PostgreSQL
- Quicks 261021-p4z, 261021-v4n, 261022-fke, 261022-cb3, 261022-q7a und 261022-d7w aendern Code nach fe24d8b (PIN genau 4 Ziffern, Anmeldung ohne „Los geht’s“, sichtbare Warteanzeige, CSV-Datei waehlen, „?“/UTF-16/Startlog, DataProtection-Startwarnungen/Distraktoren): soll das in 1.0.0, muss der Tag-Kandidat neu bestimmt werden
- 03.1-07 abgeschlossen: Tag v1.0.0 nur auf fe24d8b (Prod-Stack und volles Gate auf diesem Commit; danach nur .planning/ geaendert); setzt der Orchestrator
- e2e-Laeufe ueber 15 min scheitern vermutlich am geteilten Refresh-Token aus global-setup.ts (03.1-07-SUMMARY, Offene Punkte); nicht aufgetreten, nicht ausgebaut

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-22T22:43:47.369Z
Stopped at: Completed 03.1.1-03-PLAN.md
Resume file: None
