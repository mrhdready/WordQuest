---
phase: 03-installable-1-0-0-release
reviewed: 2026-10-18T13:35:49Z
depth: deep
diff_base: c915576
diff_head: 86e46d8
files_reviewed: 13
files_reviewed_list:
  - setup.sh
  - upgrade.sh
  - restore.sh
  - docker-compose.yml
  - docker-compose.quick.yml
  - .env.example
  - backend/Dockerfile
  - frontend/Dockerfile
  - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
  - Documentation/Installation.md
  - Documentation/README.md
  - Documentation/WordQuest_Konzept_und_Architektur.md
  - README.md
findings:
  critical: 0
  high: 0
  medium: 1
  low: 2
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 03: Code Review Report (phasenweit)

**Reviewed:** 2026-10-18T13:35:49Z
**Depth:** deep (Skripte ↔ Compose ↔ Dockerfiles ↔ CI ↔ Installationsseite, Fehlerpfade in `upgrade.sh`/`restore.sh` einzeln durchgegangen)
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Geprüft wurde `git diff c915576..86e46d8` über `setup.sh`, `upgrade.sh`, `restore.sh`, `docker-compose*.yml`, `.env.example`, beide Dockerfiles, den Release-Smoke, `Documentation/` und `README.md`. Kontext: `03-CONTEXT.md`, `03-RESEARCH.md`, `03-REVIEWS.md`, die SUMMARYs 03-01 bis 03-05, `03-VALIDATION.md` und AGENTS.md. Nicht erneut aufgeführt sind Befunde, die in den Review-Abschnitten der SUMMARYs schon als behoben oder begründet zurückgewiesen stehen. Das betrifft vor allem 03-03 #1 bis #8 und 03-04 #1 bis #9: erneuter Aufruf nach gescheitertem Update, `git pull` beim Weg zurück, Strg+C während `pg_dump`, Restore-Rat ohne Migration, Trennung web/api beim Fehlschlag, root-eigene Dumps (A9). Ebenso nicht aufgeführt sind `sed … && mv` ohne `die` in `setup.sh:75` (03-04, bewusst nicht angefasst), `$BUILDPLATFORM` ohne BuildKit und die Kleinschreibung des Image-Namens (03-02 INFO) sowie `setup.sh:178` „Verwalten → Kinder“ (03-05, Befunde für später).

Die Kernpunkte halten der Prüfung stand. Die Reihenfolge prüfen → sichern → laden → `.env` → starten ist richtig. Jede Funktion, die über `if`/`||` läuft, gibt ihre Fehler selbst weiter, denn dort greift `set -e` nicht. `pipefail` deckt Sicherung und Einspielen ab, und alle Docker-Aufrufe lesen aus `/dev/null`. Der Rückfall in `restore.sh` und die Traps sind korrekt. Die Dockerfiles liefern auf arm64 echte arm64-Binaries (siehe „Geprüft, ohne Befund“). Es gibt keinen BLOCKER. Am schwersten wiegt ein Secrets-Befund: `upgrade.sh` schreibt `.env` neu und setzt dabei die Dateirechte auf die umask zurück. In der Traefik-Variante steht in `.env` der DNS-API-Token. Dazu kommen ein Fenster, in dem Lernstand nicht in der Sicherung landet, und der Installationskanal `master`.

Schweregrade: high = BLOCKER, medium/low = WARNING, info = INFO. Kein Befund wurde im Docker-Stack ausgeführt. Belegt sind sie durch Datei und Zeile und, wo genannt, durch Bash-3.2-Proben (`/bin/bash` 3.2.57, macOS) in einem Wegwerfordner. Bash 5 und shellcheck sind auf diesem Host nicht installiert (`command -v` leer). Die Proben decken deshalb nur Bash 3.2 ab.

## Medium

### WR-01: `upgrade.sh` macht `.env` für alle lesbar, in der Traefik-Variante samt DNS-API-Token

**Klassifikation:** WARNING · **Konfidenz:** hoch (Probe mit gleichem Befehl)
**Files:** `upgrade.sh:84`, `:87`, `.env.example:31-34`, `docker-compose.yml:97`, `.gitignore:19`

**Mechanismus:** `sed -e "s|^WQ_VERSION=.*|…|" .env >.env.tmp && mv .env.tmp .env` legt eine neue Datei an. Ihre Rechte kommen aus der umask (Raspberry Pi OS: 022), nicht von der alten `.env`. Probe in Bash 3.2 mit demselben Befehl auf eine Datei mit `0600`: vorher `-rw-------`, nachher `-rw-r--r--`. In der Traefik-Variante gehört `CF_DNS_API_TOKEN` in `.env` (`.env.example:34`, `docker-compose.yml:97`). Ein Betreiber, der `.env` deshalb auf `0600` gesetzt hat, bekommt sie nach jedem `./upgrade.sh` still als `0644` zurück. Der Ordner liegt typischerweise in `/home/<user>/wordquest` und ist damit für andere lokale Konten lesbar. Scheitert `mv`, bleibt außerdem `.env.tmp` als Kopie mit Token liegen. `.gitignore` deckt nur `.env` ab (Z. 19), `git status` zeigt die Datei dann als unversioniert.

**Wirkung:** Ein Cloudflare-Token mit DNS-Schreibrecht ist für jeden lokalen Benutzer lesbar. Die Schnellstart-Variante ist nicht betroffen, weil ihre `.env` keine Secrets enthält. Der Fehler sitzt aber im gemeinsamen Update-Weg, den README und Seite ausdrücklich auch für Variante B nennen.

**Fix (minimal, BSD/GNU):** Die Rechte über eine Kopie mitnehmen. Eine Umleitung in eine bestehende Datei behält deren Modus:
```bash
cp -p .env .env.tmp && sed -e "s|^WQ_VERSION=.*|WQ_VERSION=${target}|" .env >.env.tmp && mv .env.tmp .env \
  || { rm -f .env.tmp; die "…"; }
```
Dazu `.env.tmp` in `.gitignore`. Die Rechte nach dem Update belegt ein Smoke-Schritt: `chmod 600 .env` vor `upgrade_run`, danach `-rw-------` prüfen. `setup.sh:75` legt `.env` ebenfalls mit `0644` an. Das ist alt und steht hier nur zur Kenntnis.

## Low

### WR-02: Lernstand aus der Wartezeit fehlt in der Sicherung, der Weg zurück verwirft ihn ohne Hinweis

**Klassifikation:** WARNING · **Konfidenz:** hoch (Codepfad), Dauer des Fensters nicht gemessen
**Files:** `upgrade.sh:52-61`, `:68-70`, `:95`, `restore.sh:93-108`, `Documentation/Installation.md:109`, `:140-146`

**Mechanismus:** `upgrade.sh` sichert, *dann* lädt es die neuen Images (`docker compose pull`), und erst `up -d` ersetzt die API. Während des Pulls läuft die alte API weiter und nimmt Antworten an. Auf einem Pi im Heimnetz dauert das Laden zweier Images mehr als ein paar Sekunden. Was Kinder in dieser Zeit lernen, steht nicht in `vor-update-…`. Scheitert der Start danach, nennt die Meldung genau diese Datei als Weg zurück (`upgrade.sh:75`). Wer ihn geht, verliert den Lernstand aus dem Fenster, und weder Meldung noch Seite sagen das. Die Seite verspricht „Deine Kinder, Vokabeln und der Lernstand bleiben dabei erhalten“ (Z. 109). Das gilt nur für den Erfolgsfall. In `restore.sh` gibt es dasselbe Muster, nur kürzer: Die Vorher-Sicherung läuft bei laufender API (Z. 101), `stop api` folgt erst danach (Z. 108).

Abgrenzung zu 03-04 #8: Dort ging es darum, *ob* der Restore-Rat passt, wenn nichts migriert ist. Zurückgewiesen wurde das mit „zwischen Sicherung und Fehlschlag liegt nur das Update selbst“. Dieser Befund betrifft genau dieses Stück: Der Pull gehört zum Update, und während des Pulls wird weiter geschrieben.

**Fix:** Den Pull vor die Sicherung ziehen: Pull → Sicherung → `.env` → `up -d`. Der Pull ändert nichts am laufenden Stand, damit bleiben die Aussage „Bevor es etwas ändert, sichert es“ und „Es wurde nichts geändert“ bei einem Ladefehler wahr. Das widerspricht dem Wortlaut von D-05 („Ohne geprüfte Sicherung wird nichts gezogen“), deshalb braucht es eine Entscheidung. Ohne Änderung an D-05 reicht ein Satz auf der Seite und in `start_failed`: Was nach der Sicherung gelernt wurde, fehlt nach dem Weg zurück.

### WR-03: Installationskanal ist `master`, nicht ein Release

**Klassifikation:** WARNING · **Konfidenz:** mittel (Mechanismus belegt; ob `master` zwischen Releases Entwicklungsstände bekommt, ist offen)
**Files:** `Documentation/Installation.md:41`, `:105`, `.env.example:14-16`, `.github/workflows/ci.yml:4-6`, Kontext `03-RESEARCH.md:282`, `03-05-SUMMARY.md:179`, STATE (Regel 03-04)

**Mechanismus:** Die Seite klont den Standardbranch, und das Update ist `git pull` auf diesem Branch. Gepinnt ist nur das Image (`WQ_VERSION`). Die Skripte, die Compose-Dateien und die per Bind-Mount eingebundene `frontend/nginx-traefik-realip.conf` (`docker-compose.yml:69`) kommen aus `master`-HEAD. Die CI baut bei jedem Push auf `master` (`ci.yml:4-5`), `master` ist also als Entwicklungszweig angelegt. Landet dort zwischen zwei Releases ein Commit, laufen Eltern nach `git pull && ./upgrade.sh` mit unveröffentlichten Skripten und Compose-Dateien gegen das Image der letzten Version. Die Regel aus 03-04 („Compose-Änderungen bleiben mit der Vorversion lauffähig“) deckt nur die Richtung neu → alt beim Weg zurück ab. Unveröffentlichte Stände auf `master` deckt sie nicht ab. `03-RESEARCH.md:282` verwirft das Klonen eines Tags wegen des detached HEAD und behandelt den Kanal sonst nicht.

UNBEKANNT: ob `master` nach 1.0.0 nur zu Releases bewegt wird. Wenn ja, entfällt der Befund, und diese Regel gehört dann als Satz in AGENTS.md oder STATE.

**Fix (eine Stelle):** Ein Branch `stable`, der nur beim Release vorgespult wird. Auf der Seite `git clone --branch stable …`, `git pull` bleibt unverändert. Alternativ die Regel „`master` = letztes Release“ ausdrücklich festhalten und in der CI durchsetzen.

## Info

### IN-01: Vorher-Sicherung von `restore.sh` ist `0644`, die von `upgrade.sh` `0600`

**Files:** `restore.sh:95`, Gegenstück `upgrade.sh:54`
`backup_now` in `restore.sh` schreibt ohne `umask 077`. Geschützt ist die Datei nur über `chmod 700 backups` (Z. 80). Kopiert ein Elternteil sie auf einen Stick oder in eine Freigabe, behält sie `0644`. 03-04 #6 hat das für `upgrade.sh` behoben, die Kopie in `restore.sh` blieb. **Fix:** `(umask 077 && docker compose exec … | gzip >"$1") || return 1` wie in `upgrade.sh:54`.

### IN-02: Anhängen an eine `.env` ohne Zeilenende verklebt die letzte Variable

**Files:** `upgrade.sh:87`
Probe in Bash 3.2 mit `.env`-Inhalt `…\nWQ_PORT=9000` (ohne Zeilenende) → Ergebnis `WQ_PORT=9000WQ_VERSION=1.0.0`. Der Port ist dann kaputt, und `WQ_VERSION` ist nicht gesetzt (Compose nimmt seinen Standard). Der Zweig ist laut 03-04 praktisch unerreichbar. Erreichbar wird er, wenn jemand die Zeile `WQ_VERSION` von Hand löscht, und die Seite (Z. 77, 123) lässt Eltern `.env` von Hand bearbeiten. **Fix:** vorher ein Zeilenende sicherstellen, z. B. `[[ -z "$(tail -c1 .env)" ]] || echo >>.env`.

### IN-03: `.env.example` verbietet, was der Weg zurück verlangt

**Files:** `.env.example:14-15`, `upgrade.sh:75`, `Documentation/Installation.md:140`
Der Kommentar „nicht von Hand aendern“ steht auch in jeder `.env`, weil `setup.sh` sie aus `.env.example` kopiert. Die Meldung von `upgrade.sh` und die Seite lassen Eltern genau diese Zeile von Hand ändern. **Fix:** „Aendert upgrade.sh; von Hand nur für den Weg zurück nach einem gescheiterten Update (siehe Installationsseite).“

### IN-04: Pfad-Argument von `restore.sh` gilt relativ zum Installationsordner, nicht zum Aufrufort

**Files:** `restore.sh:12`, `:37`, `Documentation/Installation.md:198-202`
`cd "$(dirname "$0")"` läuft vor `file="$1"`. `~/wordquest/restore.sh ../sicherung.sql.gz` aus einem anderen Ordner sucht die Datei deshalb relativ zu `~/wordquest`. Die Folge ist „gibt es nicht“ (harmlos) oder schlimmstenfalls eine andere Datei mit demselben relativen Namen. Die Seite ruft immer im Ordner auf, deshalb nur Info. **Fix:** Pfad vor dem `cd` absolut machen oder im Hilfetext „Pfad relativ zum Ordner `wordquest`“ sagen.

### IN-05: Kein automatischer Lauf belegt `COMPOSE_FILE` aus `.env`

**Files:** `release-smoke.sh:17`, `.planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh:17`, `.env.example:7`
Beide Smokes exportieren `COMPOSE_FILE` in der Shell, und die Shell schlägt `.env`. Der Standardweg der Eltern, bei dem Compose die Variante aus `.env` liest, läuft deshalb in keinem Gate. Nach dem Wechsel auf `export COMPOSE_FILE=docker-compose.quick.yml` (Z. 438) wäre das ab dem Update-Teil billig zu haben: `unset COMPOSE_FILE`, dann steuert `.env` den Lauf.

### IN-06: Seite nennt die Version im Fließtext, der Smoke prüft das nicht

**Files:** `Documentation/Installation.md:55`
„Danach lädt es WordQuest in der Version 1.0.0“ steht außerhalb eines text-Blocks. Weder der Seitenabgleich noch die Versionsprüfung (`release-smoke.sh:58-76`) prüfen diese Stelle. Beim nächsten Release bleibt sie still stehen. **Fix:** „in der Version aus `.env.example`“ oder die Zeile in die Versionsprüfung des Smokes aufnehmen.

## Geprüft, ohne Befund

- **Dockerfiles / `--platform=$BUILDPLATFORM`:** Das arm64-Image enthält echte arm64-Binaries. Der Weg dahin: Der Build-Stage (`backend/Dockerfile:9`) erzeugt mit `dotnet publish … /p:UseAppHost=false` ohne `-r` reine IL (`:25-26`). Ohne `UseAppHost=false` läge eine amd64-Apphost-Datei im arm64-Image, so entsteht keine. Alle nativen Teile (`dotnet`-Host, CoreCLR, ICU über `icu-libs`) kommen aus `aspnet:10.0-alpine` im Runtime-Stage, und der wird je `TARGETPLATFORM` gezogen (`:28`, ohne `--platform`). `ENTRYPOINT ["dotnet", "WordQuest.Api.dll"]` braucht keinen Apphost. Framework-abhängig reicht damit, ein RID je `TARGETARCH` ist nicht nötig. Beleg ohne Docker: Die lokale `backend/src/WordQuest.Api/obj/project.assets.json` hat 0 `runtimeTargets` und keinen Pfad `runtimes/…`. Kein Paket bringt also RID-spezifische Assets. Npgsql, EF Core und JwtBearer sind rein verwaltet, `EntityFrameworkCore.Design` hat `PrivateAssets=all` (`WordQuest.Api.csproj:23`). Kommt später ein Paket mit nativen Teilen dazu, legt ein portables Publish alle `runtimes/<rid>/native` ab und löst sie zur Laufzeit über `deps.json` auf. Auch dann bleibt das korrekt. Beim Frontend (`frontend/Dockerfile:7`) laufen esbuild, rollup und oxide nur im Build und passend zur Build-Plattform, ins Image kommt nur `dist/`. `ci.yml` behält `setup-qemu-action`, das braucht der Runtime-Stage für `RUN apk add` auf arm64.
- **`set -e`-Fallen:** `backup_now` (`upgrade.sh:52-56`, `restore.sh:94-100`), `load_dump` (`restore.sh:115-129`) und `start_app` (`:133-144`) laufen über `if`/`||` und geben jeden Teilschritt mit `|| return 1` weiter. `$(…)` mit `|| true` bzw. `|| die` stehen in eigenen Zuweisungen. `grep -c … || true` liefert `0` und kein leeres Ergebnis. `tail`/`grep -c` lesen den ganzen `gunzip`-Strom, deshalb gibt es keinen SIGPIPE unter `pipefail`.
- **Bash 3.2:** leeres Array unter `set -u` (`restore.sh:50`): Probe `(( ${#files[@]} > 0 )) || …` endet ohne „unbound variable“. Außerdem `files+=()`, `read -rp`, `[[ =~ {0,5} ]]` und `local _` in `for`. Die Nummer wird per Regex geprüft, bevor `(( ))` sie liest, deshalb ist keine Arithmetik-Injektion möglich. `ls -1ti` + `awk sub()` behalten Leerzeichen im Namen.
- **Traps:** Bash führt einen gesetzten INT/TERM-Trap aus, nachdem der laufende Vordergrundbefehl endet. Damit kommt die Meldung auch nach Strg+C während `docker compose up -d` oder `psql`. In `restore.sh` steht der Trap um das Einspielen und den Rückfall (Z. 148-160), in `upgrade.sh` vor dem Schreiben der `.env` (Z. 80).
- **Halbe Zustände:** `restore.sh` prüft die Datei vor jeder Änderung (Z. 69), legt eine fehlende DB leer an (Z. 88-91) und spielt per `psql -1 -v ON_ERROR_STOP=1` in eine neue DB ein. Scheitert das, spielt es die Vorher-Datei zurück, und die API bleibt bei doppeltem Fehlschlag gestoppt. `upgrade.sh` ändert `.env` erst nach erfolgreichem Pull. Jeder Fehler danach endet in `start_failed` mit Datei und Version.
- **Secrets in Ausgaben:** Kein Skript gibt den Inhalt von `secrets/` oder Tokens aus. Der Smoke prüft das Passwort im Install-Log (`release-smoke.sh:155`) und legt Tokens nur in Dateien unter `$WORK` ab.
- **Seite ↔ Skripte:** Alle zitierten Meldungen stimmen wörtlich: `upgrade.sh:28/62/68/70/76/92/97/111/113` und `restore.sh:52/73/105/154/162/165`. Dasselbe gilt für Port, Aufbewahrung 14/8/6, `docker compose ps` mit vier Diensten (Schnellstart), Ordnerrechte `0700` und die Hardlink-Entdopplung, die zum Listenbeispiel Z. 182-183 passt (zwei Läufe am selben Tag: `daily` = neues `last`, altes `last` einzeln). Die Konzept-Aussagen zu §14 decken sich mit `upgrade.sh`/`restore.sh`/`ci.yml:3-8`.

## Behebungsstand (2026-10-18)

Behoben auf `v1-fertig` in `d669fda`, `9658805`, `0b8aa34`, `1d90149` und `1ccdde4`. Rot vor dem Fix: Probe mit Fake-`docker` unter `/bin/bash` 3.2 gegen `git show 3717bda:upgrade.sh` bzw. `:restore.sh`, umask 022, dazu ein Release-Smoke mit den neuen Prüfungen gegen die alten Skripte (endete bei W-2/IN-01).

| Befund | Stand | Commit | Beleg |
|---|---|---|---|
| WR-01 | behoben | `9658805` | `cp -p` vor der Umleitung, `rm -f .env.tmp` im Fehlerpfad, `.env.tmp` in `.gitignore`. Smoke: `chmod 600 .env` vor dem Update, danach gleiche Rechte und keine `.env.tmp`. Rot: `-rw-------` → `-rw-r--r--` |
| WR-02 | Satz auf der Seite (Update), Code unverändert | `1d90149` | „Starte das Update, wenn gerade niemand lernt …“. Kein Satz bei `restore.sh` (Review-Befund LOW zurückgewiesen): Dort sichert nur `pg_dump` vor dem Stopp, kein Laden von Images; die Vorher-Datei dient nur dazu, eine Wiederherstellung zurückzudrehen |
| WR-03 | offen, Empfehlung an Dennis | – | Branch-Modell `master`/`stable` ist eine Release-Entscheidung |
| IN-01 | behoben | `d669fda` | `umask 077` wie in `upgrade.sh`. Smoke prüft `-rw-------`. Rot im Release-Smoke: `… vor-wiederherstellung-….sql.gz ist nicht nur fuer den Besitzer lesbar: -rw-r--r--` |
| IN-02 | behoben | `9658805` | Zeilenende vor dem Anhängen. Smoke: zweiter Aufruf mit `.env` ohne `WQ_VERSION` und ohne letztes Zeilenende. Rot: `WQ_PORT=9000WQ_VERSION=1.0.0` |
| IN-03 | behoben | `1d90149` | Kommentar: `upgrade.sh` trägt den Wert ein, von Hand nur für den Weg zurück. Bestehende `.env` behalten den alten Kommentar |
| IN-04 | behoben | `d669fda` | Pfad wird vor dem `cd` aufgelöst, im Installationsordner bleibt er wie eingegeben. Smoke: Aufruf aus `.smoke/`. Rot: „Die Datei ../backups/s.sql.gz gibt es nicht.“ |
| IN-05, IN-06 | offen, nicht im Auftrag | – | – |
| `setup.sh:178` | behoben | `0b8aa34` | „Lege unter „Kinder“ das erste Kind an, dann unter „Vokabeln“ ein Vokabelset.“ (`ManageLayout.tsx:8-11`), Seite folgt |

Gate: `bash -n` für fünf Skripte ok. Release-Smoke zweimal grün mit allen Markern bis `RELEASE-SMOKE OK`, zuletzt auf `1ccdde4`. `setup-smoke.sh` grün (`SMOKE OK`, 79 s). Backend und Frontend nicht berührt. Review per `claude -p`, nur lesend: 0 BLOCKER, 0 HIGH, 1 MEDIUM (Beleg zu W-1 fehlte im Diff, jetzt in `03-SECURITY.md`), 2 LOW (Port mit eigenem `WQ_PORT`, behoben in `1ccdde4`; WR-02 bei `restore.sh`, zurückgewiesen), 4 INFO ohne Änderung.

---

_Reviewed: 2026-10-18T13:35:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
