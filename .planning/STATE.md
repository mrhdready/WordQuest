---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: "01"
current_phase_name: Safe Home-Network Install
status: verifying
stopped_at: "Planungsabgleich; aktuelle Phasenverifikation und Geräteabnahmen offen"
last_updated: "2026-11-17"
last_activity: 2026-11-17
last_activity_desc: "32/32 Pläne ausgeführt; fünf Verifikationen stale; historische Prüfnachweise abgeglichen; aktuelles Gate, Geräteabnahmen und Release 1.1.0 offen"
state_head: 9627760c062dfea93a4b0567812b25103394fd05
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 32
  completed_plans: 32
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-17)

**Core value:** Parents without special know-how can set up WordQuest in their home network and their children can learn with it safely and reliably.
**Current focus:** Planungsabgleich abgeschlossen; Verifikation ab Phase 01 erneuern, manuelle Abnahmen und Release 1.1.0 offen

## Current Position

Phase: 01 (Safe Home-Network Install) — erste veraltete Verifikation gemäß GSD; keine fehlende Implementierung.
Plan: Alle 32 Phasenpläne ausgeführt, zuletzt 03.1.1-05. Kein neuer Funktionsumfang beauftragt.
Status: Verifikation ausstehend (`stale` in allen fünf Phasen); manuelle Abnahmen und Release 1.1.0 nicht abgeschlossen.
Last activity: 2026-11-17 — Planungsstand gegen Code `9627760`, GSD-Abfragen und dokumentierte Prüfergebnisse abgeglichen.

Progress: Umsetzung 32/32 Pläne; aktuell verifizierte Phasen 0/5. Kein Gesamt-Fertigstellungsprozentsatz.

## Abgleich am 2026-11-17

Referenz ist `master` auf `9627760` (Merge von `v1-fertig`; beide Historien erhalten). Der Arbeitsbaum war vor diesem Dokumentationsabgleich sauber. Dieser Abgleich prüft Code und vorhandene Protokolle, führt aber kein neues Build-, Test- oder Abnahme-Gate aus.

- **Umsetzung:** 32/32 Phasenpläne haben eine Zusammenfassung (8 + 7 + 5 + 7 + 5). Das ist kein Nachweis einer abgeschlossenen Phasenabnahme.
- **Letzter dokumentierter voller Prüflauf:** 2026-10-26, [Quick 261026-j98](quick/261026-j98-codex-befunde-der-wartungsrunde-beheben/261026-j98-SUMMARY.md), Code-Endstand `34ee200`: Backend-Build ohne Warnungen/Fehler, Learning 171/171, API 390/390, Frontend 333/333, E2E mit axe 71 bestanden/1 übersprungen; Design-Lint 0 Fehler/0 Warnungen, Proxy-, Installations- und Release-Smoke erfolgreich. Der übersprungene E2E-Fall wird dadurch nicht als bestanden gewertet.
- **VM-Abnahme HTTPS:** Debian aarch64 am 2026-10-26 bestanden; Mehrnetz-Gateway-Befund in `11220f7` behoben. [Nachweis](quick/261025-fpi-https-mit-eigener-ca-statt-lets-encrypt/261025-fpi-05-SUMMARY.md#vm-abnahme-orchestrator-2026-10-26). Das ersetzt keine Abnahme auf echten Endgeräten.
- **Aktuelle Verifikation:** GSD 1.21.0 meldet für alle fünf Phasen `stale`. Die Quellen wurden seit den jeweiligen Verifikationen geändert. Die historischen `VERIFICATION.md`- und UAT-Protokolle bleiben als Nachweise erhalten; ihre alten Ergebnisse gelten nicht als neuer Prüflauf auf `9627760`.
- **Prüfumgebung:** Gebündeltes Node.js und `gsd_run` sind mit dem global vorgegebenen PATH nutzbar. Frühere Aufrufe scheiterten an `node`/`npm` bzw. `dotnet` mit Exit 127; Arcane zuletzt an `SNAPSHOT_CHANGED`. Die behobene GSD-Laufzeit ist keine Projektverifikation. Ein vollständiger aktueller Build-, Test-, Design- und axe/E2E-Lauf bleibt offen.

### Noch offene Abnahmen und Freigaben

- Vokabelbilder: A1 Kamera-Dateiauswahl auf iPhone/Android, A2 HEIC und Drehung, A3 Safari/JPEG-Rückfall aus [03.1.1-VERIFICATION](phases/03.1.1-vocabulary-pictures/03.1.1-VERIFICATION.md).
- HTTPS mit eigener CA: iPhone/iPad, Android und Browser ohne installierte CA auf echter Heimhardware; Vertrauen, CA-Installation, Warnung/Rückfall und PWA-Verhalten gemäß [HTTPS-Nachweis](quick/261025-fpi-https-mit-eigener-ca-statt-lets-encrypt/261025-fpi-05-SUMMARY.md).
- Verbleibende Hardware-/Bedienungsabnahmen aus [01-UAT](phases/01-safe-home-network-install/01-UAT.md), [02-UAT](phases/02-reliable-learning-clean-family-data/02-UAT.md), [03-UAT](phases/03-installable-1-0-0-release/03-UAT.md) und den Verifikationen: echte Tablet-Performance, Bildschirmtastatur/echter Browser-Zoom, echte WLAN-Geräte, echter Pi und Langzeit-/Tageswechselverhalten sowie Installation durch einen Menschen ohne Projektkenntnis. Die dort dokumentierten VM-, Simulations- und Agent-Ersatzprüfungen bleiben als solche gekennzeichnet. Nicht eigens geprüftes Reset-Passwort-Logging bleibt offen.
- Release 1.1.0: Version ist im Code/Paket vorbereitet; lokales Tag fehlt (`git tag --list` zeigt `v1.0.0` und `v1.0.1`). Veröffentlichung von Tag, Images und Paket 1.1.0 ist nicht belegt und bleibt offen. Für 1.0.0/1.0.1 liegen historische Veröffentlichungsnachweise in `03-UAT.md` vor.
- Phasenverifikation aktualisieren und verbleibende manuelle Punkte abnehmen, bevor der Meilenstein abgeschlossen wird. GSD meldet 26 `human_needed`-Einträge in alten Verifikationen. Diese Rohzahl ist keine bereinigte Zahl unerledigter Abnahmen: einige Einträge sind später durch UAT-Ersatzprüfungen belegt oder durch die Entfernung von Traefik überholt. Verbliebene Grenzen werden deshalb oben ausdrücklich weitergeführt.

### Überholte Prüfszenarien

Traefik/Let's Encrypt, `docker-compose.yml` und die Installation über `git pull` gehören nicht mehr zum aktuellen Betriebsweg. Historische Nachweise bleiben erhalten; eine erneute Abnahme dieser entfernten Variante ist nicht erforderlich. Aktuelle Prüfungen nutzen `docker-compose.quick.yml`, HTTPS mit eigener CA und den Paket-Updateweg. Die spätere VM-Abnahme schließt die ehemals offene VM-Prüfung, aber nicht die Geräteabnahme. Ein Upgrade bestehender 1.0.x-Installationen auf 1.1.0 ist nicht vorgesehen; Neuinstallation ist dokumentiert.

## Performance Metrics

**Velocity:**
- Total plans completed: 32
- Average duration: -
- Total execution time: nicht neu aggregiert; historische Per-Plan Metrics siehe unten

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 8 | 8 | nicht neu aggregiert |
| 02 | 7 | 7 | nicht neu aggregiert |
| 03 | 5 | 5 | nicht neu aggregiert |
| 03.1 | 7 | 7 | nicht neu aggregiert |
| 03.1.1 | 5 | 5 | nicht neu aggregiert |

**Recent Trend:**
- Last 5 plans: 03.1.1-01 bis 03.1.1-05 ausgeführt; historische Nachweise in den jeweiligen Zusammenfassungen
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
| Phase 03.1.1 P04 | 28min | 2 tasks | 9 files |
| Phase 03.1.1 P05 | 38min | 3 tasks | 6 files |

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
- [Phase 03.1.1]: 03.1.1-04: 200 %-Prüfung der Lernrunde mit Viewport vor dem Rundenstart (autoFocus scrollt nur beim Mount)
- [Phase 03.1.1]: 03.1.1-04: Hinweis „Noch einmal“ als Badge tone=yellow (status-chip-warn), warn-text auf Glas hatte 4.45:1
- [Phase 03.1.1]: 03.1.1-05: toDataUrl liest Bildbytes per arrayBuffer statt FileReader; unter Node 22 (CI) lehnte jsdoms FileReader den Node-Blob ab, 14 vitest-Faelle waren seit 8828b32 rot

### Pending Todos

- Aktuellen vollständigen Build-, Test-, Design- und axe/E2E-Lauf nachholen; alle fünf `stale`-Verifikationen erneuern. GSD empfiehlt zunächst `$gsd-execute-phase 01`; die Pläne sind bereits ausgeführt.
- Verbleibende Geräte-/Hardware- und menschliche Abnahmen siehe „Noch offene Abnahmen und Freigaben“ oben. A1–A3 und die HTTPS-Geräteabnahme bleiben offen.
- Release 1.1.0 erst nach den vorgesehenen Abnahmen freigeben und veröffentlichen.
- Historisch erledigt: Lernseiten-axe durch spätere vollständige E2E-Läufe (zuletzt Quick 261026-j98); Query-Cache und doppelte Login-Anfragen durch Quick 261023-k4m; Logout-Tokenkette durch Quick 261023-a8x. Das aktuelle Gate bleibt davon unabhängig offen.

### Quick Tasks

| ID | Aufgabe | Stand | Nachweis |
|----|---------|-------|----------|
| 261006-r7l | Installer, Container-Secrets und HTTP-Lernen | Umgesetzt; Lernseiten-axe durch spätere Phasen-/Quick-Läufe historisch belegt, aktueller Lauf offen | [Zusammenfassung](quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/261006-r7l-SUMMARY.md) |
| 261021-p4z | Kinder-PIN genau 4 Ziffern, Anmeldung mit der vierten Ziffer (PAR-02, FIX-08) | Umgesetzt; Gate, e2e/axe, Install- und Release-Smoke gruen; Frage zu „Los geht’s“ in 261021-v4n beantwortet | [Zusammenfassung](quick/261021-p4z-kinder-pin-genau-4-ziffern/261021-p4z-SUMMARY.md) |
| 261021-v4n | Kinder-Anmeldung ohne „Los geht’s“, PIN-Felder der Eltern auf 4 Zeichen, Doku ohne Alt-PINs (PAR-02, FIX-08) | Umgesetzt; Gate, e2e/axe, Install- und Release-Smoke gruen; Frage zu sichtbarer Warteanzeige in 261022-fke beantwortet | [Zusammenfassung](quick/261021-v4n-pin-ohne-los-gehts-button/261021-v4n-SUMMARY.md) |
| 261022-fke | Sichtbare Warteanzeige „Einen Moment …“ auf der Kinder-Anmeldung (PAR-02, FIX-08) | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen | [Zusammenfassung](quick/261022-fke-sichtbare-warteanzeige-pin-anmeldung/261022-fke-SUMMARY.md) |
| 261022-cb3 | CSV-Import: Datei wählen statt Text einfügen (Konzept M2) | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen; Frage zu UTF-16 in 261022-q7a beantwortet | [Zusammenfassung](quick/261022-cb3-csv-datei-waehlen/261022-cb3-SUMMARY.md) |
| 261022-q7a | „?“ am Antwortende ignorieren (Konzept §6.4), UTF-16 im CSV-Import (M2), erster Start ohne fail:-Zeilen | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen | [Zusammenfassung](quick/261022-q7a-fragezeichen-utf16-migrationslog/261022-q7a-SUMMARY.md) |
| 261022-d7w | Start ohne warn:-Zeilen von DataProtection (Vorladen entfernt), EF-Warnung 10102: Distraktoren aus dem ganzen Set, Profilauswahl sortiert | Umgesetzt; Gate, e2e/axe, Install-Smoke (STARTLOG ohne warn:) gruen | [Zusammenfassung](quick/261022-d7w-dataprotection-startwarnungen/261022-d7w-SUMMARY.md) |
| 261023-a8x | Abmelden widerruft die ganze Token-Kette; 409-Frist meldet wiederholbaren Fehler statt alle Tabs abzumelden, Abfragen nach 409 ohne Auto-Wiederholung (HARD-01, Codex-Review 2026-10-23) | Umgesetzt; Gate, e2e/axe, Install-Smoke gruen | [Zusammenfassung](quick/261023-a8x-auth-logout-kette/261023-a8x-SUMMARY.md) |
| 261023-k4m | Login nach 401 ohne Refresh/Wiederholung, Query-Cache beim Anmeldewechsel leeren, CSV-Auswahl waehrend des Lesens sperren, Commit ohne Request-Token (kein fail: bei Abbruch) (HARD-01, 03.1-02 INFO 7/8, Codex-Review) | Umgesetzt; Gate, e2e/axe (API-Log ohne fail:), Install-Smoke gruen | [Zusammenfassung](quick/261023-k4m-login-cache-csv-logoutlog/261023-k4m-SUMMARY.md) |
| 261024-vnx | Release 1.0.1 aus der UAT 2026-10-24: Kinderwahl auf „Fortschritt“ mit Haken (WCAG 1.4.1), deutscher Hinweis bei belegtem Port in setup.sh, Installationsseite und README Variante B nach Laien-Test, Version 1.0.1 | Umgesetzt; Gate, e2e/axe, Install- und Release-Smoke gruen | [Zusammenfassung](quick/261024-vnx-release-1-0-1-kinderwahl-auf-fortschritt/261024-vnx-SUMMARY.md) |
| 261025-fd0 | Installationsseite: feste Adresse im Heimnetz (DHCP-Reservierung im Router, Name per .fritz.box/.local mit Grenzen, Hilfe-Eintrag „Die Adresse geht nicht mehr.“) | Umgesetzt (2d605da); Seitenpruefung statisch gruen, Review ohne BLOCKER/HIGH/MEDIUM, 3 LOW behoben | [Zusammenfassung](quick/261025-fd0-installationsseite-feste-adresse-im-heim/261025-fd0-SUMMARY.md) |
| 261025-gef | Lernrunde: richtige Antwort ohne Tippfehler springt direkt zur naechsten Aufgabe, „Richtig! +N XP“ ueber dem neuen Antwortfeld; falsch und Tippfehler behalten „Weiter“ | Umgesetzt (9184075); Gate gruen, learn.spec mit axe/Tastatur/200 % gruen; voller e2e-Lauf auf 9184075 66 passed, 1 skipped (Nachlauf 2026-10-25) | [Zusammenfassung](quick/261025-gef-richtige-antwort-springt-direkt-weiter/261025-gef-SUMMARY.md) |
| 261025-fpi | HTTPS mit eigener CA statt Let's Encrypt (Dienst certs, 80→443-Umleitung, Portpruefung mit 8080/8443-Ausweich, Traefik entfernt, Version 1.1.0) | Plaene 01–05 umgesetzt (a7f1992..0507995); Gate gruen: Learning 166/166, Api 388/388, Vitest 332/332, e2e 70 passed/1 skipped, axe 0, PROXY-XFF/SMOKE/RELEASE-SMOKE OK; VM-Abnahme bestanden 2026-10-26 (Befund behoben in 11220f7); Geraeteabnahme durch den Owner offen, Tag v1.1.0 wartet darauf | [Zusammenfassung](quick/261025-fpi-https-mit-eigener-ca-statt-lets-encrypt/261025-fpi-05-SUMMARY.md) |
| 261026-j98 | Codex-Befunde der Wartungsrunde: HTTPS-Pruefung in upgrade/restore, CSV-Trennzeichen in Anfuehrungszeichen, Tippfehler-Mindestlaenge ohne Artikel, Levelaufstieg durch Antwort-XP, Ladefehler der Vokabelliste | Umgesetzt (21fa7ce..34ee200), je Befund erst roter Test; Gate gruen: Learning 171/171, Api 390/390, Vitest 333/333, e2e 71 passed/1 skipped, axe 0, PROXY-XFF/SMOKE/RELEASE-SMOKE OK; Review 2 MEDIUM + 1 LOW behoben | [Zusammenfassung](quick/261026-j98-codex-befunde-der-wartungsrunde-beheben/261026-j98-SUMMARY.md) |

### Blockers/Concerns

- Release 1.0.0 veroeffentlicht 2026-10-24: Tag v1.0.0 auf 8f3c6ab, master b5df847 (Merge-Commit, Baum gleich v1-fertig), CI gruen, Images amd64/arm64 anonym ladbar. Release 1.0.1 (Quick 261024-vnx) veroeffentlicht 2026-10-24: Tag v1.0.1, master 525abd7, CI gruen; Update 1.0.0 → 1.0.1 auf der VM bestanden (03-UAT Test 5 und 6). UAT-Stand Phase 1-3 in den jeweiligen UAT-Dateien.
- Weiterhin offene Grenze aus 03.1-01: Gewinnt Abmelden oder PIN-Wechsel das Rennen, kann ein Refresh mit widerrufenem, nicht rotiertem Token alle Tokens des Kontos widerrufen. Andere Geräte müssen sich dann neu anmelden (`AuthService.RefreshAsync`, `RevokeAllAsync`; 03.1-01-SUMMARY, Offene Punkte).
- Weiterhin offene Grenze aus 03.1-01: Eine bereits geprüfte Anmeldung mit alten Zugangsdaten kann während Reset/PIN-Wechsel nach dem Widerruf noch einen Token speichern; Login-Pfade nehmen die Kontosperre nicht selbst.
- Davon getrennt historisch behoben: Logout mit rotiertem Token widerruft die Nachfolgerkette R1→R2→R3 (Quick 261023-a8x). Das behebt das oben genannte Refresh-Rennen nicht.
- Schuld aus 261023-a8x: `LogoutAsync` laedt alle Refresh-Tokens des Kontos (`AuthService.cs:262-264`), alte werden nie geloescht; heute unkritisch, spaeter ab `CreatedAt` filtern oder rekursive CTE
- e2e-Laeufe ueber 15 min scheitern vermutlich am geteilten Refresh-Token aus global-setup.ts (03.1-07-SUMMARY, Offene Punkte); nicht aufgetreten, nicht ausgebaut

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-17
Stopped at: Planungsabgleich; Verifikation und manuelle Abnahmen offen
Resume file: None
