#!/usr/bin/env bash
#
# Release-Smoke der Phase 3 (REL-04, REL-03): frische Installation aus einer
# Arbeitskopie des Arbeitsbaums mit lokal gebauten Images, die genau so heissen
# wie die veroeffentlichten (ghcr.io/mrhdready/wordquest-{api,web}:1.0.0).
# Eigener Compose-Projektname und Port, raeumt am Ende alles wieder ab, auch
# nach einem Abbruch mitten im Build.
#
#   bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
WORK="$(mktemp -d)"

export COMPOSE_PROJECT_NAME=wq-release
export WQ_PORT=18082
export COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml
# WQ_VERSION und WQ_IMAGE_PREFIX bewusst nicht exportieren (anders als
# setup-smoke.sh): Eine Shell-Variable schlaegt .env, dann pruefte der Smoke
# die Werte aus .env gar nicht (03-RESEARCH Pitfall 3).

EXPECTED_VERSION=1.0.0
EXPECTED_PREFIX=ghcr.io/mrhdready/wordquest
API_TAG="${EXPECTED_PREFIX}-api:${EXPECTED_VERSION}"
WEB_TAG="${EXPECTED_PREFIX}-web:${EXPECTED_VERSION}"

fail() { echo "RELEASE-SMOKE FEHLER: $*" >&2; exit 1; }

# Tags, die dieser Lauf anlegt. Sie stehen hier, bevor sie entstehen, damit
# auch ein Abbruch mitten im Build nichts zuruecklaesst (Review 03-01 MEDIUM).
CLEANUP_TAGS=""

# Bash 3.2 endet mit trap EXIT nach einer ungesetzten Variable mit Exit 0;
# deshalb zaehlt nur ein Lauf bis zum Ende als Erfolg.
SMOKE_DONE=0
cleanup() {
  # Die Dumps gehoeren unter Linux root; sonst scheitert rm -rf unten.
  (cd "$WORK" && docker compose exec -T backup sh -c 'rm -rf /backups/*' </dev/null >/dev/null 2>&1) || true
  (cd "$WORK" && docker compose down -v --remove-orphans </dev/null >/dev/null 2>&1) || true
  for tag in $CLEANUP_TAGS; do
    if docker image inspect "$tag" >/dev/null 2>&1; then
      docker image rm "$tag" >/dev/null 2>&1 || true
    fi
  done
  rm -rf "$WORK"
  [[ "$SMOKE_DONE" == 1 ]] || exit 1
}
trap cleanup EXIT

tar -C "$ROOT" \
  --exclude=.git --exclude=node_modules --exclude=bin --exclude=obj \
  --exclude=./secrets --exclude=./.env --exclude=./backups \
  -cf - . | tar -C "$WORK" -xf -
cd "$WORK"
mkdir .smoke

echo "== Version und Image-Praefix an drei Stellen (D-04)"
example_value() { sed -n "s/^$1=//p" .env.example; }
[[ "$(example_value WQ_VERSION)" == "$EXPECTED_VERSION" ]] \
  || fail ".env.example: WQ_VERSION ist '$(example_value WQ_VERSION)' statt '$EXPECTED_VERSION'."
[[ "$(example_value WQ_IMAGE_PREFIX)" == "$EXPECTED_PREFIX" ]] \
  || fail ".env.example: WQ_IMAGE_PREFIX ist '$(example_value WQ_IMAGE_PREFIX)' statt '$EXPECTED_PREFIX'."
# Standardwerte ${NAME:-wert} einer Compose-Datei, je Fundstelle eine Zeile.
compose_defaults() { grep -o "\${$1:-[^}]*}" "$2" | sed "s/^\${$1:-//; s/}\$//" || true; }
for file in docker-compose.quick.yml docker-compose.yml; do
  for pair in "WQ_VERSION $EXPECTED_VERSION" "WQ_IMAGE_PREFIX $EXPECTED_PREFIX"; do
    name="${pair% *}"; expected="${pair#* }"
    found="$(compose_defaults "$name" "$file")"
    [[ "$(printf '%s\n' "$found" | grep -c .)" == 2 ]] \
      || fail "$file: $name hat nicht genau zwei Standardwerte (api und web): $(echo $found)"
    [[ "$(printf '%s\n' "$found" | sort -u)" == "$expected" ]] \
      || fail "$file: Standardwert von $name ist '$(echo $found)' statt '$expected'."
  done
done
echo "VERSION OK"

echo "== Vorpruefung der lokalen Tags"
for tag in "$API_TAG" "$WEB_TAG"; do
  if docker image inspect "$tag" >/dev/null 2>&1; then
    fail "Das Image $tag gibt es lokal schon; der Smoke wuerde es ueberdecken und am Ende loeschen. Entferne es vorher selbst mit: docker image rm $tag"
  fi
done
# Beide fehlen: Jedes, das am Ende existiert, gehoert diesem Lauf.
CLEANUP_TAGS="$API_TAG $WEB_TAG"

echo "== Build der Images aus der Arbeitskopie (ohne .env)"
docker compose build api web </dev/null

# Anmelde-Limit (Program.cs:113-138): 10 Auth-Anfragen pro Minute je Absender,
# im Speicher der API. Gezaehlt wird je API-Start, das ist strenger als das
# Minutenfenster. Zaehler in einer Datei, weil login in $(...) laeuft.
AUTH_FILE="$WORK/.smoke/auth-budget"
auth_budget() {
  local started saved="" count=0
  started="$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q api </dev/null)")" || true
  # In $(login ...) greift set -e nicht; ein leerer Wert setzte den Zaehler still zurueck.
  [[ -n "$started" ]] || fail "Startzeit des api-Containers nicht lesbar; das Anmelde-Limit laesst sich nicht zaehlen."
  if [[ -f "$AUTH_FILE" ]]; then read -r saved count <"$AUTH_FILE"; fi
  [[ "$started" == "$saved" ]] || count=0
  count=$((count + $1))
  (( count <= 10 )) \
    || fail "Anmelde-Limit: $count Auth-Anfragen seit dem letzten API-Start (Grenze 10 pro Minute, Program.cs:113-138). Reihenfolge im Smoke prüfen."
  printf '%s %s\n' "$started" "$count" >"$AUTH_FILE"
}

login() {
  auth_budget 1
  curl -s -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    "http://localhost:${WQ_PORT}/api/v1/auth/login"
}

# Seitenabgleich (REL-03, D-10): Jeder Befehl der Installationsseite laeuft hier
# oder steht mit Grund in HANDGRIFFE; jede zitierte Ausgabe kommt in einem Log vor.
PAGE=Documentation/Installation.md
# Zeilen aus den Codebloecken einer Sprache (bash oder text), ohne Einrueckung.
page_lines() {
  awk -v lang="$1" '{ sub(/^[ \t]+/, "") }
    /^```/ { if (open) open = 0; else { open = 1; cur = substr($0, 4) } next }
    open && cur == lang' "$PAGE"
}
# Vor jedem Seitenschritt, den der Smoke ausfuehrt: Die Zeile muss woertlich in
# einem bash-Block der Seite stehen.
page_cmd() {
  [[ -f "$PAGE" ]] || fail "Die Installationsseite $PAGE fehlt."
  grep -Fxq -- "$1" <(page_lines bash) || fail "Seitenbefehl steht nicht auf $PAGE: $1"
  printf '%s\n' "$1" >>.smoke/page-cmds
}
# Befehle der Seite, die der Smoke nicht ausfuehrt: "Befehl — Grund", je eine Zeile.
HANDGRIFFE='sudo apt install git — Paketinstallation auf dem Zielgeraet; der Entwicklungsrechner hat git
sudo usermod -aG docker $USER — Gruppe docker, wirkt erst nach neuer Anmeldung
git clone https://github.com/mrhdready/WordQuest.git wordquest — der Smoke arbeitet in einer Arbeitskopie des Arbeitsbaums
cd wordquest — Ordnerwechsel nach dem Klonen; der Smoke steht schon in der Arbeitskopie
docker compose -p wordquest-quick down — alter Schnelltest, kein Smoke-Teil (D-06)
sudo chown -R "$(id -un)" backups — Ausweg aus der Meldung von setup.sh:56, braucht sudo
docker compose exec api dotnet WordQuest.Api.dll reset-password eltern@example.de — belegt in setup-smoke.sh (RESET OK)
docker compose logs api — nur Ansehen im Fehlerfall; die Startabbrueche belegt setup-smoke.sh (STARTABBRUCH OK)
hostname -I — nur auf dem Pi (Linux); macOS kennt -I nicht
./restore.sh backups/daily/wordquest-20261001.sql.gz — Beispielname; die Form mit Pfad laeuft im Smoke mit dem Tagesdump und den Testdateien'

echo "== Installation"
# Grossbuchstaben im Praefix werden abgelehnt, danach uebernimmt Enter den Standard.
page_cmd './setup.sh'
printf '%s\n' 'GHCR.io/X' '' eltern@example.de geheim-123 geheim-123 \
  | ./setup.sh 2>&1 | tee .smoke/install.log
grep -qF 'Das Image-Präfix besteht aus' .smoke/install.log || fail "Kein Hinweis auf ein ungueltiges Image-Praefix."
grep -qx "WQ_VERSION=$EXPECTED_VERSION" .env || fail ".env enthaelt nicht WQ_VERSION=$EXPECTED_VERSION."
grep -qx "WQ_IMAGE_PREFIX=$EXPECTED_PREFIX" .env || fail ".env enthaelt nicht WQ_IMAGE_PREFIX=$EXPECTED_PREFIX."
grep -qF '✓ API ist bereit.' .smoke/install.log || fail "Zeile '✓ API ist bereit.' fehlt."
grep -qF 'Fertig. WordQuest läuft unter: http://' .smoke/install.log || fail "Abschlusszeile fehlt."
if grep -qF 'geheim-123' .smoke/install.log; then fail "Ausgabe enthaelt das Passwort."; fi

running="$(docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q api </dev/null)")"
[[ "$running" == "$API_TAG" ]] || fail "api laeuft mit '$running' statt '$API_TAG'."
running="$(docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q web </dev/null)")"
[[ "$running" == "$WEB_TAG" ]] || fail "web laeuft mit '$running' statt '$WEB_TAG'."

code="$(login eltern@example.de geheim-123)"
[[ "$code" == 200 ]] || fail "Login mit dem neuen Elternkonto: HTTP $code statt 200."
echo "INSTALL OK"

echo "== Weitere Seitenschritte"
page_cmd 'docker compose version'
docker compose version </dev/null >.smoke/compose-version.log
page_cmd 'docker compose ps'
docker compose ps </dev/null >.smoke/compose-ps.log
for service in api backup db web; do
  grep -E "[[:space:]]${service}[[:space:]]" .smoke/compose-ps.log | grep -q 'Up' \
    || fail "docker compose ps zeigt den Dienst $service nicht mit Up."
done
page_cmd 'docker compose exec backup /backup.sh'
# -T: Der Smoke hat kein Terminal.
docker compose exec -T backup /backup.sh </dev/null >.smoke/backup.log 2>&1 \
  || fail "Sofortige Sicherung fehlgeschlagen."
dump="$(ls backups/daily/wordquest-*.sql.gz 2>/dev/null | head -n 1 || true)"
[[ -n "$dump" ]] || fail "Keine Datei backups/daily/wordquest-*.sql.gz nach der Sicherung."
gzip -t "$dump" || fail "$dump ist kein gueltiges gzip."

echo "== Wiederherstellung (REL-02)"
# Fingerabdruck der Fachdaten in einer Zeile, ohne refresh_token (restore.sh
# leert die Tabelle absichtlich).
FP_TABLES='tenant app_user learner_profile vocabulary_set vocabulary_entry card review_state review_log gamification_profile learning_session session_item'
fingerprint() {
  local sql="select concat_ws(' '" table
  for table in $FP_TABLES; do
    sql="$sql, (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.$table t)"
  done
  docker compose exec -T db psql -U wordquest -d wordquest -At -c "$sql)" </dev/null
}
count_rows() {
  docker compose exec -T db psql -U wordquest -d wordquest -At -c "select count(*) from public.$1" </dev/null
}
api_started() { docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q api </dev/null)"; }
# Login als Elternteil; die Tokens landen in Dateien, nie in der Ausgabe.
token() {
  local code
  auth_budget 1
  code="$(curl -s -o .smoke/login.json -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d '{"email":"eltern@example.de","password":"geheim-123"}' \
    "http://localhost:${WQ_PORT}/api/v1/auth/login" || true)"
  [[ "$code" == 200 ]] || fail "Login fuer die Tokens: HTTP $code statt 200."
  sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p' .smoke/login.json >.smoke/access-token
  sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p' .smoke/login.json >.smoke/refresh-token
  [[ -s .smoke/access-token && -s .smoke/refresh-token ]] || fail "Tokens nicht in der Login-Antwort."
}
# GET /api/v1/learners mit dem Access-Token aus der Datei; Antwort in .smoke/learners.json.
learners() {
  curl -s -o .smoke/learners.json -w '%{http_code}' \
    -H "Authorization: Bearer $(cat .smoke/access-token)" \
    "http://localhost:${WQ_PORT}/api/v1/learners" || true
}
# restore.sh startet web zuletzt neu; nginx nimmt danach erst nach einem Moment an.
wait_web() {
  local _
  for _ in $(seq 1 30); do
    curl -s -o /dev/null "http://localhost:${WQ_PORT}/" && return 0
    sleep 1
  done
  fail "web antwortet 30 s nach restore.sh nicht."
}
# restore.sh mit den Antworten auf stdin; Ausgabe in der Log-Datei und auf dem
# Terminal, Exit-Code in $status. Antworten per < <(...), nicht per Pipe: In
# einer Pipe liefe die Funktion in einer Subshell, und $status ginge verloren.
restore_run() {
  status=0
  ./restore.sh "${@:2}" >"$1" 2>&1 || status=$?
  cat "$1"
}

# Echter Lernstand: Kind, Set und eine Lernantwort ueber die Oberflaeche.
# Anmelde-Limit: globalSetup, Profilwahl und learner-login (first-run.spec.ts:11-12).
auth_budget 3
# Das Passwort steht nur fuer diesen einen Aufruf in der Umgebung.
WQ_E2E_FIRST_RUN=1 WQ_E2E_BASE_URL="http://localhost:${WQ_PORT}" \
  WQ_E2E_GUARDIAN_EMAIL=eltern@example.de WQ_E2E_GUARDIAN_PASSWORD=geheim-123 \
  npm --prefix "$ROOT/frontend" run e2e -- first-run.spec.ts </dev/null \
  || fail "Erstdurchlauf auf der Release-Installation fehlgeschlagen."
for table in learner_profile vocabulary_entry review_log; do
  [[ "$(count_rows "$table")" -ge 1 ]] || fail "Nach dem Erstdurchlauf ist $table leer."
done

token
cp .smoke/refresh-token .smoke/refresh-token-s1

page_cmd 'docker compose exec backup /backup.sh'
# -T: Der Smoke hat kein Terminal.
docker compose exec -T backup /backup.sh </dev/null >>.smoke/backup.log 2>&1 \
  || fail "Sicherung S1 fehlgeschlagen."
fp_s1="$(fingerprint)"
daily="$(ls backups/daily/wordquest-[0-9]*.sql.gz 2>/dev/null || true)"
[[ "$(printf '%s\n' "$daily" | grep -c .)" == 1 ]] || fail "Nicht genau ein Tagesdump: $(echo $daily)"

# Aenderung nach der Sicherung: das Kind loeschen.
code="$(learners)"
[[ "$code" == 200 ]] || fail "GET /api/v1/learners: HTTP $code statt 200."
child_id="$(sed -n 's/.*"id":"\([^"]*\)","displayName":"Erstes Kind".*/\1/p' .smoke/learners.json)"
[[ -n "$child_id" ]] || fail "Erstes Kind nicht in /api/v1/learners."
code="$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer $(cat .smoke/access-token)" \
  "http://localhost:${WQ_PORT}/api/v1/learners/$child_id" || true)"
[[ "$code" == 204 ]] || fail "DELETE des Kindes: HTTP $code statt 204."
[[ "$(fingerprint)" != "$fp_s1" ]] || fail "Fingerabdruck nach dem Loeschen unveraendert."

[[ -x restore.sh ]] || fail "restore.sh fehlt oder ist nicht ausfuehrbar."
page_cmd './restore.sh'
restore_run .smoke/restore.log < <(printf '%s\n' 1 ja)
[[ "$status" == 0 ]] || fail "restore.sh endete mit Exit $status."
wait_web
tail -n 1 .smoke/restore.log | tr -d '\033' | sed 's/\[[0-9;]*m//g' | grep -q '^Fertig\.' \
  || fail "Letzte Zeile von restore.sh beginnt nicht mit 'Fertig.'."
# Liste: Zeilen "  <n>) <Pfad>"; Hardlinks nur einmal, keine latest-Verweise.
sed -n 's/^ *[0-9][0-9]*) //p' .smoke/restore.log >.smoke/restore-list
[[ -s .smoke/restore-list ]] || fail "restore.sh zeigte keine Liste."
if grep -q -- '-latest\.sql\.gz$' .smoke/restore-list; then fail "latest-Verweis in der Liste."; fi
inodes="$(while IFS= read -r path; do ls -1i "$path" | awk '{ print $1 }'; done <.smoke/restore-list)"
[[ "$(printf '%s\n' "$inodes" | sort | uniq -d)" == "" ]] || fail "Zwei Eintraege mit derselben Inode."
[[ "$(printf '%s\n' "$inodes" | head -n 1)" == "$(ls -1i "$daily" | awk '{ print $1 }')" ]] \
  || fail "Eintrag 1 ist nicht der Tagesdump $daily: $(head -n 1 .smoke/restore-list)"

# Vor jeder neuen Anmeldung: Stand der Sicherung, keine erneuerbare Anmeldung.
[[ "$(fingerprint)" == "$fp_s1" ]] || fail "Fingerabdruck nach restore.sh ungleich S1."
[[ "$(count_rows refresh_token)" == 0 ]] || fail "refresh_token ist nach restore.sh nicht leer."
# /auth/refresh hat kein Anmelde-Limit (AuthEndpoints.cs:23).
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$(cat .smoke/refresh-token-s1)\"}" \
  "http://localhost:${WQ_PORT}/api/v1/auth/refresh" || true)"
echo "Refresh mit Token aus der Sicherung: HTTP $code"
[[ "$code" == 401 ]] || fail "Refresh mit dem Token aus der Sicherung: HTTP $code statt 401."
code="$(learners)"
echo "Alter Access-Token nach restore.sh: HTTP $code"
[[ "$code" == 200 ]] || fail "Alter Access-Token: HTTP $code statt 200 (laeuft erst nach 15 Minuten ab)."

before_files="$(ls backups/vor-wiederherstellung-*.sql.gz 2>/dev/null || true)"
[[ "$(printf '%s\n' "$before_files" | grep -c .)" == 1 ]] \
  || fail "Nicht genau eine Vorher-Sicherung: $(echo $before_files)"
gzip -t "$before_files" || fail "$before_files ist kein gueltiges gzip."
gunzip -c "$before_files" | tail -n 5 | grep -q 'PostgreSQL database dump complete' \
  || fail "$before_files hat die Endzeile nicht."
[[ "$(gunzip -c "$before_files" | grep -c 'Erstes Kind' || true)" == 0 ]] \
  || fail "$before_files enthaelt den Stand vor dem Loeschen."
docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null \
  || fail "API nach restore.sh nicht bereit."
token
code="$(learners)"
[[ "$code" == 200 ]] && grep -qF '"displayName":"Erstes Kind"' .smoke/learners.json \
  || fail "Erstes Kind nach restore.sh nicht da (HTTP $code)."
echo "RESTORE OK"

echo "== Wiederherstellung: Fehlerpfade (D-08, Review 03-02 HIGH)"
before_count() { ls backups/vor-wiederherstellung-*.sql.gz 2>/dev/null | grep -c . || true; }
snapshot() { fp_before="$(fingerprint)"; n_before="$(before_count)"; started_before="$(api_started)"; }
# Abgelehnt: Datenbank, Vorher-Sicherungen und laufende API wie vorher.
assert_unchanged() {
  [[ "$status" != 0 ]] || fail "$1: restore.sh endete mit Exit 0."
  [[ "$(fingerprint)" == "$fp_before" ]] || fail "$1: Fingerabdruck geaendert."
  [[ "$(before_count)" == "$n_before" ]] || fail "$1: neue Vorher-Sicherung."
  [[ "$(api_started)" == "$started_before" ]] || fail "$1: api wurde neu gestartet."
}
expect_msg() { grep -qF -- "$2" "$1" || fail "Meldung fehlt in $1: $2"; }
wait_api() {
  local _
  for _ in $(seq 1 60); do
    docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null 2>&1 && return 0
    sleep 2
  done
  fail "API nach zwei Minuten nicht bereit."
}
# Rueckfall: nie Erfolg gemeldet, Meldung nennt beide Dateien, Stand wie vorher,
# WordQuest laeuft weiter.
assert_fallback() {
  local before
  [[ "$status" != 0 ]] || fail "$2: restore.sh endete mit Exit 0."
  before="$(grep -o 'backups/vor-wiederherstellung-[0-9-]*\.sql\.gz' "$1" | tail -n 1 || true)"
  [[ -n "$before" && -f "$before" ]] || fail "$2: Meldung nennt keine vorhandene Vorher-Datei."
  expect_msg "$1" "Das Einspielen von $2 ist fehlgeschlagen. Der vorherige Stand aus $before ist wieder eingespielt"
  wait_web
  [[ "$(fingerprint)" == "$fp_before" ]] || fail "$2: Fingerabdruck nach dem Rueckfall ungleich vorher."
  wait_api
  code="$(login eltern@example.de geheim-123)"
  [[ "$code" == 200 ]] || fail "$2: Login nach dem Rueckfall: HTTP $code statt 200."
}

# Falsche Nummer, keine Zahl, dann Nummer 1 und eine andere Antwort als ja.
snapshot
restore_run .smoke/restore-eingabe.log < <(printf '%s\n' 99 x 1 nein)
[[ "$(grep -cF 'Bitte eine Nummer zwischen' .smoke/restore-eingabe.log)" == 2 ]] \
  || fail "Nicht je ein Hinweis zu 99 und x."
expect_msg .smoke/restore-eingabe.log 'Abgebrochen. Es wurde nichts geändert.'
assert_unchanged "Falsche Eingabe"

# Ende der Eingabe vor der Auswahl.
restore_run .smoke/restore-eof.log </dev/null
grep -q '^ *1) ' .smoke/restore-eof.log || fail "Ohne Eingabe keine Liste."
expect_msg .smoke/restore-eof.log 'Eingabe beendet. Es wurde nichts geändert.'
assert_unchanged "Ende der Eingabe"

# Pfad, den es nicht gibt.
restore_run .smoke/restore-fehlt.log backups/gibt-es-nicht.sql.gz </dev/null
expect_msg .smoke/restore-fehlt.log 'backups/gibt-es-nicht.sql.gz'
assert_unchanged "Fehlender Pfad"

# Fremde Datei: wird vor der Bestaetigung abgelehnt.
printf 'kaputt\n' | gzip >backups/kaputt.sql.gz
restore_run .smoke/restore-kaputt.log backups/kaputt.sql.gz < <(printf 'ja\n')
expect_msg .smoke/restore-kaputt.log 'backups/kaputt.sql.gz ist keine vollständige WordQuest-Sicherung. Es wurde nichts geändert.'
assert_unchanged "Kaputte Datei"

# Importfehler: besteht die Pruefung, scheitert beim Einspielen.
printf '%s\n' 'SELECT 1/0;' '-- COPY public.app_user' '-- PostgreSQL database dump complete' \
  | gzip >backups/fehlerhaft.sql.gz
snapshot
restore_run .smoke/restore-import.log backups/fehlerhaft.sql.gz < <(printf 'ja\n')
assert_fallback .smoke/restore-import.log backups/fehlerhaft.sql.gz

# Lesefehler: Die Datei verschwindet nach der Bestaetigung. Ohne ausdrueckliche
# Fehlerweitergabe committet psql den leeren Strom, und restore.sh meldet eine
# leere Datenbank als Erfolg (Review 03-02 HIGH).
cp "$daily" backups/lesefehler.sql.gz
snapshot
mkfifo .smoke/restore-in
./restore.sh backups/lesefehler.sql.gz <.smoke/restore-in >.smoke/restore-lesen.log 2>&1 &
restore_pid=$!
exec 3>.smoke/restore-in
seen=0
for _ in $(seq 1 60); do
  if grep -qF 'durch den Stand aus backups/lesefehler.sql.gz ersetzt' .smoke/restore-lesen.log; then
    seen=1
    break
  fi
  sleep 1
done
[[ "$seen" == 1 ]] || fail "Lesefehler: Bestaetigungssatz nach 60 s nicht in der Ausgabe."
rm backups/lesefehler.sql.gz
echo ja >&3
exec 3>&-
status=0
wait "$restore_pid" || status=$?
cat .smoke/restore-lesen.log
assert_fallback .smoke/restore-lesen.log backups/lesefehler.sql.gz

# Drop-Fehler, und auch der Rueckfall scheitert: Eine Template-Datenbank laesst
# sich nicht loeschen. Bricht der Smoke hier ab, entfernt cleanup das Volume.
db_admin() { docker compose exec -T db psql -U wordquest -d postgres -qc "$1" </dev/null; }
snapshot
db_admin 'ALTER DATABASE wordquest IS_TEMPLATE true'
restore_run .smoke/restore-drop.log "$daily" < <(printf 'ja\n')
[[ "$status" != 0 ]] || fail "Drop-Fehler: restore.sh endete mit Exit 0."
expect_msg .smoke/restore-drop.log 'Die API bleibt gestoppt'
[[ "$(before_count)" == $((n_before + 1)) ]] || fail "Drop-Fehler: keine neue Vorher-Sicherung."
newest="$(ls -t backups/vor-wiederherstellung-*.sql.gz | head -n 1)"
expect_msg .smoke/restore-drop.log "$newest"
[[ -z "$(docker compose ps --status running -q api </dev/null)" ]] \
  || fail "Drop-Fehler: api laeuft nach doppeltem Fehlschlag."
gzip -t "$newest" || fail "$newest ist kein gueltiges gzip."
gunzip -c "$newest" | tail -n 5 | grep -q 'PostgreSQL database dump complete' \
  || fail "$newest hat die Endzeile nicht."
db_admin 'ALTER DATABASE wordquest IS_TEMPLATE false'
# Weg aus der Meldung, schlimmster Fall: Die Datenbank fehlt ganz (DROP gelang,
# CREATE nicht). restore.sh legt sie leer an, sichert sie und spielt die
# genannte Datei ein (Seite; Review 03-03 MEDIUM).
db_admin 'DROP DATABASE wordquest WITH (FORCE)'
restore_run .smoke/restore-zurueck.log "$newest" < <(printf 'ja\n')
[[ "$status" == 0 ]] || fail "Weg zurueck mit $newest: restore.sh endete mit Exit $status."
wait_web
[[ "$(fingerprint)" == "$fp_before" ]] || fail "Drop-Fehler: Fingerabdruck nach dem Weg zurueck ungleich vorher."

rm -f backups/kaputt.sql.gz backups/fehlerhaft.sql.gz .smoke/restore-in
echo "RESTORE-FEHLER OK"

echo "== Update (REL-01)"
# Ab hier ohne Build-Overlay: Sonst gelten api und web als baubar, und
# pull --ignore-buildable uebersprange sie (Review 03-03 MEDIUM).
export COMPOSE_FILE=docker-compose.quick.yml
# Aeltere Version: dieselben Images unter einem zweiten Namen. Veroeffentlichte
# Images gibt es noch nicht; die Zielversion 1.0.0 stammt aus dem Build oben.
OLD_VERSION=0.0.0-smoke
OLD_API_TAG="${EXPECTED_PREFIX}-api:${OLD_VERSION}"
OLD_WEB_TAG="${EXPECTED_PREFIX}-web:${OLD_VERSION}"
for tag in "$OLD_API_TAG" "$OLD_WEB_TAG"; do
  if docker image inspect "$tag" >/dev/null 2>&1; then
    fail "Das Image $tag gibt es lokal schon; der Smoke wuerde es ueberdecken und am Ende loeschen. Entferne es vorher selbst mit: docker image rm $tag"
  fi
done
CLEANUP_TAGS="$CLEANUP_TAGS $OLD_API_TAG $OLD_WEB_TAG"
docker tag "$API_TAG" "$OLD_API_TAG"
docker tag "$WEB_TAG" "$OLD_WEB_TAG"

# .env aendern wie setup.sh: temporaere Datei statt sed -i (BSD/GNU).
set_env() {
  if grep -q "^$1=" .env; then
    sed -e "s|^$1=.*|$1=$2|" .env >.env.tmp && mv .env.tmp .env
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
}
image_of() { docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q "$1" </dev/null)"; }
backup_count() { ls backups/vor-update-*.sql.gz 2>/dev/null | grep -c . || true; }
# Die Sicherung aus der Ausgabe von upgrade.sh, nicht aus ls.
upd_file() { grep -o 'backups/vor-update-[0-9-]*\.sql\.gz' "$1" | tail -n 1 || true; }
# Sicherung vor dem Update: vorhanden, vollstaendig, mit dem Lernstand.
check_upd_backup() {
  [[ -n "$1" && -f "$1" ]] || fail "Die Sicherung '$1' aus der Ausgabe von upgrade.sh gibt es nicht."
  gzip -t "$1" || fail "$1 ist kein gueltiges gzip."
  gunzip -c "$1" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || fail "$1 hat die Endzeile nicht."
  [[ "$(gunzip -c "$1" | grep -c 'Erstes Kind' || true)" -gt 0 ]] || fail "$1 enthaelt 'Erstes Kind' nicht."
}

set_env WQ_VERSION "$OLD_VERSION"
docker compose up -d </dev/null
wait_api
wait_web
[[ "$(image_of api)" == "$OLD_API_TAG" ]] || fail "api laeuft vor dem Update mit '$(image_of api)' statt '$OLD_API_TAG'."
for table in learner_profile vocabulary_entry review_log; do
  [[ "$(count_rows "$table")" -ge 1 ]] || fail "Vor dem Update ist $table leer."
done
fp_f0="$(fingerprint)"

# Pull-Spy (Review 03-03 MEDIUM): Ein docker vorn im PATH protokolliert bei
# "docker compose pull" die Zielversion aus der Umgebung und den Stand der .env
# und meldet Erfolg; alles andere geht an das echte docker. Nur aktiv mit
# WQ_SPY_PULL=ok, also nur fuer die Aufrufe von upgrade.sh mit Spy.
SPY_DIR="$WORK/.smoke/spy"
SPY_LOG="$WORK/.smoke/spy-pull"
REAL_DOCKER="$(command -v docker)"
mkdir "$SPY_DIR"
: >"$SPY_LOG"
cat >"$SPY_DIR/docker" <<EOF
#!/usr/bin/env bash
if [[ "\${WQ_SPY_PULL:-}" == ok && "\${1:-}" == compose && "\${2:-}" == pull ]]; then
  printf 'ziel=%s env=%s\n' "\${WQ_VERSION:-}" "\$(sed -n 's/^WQ_VERSION=//p' .env | tail -n 1)" >>"$SPY_LOG"
  exit 0
fi
exec "$REAL_DOCKER" "\$@"
EOF
chmod +x "$SPY_DIR/docker"
spy_lines() { grep -c . "$SPY_LOG" || true; }
# upgrade.sh ohne Eingabe, mit Spy, wenn $2 = spy. Exit-Code in $status, wie restore_run.
upgrade_run() {
  status=0
  if [[ "${2:-}" == spy ]]; then
    PATH="$SPY_DIR:$PATH" WQ_SPY_PULL=ok ./upgrade.sh </dev/null >"$1" 2>&1 || status=$?
  else
    ./upgrade.sh </dev/null >"$1" 2>&1 || status=$?
  fi
  cat "$1"
}

[[ -x upgrade.sh ]] || fail "upgrade.sh fehlt oder ist nicht ausfuehrbar."
[[ "$(backup_count)" == 0 ]] || fail "Vor dem Update gibt es schon eine Sicherung vor-update-*."
upgrade_run .smoke/upgrade.log spy
[[ "$status" == 0 ]] || fail "upgrade.sh endete mit Exit $status."
expect_msg .smoke/upgrade.log '✓ Sicherung geprüft:'
upd="$(upd_file .smoke/upgrade.log)"
last="$(tail -n 1 .smoke/upgrade.log | tr -d '\033' | sed 's/\[[0-9;]*m//g')"
[[ "$last" == "Fertig. WordQuest läuft jetzt mit Version $EXPECTED_VERSION. Die Sicherung von vorher liegt in $upd." ]] \
  || fail "Letzte Zeile von upgrade.sh: $last"
echo "Spy-Protokoll: $(cat "$SPY_LOG")"
[[ "$(cat "$SPY_LOG")" == "ziel=$EXPECTED_VERSION env=$OLD_VERSION" ]] \
  || fail "Spy-Protokoll nicht genau eine Zeile mit Zielversion $EXPECTED_VERSION bei .env $OLD_VERSION: $(cat "$SPY_LOG")"
[[ "$(backup_count)" == 1 ]] || fail "Nicht genau eine Sicherung vor-update-*."
check_upd_backup "$upd"
grep -qx "WQ_VERSION=$EXPECTED_VERSION" .env || fail ".env enthaelt nach dem Update nicht WQ_VERSION=$EXPECTED_VERSION."
[[ "$(image_of api)" == "$API_TAG" ]] || fail "api laeuft nach dem Update mit '$(image_of api)' statt '$API_TAG'."
[[ "$(image_of web)" == "$WEB_TAG" ]] || fail "web laeuft nach dem Update mit '$(image_of web)' statt '$WEB_TAG'."
docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null \
  || fail "API nach upgrade.sh nicht bereit."
# Vor jeder Anmeldung: Kinder, Sets und Lernstand unveraendert.
[[ "$(fingerprint)" == "$fp_f0" ]] || fail "Fingerabdruck nach dem Update ungleich vorher."
wait_web
token
code="$(learners)"
[[ "$code" == 200 ]] && grep -qF '"displayName":"Erstes Kind"' .smoke/learners.json \
  || fail "Erstes Kind nach dem Update nicht da (HTTP $code)."
# Die Sicherung steht in der Liste von restore.sh (D-07).
restore_run .smoke/restore-nach-update.log </dev/null
grep -q '^ *[0-9][0-9]*) backups/vor-update-' .smoke/restore-nach-update.log \
  || fail "Die Sicherung vor dem Update fehlt in der Liste von restore.sh."
expect_msg .smoke/restore-nach-update.log 'Eingabe beendet. Es wurde nichts geändert.'
echo "UPDATE OK"

echo "== Seite gegen den Lauf"
# Nur bash- und text-Bloecke werden geprueft; ein anderer Block liefe still vorbei.
other="$(awk '{ sub(/^[ \t]+/, "") } /^```/ { if (open) open = 0; else { open = 1; lang = substr($0, 4); if (lang != "bash" && lang != "text") print NR ": " $0 } }' "$PAGE")"
[[ -z "$other" ]] || fail "Codeblock ohne Sprache bash oder text auf $PAGE, Zeile $other"
checked=0
printf '%s\n' "$HANDGRIFFE" | sed 's/ — .*//' >.smoke/handgriffe
while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  grep -Fxq -- "$line" .smoke/page-cmds .smoke/handgriffe || fail "Seitenbefehl ohne Beleg: $line"
  checked=$((checked + 1))
done < <(page_lines bash)
[[ "$checked" -gt 0 ]] || fail "Keine Befehlszeile auf $PAGE gefunden; der Abgleich liefe leer."
checked=0
# Zitierte Ausgaben: Veraenderliche Teile stehen in spitzen Klammern; jedes feste
# Stueck ab 6 Zeichen muss in einem Log dieses Laufs vorkommen.
while IFS= read -r piece; do
  grep -Fq -- "$piece" .smoke/*.log || fail "Seitenausgabe nicht beobachtet: $piece"
  checked=$((checked + 1))
done < <(page_lines text | awk '{ gsub(/<[^>]*>/, "\n"); print }' | awk 'length($0) >= 6')
[[ "$checked" -gt 0 ]] || fail "Keine zitierte Ausgabe auf $PAGE gefunden; der Abgleich liefe leer."
echo "SEITE OK"

SMOKE_DONE=1
echo "RELEASE-SMOKE OK"
