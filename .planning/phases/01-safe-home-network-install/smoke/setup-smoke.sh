#!/usr/bin/env bash
#
# Ende-zu-Ende-Smoke fuer setup.sh (Plan 01-02, SETUP-01/02) bis zur ersten
# Lernantwort eines Kindes auf der frischen Installation (01-07, PAR-05).
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
# Demo-Seed eingeschaltet (CR-01): bricht vor jedem Datenbankzugriff ab.
start_abort "Start abgebrochen: WQ_SEED_DEMO_DATA" \
  -e WQ_DB_PASSWORD="$random_db" -e WQ_JWT_SIGNING_KEY="$random_jwt" -e WQ_SEED_DEMO_DATA=True
echo "STARTABBRUCH OK"

echo "== Taegliche Sicherung (SETUP-01)"
grep -qF 'Tägliche Sicherungen liegen in:' run1.log || fail "Lauf 1 nennt den Sicherungsordner nicht."
mode="$(stat -c '%a' backups 2>/dev/null || stat -f '%Lp' backups)"
[[ "$mode" == 700 ]] || fail "backups hat Rechte $mode statt 700."
docker compose exec -T backup /backup.sh </dev/null >/dev/null || fail "Manueller Lauf von /backup.sh fehlgeschlagen."
dump="$(ls backups/daily/wordquest-*.sql.gz 2>/dev/null | head -n 1)"
[[ -n "$dump" ]] || fail "Keine Datei backups/daily/wordquest-*.sql.gz."
gzip -t "$dump" || fail "$dump ist kein gueltiges gzip."
# grep -c statt -q: sonst bricht gunzip unter pipefail mit SIGPIPE ab (03-RESEARCH Pitfall 4).
[[ "$(gunzip -c "$dump" | grep -c 'COPY public.app_user' || true)" -gt 0 ]] || fail "$dump enthaelt die Kontodaten nicht."
echo "BACKUP OK"

echo "== Seedfreier Erstdurchlauf bis zur Zusammenfassung der ersten Runde (PAR-05)"
# Playwright aus dem Repo (dort liegen node_modules), gegen diesen Stack. Das
# Reset-Passwort steht nur fuer diesen einen Aufruf in der Umgebung, nie in der Ausgabe.
WQ_E2E_FIRST_RUN=1 WQ_E2E_BASE_URL="http://localhost:${WQ_PORT}" \
  WQ_E2E_GUARDIAN_EMAIL=eltern@example.de WQ_E2E_GUARDIAN_PASSWORD="$owner_password" \
  npm --prefix "$ROOT/frontend" run e2e -- first-run.spec.ts </dev/null \
  || fail "Erstdurchlauf auf frischer Installation fehlgeschlagen."
echo "FIRST RUN OK"

echo "== Startabbruch mit Demo-Konto und bekanntem Passwort, Ausweg reset-password (CR-01)"
# Altinstallation nachstellen: das Elternkonto bekommt Adresse und Passwort-Hash des
# Demo-Kontos. Hash im Format von PasswordHasher (v1.<iter>.<salt>.<subkey>), per node.
demo_hash="$(node -e "const c=require('crypto');const s=c.randomBytes(16);const k=c.pbkdf2Sync(process.argv[1],s,210000,32,'sha256');console.log('v1.210000.'+s.toString('base64')+'.'+k.toString('base64'))" "$demo_password")"
docker compose exec -T db psql -U wordquest -d wordquest -qc \
  "update app_user set email='$demo_email', password_hash='$demo_hash' where email='eltern@example.de'" </dev/null >/dev/null
docker compose restart api </dev/null >/dev/null 2>&1 || true
aborted=0
for _ in $(seq 1 30); do
  # grep -c statt -q: sonst bricht docker compose logs nach dem Treffer per SIGPIPE ab.
  if [[ "$(docker compose logs api </dev/null 2>&1 | grep -cF "Start abgebrochen: Das Demo-Elternkonto $demo_email hat noch sein bekanntes Passwort." || true)" -gt 0 ]]; then
    aborted=1; break
  fi
  sleep 2
done
[[ "$aborted" == 1 ]] || fail "Start mit Demo-Konto und bekanntem Passwort bricht nicht mit Meldung ab."
# Genau der Befehl aus der Meldung; exec ginge nicht, der api-Container laeuft nicht.
recovery="$(docker compose logs api </dev/null 2>&1 | sed -n 's/.*Setze es zurück mit `\(docker compose run --rm api reset-password [^`]*\)`.*/\1/p' | tail -n 1)"
[[ "$recovery" == "docker compose run --rm api reset-password $demo_email" ]] || fail "Meldung nennt den Ausweg nicht: '$recovery'."
status=0
docker compose run --rm -T api reset-password "$demo_email" </dev/null >demo-reset.log 2>/dev/null || status=$?
[[ "$status" == 0 ]] || fail "reset-password aus der Abbruchmeldung: Exit $status statt 0."
grep -qF "Neues Passwort für $demo_email:" demo-reset.log || fail "reset-password fuer das Demo-Konto: keine Erfolgszeile."
# restart statt up -d: up wartete auf den naechsten Neustart der Abbruchschleife.
docker compose restart api </dev/null >/dev/null 2>&1
ready=0
for _ in $(seq 1 60); do
  if docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[[ "$ready" == 1 ]] || fail "API startet nach reset-password nicht."
code="$(login "$demo_email" "$demo_password")"
[[ "$code" == 401 ]] || fail "Demo-Login nach reset-password: HTTP $code statt 401."
echo "DEMO-ABBRUCH OK"

echo "== Anmelde-Limit pro Geraet (FIX-01)"
# Erst nach dem Demo-Block: die Sperre wuerde sonst dessen Login treffen.
# Zwei Absender, eine Sperre: der Host sperrt nur sich selbst, ein zweiter
# Absender im Compose-Netz meldet sich in derselben Minute an, ein gefaelschter
# X-Forwarded-For-Kopf waehlt keinen neuen Topf, Refresh zaehlt nicht mit.
# Belegt ist damit: nginx reicht je Absenderadresse einen eigenen Topf durch.
# Ob nginx zwei echte Geraete im Heimnetz unterscheidet, haengt an Docker (siehe
# Konzept, Grenze) und bleibt eine Pruefung mit zwei Geraeten (02-VALIDATION).
wrong_login="{\"email\":\"$demo_email\",\"password\":\"falsches-passwort\"}"
limited=0
for attempt in $(seq 1 11); do
  code="$(login "$demo_email" falsches-passwort)"
  if [[ "$code" == 429 ]]; then limited=1; break; fi
  [[ "$code" == 401 ]] || fail "Fehlversuch $attempt vom Host: HTTP $code statt 401."
done
[[ "$limited" == 1 ]] || fail "Der Host ist nach 11 Fehlversuchen nicht gesperrt."
code="$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.9.9.9' \
  -d "$wrong_login" "http://localhost:${WQ_PORT}/api/v1/auth/login")"
[[ "$code" == 429 ]] || fail "Ein gefaelschter X-Forwarded-For-Kopf oeffnet einen neuen Topf: HTTP $code statt 429."
# busybox-wget endet bei 401 mit Exit ungleich 0; die Ausgabe wird trotzdem gebraucht.
second="$(docker compose exec -T db sh -c "wget -S -O /dev/null --header 'Content-Type: application/json' --post-data '$wrong_login' http://web:8080/api/v1/auth/login 2>&1" </dev/null || true)"
grep -q '401' <<<"$second" || fail "Der zweite Absender bekommt kein 401: $second"
if grep -q '429' <<<"$second"; then fail "Der zweite Absender ist mitgesperrt (429): $second"; fi
code="$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"refreshToken":"ungueltig"}' \
  "http://localhost:${WQ_PORT}/api/v1/auth/refresh")"
[[ "$code" == 401 ]] || fail "Refresh vom gesperrten Host: HTTP $code statt 401."
echo "RATE-LIMIT OK"

echo "SMOKE OK"
