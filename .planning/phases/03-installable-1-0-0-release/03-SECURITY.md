---
phase: "03"
slug: "installable-1-0-0-release"
status: verified
verdict: SECURED
threats_total: 23
threats_closed: 16
threats_accepted: 7
# threats_open = offene Threats mit Severity >= workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
block_on: high
code_range: "c915576..86e46d8"
created: "2026-10-18"
---

# Phase 03 — Sicherheit

> Sicherheitsvertrag der Phase: Threat-Register, akzeptierte Risiken und Prüfspur. Geprüft wurde der Code im Bereich `c915576..86e46d8` gegen die Threat-Register aus `03-01-PLAN.md` bis `03-05-PLAN.md`. Jede Mitigation ist mit Datei und Zeile belegt, dazu der Smoke-Fall, der sie abdeckt. Den Release-Smoke hat der Auditor nicht selbst ausgeführt (kein Docker-Stack); die Laufbelege stammen aus den SUMMARYs (siehe Prüfspur).

---

## Vertrauensgrenzen

| Grenze | Beschreibung | Daten |
|--------|--------------|-------|
| Heimserver → GHCR (`docker compose pull` in `setup.sh` und `upgrade.sh`) | Installation und Update ziehen fremd gebaute Images; welcher Stand, bestimmen `.env` und `.env.example` | Image-Präfix, Version |
| GitHub Actions → GHCR | Nur `ci.yml` schiebt Images, nur bei `push` | `GITHUB_TOKEN` mit `packages: write` |
| Build-Plattform → Zielplattform | Build-Stage auf amd64-Runnern, Runtime auf arm64 und amd64 | IL, `dist/` |
| Upstream-Repo → Heimserver (`git clone`, `git pull`) | Die Zielversion kommt aus `.env.example` des Repos | `WQ_VERSION` |
| Betreiber-Terminal → `restore.sh` | Auswahl und Pfad-Argument kommen vom Betreiber (Shell-Zugang = Administrator) | Nummer, Pfad, `ja` |
| Datei in `backups/` → Datenbank | Der Inhalt läuft als SQL mit Superuser-Rechten im db-Container | Dump mit Familiendaten und Passwort-Hashes |
| `restore.sh`/`upgrade.sh` → API-Start | Die API startet auf dem eingespielten bzw. neuen Stand und migriert vorwärts | Schema, Refresh-Tokens |
| Smoke → Image-Speicher und Arbeitsordner des Entwicklungsrechners | Tags mit dem echten Namen; Testpasswort und Tokens in Dateien | Tags, Testzugang |
| Installationsseite → Eltern ohne Vorwissen | Eltern führen die Befehle wörtlich aus | Befehle |
| Heimnetz → Internet | WordQuest ist für das Heimnetz gedacht, ohne HTTPS | Port 8080 |

---

## Threat-Register

| Threat ID | Kategorie | Komponente | Severity | Disposition | Beleg | Status |
|-----------|-----------|------------|----------|-------------|-------|--------|
| T-03-01 | Tampering | Image-Auswahl der Installation | medium | mitigate | Fester Tag `.env.example:16` (`WQ_VERSION=1.0.0`), Compose-Standardwerte `docker-compose.quick.yml:42,70`, `docker-compose.yml:31,60`; Präfix `ghcr.io/mrhdready/wordquest` `.env.example:12`, von `setup.sh:66-69` als Standard übernommen, Format geprüft `:70`; Push nur bei `push` `ci.yml:100`, Datei im Bereich unverändert (`git diff --quiet c915576..HEAD -- .github/workflows/ci.yml` → 0); Smoke `release-smoke.sh:60-75` (drei Stellen), `:151-152` (`.env` nach Enter), `:157-160` (Image der laufenden api und web), `:530-531` (nach dem Update). Wirkt für neue Familien erst nach dem Release-Schritt → W-8; Tag statt Digest → W-5 | closed |
| T-03-03 | Spoofing | Smoke überdeckt oder löscht ein lokales `1.0.0`-Image | low | mitigate | Vorprüfung mit Abbruch `release-smoke.sh:78-83`, erst danach Aufräumliste `:85`; dasselbe für `0.0.0-smoke` `:444-449`; Aufräumen nur der eigenen Tags `:41-45`; Gegenprobe Teil-Build ohne Reste `03-01-SUMMARY.md:81-84` | closed |
| T-03-04 | Information Disclosure | Smoke-Logs oder Seite enthalten Secrets | low | mitigate | `setup.sh` nennt nur Dateinamen `:34-50`, Passwort unsichtbar `:129,136` und per stdin `:147`; Smoke mit Testpasswort `release-smoke.sh:148`, Abbruch bei Passwort im Log `:155`; Tokens nur in Dateien `:198-210`, ausgegeben werden nur HTTP-Codes `:292,295`; `secrets/` des Entwicklers wird nicht kopiert `:53`, sonst greift der Smoke nicht auf `secrets/` zu (grep → nur `:53`); Arbeitsordner `mktemp -d` `:14`, gelöscht `:46`; Seite nennt nur Dateinamen `Installation.md:89,252`; keine `.smoke/`- oder `.log`-Datei im Index, kein JWT-Muster in `.planning/phases/03-…` (je 0). Rest: Testpasswort und Tokens stehen während des Laufs in curl-Argumenten (`:111`, `:214`) und sind in der Prozessliste des Entwicklungsrechners sichtbar; nur Testwerte | closed |
| T-03-SC (03-01) | Tampering | npm/NuGet/Container-Images | low | accept | keine Änderung an `*.csproj`, `package.json`, `package-lock.json`, `Directory.Packages.props` im Bereich; → R-23 | closed (akzeptiert) |
| T-03-02 | Denial of Service | Cross-Build liefert ein Image, das auf der Zielplattform nicht startet | medium | mitigate | `--platform=$BUILDPLATFORM` nur am Build-Stage `backend/Dockerfile:9`, `frontend/Dockerfile:7`; Runtime-Stages je Zielplattform `backend/Dockerfile:29`, `frontend/Dockerfile:16`; Plattformen `ci.yml:139`; Buildx-Proben beider Plattformen, `dotnet restore`/`publish` nur auf arm64 `03-02-SUMMARY.md:73-77`; amd64-Image startet auf dem arm64-Host bis zur Secret-Prüfung `:81-85`; arm64-Runtime läuft nativ in jedem Release-Smoke (Host arm64, `:64`); Pi-Pull der veröffentlichten Images offen → W-10 | closed |
| T-03-SC (03-02) | Tampering | npm/NuGet/Container-Images | low | accept | kein neues Basis-Image, der Diff ergänzt nur `--platform` an bestehenden `FROM`-Zeilen; → R-23 | closed (akzeptiert) |
| T-03-05 | Tampering | Einspielen einer manipulierten oder fremden Datei | medium | mitigate | Liste nur aus `backups/` `restore.sh:47`; Ordner 0700 `setup.sh:57`, Besitz-Prüfung und 0700 auch `restore.sh:79-80`; `check_dump` (gzip, Endzeile, `COPY public.app_user`) `:25-33` an `:69`, vor der Bestätigung `:73-75` und vor der ersten Änderung `:78`; Pfad-Argument `:36-38` mit derselben Prüfung und Rückfrage; Smoke „Kaputte Datei“ `release-smoke.sh:367-371` und „Fehlender Pfad“ `:362-365`, je mit unverändertem Fingerabdruck, ohne neue Vorher-Sicherung und ohne API-Neustart `:318-323`; Grenze der Prüfung → W-3 | closed |
| T-03-06 | Denial of Service | Gescheitertes Einspielen: leere Datenbank, falscher Erfolg, API startet wie neu | high | mitigate | Neu angelegte Datenbank `restore.sh:117-119`; Einspielen mit `ON_ERROR_STOP=1` `:126-128`, `pipefail` `:10`; `\|\| return 1` je Teilschritt `:119,128` (Prüfungen `:26-27,31-32`, Vorher-Sicherung `:95,99`); Rückfall `:149-158`; API gestoppt ab `:108`, Start nur nach Erfolg `:156,163`, bei doppeltem Fehlschlag bleibt sie gestoppt `:153-154`; Strg+C `:148,155,160`; Smoke Importfehler `release-smoke.sh:373-378`, Lesefehler `:380-404`, Drop-Fehler mit gestoppter API `:406-421`, Weg zurück bei fehlender Datenbank `:423-430`; Gegenprobe ohne `pipefail` wird rot `03-03-SUMMARY.md:96`. `-1` wirkt laut Doku ohne `-c`/`-f` nicht → W-1 | closed |
| T-03-07 | Information Disclosure | Vorher-Sicherung mit Familiendaten und Passwort-Hashes | medium | mitigate | Ablage `backups/vor-wiederherstellung-…` `restore.sh:93`, Besitz-Prüfung `:79`, `chmod 700 backups` `:80`; Ausgaben nennen nur Dateinamen `:105,150,154,158,165`; Smoke gibt nur die Ausgabe von `restore.sh` und HTTP-Codes aus `release-smoke.sh:232,292,295`, Dumps nur per `gzip -t` und `grep -c` geprüft `:301-305`; Dateirechte der Vorher-Datei → W-2 | closed |
| T-03-08 | Tampering | Nummer oder Pfad mit Sonderzeichen | low | mitigate | Muster `^[1-9][0-9]{0,5}$` vor dem Bereichsvergleich `restore.sh:60` (die Arithmetik sieht nur Ziffern, keine führende Null), Index `:65`, Eingabeende bricht ab `:59`; Pfade in Anführungszeichen `:26-27,32,38,69`; Liste mit `IFS= read -r`, Leerzeichen im Namen bleiben erhalten `:45-49`; Smoke `99`, `x`, Eingabeende `release-smoke.sh:348-360`. Pfad-Argument: nur `-f`, jeder Ort zulässig (Seite `Installation.md:198`); ein Name mit führendem `-` ginge als Option an gzip `:26`, das träfe nur den Betreiber selbst | closed |
| T-03-09 | Denial of Service | Versehentliches Wiederherstellen eines alten Stands | medium | mitigate | Satz `restore.sh:73`, nur `ja` geht weiter `:74-75`; Vorher-Datei in der Schlusszeile `:165`; Smoke `nein` → „Abgebrochen. Es wurde nichts geändert.“ `release-smoke.sh:350-354`; Seite `Installation.md:178` | closed |
| T-03-10 | Spoofing | Widerrufene Anmeldungen und altes Passwort gelten nach dem Wiederherstellen wieder | medium | mitigate | `DELETE FROM public.refresh_token` im Einspielstrom `restore.sh:126`, auch im Rückfall (dieselbe Funktion, `:153`); die API ist von `:108` bis zum Start `:156`/`:163` gestoppt; Smoke `refresh_token` 0 Zeilen `release-smoke.sh:287`, Refresh mit Token aus der Sicherung 401 `:289-293`, alter Access-Token 200 `:294-296` (beobachtet `03-03-SUMMARY.md:81`); Seite: neu anmelden, „spätestens nach rund 15 Minuten“, Passwort-Stand der Sicherung, Verweis auf „Passwort vergessen“ `Installation.md:206`, `:228-236`; `AuthOptions.cs:15`, `JwtTokenService.cs:54`. Restfenster → R-19, Passwort-Stand → R-20; „in derselben Transaktion“ nicht belegt → W-1 | closed |
| T-03-SC (03-03) | Tampering | npm/NuGet/Container-Images | low | accept | keine Dependency-Änderung, kein neues Image; → R-23 | closed (akzeptiert) |
| T-03-11 | Denial of Service | Halber Zustand, wenn das Image der Zielversion fehlt | high | mitigate | Pull mit der Zielversion in der Umgebung `upgrade.sh:69` vor dem Schreiben der `.env` `:83-89`; Abbruch ohne Änderung `:70`; Smoke `9.9.9-fehlt` mit echtem Pull `release-smoke.sh:586-598` (`.env`-Prüfsumme, Image, StartedAt, Fingerabdruck `:556-562`); Spy belegt Zielversion und alten `.env`-Stand beim Pull `:525-526`, `:606-607` | closed |
| T-03-12 | Tampering | Update ohne brauchbare Sicherung | high | mitigate | `backup_now` mit `\|\| return 1` und `check_dump` `upgrade.sh:46-56`; `die` vor dem Pull `:58-61`; Smoke `chmod 500 backups`: keine neue Datei, keine Spy-Zeile, `.env`, Image und StartedAt gleich `release-smoke.sh:575-584` | closed |
| T-03-13 | Information Disclosure | Sicherungsdatei mit Familiendaten und Passwort-Hashes | medium | mitigate | Besitz-Prüfung `upgrade.sh:33`, `umask 077` `:54`; Ordner 0700 aus `setup.sh:57`; Smoke prüft `-rw-------` `release-smoke.sh:469`; Ausgaben nennen nur Dateinamen `upgrade.sh:62,70,76,113` | closed |
| T-03-14 | Spoofing | Demo-Elternkonto aus einer Installation vor Phase 1 | low | accept | `DemoAccountCheck.cs:15`, Aufruf `Program.cs:35,247`; `upgrade.sh` ohne Demo-Zweig (`grep -ci demo` → 0); Seite und README ohne `demo@` (→ 0); → R-21 | closed (akzeptiert) |
| T-03-15 | Tampering | Manipulierte Zielversion über ein kompromittiertes Upstream-Repo | low | accept | Zielversion aus `.env.example` `upgrade.sh:25`, Präfix aus `.env`; → R-22; Format ungeprüft → W-7 | closed (akzeptiert) |
| T-03-18 | Denial of Service | Neue Version startet nicht, Eltern ohne Rückweg | high | mitigate | `start_failed` mit alter Version, Sicherungsdatei und `./restore.sh` `upgrade.sh:73-77`; `up -d` `:95`, Health-Timeout `:97-106`, `restart web` `:109`; Trap vor dem Schreiben der `.env` `:80`, gelöst erst nach Erfolg `:110`; Smoke `7.7.7-ohne-image` `release-smoke.sh:600-619` und `WQ_SEED_DEMO_DATA=true` `:621-641`, je mit Weg zurück über `restore.sh` (Fingerabdruck gleich, Login 200); Strg+C-Probe `03-04-SUMMARY.md:84` | closed |
| T-03-SC (03-04) | Tampering | npm/NuGet/Container-Images | low | accept | keine Dependency-Änderung, kein neues Image, der Pull-Spy ist ein Shell-Skript im Smoke; → R-23 | closed (akzeptiert) |
| T-03-16 | Elevation of Privilege | Seite verleitet zu unsicheren Schritten | high | mitigate | Strukturprüfung im Smoke `release-smoke.sh:669-672` (Modus 777 per `chmod`, auch rekursiv, und `0.0.0.0`), Mutanten je rot `03-05-SUMMARY.md:70-77`; Review: keine Portfreigabe, keine gelockerten Rechte, keine Zugangsdaten in Befehlen `:228`; im Audit nachgeprüft: kein `chmod`, `0.0.0.0`, `curl`, `wget` und keine Pipe in eine Shell auf der Seite (je 0 Treffer); Rechte wie in `setup.sh` (`secrets/` `Installation.md:89` ↔ `setup.sh:23`, `backups/` `:152` ↔ `setup.sh:57`); `sudo` nur für `usermod`, `apt install git` und `chown` zurück an den Betreiber (`:15,21,225`); `reset-password` nur mit E-Mail `:231`. Fehlende Warnhinweise → W-6 | closed |
| T-03-17 | Repudiation | Doku-Drift: Seite beschreibt anderes Verhalten als der Code | medium | mitigate | Abschnittsfolge `release-smoke.sh:651-661`, bash- und text-Block je Abschnitt `:662-668`, nur diese Sprachen `:673-675`; jeder Befehl ausgeführt (`page_cmd` `:126-130`) oder mit Grund (`HANDGRIFFE` `:132-143`) `:676-683`; zitierte Ausgaben gegen die Logs `:684-691`; Faktentabelle mit Fundstellen und fünf Korrekturen `03-05-SUMMARY.md:83-124`; Release-Smoke nach dem letzten Seiten-Commit grün `:152,243`. Drift außerhalb der Seite (Konzept „in einer Transaktion“) → W-1 | closed |
| T-03-SC (03-05) | Tampering | npm/NuGet/Container-Images | low | accept | keine Dependency; das Gate nutzt nur vorhandene Images und Werkzeuge (shellcheck, actionlint nicht installiert, D-02); → R-23 | closed (akzeptiert) |

*Status: open · closed · closed (akzeptiert) · open — unter Schwelle `high` (nicht blockierend)*
*Severity: critical > high > medium > low. Nur offene Threats ab `high` zählen für `threats_open`.*

---

## Akzeptierte Risiken

| Risk ID | Threat | Begründung | Akzeptanz dokumentiert in | Erfasst |
|---------|--------|------------|---------------------------|---------|
| R-19 | T-03-10 (Restrisiko) | Bereits ausgegebene Access-Tokens bleiben nach dem Wiederherstellen bis zum Ablauf gültig: 15 Minuten (`AuthOptions.cs:15`) plus 30 s Toleranz (`JwtTokenService.cs:54`). Die API prüft beim Access-Token keine Refresh-Tokens. Im Smoke beobachtet: alter Access-Token 200 (`release-smoke.sh:294-296`). Eine sofortige Abmeldung wäre eine neue Auth-Entscheidung | `03-REVIEWS.md:15,58-63,142,158`; `03-03-PLAN.md` Threat-Register T-03-10; Seite `Installation.md:206` | 2026-10-18 |
| R-20 | T-03-10 (Restrisiko) | Passwörter und PINs gelten nach dem Wiederherstellen im Stand der Sicherung; ein seither geändertes Passwort gilt wieder. Ausweg auf der Seite: `reset-password` | `03-03-PLAN.md` Threat-Register T-03-10; `Installation.md:206,228-236` | 2026-10-18 |
| R-21 | T-03-14 | Ein Demo-Elternkonto mit bekanntem Passwort gibt es nur in Installationen vor Phase 1, nicht in solchen aus `setup.sh`. `DemoAccountCheck` verhindert den Start weiterhin und nennt den Ausweg | `03-04-PLAN.md` Threat-Register | 2026-10-18 |
| R-22 | T-03-15 | Die Zielversion kommt per `git pull` aus dem Upstream-Repo: gleiches Vertrauen wie beim Klonen und bei `setup.sh`. Images nur aus dem Präfix in `.env` | `03-04-PLAN.md` Threat-Register | 2026-10-18 |
| R-23 | T-03-SC (03-01 bis 03-05) | Keine neue Dependency und kein neues Image. Der Pull-Spy ist ein Shell-Skript im Smoke; shellcheck und actionlint werden nicht installiert (D-02) | jeweiliges Threat-Register; `git diff --name-only c915576..HEAD` ohne Treffer auf `*.csproj`, `package.json`, `package-lock.json`, `Directory.Packages.props`; Dockerfiles nur mit `--platform` | 2026-10-18 |

*Akzeptierte Risiken tauchen in späteren Audits nicht erneut auf.*

---

## Hinweise ohne Threat-Zuordnung (nicht blockierend)

| ID | Fundstelle | Hinweis |
|----|------------|---------|
| W-1 | `restore.sh:127`; Konzept `Documentation/WordQuest_Konzept_und_Architektur.md:635`; `03-03-SUMMARY.md:12` | `psql … -1` ohne `-c`/`-f`. Die PostgreSQL-17-Doku (`https://www.postgresql.org/docs/17/app-psql.html`, in dieser Session abgerufen) sagt dazu: „This option can only be used in combination with one or more -c and/or -f options.“ Der Smoke lief mit diesem Aufruf grün, psql lehnt die Kombination also nicht ab. Ob der Strom trotzdem in einer Transaktion läuft: UNBEKANNT. Der Kommentar `restore.sh:146` geht selbst von einem Teil-Commit aus, und kein Smoke-Fall unterscheidet beides. Die Folgen sind begrenzt: Die Zieldatenbank ist neu angelegt, jeder Fehler führt über `ON_ERROR_STOP` und `pipefail` zum Rückfall, und die API bleibt bis zum Erfolg gestoppt (T-03-06 und T-03-10 bleiben geschlossen). Nicht belegt ist die Aussage „in einer Transaktion“ im Konzept und im SUMMARY, ebenso „in derselben Transaktion“ in T-03-10. Vorschlag: `-f -` ergänzen (laut Doku liest `-f -` von stdin, und `-1` gilt dann) oder die Aussage streichen. |
| W-2 | `restore.sh:93-95` | Die Vorher-Sicherung entsteht ohne `umask 077` (`gzip >"$1"`), laut Code also mit der Standardmaske des Benutzers, meist 0644. Geschützt ist sie nur durch den Ordner mit 0700. `upgrade.sh:54` setzt `umask 077`; der Smoke prüft `-rw-------` nur für `vor-update-…` (`release-smoke.sh:469`). Wer den Ordner kopiert (NAS, USB-Stick), verliert diesen Schutz. Vorschlag: dieselbe Zeile wie `upgrade.sh:54`. Die Rechte der Dumps des Sicherungsdienstes sind UNBEKANNT (A9, W-10). |
| W-3 | `restore.sh:30-33,126-127`; `Installation.md:204` | `check_dump` prüft nur auf Plausibilität: Die Zeichenfolge `COPY public.app_user` darf irgendwo stehen, auch in einem Kommentar (der Smoke nutzt genau das, `release-smoke.sh:374`). Eingespielt wird als `wordquest`; im offiziellen Postgres-Image ist `POSTGRES_USER` Superuser (`https://github.com/docker-library/docs/blob/master/postgres/content.md`, in dieser Session abgerufen: „create the specified user with superuser power“). Beliebiges SQL einer untergeschobenen Datei läuft also mit vollen Rechten im db-Container. Das deckt das Vertrauensmodell von T-03-05 ab, denn `backups/` gehört dem Betreiber. Die Seite lädt aber ein, „eigene Sicherungen“ nach `backups/` zu legen, ohne zu sagen, dass nur eigene WordQuest-Sicherungen dorthin gehören. Vorschlag: ein Halbsatz auf der Seite. |
| W-4 | `.github/workflows/ci.yml:37,39,67,79,81,114,116,117,119,126,134` | Die Actions sind nur per Tag gepinnt (`@v5`, `@v3`, `@v6`), nicht per Commit-SHA. Der Job `images` hat `packages: write` (`:105`) und schiebt `1.0.0`, den Standard jeder neuen Installation. Ein umgehängter Tag einer Action könnte dort ein fremdes Image ablegen. Ohne `permissions:` auf Workflow-Ebene bekommen `backend` und `frontend` die Standardrechte des Repos (UNBEKANNT: Repo-Einstellung). `ci.yml` ist in Phase 3 unverändert. Vorschlag: SHA-Pins mit Versionskommentar und `permissions: contents: read` auf Workflow-Ebene. |
| W-5 | `ci.yml:131`; `docker-compose.quick.yml:24,78`; `backend/Dockerfile:9,29`; `frontend/Dockerfile:7,16`; `upgrade.sh:69` | Der feste Stand gilt nur für api und web und nur als Tag: `1.0.0` ist in GHCR veränderlich (ein erneuter Lauf zum Git-Tag `v1.0.0` überschreibt ihn), ein Digest ist nicht gepinnt. `postgres:17-alpine`, `prodrigestivill/postgres-backup-local:17` (ein Fremd-Image mit DB-Passwort und allen Familiendaten) und die Basis-Images folgen wandernden Tags. `upgrade.sh:69` lädt bei jedem Aufruf alle Dienste neu (Seite `Installation.md:121` sagt das). Das ist Bestand seit Phase 1 und unter T-03-SC („kein neues Image“) akzeptiert. Für spätere Releases: Digests für die Fremd-Images erwägen. |
| W-6 | `Installation.md:15,71-77,97`; `docker-compose.quick.yml:72` | Die Seite empfiehlt nichts Unsicheres, nennt aber zwei Grenzen nicht. (a) Die Gruppe `docker` gibt root-gleiche Rechte; die verlinkte Docker-Anleitung warnt davor (`https://docs.docker.com/engine/install/linux-postinstall/`, in dieser Session abgerufen: „The docker group grants root-level privileges to the user.“), die Seite nicht. (b) Es fehlt ein ausdrücklicher Satz, Port 8080 nicht im Router ins Internet freizugeben; WordQuest läuft ohne HTTPS und veröffentlicht den Port auf allen Schnittstellen. Die Strukturprüfung (`release-smoke.sh:670`) deckt nur drei Zeichenfolgen ab (Review 03-05 INFO, `03-05-SUMMARY.md:240`). Vorschlag: je ein Satz auf der Seite. |
| W-7 | `upgrade.sh:25,84,87` | Die Zielversion aus `.env.example` wird nicht auf ein Muster geprüft und landet unverändert im `sed`-Ersatz und in `.env`. Ein `\|` oder `&` im Wert würde `.env` verderben. Die Quelle ist das Upstream-Repo (T-03-15, akzeptiert). Vorschlag: Musterprüfung wie beim Präfix (`setup.sh:70`). |
| W-8 | `Installation.md:41`; `03-05-SUMMARY.md:179-180` | T-03-01 wirkt für neue Familien erst, wenn der Standardbranch `master` den Stand von `v1-fertig` hat: Die Seite klont ohne `--branch`. Im lokalen `master` stehen `.env.example:7` mit dem Platzhalter `ghcr.io/dein-account/wordquest` und `:11` mit `WQ_VERSION=master`, und `restore.sh` fehlt (beobachtet). Laut SUMMARY steht der entfernte `master` auf `6a918e8`. Kein Code-Mangel, sondern ein Release-Schritt vor dem Push. |
| W-9 | `restore.sh:117-128` | Annahme aus dem Verhalten von PostgreSQL, in dieser Session nicht belegt: Scheitert das Einspielen in einer COPY-Zeile, nennt die Fehlermeldung meist den Anfang der betroffenen Zeile. Bei `app_user` wären das E-Mail-Adresse und Teile des Passwort-Hashes, im Terminal (stderr von psql wird nicht umgeleitet) und im Log des db-Containers. Nicht beobachtet: Die Smoke-Fälle scheitern an `SELECT 1/0` und an `DROP`. Für eine spätere Prüfung notiert. |
| W-10 | `03-VALIDATION.md:84-89` | Die Nach-Release-Abnahme ist offen: Pi-Pull der veröffentlichten Images (letzter Baustein von T-03-02), anonymer Pull (REL-04), root-eigene Tagesdumps für `restore.sh` lesbar (A9), echter GHCR-Pull durch `upgrade.sh`, Traefik-Variante. UNBEKANNT: Ergebnisse. |
| W-11 | `03-03-SUMMARY.md:224` | Als neue Fläche gemeldet, ohne Threat-ID: `restore.sh:86-91` legt die Datenbank leer an, nur wenn `pg_database` keinen Eintrag `wordquest` hat. Geprüft: konstantes SQL ohne Eingabe, keine Daten betroffen. Kein Handlungsbedarf. |

Die SUMMARY-Dateien der Phase haben keinen Abschnitt `## Threat Flags`. Jede führt `## Bedrohungen` mit Zuordnung zu den Threat-IDs; als neue Fläche gemeldet ist nur `03-03-SUMMARY.md:224` (→ W-11).


## Behebungsstand (2026-10-18)

Behoben auf `v1-fertig` in `d669fda`, `9658805`, `1d90149` und `1ccdde4`. W-2 entspricht IN-01 aus `03-REVIEW.md`; Gate, Review und die übrigen Rot-Belege stehen dort unter „Behebungsstand“.

| Hinweis | Stand | Beleg |
|---|---|---|
| W-1 | belegt, `-f -` ergänzt (`d669fda`) | Probe im Container `postgres:17-alpine` (psql 17.11), je in einer frischen Datenbank, Strom per stdin mit `-v ON_ERROR_STOP=1`. Strom `CREATE TABLE t …; COPY public.t … FROM stdin; …; INSERT …; SELECT 1/0;`: mit `-1 -q` Exit 3, Tabelle `t` fehlt; mit `-1 -q -f -` Exit 3, Tabelle fehlt; ohne `-1` Exit 3, Tabelle vorhanden. Ohne COPY dasselbe Ergebnis. Ein Strom, der ohne Fehler abbricht, wird committet (`-1 -f -`: Exit 0, Tabelle vorhanden), dagegen hilft weiter `pipefail`. Der alte Aufruf war also schon transaktional; `-f -` stützt das auf das dokumentierte Verhalten. Konzept §14 und `03-03-SUMMARY.md:12` nennen jetzt beides. „In derselben Transaktion“ aus T-03-10 ist damit belegt |
| W-2 | behoben (`d669fda`) | `umask 077`, Smoke prüft `-rw-------` |
| W-3 | Halbsatz auf der Seite (`1d90149`) | „dorthin gehören nur Sicherungen von WordQuest“ |
| W-4 | offen, Empfehlung an Dennis | SHA-Pins und `permissions: contents: read` in `ci.yml` |
| W-5 | offen, Empfehlung an Dennis | Digests für die Fremd-Images |
| W-6 | je ein Satz auf der Seite (`1d90149`, `1ccdde4`) | Gruppe `docker` gibt Rechte wie root (Docker-Anleitung in dieser Session erneut abgerufen: „The docker group grants root-level privileges to the user.“). Port von WordQuest (8080 oder `WQ_PORT`) nicht im Router freigeben |
| W-7 | behoben (`9658805`) | `^[A-Za-z0-9._-]+$` vor der Sicherung. Smoke-Fall mit `WQ_VERSION=1.0.0\|x`: Abbruch, keine Sicherung, kein Pull. Rot mit dem alten Skript: Sicherung angelegt, geladen, dann „Die Datei .env ließ sich nicht schreiben.“ |
| W-8 bis W-11 | unverändert | Release-Schritt, spätere Prüfung, Nach-Release-Abnahme, kein Bedarf |

---

## Prüfspur

| Datum | Threats gesamt | Geschlossen | Akzeptiert | Offen | Durchgeführt von |
|-------|----------------|-------------|------------|-------|------------------|
| 2026-10-18 | 23 | 16 | 7 | 0 | gsd-security-auditor (Claude Opus 5.5), ASVS L1, block_on high |

Mechanisch geprüft in dieser Session:
- `git diff --quiet c915576..HEAD -- .github/workflows/ci.yml` → Exit 0 (unverändert).
- `git diff --name-only c915576..HEAD -- '*.csproj' '**/package.json' '**/package-lock.json' backend/Directory.Packages.props` → leer; Image-Zeilen im Diff: nur Präfix und Version sowie `--platform`.
- `git ls-files -s` → `restore.sh`, `setup.sh`, `upgrade.sh` je `100755`.
- `Documentation/Installation.md`: `chmod`, `0.0.0.0`, `curl`, `wget`, Pipe in eine Shell → je 0; `demo@` in Seite und README → 0; `demo` in `upgrade.sh` → 0.
- Keine `.smoke/`- oder `.log`-Datei im Index; kein JWT-Muster (`eyJ…`) in `.planning/phases/03-installable-1-0-0-release/` → 0; kein Skript liest `.env` per `source` → 0; `release-smoke.sh` erwähnt `secrets` nur in `:53`.
- `git check-ignore`: `secrets/` → `.gitignore:18`, `backups/` → `.gitignore:24`; Playwright ohne Trace und Screenshot (`frontend/playwright.config.ts:11`), `test-results/` und `playwright-report/` git-ignoriert.
- Abgerufen: PostgreSQL-17-Doku zu `-1` und `-f -`, Docker-Anleitung „linux-postinstall“ (Warnung zur Gruppe `docker`), Doku des Postgres-Images (`POSTGRES_USER` als Superuser).

Nicht selbst ausgeführt: Release-Smoke, Phasen-Gate, Buildx-Proben (laut Auftrag kein Docker-Stack). Die Belege stammen aus `03-05-SUMMARY.md:142-159` (16 Schritte je Exit 0 auf `be56cbf`; Release-Smoke 315 s mit `VERSION OK` bis `RELEASE-SMOKE OK`; Backend 137 und 251 passed; Frontend 230 passed; e2e 48 passed, 1 skipped), `03-03-SUMMARY.md:76-96` (Refresh 401, Access-Token 200, Fehlerpfade) und `03-04-SUMMARY.md:84-94` (Update-Fehlerpfade, Strg+C-Probe).

---

## Freigabe

- [x] Alle Threats haben eine Disposition (mitigate / accept / transfer)
- [x] Akzeptierte Risiken stehen im Abschnitt „Akzeptierte Risiken“
- [x] `threats_open: 0` bestätigt
- [x] `status: verified` im Frontmatter gesetzt

**Freigabe:** verified 2026-10-18
