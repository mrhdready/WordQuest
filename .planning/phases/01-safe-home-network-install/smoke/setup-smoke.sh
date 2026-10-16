#!/usr/bin/env bash
#
# Ende-zu-Ende-Smoke fuer setup.sh (Plan 01-02, SETUP-01/02).
# Laeuft in einer Arbeitskopie des Arbeitsbaums gegen frisch gebaute Images,
# eigener Compose-Projektname und Port, raeumt am Ende alles wieder ab.
#
#   bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
WORK="$(mktemp -d)"

export COMPOSE_PROJECT_NAME=wq-smoke
export WQ_PORT=18081
export COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml
export WQ_IMAGE_PREFIX=wq-smoke
# Eindeutiger Tag je Lauf: ein aelteres lokales Image (Default "master")
# darf den Lauf nicht bedienen.
export WQ_VERSION=smoke-$(date +%s)-$$

fail() { echo "SMOKE FEHLER: $*" >&2; exit 1; }

cleanup() {
  (cd "$WORK" && docker compose down -v --remove-orphans </dev/null >/dev/null 2>&1) || true
  docker image rm "wq-smoke-api:${WQ_VERSION}" "wq-smoke-web:${WQ_VERSION}" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

tar -C "$ROOT" \
  --exclude=.git --exclude=node_modules --exclude=bin --exclude=obj \
  --exclude=./secrets --exclude=./.env --exclude=./backups \
  -cf - . | tar -C "$WORK" -xf -
cd "$WORK"

# Demo-Zugangsdaten aus dem Seeder, nicht abgeschrieben.
seeder="$ROOT/backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs"
demo_email="$(sed -n 's/.*DemoEmail = "\(.*\)";/\1/p' "$seeder")"
demo_password="$(sed -n 's/.*DemoPassword = "\(.*\)";/\1/p' "$seeder")"
[[ -n "$demo_email" && -n "$demo_password" ]] || fail "Demo-Zugangsdaten im Seeder nicht gefunden."

echo "== Build der Images aus dem Arbeitsbaum (Tag ${WQ_VERSION})"
docker compose build api web </dev/null

login() {
  curl -s -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    "http://localhost:${WQ_PORT}/api/v1/auth/login"
}

tenants() {
  docker compose exec -T db psql -U wordquest -d wordquest -tAc 'select count(*) from tenant' </dev/null | tr -d '[:space:]'
}

echo "== Lauf 1"
printf '%s\n' wq-smoke keine-mail eltern@example.de kurz geheim-123 geheim-123 \
  | ./setup.sh 2>&1 | tee run1.log
grep -qF 'Das sieht nicht nach einer E-Mail-Adresse aus. Bitte noch einmal.' run1.log || fail "Kein Hinweis auf ungueltige E-Mail."
grep -qF 'Das Passwort muss mindestens 8 Zeichen lang sein.' run1.log || fail "Kein Hinweis auf zu kurzes Passwort."
grep -qF 'Fertig. WordQuest läuft unter: http://' run1.log || fail "Abschlusszeile fehlt."
if grep -qF "$demo_email" run1.log; then fail "Ausgabe nennt den Demo-Zugang."; fi
if grep -qF 'geheim-123' run1.log; then fail "Ausgabe enthaelt das Passwort."; fi

running="$(docker inspect -f '{{.Image}}' "$(docker compose ps -q api)")"
built="$(docker image inspect -f '{{.Id}}' "wq-smoke-api:${WQ_VERSION}")"
[[ "$running" == "$built" ]] || fail "API läuft nicht mit dem frisch gebauten Image."
echo "IMAGE OK"

code="$(login eltern@example.de geheim-123)"
[[ "$code" == 200 ]] || fail "Login mit dem neuen Konto: HTTP $code statt 200."
code="$(login "$demo_email" "$demo_password")"
[[ "$code" == 401 ]] || fail "Demo-Login: HTTP $code statt 401."
echo "LOGIN OK"

before="$(shasum secrets/*.txt .env)"

echo "== Lauf 2"
./setup.sh </dev/null 2>&1 | tee run2.log
grep -qF 'Elternkonto ist schon angelegt' run2.log || fail "Lauf 2 meldet kein bestehendes Elternkonto."
[[ "$(shasum secrets/*.txt .env)" == "$before" ]] || fail "Lauf 2 hat secrets/*.txt oder .env veraendert."
[[ "$(tenants)" == 1 ]] || fail "Mehr als ein Mandant nach Lauf 2."

echo "== Zweites Elternkonto direkt ueber create-owner"
status=0
printf '%s\n' 'anderes-456' \
  | docker compose exec -T api dotnet WordQuest.Api.dll create-owner zweite@example.de || status=$?
[[ "$status" == 3 ]] || fail "Zweites create-owner: Exit $status statt 3."
[[ "$(tenants)" == 1 ]] || fail "Mehr als ein Mandant nach zweitem create-owner."

echo "== Passwort zuruecksetzen (SETUP-04)"
# Ausgabe nur in die Datei, nicht ins Log: sie enthaelt das neue Passwort.
status=0
docker compose exec -T api dotnet WordQuest.Api.dll reset-password eltern@example.de </dev/null >reset.log || status=$?
[[ "$status" == 0 ]] || fail "reset-password: Exit $status statt 0."
grep -qF 'Es wird nur dieses eine Mal angezeigt' reset.log || fail "reset-password: Hinweis 'nur dieses eine Mal' fehlt."
# Fuer spaetere Schritte (01-07: seedfreier Erstdurchlauf); nie ausgeben.
owner_password="$(sed -n 's/^Neues Passwort für eltern@example\.de: \([^ ]*\) — .*/\1/p' reset.log)"
[[ ${#owner_password} == 16 ]] || fail "reset-password: kein Passwort mit 16 Zeichen in der Ausgabe."
code="$(login eltern@example.de "$owner_password")"
[[ "$code" == 200 ]] || fail "Login mit dem Reset-Passwort: HTTP $code statt 200."
code="$(login eltern@example.de geheim-123)"
[[ "$code" == 401 ]] || fail "Login mit dem alten Passwort: HTTP $code statt 401."
status=0
docker compose exec -T api dotnet WordQuest.Api.dll reset-password fremd@example.de </dev/null >reset-unknown.log || status=$?
[[ "$status" == 1 ]] || fail "reset-password fuer unbekannte Adresse: Exit $status statt 1."
grep -qF 'Es gibt kein Elternkonto mit dieser E-Mail-Adresse.' reset-unknown.log || fail "reset-password: Text fuer unbekannte Adresse fehlt."
echo "RESET OK"

echo "== Startabbruch mit bekannten Standard-Secrets (SETUP-05)"
# Genau das Image, mit dem der api-Container des Stacks laeuft (IMAGE OK oben).
API_IMAGE="$(docker inspect -f '{{.Image}}' "$(docker compose ps -q api)")"
[[ -n "$API_IMAGE" ]] || fail "Kein laufender api-Container fuer den Startabbruch-Test."
# Bekannte Standardwerte aus dem Bestand, zufaellige Werte frisch erzeugt; nichts davon wird ausgegeben.
known_db="$(sed -n 's/.*ReadSecret("WQ_DB_PASSWORD", "\(.*\)").*/\1/p' "$ROOT/backend/src/WordQuest.Api/Program.cs")"
known_jwt="nur-zum-ausprobieren-bitte-nicht-im-echtbetrieb-verwenden"
[[ -n "$known_db" ]] || fail "Bekannter DB-Standardwert in Program.cs nicht gefunden."
random_db="$(openssl rand -hex 24)"
random_jwt="$(openssl rand -hex 24)"

# Kein DB-Host erreichbar: die Pruefung muss vor jedem Verbindungsversuch greifen.
start_abort() {
  local expected="$1"; shift
  local status=0 out
  out="$(docker run --rm -e ASPNETCORE_ENVIRONMENT=Production -e WQ_DB_HOST=gibt-es-nicht "$@" "$API_IMAGE" 2>&1)" || status=$?
  [[ "$status" == 1 ]] || fail "Start mit Standard-Secret ($expected): Exit $status statt 1."
  grep -qF "$expected" <<<"$out" || fail "Start mit Standard-Secret: '$expected' fehlt in der Ausgabe."
}
start_abort "Start abgebrochen: WQ_DB_PASSWORD" \
  -e WQ_DB_PASSWORD="$known_db" -e WQ_JWT_SIGNING_KEY="$random_jwt"
start_abort "Start abgebrochen: WQ_JWT_SIGNING_KEY" \
  -e WQ_DB_PASSWORD="$random_db" -e WQ_JWT_SIGNING_KEY="$known_jwt"
start_abort "Start abgebrochen: ConnectionStrings__Default" \
  -e WQ_DB_PASSWORD="$random_db" -e WQ_JWT_SIGNING_KEY="$random_jwt" \
  -e ConnectionStrings__Default="Host=gibt-es-nicht;Username=wordquest;Password=$known_db"
echo "STARTABBRUCH OK"

echo "SMOKE OK"
