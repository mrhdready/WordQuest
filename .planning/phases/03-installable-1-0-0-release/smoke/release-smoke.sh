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

cleanup() {
  (cd "$WORK" && docker compose down -v --remove-orphans </dev/null >/dev/null 2>&1) || true
  for tag in $CLEANUP_TAGS; do
    if docker image inspect "$tag" >/dev/null 2>&1; then
      docker image rm "$tag" >/dev/null 2>&1 || true
    fi
  done
  rm -rf "$WORK"
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
  started="$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q api </dev/null)")"
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

echo "== Installation"
# Grossbuchstaben im Praefix werden abgelehnt, danach uebernimmt Enter den Standard.
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

echo "RELEASE-SMOKE OK"
