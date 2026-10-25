#!/usr/bin/env bash
#
# Release-Smoke der Phase 3 (REL-04, REL-03) und 03.1 (D-16): frische
# Installation aus dem lokal gebauten Release-Paket, so wie Eltern sie ohne Git
# machen (curl | tar xz, ./setup.sh), mit lokal gebauten Images, die genau so
# heissen wie die veroeffentlichten (ghcr.io/mrhdready/wordquest-{api,web}:$EXPECTED_VERSION).
# Paket und Images entstehen aus einer Arbeitskopie des Arbeitsbaums ($WORK/src),
# das Paket kommt von einem lokalen HTTP-Server (127.0.0.1:18083). Das Update
# (03.1-06) laedt die Zielimages echt aus einer lokalen Registry (registry:2,
# per Digest gepinnt, nur auf 127.0.0.1:18084; Freigabe D-22).
# Eigener Compose-Projektname und Port, raeumt am Ende alles wieder ab, auch
# nach einem Abbruch mitten im Build.
#
# Nur Bash-3.2-Mittel, weil der Smoke unter macOS mit /bin/bash 3.2 laeuft
# (verbotene Mittel: 03.1-05-PLAN.md, Flagged Assumptions).
#
#   bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
WORK="$(mktemp -d)"
# Quellbaum fuer Build und Paket; installiert wird daneben aus dem Paket.
SRC="$WORK/src"
INST="$WORK/wordquest"

export COMPOSE_PROJECT_NAME=wq-release
export WQ_HTTP_PORT=18082
export WQ_HTTPS_PORT=18442
export COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml
# WQ_VERSION und WQ_IMAGE_PREFIX bewusst nicht exportieren (anders als
# setup-smoke.sh): Eine Shell-Variable schlaegt .env, dann pruefte der Smoke
# die Werte aus .env gar nicht (03-RESEARCH Pitfall 3).

EXPECTED_VERSION=1.0.1
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
HTTP_PID=""
# Lokale Registry fuer den echten Pull im Update (Codex-Review 05 HIGH, D-22).
REGISTRY_IMAGE=registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373
REGISTRY_NAME=wq-release-registry
REGISTRY_STARTED=0
cleanup() {
  # wait: sonst meldet Bash den beendeten Server mit "Terminated".
  if [[ -n "$HTTP_PID" ]]; then kill "$HTTP_PID" 2>/dev/null || true; wait "$HTTP_PID" 2>/dev/null || true; fi
  # Die Dumps gehoeren unter Linux root: Nach einem gruenen Lauf loescht sie der
  # Container, nach einem roten bekommt sie der Nutzer (der Ordner bleibt liegen).
  if [[ "$SMOKE_DONE" == 1 ]]; then
    (cd "$INST" && docker compose exec -T backup sh -c 'rm -rf /backups/*' </dev/null >/dev/null 2>&1) 2>/dev/null || true
  else
    (cd "$INST" && docker compose exec -T backup chown -R "$(id -u):$(id -g)" /backups </dev/null >/dev/null 2>&1) 2>/dev/null || true
  fi
  (cd "$INST" && docker compose down -v --remove-orphans </dev/null >/dev/null 2>&1) 2>/dev/null || true
  if [[ "$REGISTRY_STARTED" == 1 ]]; then
    docker rm -f -v "$REGISTRY_NAME" >/dev/null 2>&1 || true
    # Docker Desktop gibt den Port erst Sekunden nach dem Entfernen frei; ein
    # direkt folgender Lauf oder eine Nachpruefung saehe ihn sonst belegt.
    for _ in $(seq 1 30); do
      lsof -nP -iTCP:18084 -sTCP:LISTEN >/dev/null 2>&1 || break
      sleep 1
    done
  fi
  for tag in $CLEANUP_TAGS; do
    if docker image inspect "$tag" >/dev/null 2>&1; then
      docker image rm "$tag" >/dev/null 2>&1 || true
    fi
  done
  # Roter Lauf: Installationsordner mit Dumps und Logs zur Untersuchung behalten
  # (03.1-05: restore.sh hielt einmal den Tagesdump fuer unvollstaendig).
  if [[ "$SMOKE_DONE" != 1 && -d "$INST" ]]; then
    keep="${TMPDIR:-/tmp}/wq-release-smoke-rot-$(date +%Y%m%d-%H%M%S)"
    mv "$INST" "$keep" 2>/dev/null && echo "Installationsordner des roten Laufs: $keep (danach loeschen mit: rm -rf $keep)" >&2
  fi
  rm -rf "$WORK"
  [[ "$SMOKE_DONE" == 1 ]] || exit 1
}
trap cleanup EXIT

tar -C "$ROOT" \
  --exclude=.git --exclude=node_modules --exclude=bin --exclude=obj \
  --exclude=./secrets --exclude=./.env --exclude=./backups \
  -cf - . | { mkdir "$SRC" && tar -C "$SRC" -xf -; }
cd "$SRC"

echo "== Version und Image-Praefix an drei Stellen (D-04)"
example_value() { sed -n "s/^$1=//p" .env.example; }
[[ "$(example_value WQ_VERSION)" == "$EXPECTED_VERSION" ]] \
  || fail ".env.example: WQ_VERSION ist '$(example_value WQ_VERSION)' statt '$EXPECTED_VERSION'."
[[ "$(example_value WQ_IMAGE_PREFIX)" == "$EXPECTED_PREFIX" ]] \
  || fail ".env.example: WQ_IMAGE_PREFIX ist '$(example_value WQ_IMAGE_PREFIX)' statt '$EXPECTED_PREFIX'."
# Standardwerte ${NAME:-wert} einer Compose-Datei, je Fundstelle eine Zeile.
compose_defaults() { grep -o "\${$1:-[^}]*}" "$2" | sed "s/^\${$1:-//; s/}\$//" || true; }
for file in docker-compose.quick.yml; do
  for pair in "WQ_VERSION $EXPECTED_VERSION" "WQ_IMAGE_PREFIX $EXPECTED_PREFIX"; do
    name="${pair% *}"; expected="${pair#* }"
    found="$(compose_defaults "$name" "$file")"
    [[ "$(printf '%s\n' "$found" | grep -c .)" == 3 ]] \
      || fail "$file: $name hat nicht genau drei Standardwerte (api, certs und web): $(echo $found)"
    [[ "$(printf '%s\n' "$found" | sort -u)" == "$expected" ]] \
      || fail "$file: Standardwert von $name ist '$(echo $found)' statt '$expected'."
  done
done
echo "VERSION OK"

echo "== Vollstaendigkeitspruefung der Sicherung in restore.sh und upgrade.sh"
# pg_dump 17.6 setzt nach der Endzeile noch vier Zeilen (\unrestrict); eine
# weitere Zeile einer kuenftigen Version darf nicht jede Sicherung durchfallen
# lassen. Ein abgeschnittener Dump (pg_dump bricht mitten im COPY ab, gzip
# schliesst sauber) bleibt abgelehnt, auch wenn eine Datenzeile den Text der
# Endzeile enthaelt. Geprueft wird check_dump, wie es im Skript steht.
dump_with_end() {
  {
    printf '%s\n' '--' '-- PostgreSQL database dump' '--' 'COPY public.app_user (id, name) FROM stdin;'
    printf '1\tKind\n'
    case "$2" in
      cut) ;;
      cut-text) printf '2\tPostgreSQL database dump complete\n' ;;
      *) printf '%s\n' '\.' '' '--' '-- PostgreSQL database dump complete' '--' '' '\unrestrict abc' '' ;;
    esac
    if [[ "$2" == plus1 ]]; then echo '-- zusaetzliche Zeile einer kuenftigen pg_dump-Version'; fi
    # Lange Zeilen nach der Endzeile: Liest grep nach dem Treffer nicht weiter,
    # bricht tail unter pipefail mit SIGPIPE ab (immer statt nur gelegentlich).
    if [[ "$2" == plus-lang ]]; then
      for _ in 1 2 3; do head -c 100000 /dev/zero | tr '\0' x; echo; done
    fi
  } | gzip >"$1"
}
for name in heute plus1 plus-lang cut cut-text; do dump_with_end "$WORK/dump-$name.sql.gz" "$name"; done
for script in restore.sh upgrade.sh; do
  for case_ in heute:0 plus1:0 plus-lang:0 cut:1 cut-text:1; do
    name="${case_%:*}"; want="${case_#*:}"
    got=0
    (eval "$(sed -n '/^dump_complete() {/,/^}/p; /^check_dump() {/,/^}/p' "$script")" \
      && declare -f check_dump >/dev/null || exit 2
      check_dump "$WORK/dump-$name.sql.gz") || got=$?
    [[ "$got" == "$want" ]] || fail "$script: check_dump fuer Dump '$name' endete mit $got statt $want."
  done
done
echo "DUMP-PRUEFUNG OK"

echo "== Release-Paket wie in der CI (D-16)"
bash "$SRC/.github/release-package.sh" "$WORK/release-base" "v$EXPECTED_VERSION" \
  || fail "Das Release-Paket liess sich nicht bauen (.github/release-package.sh)."
(cd "$WORK/release-base" && sha256sum -c wordquest.tar.gz.sha256) \
  || fail "Die Pruefsumme des Pakets stimmt nicht."
# Typzeichen und Name je Eintrag, sortiert. GNU- und BSD-tar liefern dieselben
# Typzeichen (d, -, l, p, h); dieselbe Liste gilt fuer upgrade.sh (03.1-06).
# LC_ALL=C: sonst sortiert .env.example je nach Locale anders ein.
pkg_listing() {
  paste -d ' ' <(tar -tvzf "$1" | cut -c1) <(tar -tzf "$1") | LC_ALL=C sort
}
PKG_EXPECTED='- wordquest/.env.example
- wordquest/docker-compose.quick.yml
- wordquest/restore.sh
- wordquest/setup.sh
- wordquest/upgrade.sh
d wordquest/'
listing="$(pkg_listing "$WORK/release-base/wordquest.tar.gz")"
[[ "$listing" == "$PKG_EXPECTED" ]] \
  || fail "Paketinhalt weicht ab: $(printf '%s' "$listing" | tr '\n' '|')"
# Auslieferung wie ein GitHub-Release: beide Dateien unter einer Adresse.
mkdir "$WORK/release"
cp "$WORK/release-base/wordquest.tar.gz" "$WORK/release-base/wordquest.tar.gz.sha256" "$WORK/release/"
python3 -m http.server --bind 127.0.0.1 --directory "$WORK/release" 18083 >"$WORK/http.log" 2>&1 &
HTTP_PID=$!
export WQ_RELEASE_URL=http://127.0.0.1:18083
served=0
for _ in $(seq 1 30); do
  # Inhalt vergleichen: Ein fremder Dienst auf dem Port fiele sonst nicht auf.
  if curl -fsS "$WQ_RELEASE_URL/wordquest.tar.gz.sha256" 2>/dev/null \
    | cmp -s - "$WORK/release/wordquest.tar.gz.sha256"; then
    served=1
    break
  fi
  sleep 1
done
[[ "$served" == 1 ]] || fail "Der lokale Release-Server auf 127.0.0.1:18083 liefert das Paket nach 30 s nicht (Port belegt?)."
echo "PAKET OK"

echo "== Vorpruefung der lokalen Tags und der Registry"
# Update (03.1-06): Ziel EXPECTED_VERSION kommt aus der lokalen Registry, die alte Version
# 0.0.0-smoke liegt nur lokal unter demselben Praefix.
REG_PREFIX=localhost:18084/wordquest
OLD_VERSION=0.0.0-smoke
REG_API_TAG="${REG_PREFIX}-api:${EXPECTED_VERSION}"
REG_WEB_TAG="${REG_PREFIX}-web:${EXPECTED_VERSION}"
OLD_API_TAG="${REG_PREFIX}-api:${OLD_VERSION}"
OLD_WEB_TAG="${REG_PREFIX}-web:${OLD_VERSION}"
for tag in "$API_TAG" "$WEB_TAG" "$REG_API_TAG" "$REG_WEB_TAG" "$OLD_API_TAG" "$OLD_WEB_TAG"; do
  if docker image inspect "$tag" >/dev/null 2>&1; then
    fail "Das Image $tag gibt es lokal schon; der Smoke wuerde es ueberdecken und am Ende loeschen. Entferne es vorher selbst mit: docker image rm $tag"
  fi
done
# Alle fehlen: Jedes, das am Ende existiert, gehoert diesem Lauf.
CLEANUP_TAGS="$API_TAG $WEB_TAG $REG_API_TAG $REG_WEB_TAG $OLD_API_TAG $OLD_WEB_TAG"
[[ -z "$(docker ps -aq --filter "name=^${REGISTRY_NAME}\$")" ]] \
  || fail "Es gibt schon einen Container $REGISTRY_NAME. Entferne ihn vorher selbst mit: docker rm -f -v $REGISTRY_NAME"
if curl -s -o /dev/null --max-time 5 http://127.0.0.1:18084/; then
  fail "Auf 127.0.0.1:18084 antwortet schon ein Dienst; die lokale Registry braucht den Port."
fi
# Das Registry-Image selbst nur entfernen, wenn dieser Lauf es geladen hat.
if ! docker image inspect "$REGISTRY_IMAGE" >/dev/null 2>&1; then
  CLEANUP_TAGS="$CLEANUP_TAGS $REGISTRY_IMAGE"
fi

echo "== Build der Images aus der Arbeitskopie (ohne .env)"
docker compose build api web </dev/null

# Anmelde-Limit (Program.cs:113-138): 10 Auth-Anfragen pro Minute je Absender,
# im Speicher der API. Gezaehlt wird je API-Start, das ist strenger als das
# Minutenfenster. Zaehler in einer Datei, weil login in $(...) laeuft.
AUTH_FILE="$INST/.smoke/auth-budget"
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

# Anfragen an WordQuest per HTTPS, mit der CA der Installation als einzigem Anker
# (nach der Installation in .smoke/ca.pem).
curl_wq() { curl --cacert "$INST/.smoke/ca.pem" "$@"; }

login() {
  auth_budget 1
  curl_wq -s -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    "https://localhost:${WQ_HTTPS_PORT}/api/v1/auth/login"
}

# Seitenabgleich (REL-03, D-10): Jeder Befehl der Installationsseite laeuft hier
# oder steht mit Grund in HANDGRIFFE; jede zitierte Ausgabe kommt in einem Log vor.
PAGE="$SRC/Documentation/Installation.md"
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
  printf '%s\n' "$1" >>"$INST/.smoke/page-cmds"
}
# Befehle der Seite, die der Smoke nicht ausfuehrt: "Befehl — Grund", je eine Zeile.
HANDGRIFFE='docker compose down — Ausweg „Zertifizierungsstelle neu anlegen“; belegt in setup-smoke.sh (TLS OK) mit dem Projektnamen des Smokes
docker volume rm wordquest_tls-ca wordquest_tls — Ausweg „Zertifizierungsstelle neu anlegen“; belegt in setup-smoke.sh (TLS OK) mit dem Projektnamen des Smokes
docker compose logs certs — nur Ansehen im Fehlerfall; die Meldungen von certs belegt setup-smoke.sh (TLS OK)
sudo apt install curl — Paketinstallation auf dem Zielgeraet; der Entwicklungsrechner hat curl
sudo usermod -aG docker $USER — Gruppe docker, wirkt erst nach neuer Anmeldung
docker compose -p wordquest-quick down — alter Schnelltest, kein Smoke-Teil (D-06)
sudo chown -R "$(id -un)" backups — Ausweg aus der Meldung von setup.sh:56, braucht sudo
docker compose exec api dotnet WordQuest.Api.dll reset-password eltern@example.de — belegt in setup-smoke.sh (RESET OK)
docker compose logs api — nur Ansehen im Fehlerfall; die Startabbrueche belegt setup-smoke.sh (STARTABBRUCH OK)
hostname -I — nur auf dem Pi (Linux); macOS kennt -I nicht
./restore.sh backups/daily/wordquest-20261001.sql.gz — Beispielname; die Form mit Pfad laeuft im Smoke mit dem Tagesdump und den Testdateien
./restore.sh backups/vor-update-20261001-193000.sql.gz — Beispielname; der Smoke geht den Weg mit der Datei aus der Meldung von upgrade.sh (UPDATE-ABBRUCH OK)'

echo "== Installation aus dem Paket (D-16)"
mkdir -p "$INST/.smoke"
cd "$WORK"
# Die Zeile der Seite, nur mit der Adresse des lokalen Servers. Den echten
# Download von GitHub prueft die Nach-Release-Abnahme (03.1-VALIDATION.md).
GH_RELEASE_URL=https://github.com/mrhdready/WordQuest/releases/latest/download
INSTALL_LINE="curl -fsSL $GH_RELEASE_URL/wordquest.tar.gz | tar xz"
page_cmd "$INSTALL_LINE"
local_line="${INSTALL_LINE/"$GH_RELEASE_URL"/$WQ_RELEASE_URL}"
[[ "$local_line" != "$INSTALL_LINE" ]] || fail "Adresse in der Installationszeile nicht ersetzt."
bash -o pipefail -c "$local_line" || fail "Laden und Entpacken des Pakets fehlgeschlagen: $local_line"
page_cmd 'cd wordquest'
cd wordquest
for script in setup.sh upgrade.sh restore.sh; do
  [[ -f "$script" && -x "$script" ]] || fail "$script fehlt im Paket oder ist nicht ausfuehrbar."
done
# Nur fuer den Smoke: Mit dem Build-Overlay gelten api und web als baubar, und
# pull --ignore-buildable in setup.sh ersetzt die lokal gebauten Tags EXPECTED_VERSION
# nicht durch veroeffentlichte.
cp "$SRC/docker-compose.build.yml" .
# Grossbuchstaben im Praefix werden abgelehnt, danach uebernimmt Enter den Standard.
page_cmd './setup.sh'
printf '%s\n' 'GHCR.io/X' '' eltern@example.de geheim-123 geheim-123 \
  | ./setup.sh 2>&1 | tee .smoke/install.log
grep -qF 'Das Image-Präfix besteht aus' .smoke/install.log || fail "Kein Hinweis auf ein ungueltiges Image-Praefix."
grep -qx "WQ_VERSION=$EXPECTED_VERSION" .env || fail ".env enthaelt nicht WQ_VERSION=$EXPECTED_VERSION."
grep -qx "WQ_IMAGE_PREFIX=$EXPECTED_PREFIX" .env || fail ".env enthaelt nicht WQ_IMAGE_PREFIX=$EXPECTED_PREFIX."
grep -qF '✓ API ist bereit.' .smoke/install.log || fail "Zeile '✓ API ist bereit.' fehlt."
grep -qF 'Fertig. WordQuest läuft unter: https://' .smoke/install.log || fail "Abschlusszeile fehlt."
for line in '✓ Zertifikat ist bereit.' '✓ WordQuest antwortet über HTTPS.' \
  'Fingerabdruck von WordQuest (SHA-256): ' 'Fingerabdruck der Zertifizierungsstelle (SHA-256): '; do
  grep -qF "$line" .smoke/install.log || fail "Installation ohne Zeile: $line"
done
docker compose exec -T certs cat /certs/ca/ca.crt </dev/null >.smoke/ca.pem || fail "CA der Installation nicht lesbar."
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
for service in api backup certs db web; do
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
page_cmd 'docker compose exec certs dotnet WordQuest.Api.dll tls show'
docker compose exec -T certs dotnet WordQuest.Api.dll tls show </dev/null >.smoke/tls-show.log \
  || fail "tls show endete nicht mit 0."
while IFS= read -r line; do
  grep -qF -- "$line" .smoke/install.log || fail "tls show nennt einen anderen Fingerabdruck als setup.sh: $line"
done <.smoke/tls-show.log
[[ "$(grep -c 'Fingerabdruck' .smoke/tls-show.log)" == 2 ]] || fail "tls show nennt nicht genau zwei Fingerabdruecke."

echo "== Wiederherstellung (REL-02)"
# Fingerabdruck der Fachdaten in einer Zeile, ohne refresh_token (restore.sh
# leert die Tabelle absichtlich).
# vocabulary_picture: t::text nimmt die Bildbytes mit, der Abdruck vergleicht also
# jedes Bild Byte fuer Byte (D-14).
FP_TABLES='tenant app_user learner_profile vocabulary_set vocabulary_entry vocabulary_picture card review_state review_log gamification_profile learning_session session_item'
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
  code="$(curl_wq -s -o .smoke/login.json -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d '{"email":"eltern@example.de","password":"geheim-123"}' \
    "https://localhost:${WQ_HTTPS_PORT}/api/v1/auth/login" || true)"
  [[ "$code" == 200 ]] || fail "Login fuer die Tokens: HTTP $code statt 200."
  sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p' .smoke/login.json >.smoke/access-token
  sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p' .smoke/login.json >.smoke/refresh-token
  [[ -s .smoke/access-token && -s .smoke/refresh-token ]] || fail "Tokens nicht in der Login-Antwort."
}
# GET /api/v1/learners mit dem Access-Token aus der Datei; Antwort in .smoke/learners.json.
learners() {
  curl_wq -s -o .smoke/learners.json -w '%{http_code}' \
    -H "Authorization: Bearer $(cat .smoke/access-token)" \
    "https://localhost:${WQ_HTTPS_PORT}/api/v1/learners" || true
}
# restore.sh startet web zuletzt neu; nginx nimmt danach erst nach einem Moment an.
wait_web() {
  local _
  for _ in $(seq 1 30); do
    curl_wq -s -o /dev/null "https://localhost:${WQ_HTTPS_PORT}/" && return 0
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

# Echter Lernstand: Kind, Set und eine ganze erste Runde ueber die Oberflaeche.
# Anmelde-Limit: globalSetup, Profilwahl und learner-login (first-run.spec.ts:11-12).
auth_budget 3
# Das Passwort steht nur fuer diesen einen Aufruf in der Umgebung.
WQ_E2E_FIRST_RUN=1 WQ_E2E_BASE_URL="http://localhost:${WQ_HTTP_PORT}" \
  WQ_E2E_GUARDIAN_EMAIL=eltern@example.de WQ_E2E_GUARDIAN_PASSWORD=geheim-123 \
  npm --prefix "$ROOT/frontend" run e2e -- first-run.spec.ts </dev/null \
  || fail "Erstdurchlauf auf der Release-Installation fehlgeschlagen."
for table in learner_profile vocabulary_entry vocabulary_picture review_log; do
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
code="$(curl_wq -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer $(cat .smoke/access-token)" \
  "https://localhost:${WQ_HTTPS_PORT}/api/v1/learners/$child_id" || true)"
[[ "$code" == 204 ]] || fail "DELETE des Kindes: HTTP $code statt 204."
# Auch das Bild entfernen: Sonst bewiese die Wiederherstellung fuer Bilder nichts,
# es laege ja noch in der Datenbank (D-14).
code="$(curl_wq -s -o .smoke/sets.json -w '%{http_code}' \
  -H "Authorization: Bearer $(cat .smoke/access-token)" \
  "https://localhost:${WQ_HTTPS_PORT}/api/v1/sets" || true)"
[[ "$code" == 200 ]] || fail "GET /api/v1/sets: HTTP $code statt 200."
set_id="$(sed -n 's/.*"id":"\([^"]*\)","title":"Erstes Set".*/\1/p' .smoke/sets.json)"
[[ -n "$set_id" ]] || fail "Erstes Set nicht in /api/v1/sets."
code="$(curl_wq -s -o .smoke/entries.json -w '%{http_code}' \
  -H "Authorization: Bearer $(cat .smoke/access-token)" \
  "https://localhost:${WQ_HTTPS_PORT}/api/v1/sets/$set_id/entries" || true)"
[[ "$code" == 200 ]] || fail "GET /api/v1/sets/$set_id/entries: HTTP $code statt 200."
entry_id="$(sed -n 's/.*"id":"\([^"]*\)","sourceText":"Hund".*/\1/p' .smoke/entries.json)"
[[ -n "$entry_id" ]] || fail "Vokabel Hund nicht im Ersten Set."
code="$(curl_wq -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer $(cat .smoke/access-token)" \
  "https://localhost:${WQ_HTTPS_PORT}/api/v1/sets/$set_id/entries/$entry_id/picture" || true)"
[[ "$code" == 204 ]] || fail "DELETE des Bildes: HTTP $code statt 204."
[[ "$(count_rows vocabulary_picture)" == 0 ]] || fail "Nach dem Entfernen ist vocabulary_picture nicht leer."
[[ "$(fingerprint)" != "$fp_s1" ]] || fail "Fingerabdruck nach dem Loeschen unveraendert."

[[ -x restore.sh ]] || fail "restore.sh fehlt oder ist nicht ausfuehrbar."
page_cmd './restore.sh'
restore_run .smoke/restore.log < <(printf '%s\n' 1 ja)
if [[ "$status" != 0 ]]; then
  # Diagnose (03.1-05, einmal rot ohne Befund): welcher Teil der Pruefung aus
  # restore.sh scheitert, auf dem Host und im Container, sofort und nach 5 s.
  for wait_s in 0 5; do
    sleep "$wait_s"
    echo "Diagnose nach $wait_s s: $daily $(ls -li "$daily")"
    gzip -t "$daily" && echo "  gzip -t: ok" || echo "  gzip -t: FEHLER"
    echo "  letzte Zeilen: $( (gunzip -c "$daily" 2>/dev/null || true) | tail -n 20 | tr '\n' '|')"
    echo "  COPY public.app_user: $( (gunzip -c "$daily" 2>/dev/null || true) | grep -c 'COPY public.app_user' || true)"
    docker compose exec -T backup sh -c "ls -li /$daily; gzip -t /$daily && echo '  Container: gzip -t ok'" </dev/null || true
  done
  fail "restore.sh endete mit Exit $status."
fi
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
[[ "$(count_rows vocabulary_picture)" -ge 1 ]] || fail "Das Bild ist nach restore.sh nicht zurueck."
[[ "$(count_rows refresh_token)" == 0 ]] || fail "refresh_token ist nach restore.sh nicht leer."
# /auth/refresh hat kein Anmelde-Limit (AuthEndpoints.cs:23).
code="$(curl_wq -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$(cat .smoke/refresh-token-s1)\"}" \
  "https://localhost:${WQ_HTTPS_PORT}/api/v1/auth/refresh" || true)"
echo "Refresh mit Token aus der Sicherung: HTTP $code"
[[ "$code" == 401 ]] || fail "Refresh mit dem Token aus der Sicherung: HTTP $code statt 401."
code="$(learners)"
echo "Alter Access-Token nach restore.sh: HTTP $code"
[[ "$code" == 200 ]] || fail "Alter Access-Token: HTTP $code statt 200 (laeuft erst nach 15 Minuten ab)."

before_files="$(ls backups/vor-wiederherstellung-*.sql.gz 2>/dev/null || true)"
[[ "$(printf '%s\n' "$before_files" | grep -c .)" == 1 ]] \
  || fail "Nicht genau eine Vorher-Sicherung: $(echo $before_files)"
gzip -t "$before_files" || fail "$before_files ist kein gueltiges gzip."
# Nur fuer den Besitzer lesbar wie vor-update-… (W-2, IN-01).
[[ "$(ls -l "$before_files" | cut -c1-10)" == -rw------- ]] \
  || fail "$before_files ist nicht nur fuer den Besitzer lesbar: $(ls -l "$before_files" | cut -c1-10)"
[[ "$(gunzip -c "$before_files" | tail -n 20 | grep -cx -- '-- PostgreSQL database dump complete' || true)" -gt 0 ]] \
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

# Relativer Pfad aus einem anderen Ordner: gilt ab dem Aufrufort, nicht ab dem
# Installationsordner (IN-04). Sonst kaeme "gibt es nicht".
status=0
(cd .smoke && ../restore.sh ../backups/kaputt.sql.gz) < <(printf 'ja\n') >.smoke/restore-relativ.log 2>&1 || status=$?
cat .smoke/restore-relativ.log
expect_msg .smoke/restore-relativ.log 'backups/kaputt.sql.gz ist keine vollständige WordQuest-Sicherung. Es wurde nichts geändert.'
assert_unchanged "Relativer Pfad"

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
[[ "$(gunzip -c "$newest" | tail -n 20 | grep -cx -- '-- PostgreSQL database dump complete' || true)" -gt 0 ]] \
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

echo "== Update aus dem Release-Paket (REL-01, D-16)"
# Ab hier ohne Build-Overlay: Sonst gelten api und web als baubar, und
# pull --ignore-buildable uebersprange sie (Review 03-03 MEDIUM).
export COMPOSE_FILE=docker-compose.quick.yml

# Echter Pull (Codex-Review 05 HIGH): Die Zielimages liegen nur in der lokalen
# Registry. Lokal fehlen sie vor dem Update; erst der Pull legt den Tag an, und
# der RepoDigest nennt die Registry.
REGISTRY_STARTED=1
docker run -d --name "$REGISTRY_NAME" -p 127.0.0.1:18084:5000 "$REGISTRY_IMAGE" >/dev/null \
  || fail "Die lokale Registry ($REGISTRY_IMAGE) startet nicht."
registry_up=0
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:18084/v2/ >/dev/null 2>&1; then registry_up=1; break; fi
  sleep 1
done
[[ "$registry_up" == 1 ]] || fail "Die lokale Registry antwortet nach 60 s nicht auf 127.0.0.1:18084."
for pair in "$API_TAG $REG_API_TAG" "$WEB_TAG $REG_WEB_TAG"; do
  src="${pair% *}"; dst="${pair#* }"
  docker tag "$src" "$dst"
  docker push -q "$dst" >/dev/null || fail "Push von $dst in die lokale Registry fehlgeschlagen."
  docker image rm "$dst" >/dev/null
  if docker image inspect "$dst" >/dev/null 2>&1; then fail "$dst liegt nach dem Push noch lokal."; fi
done
# Aeltere Version: dieselben Images unter einem zweiten Namen, nur lokal.
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
  [[ "$(ls -l "$1" | cut -c1-10)" == -rw------- ]] || fail "$1 ist nicht nur fuer den Besitzer lesbar: $(ls -l "$1" | cut -c1-10)"
  [[ "$(gunzip -c "$1" | tail -n 20 | grep -cx -- '-- PostgreSQL database dump complete' || true)" -gt 0 ]] || fail "$1 hat die Endzeile nicht."
  [[ "$(gunzip -c "$1" | grep -c 'Erstes Kind' || true)" -gt 0 ]] || fail "$1 enthaelt 'Erstes Kind' nicht."
}

# Ausgeliefertes Paket: das aus der CI-Nachbildung oben, mit anderer Version in
# .env.example (grep -v und angehaengte Zeile: ein | verduerbe einen sed-Ersatz).
# Mit "falsch" passt die Pruefsumme nicht zum Paket.
PKG_FILES='docker-compose.quick.yml .env.example setup.sh upgrade.sh restore.sh'
pkg_unpack() {
  rm -rf "$WORK/pkg"
  mkdir "$WORK/pkg"
  tar -xzf "$WORK/release-base/wordquest.tar.gz" -C "$WORK/pkg"
}
pkg_pack() {
  (cd "$WORK/pkg" && COPYFILE_DISABLE=1 tar --no-xattrs -czf "$WORK/release/wordquest.tar.gz" wordquest)
  if [[ "${1:-}" == falsch ]]; then
    (cd "$WORK/pkg/wordquest" && sha256sum setup.sh | sed 's/setup\.sh$/wordquest.tar.gz/') >"$WORK/release/wordquest.tar.gz.sha256"
  else
    (cd "$WORK/release" && sha256sum wordquest.tar.gz >wordquest.tar.gz.sha256)
  fi
}
serve_pkg() {
  pkg_unpack
  { grep -v '^WQ_VERSION=' "$WORK/pkg/wordquest/.env.example"; echo "WQ_VERSION=$1"; } >"$WORK/pkg/env-example"
  mv "$WORK/pkg/env-example" "$WORK/pkg/wordquest/.env.example"
  pkg_pack "${2:-}"
}
# Summen der fuenf Paketdateien im Installationsordner und von secrets/.
pkg_sums() { for f in $PKG_FILES; do shasum "$f" 2>&1 || true; done; ls -l $PKG_FILES 2>&1 | cut -c1-10; }
secrets_sum() { (cd secrets && ls -ln | cut -c1-10 && shasum ./*) 2>&1 || true; }
# Jede der fuenf Dateien gleicht der im ausgelieferten Paket.
pkg_is_served() {
  local f
  for f in $PKG_FILES; do
    tar -xOzf "$WORK/release/wordquest.tar.gz" "wordquest/$f" | cmp -s - "$f" || return 1
  done
}
no_workdir() { [[ -z "$(ls -d .upgrade.* 2>/dev/null || true)" ]]; }

set_env WQ_IMAGE_PREFIX "$REG_PREFIX"
set_env WQ_VERSION "$OLD_VERSION"
docker compose up -d </dev/null
wait_api
wait_web
[[ "$(image_of api)" == "$OLD_API_TAG" ]] || fail "api laeuft vor dem Update mit '$(image_of api)' statt '$OLD_API_TAG'."
for table in learner_profile vocabulary_entry vocabulary_picture review_log; do
  [[ "$(count_rows "$table")" -ge 1 ]] || fail "Vor dem Update ist $table leer."
done
fp_f0="$(fingerprint)"

# Docker-Spy (Review 03-03 MEDIUM, Codex-Review 05 HIGH): Ein docker vorn im
# PATH protokolliert bei "docker compose pull" die Zielversion aus der Umgebung,
# den Stand der .env und die Kommandozeile des Aufrufers. Mit WQ_SPY_PULL=pass
# laedt danach das echte docker, mit WQ_SPY_PULL=ok meldet er Erfolg ohne Laden
# (nur fuer Startfehler mit absichtlich fehlendem Image).
SPY_DIR="$INST/.smoke/spy"
SPY_LOG="$INST/.smoke/spy-pull"
REAL_DOCKER="$(command -v docker)"
mkdir "$SPY_DIR"
: >"$SPY_LOG"
: >"$SPY_LOG-args"
cat >"$SPY_DIR/docker" <<EOF
#!/usr/bin/env bash
if [[ -n "\${WQ_SPY_PULL:-}" && "\${1:-}" == compose && "\${2:-}" == pull ]]; then
  printf 'ziel=%s env=%s\n' "\${WQ_VERSION:-}" "\$(sed -n 's/^WQ_VERSION=//p' .env | tail -n 1)" >>"$SPY_LOG"
  ps -o args= -p "\$PPID" >>"$SPY_LOG-args"
  [[ "\$WQ_SPY_PULL" == pass ]] || exit 0
fi
exec "$REAL_DOCKER" "\$@"
EOF
chmod +x "$SPY_DIR/docker"
spy_lines() { grep -c . "$SPY_LOG" || true; }
# upgrade.sh ohne Eingabe; $2 ist die Art des Spy (pass, ok) oder leer, danach
# die Argumente. Exit-Code in $status, wie restore_run.
upgrade_run() {
  local log="$1" art="$2"
  shift 2
  status=0
  if [[ -n "$art" ]]; then
    PATH="$SPY_DIR:$PATH" WQ_SPY_PULL="$art" ./upgrade.sh "$@" </dev/null >"$log" 2>&1 || status=$?
  else
    ./upgrade.sh "$@" </dev/null >"$log" 2>&1 || status=$?
  fi
  cat "$log"
}

[[ -x upgrade.sh ]] || fail "upgrade.sh fehlt oder ist nicht ausfuehrbar."
[[ "$(backup_count)" == 0 ]] || fail "Vor dem Update gibt es schon eine Sicherung vor-update-*."
docker compose exec -T certs cat /certs/ca/ca.crt </dev/null >.smoke/ca-vor-update.pem
for tag in "$REG_API_TAG" "$REG_WEB_TAG"; do
  if docker image inspect "$tag" >/dev/null 2>&1; then fail "$tag liegt vor dem Update schon lokal."; fi
done
serve_pkg "$EXPECTED_VERSION"
# Die installierte Fassung weicht vom Paket ab: Danach muss sie ersetzt sein.
echo '# Smoke: installierte Fassung vor dem Update' >>upgrade.sh
page_cmd './upgrade.sh'
# Die .env behaelt ihre Rechte (WR-01): upgrade.sh darf sie nicht fuer alle lesbar machen.
chmod 600 .env
env_mode="$(ls -l .env | cut -c1-10)"
secrets_before="$(secrets_sum)"
upgrade_run .smoke/upgrade.log pass
[[ "$status" == 0 ]] || fail "upgrade.sh endete mit Exit $status."
[[ "$(ls -l .env | cut -c1-10)" == "$env_mode" ]] \
  || fail ".env hat nach dem Update die Rechte $(ls -l .env | cut -c1-10) statt $env_mode."
[[ ! -e .env.tmp ]] || fail ".env.tmp liegt nach dem Update noch da."
no_workdir || fail "Arbeitsordner .upgrade.* liegt nach dem Update noch da."
[[ "$(secrets_sum)" == "$secrets_before" ]] || fail "secrets/ hat sich beim Update geaendert."
expect_msg .smoke/upgrade.log '✓ Prüfsumme stimmt.'
expect_msg .smoke/upgrade.log '✓ Sicherung geprüft:'
upd="$(upd_file .smoke/upgrade.log)"
last="$(tail -n 1 .smoke/upgrade.log | tr -d '\033' | sed 's/\[[0-9;]*m//g')"
[[ "$last" == "Fertig. WordQuest läuft jetzt mit Version $EXPECTED_VERSION. Die Sicherung von vorher liegt in $upd." ]] \
  || fail "Letzte Zeile von upgrade.sh: $last"
tar -xOzf "$WORK/release/wordquest.tar.gz" wordquest/upgrade.sh | cmp -s - upgrade.sh \
  || fail "Die installierte upgrade.sh ist nicht die aus dem Paket."
pkg_is_served || fail "Die Dateien im Installationsordner gleichen nicht dem ausgelieferten Paket."
echo "Spy-Protokoll: $(cat "$SPY_LOG") | $(cat "$SPY_LOG-args")"
[[ "$(cat "$SPY_LOG")" == "ziel=$EXPECTED_VERSION env=$OLD_VERSION" ]] \
  || fail "Spy-Protokoll nicht genau eine Zeile mit Zielversion $EXPECTED_VERSION bei .env $OLD_VERSION: $(cat "$SPY_LOG")"
grep -qF -- "--continue $upd" "$SPY_LOG-args" \
  || fail "Geladen hat nicht die neue Fassung mit --continue $upd: $(cat "$SPY_LOG-args")"
[[ "$(backup_count)" == 1 ]] || fail "Nicht genau eine Sicherung vor-update-*."
check_upd_backup "$upd"
grep -qx "WQ_VERSION=$EXPECTED_VERSION" .env || fail ".env enthaelt nach dem Update nicht WQ_VERSION=$EXPECTED_VERSION."
[[ "$(image_of api)" == "$REG_API_TAG" ]] || fail "api laeuft nach dem Update mit '$(image_of api)' statt '$REG_API_TAG'."
[[ "$(image_of web)" == "$REG_WEB_TAG" ]] || fail "web laeuft nach dem Update mit '$(image_of web)' statt '$REG_WEB_TAG'."
[[ "$(image_of certs)" == "$REG_API_TAG" ]] || fail "certs laeuft nach dem Update mit '$(image_of certs)' statt '$REG_API_TAG'."
docker compose exec -T certs cat /certs/ca/ca.crt </dev/null | cmp -s - .smoke/ca-vor-update.pem \
  || fail "Das Update hat die Zertifizierungsstelle geaendert."
for tag in "$REG_API_TAG" "$REG_WEB_TAG"; do
  digests="$(docker image inspect -f '{{json .RepoDigests}}' "$tag")"
  echo "RepoDigests $tag: $digests"
  [[ "$digests" == *"${tag%:*}@sha256:"* ]] || fail "$tag stammt nicht aus der Registry: $digests"
done
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

echo "== Update: Abbruch- und Startfehlerpfade (D-05, Review 03-03 HIGH, Codex-Review 05 MEDIUM)"
upd_snapshot() {
  env_sum="$(shasum .env)"; n_upd="$(backup_count)"; n_spy="$(spy_lines)"
  api_image="$(image_of api)"; started_before="$(api_started)"; fp_before="$(fingerprint)"
  pkg_before="$(pkg_sums)"; secrets_before="$(secrets_sum)"
}
# Abbruch vor dem Ersetzen: nichts geaendert, auch keine Paketdatei und keine Sicherung.
assert_untouched() {
  [[ "$status" != 0 ]] || fail "$1: upgrade.sh endete mit Exit 0."
  [[ "$(pkg_sums)" == "$pkg_before" ]] || fail "$1: Paketdatei im Installationsordner geaendert."
  [[ "$(shasum .env)" == "$env_sum" ]] || fail "$1: .env geaendert."
  [[ "$(secrets_sum)" == "$secrets_before" ]] || fail "$1: secrets/ geaendert."
  [[ "$(backup_count)" == "$n_upd" ]] || fail "$1: neue Datei vor-update-*."
  [[ "$(spy_lines)" == "$n_spy" ]] || fail "$1: trotzdem geladen ($(tail -n 1 "$SPY_LOG"))."
  [[ "$(image_of api)" == "$api_image" ]] || fail "$1: api laeuft mit '$(image_of api)' statt '$api_image'."
  [[ "$(api_started)" == "$started_before" ]] || fail "$1: api wurde neu gestartet."
  [[ "$(fingerprint)" == "$fp_before" ]] || fail "$1: Fingerabdruck geaendert."
  no_workdir || fail "$1: Arbeitsordner .upgrade.* liegt noch da."
}
# Abbruch nach dem Ersetzen: Paketdateien neu, genau eine neue geprufte
# Sicherung; .env, laufende api, Daten und secrets/ wie vorher.
assert_not_switched() {
  [[ "$status" != 0 ]] || fail "$1: upgrade.sh endete mit Exit 0."
  [[ "$(shasum .env)" == "$env_sum" ]] || fail "$1: .env geaendert."
  [[ "$(secrets_sum)" == "$secrets_before" ]] || fail "$1: secrets/ geaendert."
  pkg_is_served || fail "$1: Paketdateien gleichen nicht dem ausgelieferten Paket."
  [[ "$(backup_count)" == $((n_upd + 1)) ]] || fail "$1: nicht genau eine neue Sicherung."
  check_upd_backup "$(upd_file "$2")"
  [[ "$(image_of api)" == "$api_image" ]] || fail "$1: api laeuft mit '$(image_of api)' statt '$api_image'."
  [[ "$(api_started)" == "$started_before" ]] || fail "$1: api wurde neu gestartet."
  [[ "$(fingerprint)" == "$fp_before" ]] || fail "$1: Fingerabdruck geaendert."
  no_workdir || fail "$1: Arbeitsordner .upgrade.* liegt noch da."
}
# Startfehler: Meldung mit Sicherungsdatei und Weg zurueck. Gibt die Datei aus.
assert_way_back_named() {
  local f
  [[ "$status" != 0 ]] || fail "$2: upgrade.sh endete mit Exit 0."
  f="$(upd_file "$1")"
  check_upd_backup "$f"
  [[ "$(backup_count)" == $((n_upd + 1)) ]] || fail "$2: nicht genau eine neue Sicherung."
  expect_msg "$1" "Deine Daten von vorher liegen in $f."
  expect_msg "$1" "./restore.sh $f"
  upd_way_back="$f"
}

# Ungueltige Zielversion im Paket (W-7): Abbruch vor der Sicherung.
serve_pkg '1.0.0|x'
upd_snapshot
upgrade_run .smoke/upgrade-version.log pass
assert_untouched "Ungueltige Zielversion"
expect_msg .smoke/upgrade-version.log 'Das WordQuest-Paket ist unvollständig oder nennt keine gültige Version. Es wurde nichts geändert.'
echo "Fall ungueltige Zielversion: Exit $status"

# Keine Sicherung moeglich: Dann wird nichts ersetzt und nichts geladen.
serve_pkg "$EXPECTED_VERSION"
upd_snapshot
chmod 500 backups
upgrade_run .smoke/upgrade-ohne-sicherung.log pass
chmod 700 backups
assert_untouched "Keine Sicherung"
expect_msg .smoke/upgrade-ohne-sicherung.log 'Die Sicherung vor dem Update ist fehlgeschlagen. Es wurde nichts geändert.'
echo "Fall keine Sicherung: Exit $status"

# Zielversion fehlt in der Registry: echter Pull, der scheitert. Die
# Paketdateien sind schon neu, WordQuest laeuft mit der bisherigen Version.
serve_pkg 9.9.9-fehlt
upd_snapshot
upgrade_run .smoke/upgrade-fehlt.log pass
assert_not_switched "Zielversion fehlt" .smoke/upgrade-fehlt.log
grep -qx 'WQ_VERSION=9.9.9-fehlt' .env.example || fail "Zielversion fehlt: .env.example nennt nicht 9.9.9-fehlt."
expect_msg .smoke/upgrade-fehlt.log 'Die Version 9.9.9-fehlt ließ sich nicht laden.'
expect_msg .smoke/upgrade-fehlt.log 'WordQuest läuft unverändert mit der bisherigen Version weiter'
if grep -qF 'Es wurde nichts geändert.' .smoke/upgrade-fehlt.log; then
  fail "Zielversion fehlt: Meldung behauptet 'Es wurde nichts geändert.', obwohl die Dateien neu sind."
fi
docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null \
  || fail "Zielversion fehlt: API nicht bereit."
echo "Fall Zielversion fehlt: Exit $status"

# Start scheitert: Der Spy meldet das Laden als gelungen, das Image gibt es
# aber nicht, also scheitert docker compose up -d.
serve_pkg 7.7.7-ohne-image
upd_snapshot
upgrade_run .smoke/upgrade-start.log ok
assert_way_back_named .smoke/upgrade-start.log "Start scheitert"
[[ "$(spy_lines)" == $((n_spy + 1)) && "$(tail -n 1 "$SPY_LOG")" == "ziel=7.7.7-ohne-image env=$EXPECTED_VERSION" ]] \
  || fail "Start scheitert: Spy-Protokoll ohne Zielversion 7.7.7-ohne-image bei .env $EXPECTED_VERSION: $(tail -n 1 "$SPY_LOG")"
expect_msg .smoke/upgrade-start.log 'Der Start der Version 7.7.7-ohne-image ist fehlgeschlagen.'
expect_msg .smoke/upgrade-start.log "Trage in .env WQ_VERSION=$EXPECTED_VERSION ein"
echo "Fall Start scheitert: Exit $status"
# Weg zurueck genau wie in der Meldung.
set_env WQ_VERSION "$EXPECTED_VERSION"
restore_run .smoke/upgrade-start-zurueck.log "$upd_way_back" < <(printf 'ja\n')
[[ "$status" == 0 ]] || fail "Start scheitert, Weg zurueck: restore.sh endete mit Exit $status."
wait_web
wait_api
[[ "$(image_of api)" == "$REG_API_TAG" ]] || fail "Start scheitert, Weg zurueck: api laeuft mit '$(image_of api)'."
[[ "$(fingerprint)" == "$fp_before" ]] || fail "Start scheitert, Weg zurueck: Fingerabdruck ungleich vorher."

# API wird nicht bereit: Mit WQ_SEED_DEMO_DATA=true in .env bricht die API in
# Production ab (Program.cs:34-41).
serve_pkg "$EXPECTED_VERSION"
upd_snapshot
set_env WQ_SEED_DEMO_DATA true
t0="$(date +%s)"
upgrade_run .smoke/upgrade-bereit.log ok
echo "Fall API nicht bereit: Exit $status nach $(( $(date +%s) - t0 )) s"
assert_way_back_named .smoke/upgrade-bereit.log "API nicht bereit"
expect_msg .smoke/upgrade-bereit.log 'Die API ist nach zwei Minuten nicht bereit.'
docker compose logs api </dev/null >.smoke/api-nicht-bereit.txt 2>&1 || true
grep -qF 'Start abgebrochen: WQ_SEED_DEMO_DATA' .smoke/api-nicht-bereit.txt \
  || fail "API nicht bereit: docker compose logs api nennt den Startabbruch nicht."
# Weg zurueck: Ursache aus dem Log beheben, dann die genannte Sicherung.
set_env WQ_SEED_DEMO_DATA false
restore_run .smoke/upgrade-bereit-zurueck.log "$upd_way_back" < <(printf 'ja\n')
[[ "$status" == 0 ]] || fail "API nicht bereit, Weg zurueck: restore.sh endete mit Exit $status."
wait_web
wait_api
[[ "$(fingerprint)" == "$fp_before" ]] || fail "API nicht bereit, Weg zurueck: Fingerabdruck ungleich vorher."
code="$(login eltern@example.de geheim-123)"
[[ "$code" == 200 ]] || fail "API nicht bereit, Weg zurueck: Login HTTP $code statt 200."

# Zweiter Aufruf ohne neue Version: harmlos. Dazu fehlen in .env die Zeile
# WQ_VERSION und das letzte Zeilenende (IN-02): Die neue Zeile darf nicht an
# der letzten Variable kleben.
printf '%s' "$(grep -v '^WQ_VERSION=' .env)" >.smoke/env-ohne-version
cp .smoke/env-ohne-version .env
last_env="$(tail -n 1 .env)"
serve_pkg "$EXPECTED_VERSION"
upd_snapshot
upgrade_run .smoke/upgrade-nochmal.log ok
[[ "$status" == 0 ]] || fail "Zweiter Aufruf: upgrade.sh endete mit Exit $status."
grep -qx "WQ_VERSION=$EXPECTED_VERSION" .env || fail "Zweiter Aufruf: .env ohne WQ_VERSION=$EXPECTED_VERSION."
grep -qxF -- "$last_env" .env || fail "Zweiter Aufruf: Die Zeile '$last_env' ist in .env verklebt."
[[ "$(fingerprint)" == "$fp_before" ]] || fail "Zweiter Aufruf: Fingerabdruck geaendert."
no_workdir || fail "Zweiter Aufruf: Arbeitsordner .upgrade.* liegt noch da."
echo "UPDATE-ABBRUCH OK"

echo "== Update: Paketpruefung vor jeder Aenderung (Plan-Checker W1, Codex-Review 05 HIGH)"
LOCAL_RELEASE_URL="$WQ_RELEASE_URL"
http_requests() { grep -c 'GET ' "$WORK/http.log" || true; }
# Paket mit gueltiger Pruefsumme, aber anderem Inhalt als die feste Liste.
serve_bad() {
  local d="$WORK/pkg/wordquest"
  pkg_unpack
  case "$1" in
    env) printf 'WQ_PORT=1\n' >"$d/.env" ;;
    secrets) mkdir "$d/secrets" && printf 'fremd\n' >"$d/secrets/x" ;;
    backups) mkdir "$d/backups" && printf 'fremd\n' >"$d/backups/x" ;;
    extra) printf 'fremd\n' >"$d/extra.txt" ;;
    symlink) rm "$d/setup.sh" && ln -s upgrade.sh "$d/setup.sh" ;;
    fifo) mkfifo "$d/fifo" ;;
    fehlt) rm "$d/restore.sh" ;;
    modus) chmod 644 "$d/upgrade.sh" ;;
    *) fail "serve_bad: unbekannte Art $1" ;;
  esac
  pkg_pack
}
for art in env secrets backups extra symlink fifo fehlt modus; do
  serve_bad "$art"
  upd_snapshot
  upgrade_run ".smoke/upgrade-paket-$art.log" pass
  assert_untouched "Paket $art"
  expect_msg ".smoke/upgrade-paket-$art.log" 'Das WordQuest-Paket enthält andere Dateien als erwartet. Es wurde nichts geändert.'
  if [[ -e "secrets/x" || -e "backups/x" || -e extra.txt || -e fifo ]]; then
    fail "Paket $art: Datei aus dem Paket liegt im Installationsordner."
  fi
  echo "Fall Paket $art: Exit $status"
done

# Download scheitert: Adresse aus der Umgebung zeigt auf einen Pfad mit 404.
serve_pkg "$EXPECTED_VERSION"
upd_snapshot
WQ_RELEASE_URL="$LOCAL_RELEASE_URL/gibt-es-nicht"
upgrade_run .smoke/upgrade-download.log pass
WQ_RELEASE_URL="$LOCAL_RELEASE_URL"
assert_untouched "Download"
expect_msg .smoke/upgrade-download.log 'Das WordQuest-Paket ließ sich nicht herunterladen. Prüfe die Internetverbindung und starte upgrade.sh erneut. Es wurde nichts geändert.'
echo "Fall Download: Exit $status"

# Adresse nur in .env: Die Anfrage muss beim lokalen Server ankommen, sonst
# haette upgrade.sh still die GitHub-Adresse genommen.
printf 'WQ_RELEASE_URL=%s\n' "$LOCAL_RELEASE_URL/nur-in-env" >>.env
upd_snapshot
unset WQ_RELEASE_URL
upgrade_run .smoke/upgrade-download-env.log pass
export WQ_RELEASE_URL="$LOCAL_RELEASE_URL"
assert_untouched "Adresse aus .env"
expect_msg .smoke/upgrade-download-env.log 'Das WordQuest-Paket ließ sich nicht herunterladen.'
grep -qF 'GET /nur-in-env/wordquest.tar.gz' "$WORK/http.log" \
  || fail "Adresse aus .env: Keine Anfrage an $LOCAL_RELEASE_URL/nur-in-env beim lokalen Server."
grep -v '^WQ_RELEASE_URL=' .env >.smoke/env-ohne-url
cat .smoke/env-ohne-url >.env
echo "Fall Adresse aus .env: Exit $status"

# Pruefsumme passt nicht zum Paket.
serve_pkg "$EXPECTED_VERSION" falsch
upd_snapshot
upgrade_run .smoke/upgrade-pruefsumme.log pass
assert_untouched "Pruefsumme"
expect_msg .smoke/upgrade-pruefsumme.log 'Die Prüfsumme des WordQuest-Pakets stimmt nicht. Starte upgrade.sh später erneut. Es wurde nichts geändert.'
echo "Fall Pruefsumme: Exit $status"

# Anderes Protokoll: abgelehnt, bevor curl etwas anfragt.
serve_pkg "$EXPECTED_VERSION"
upd_snapshot
n_req="$(http_requests)"
WQ_RELEASE_URL=ftp://127.0.0.1:18083
upgrade_run .smoke/upgrade-ftp.log pass
WQ_RELEASE_URL="$LOCAL_RELEASE_URL"
assert_untouched "ftp://"
expect_msg .smoke/upgrade-ftp.log 'WQ_RELEASE_URL muss mit http:// oder https:// beginnen. Es wurde nichts geändert.'
[[ "$(http_requests)" == "$n_req" ]] || fail "ftp://: Der lokale Server bekam eine Anfrage."
echo "Fall ftp://: Exit $status"

# --continue mit erfundener Sicherung.
upd_snapshot
upgrade_run .smoke/upgrade-continue.log pass --continue backups/gibt-es-nicht.sql.gz
assert_untouched "--continue ohne Sicherung"
expect_msg .smoke/upgrade-continue.log 'upgrade.sh wurde mit --continue ohne gültige Sicherung aufgerufen. Starte ./upgrade.sh ohne Zusatz.'
# Name passt, Datei fehlt.
upgrade_run .smoke/upgrade-continue-fehlt.log pass --continue backups/vor-update-20000101-000000.sql.gz
assert_untouched "--continue mit fehlender Sicherung"
expect_msg .smoke/upgrade-continue-fehlt.log 'upgrade.sh wurde mit --continue ohne gültige Sicherung aufgerufen.'
echo "Fall --continue: Exit $status"
echo "PAKETPRUEFUNG OK"

echo "== Update aus einem frueheren Klon (D-16)"
# Mit .git nimmt upgrade.sh die Version aus dem eigenen Ordner und laedt kein
# Paket; die Adresse zeigt deshalb auf einen Pfad mit 404.
grep -qx "WQ_VERSION=$EXPECTED_VERSION" .env.example || fail "Klon: .env.example nennt nicht $EXPECTED_VERSION."
mkdir .git
upd_snapshot
n_args="$(grep -c . "$SPY_LOG-args" || true)"
n_req="$(http_requests)"
WQ_RELEASE_URL="$LOCAL_RELEASE_URL/gibt-es-nicht"
upgrade_run .smoke/upgrade-klon.log ok
WQ_RELEASE_URL="$LOCAL_RELEASE_URL"
rmdir .git
[[ "$status" == 0 ]] || fail "Klon: upgrade.sh endete mit Exit $status."
expect_msg .smoke/upgrade-klon.log 'Git-Klon erkannt'
[[ "$(http_requests)" == "$n_req" ]] || fail "Klon: upgrade.sh hat ein Paket angefragt."
[[ "$(backup_count)" == $((n_upd + 1)) ]] || fail "Klon: nicht genau eine neue Sicherung."
check_upd_backup "$(upd_file .smoke/upgrade-klon.log)"
[[ "$(spy_lines)" == $((n_spy + 1)) && "$(tail -n 1 "$SPY_LOG")" == "ziel=$EXPECTED_VERSION env=$EXPECTED_VERSION" ]] \
  || fail "Klon: Spy-Protokoll ohne Zielversion $EXPECTED_VERSION: $(tail -n 1 "$SPY_LOG")"
[[ "$(grep -c . "$SPY_LOG-args" || true)" == $((n_args + 1)) ]] || fail "Klon: keine Kommandozeile im Spy-Protokoll."
if tail -n 1 "$SPY_LOG-args" | grep -qF -- '--continue'; then
  fail "Klon: upgrade.sh hat sich mit --continue neu gestartet: $(tail -n 1 "$SPY_LOG-args")"
fi
[[ "$(pkg_sums)" == "$pkg_before" ]] || fail "Klon: Paketdatei im Installationsordner geaendert."
[[ "$(fingerprint)" == "$fp_before" ]] || fail "Klon: Fingerabdruck geaendert."
echo "KLON OK"

echo "== Seite gegen den Lauf"
# Abschnitte nach D-09: genau diese Ueberschriften zweiter Ebene, in dieser
# Reihenfolge; Zeilen in Codebloecken zaehlen nicht.
D09_SECTIONS='Voraussetzungen
Installation
Update
Sicherung und Wiederherstellung
Hilfe bei Problemen'
sections="$(awk '{ sub(/^[ \t]+/, "") } /^```/ { open = !open; next } !open && /^## / { print substr($0, 4) }' "$PAGE")"
[[ "$sections" == "$D09_SECTIONS" ]] \
  || fail "Abschnitte der Seite weichen von D-09 ab: $(printf '%s' "$sections" | tr '\n' '|')"
# Jeder Abschnitt ausser der Hilfe hat einen Befehl (bash) und ein erwartetes Ergebnis (text).
missing="$(awk '{ sub(/^[ \t]+/, "") }
  /^```/ { if (open) open = 0; else { open = 1; seen[sec, substr($0, 4)] = 1 } next }
  !open && /^## / { sec = substr($0, 4); order[++n] = sec }
  END { for (i = 1; i <= n; i++) { s = order[i]; if (s == "Hilfe bei Problemen") continue
    if (!seen[s, "bash"]) print s " ohne bash-Block"; if (!seen[s, "text"]) print s " ohne text-Block" } }' "$PAGE")"
[[ -z "$missing" ]] || fail "Abschnitt ohne Befehl oder erwartetes Ergebnis (D-09): $(printf '%s' "$missing" | tr '\n' '|')"
# Keine Empfehlung, die die Installation unsicher macht (T-03-16).
for bad in 'chmod 777' 'chmod -R 777' '0.0.0.0'; do
  if grep -qF -- "$bad" "$PAGE"; then fail "Unsichere Empfehlung auf $PAGE (T-03-16): $bad"; fi
done
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
