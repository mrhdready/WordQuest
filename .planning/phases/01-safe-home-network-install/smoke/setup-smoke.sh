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
export WQ_HTTP_PORT=18081
export WQ_HTTPS_PORT=18441
export COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml
export WQ_IMAGE_PREFIX=wq-smoke
# Eindeutiger Tag je Lauf: ein aelteres lokales Image (Default "master")
# darf den Lauf nicht bedienen.
export WQ_VERSION=smoke-$(date +%s)-$$

fail() { echo "SMOKE FEHLER: $*" >&2; exit 1; }

cleanup() {
  (cd "$WORK" && COMPOSE_PROJECT_NAME=wq-smoke-port docker compose down -v --remove-orphans </dev/null >/dev/null 2>&1) || true
  (cd "$WORK" && docker compose down -v --remove-orphans </dev/null >/dev/null 2>&1) || true
  docker image rm "wq-smoke-api:${WQ_VERSION}" "wq-smoke-web:${WQ_VERSION}" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "== Funktionen von setup.sh"
bash "$ROOT/.planning/phases/01-safe-home-network-install/smoke/setup-functions-check.sh" >"$WORK.functions.log" 2>&1 \
  || { cat "$WORK.functions.log"; rm -f "$WORK.functions.log"; fail "Funktionspruefung von setup.sh rot."; }
cat "$WORK.functions.log"
[[ "$(tail -n 1 "$WORK.functions.log")" == "FUNKTIONEN OK" ]] || fail "Funktionspruefung endet nicht mit FUNKTIONEN OK."
rm -f "$WORK.functions.log"

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

# Anfragen an WordQuest per HTTPS, mit der eigenen CA als einzigem Vertrauensanker.
curl_wq() { curl --cacert "$WORK/ca.pem" "$@"; }

login() {
  curl_wq -s -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    "https://localhost:${WQ_HTTPS_PORT}/api/v1/auth/login"
}

tenants() {
  docker compose exec -T db psql -U wordquest -d wordquest -tAc 'select count(*) from tenant' </dev/null | tr -d '[:space:]'
}

echo "== Lauf 1"
printf '%s\n' wq-smoke keine-mail eltern@example.de kurz geheim-123 geheim-123 \
  | ./setup.sh 2>&1 | tee run1.log
grep -qF 'Das sieht nicht nach einer E-Mail-Adresse aus. Bitte noch einmal.' run1.log || fail "Kein Hinweis auf ungueltige E-Mail."
grep -qF 'Das Passwort muss mindestens 8 Zeichen lang sein.' run1.log || fail "Kein Hinweis auf zu kurzes Passwort."
grep -qF 'Fertig. WordQuest läuft unter: https://' run1.log || fail "Abschlusszeile fehlt."
for line in '✓ Zertifikat ist bereit.' '✓ WordQuest antwortet über HTTPS.' \
  'Fingerabdruck von WordQuest (SHA-256): ' 'Fingerabdruck der Zertifizierungsstelle (SHA-256): '; do
  grep -qF "$line" run1.log || fail "Lauf 1 ohne Zeile: $line"
done
if grep -qF "$demo_email" run1.log; then fail "Ausgabe nennt den Demo-Zugang."; fi
if grep -qF 'geheim-123' run1.log; then fail "Ausgabe enthaelt das Passwort."; fi
if grep -qF 'ist schon belegt' run1.log; then fail "Lauf 1 meldet einen belegten Port."; fi

running="$(docker inspect -f '{{.Image}}' "$(docker compose ps -q api)")"
built="$(docker image inspect -f '{{.Id}}' "wq-smoke-api:${WQ_VERSION}")"
[[ "$running" == "$built" ]] || fail "API läuft nicht mit dem frisch gebauten Image."
echo "IMAGE OK"

docker compose exec -T certs cat /certs/ca/ca.crt </dev/null >"$WORK/ca.pem" || fail "CA nicht lesbar."

echo "== API-Log beim ersten Start (leere Datenbank)"
# Eltern lesen fail: als Fehler; erwartbare Meldungen der Migration gehoeren nicht dazu.
docker compose logs --no-color api </dev/null >api-first-start.log 2>&1
cat api-first-start.log
[[ "$(grep -cE '(^|\| )(fail|crit): ' api-first-start.log || true)" -eq 0 ]] \
  || fail "API-Log beim ersten Start enthaelt fail:/crit:."
# DataProtection nutzt WordQuest nicht; seine Warnungen zu Schluesseln im Container
# wuerden Eltern nur verunsichern.
[[ "$(grep -cE '(^|\| )warn: Microsoft\.AspNetCore\.DataProtection' api-first-start.log || true)" -eq 0 ]] \
  || fail "API-Log beim ersten Start enthaelt warn: von DataProtection."
echo "STARTLOG OK"

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

echo "== TLS: Download, Rechte, Namensaenderung, Erneuerung, kaputte Dateien (261025-fpi-03)"
# Werte aus den Ausgaben von setup.sh, ohne Farbcodes.
plain() { sed 's/\x1b\[[0-9;]*m//g' "$1"; }
ca_fp() { plain "$1" | sed -n 's/.*Fingerabdruck der Zertifizierungsstelle (SHA-256): \([0-9A-F:]*\).*/\1/p' | tail -n 1; }
server_fp() { plain "$1" | sed -n 's/.*Fingerabdruck von WordQuest (SHA-256): \([0-9A-F:]*\).*/\1/p' | tail -n 1; }
# SHA-256 einer Datei in der Schreibweise der Fingerabdruecke.
fp_of() { shasum -a 256 "$1" | awk '{ print toupper($1) }' | sed 's/../&:/g; s/:$//'; }
serial() {
  openssl s_client -connect "127.0.0.1:${WQ_HTTPS_PORT}" -servername localhost </dev/null 2>/dev/null \
    | openssl x509 -noout -serial 2>/dev/null | sed 's/^serial=//'
}
web_id() { docker compose ps -q web </dev/null; }
nginx_state() {
  printf '%s %s' "$(docker inspect -f '{{.State.StartedAt}}' "$(web_id)")" \
    "$(docker compose exec -T web cat /tmp/nginx.pid </dev/null)"
}
certs_lines() { docker compose logs --no-color --no-log-prefix certs </dev/null 2>&1 | grep -cF "$1" || true; }
ca1="$(ca_fp run1.log)"
[[ -n "$ca1" ]] || fail "Lauf 1 nennt keinen Fingerabdruck der Zertifizierungsstelle."

# Download der CA: dieselbe CA wie im Fingerabdruck (T-fpi-14).
curl -fsS -o ca-download.crt "http://localhost:${WQ_HTTP_PORT}/wordquest-ca.crt" || fail "CA-Download fehlgeschlagen."
[[ "$(fp_of ca-download.crt)" == "$ca1" ]] || fail "CA-Download: SHA-256 $(fp_of ca-download.crt) statt $ca1."

# Rechte und Einbindung (Codex 10, T-fpi-17).
[[ "$(docker compose exec -T certs stat -c '%a' /certs/ca/ca.key </dev/null)" == 600 ]] || fail "ca.key hat nicht die Rechte 600."
[[ "$(docker compose exec -T web stat -c '%a %g' /etc/nginx/tls/server.pem </dev/null)" == "640 101" ]] \
  || fail "server.pem im web-Container nicht 640 mit Gruppe 101."
[[ "$(docker compose exec -T web ls /etc/nginx/tls </dev/null | tr '\n' ' ')" == "server.pem wordquest-ca.crt " ]] \
  || fail "Unter /etc/nginx/tls liegt mehr als server.pem und wordquest-ca.crt."
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$(docker compose ps -q certs </dev/null)")" == none ]] \
  || fail "certs hat ein Netz."
web_mounts="$(docker inspect -f '{{range .Mounts}}{{.Name}} {{.Destination}}{{"\n"}}{{end}}' "$(web_id)")"
if grep -qE '(^| )/certs/ca|^wq-smoke_tls-ca ' <<<"$web_mounts"; then fail "web bindet das CA-Volume ein: $web_mounts"; fi
docker compose ps </dev/null >compose-ps.log
for service in api backup certs db web; do
  grep -E "[[:space:]]${service}[[:space:]]" compose-ps.log | grep -q 'Up' || fail "docker compose ps zeigt $service nicht mit Up."
done

# Namensaenderung ab dem naechsten ./setup.sh, ohne nginx-Neustart und ohne neue CA.
mkdir -p stub
printf '%s\n' '#!/bin/sh' '[ "${1:-}" = -I ] && exit 1' 'echo wqsmoke2' >stub/hostname
chmod +x stub/hostname
before_nginx="$(nginx_state)"
PATH="$WORK/stub:$PATH" ./setup.sh </dev/null >tls-name.log 2>&1 || { cat tls-name.log; fail "setup.sh mit neuem Geraetenamen endete nicht mit 0."; }
grep -qx 'WQ_TLS_NAMES=wqsmoke2,wqsmoke2.local,wqsmoke2.fritz.box,localhost,127.0.0.1' .env || fail ".env ohne neue Namensliste."
curl -fsS -o /dev/null --cacert "$WORK/ca.pem" --resolve "wqsmoke2.local:${WQ_HTTPS_PORT}:127.0.0.1" "https://wqsmoke2.local:${WQ_HTTPS_PORT}/" \
  || fail "Kein Handshake fuer wqsmoke2.local mit der CA."
[[ "$(ca_fp tls-name.log)" == "$ca1" ]] || fail "Namensaenderung hat die CA gewechselt."
[[ -n "$(server_fp tls-name.log)" && "$(server_fp tls-name.log)" != "$(server_fp run1.log)" ]] || fail "Namensaenderung ohne neues Server-Zertifikat."
[[ "$(nginx_state)" == "$before_nginx" ]] || fail "nginx wurde bei der Namensaenderung neu gestartet ($before_nginx -> $(nginx_state))."
./setup.sh </dev/null >tls-name-back.log 2>&1 || { cat tls-name-back.log; fail "setup.sh mit dem alten Namen endete nicht mit 0."; }
if grep -qF 'ist schon belegt' run2.log tls-name.log tls-name-back.log; then fail "Ein Lauf im laufenden Stack meldet einen belegten Port."; fi
echo "TLS-NAME OK"

# Erneuerung durch watch: Neustart ohne Anlass aendert nichts (Negativkontrolle).
serial_before="$(serial)"
[[ -n "$serial_before" ]] || fail "Seriennummer nicht lesbar."
current="$(certs_lines 'ist aktuell')"
docker compose restart certs </dev/null >/dev/null 2>&1
for _ in $(seq 1 30); do [[ "$(certs_lines 'ist aktuell')" -gt "$current" ]] && break; sleep 1; done
[[ "$(certs_lines 'ist aktuell')" -gt "$current" ]] || fail "certs meldet nach dem Neustart nicht 'ist aktuell'."
[[ "$(serial)" == "$serial_before" ]] || fail "Neustart ohne Anlass hat das Zertifikat erneuert."
# Zertifikat mit nur 10 Tagen Laufzeit von derselben CA, Seriennummer 4242 (0x1092).
# Der CA-Schluessel liegt dafuer kurz im Arbeitsordner und wird gleich wieder geloescht.
names_now="$(docker compose exec -T certs printenv WQ_TLS_NAMES </dev/null)"
san="$(printf '%s\n' "$names_now" | tr ',' '\n' | awk '/^[0-9.]+$/ { printf "%sIP:%s", sep, $0; sep = ","; next } { printf "%sDNS:%s", sep, $0; sep = "," }')"
printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\n' "$san" >short.ext
docker compose exec -T certs cat /certs/ca/ca.key </dev/null >ca-key.tmp
openssl req -new -newkey rsa:2048 -nodes -keyout short.key -subj /CN=localhost -out short.csr 2>/dev/null
openssl x509 -req -in short.csr -CA "$WORK/ca.pem" -CAkey ca-key.tmp -set_serial 4242 -days 10 -extfile short.ext -out short.crt 2>/dev/null \
  || { rm -f ca-key.tmp; fail "Kurzes Zertifikat liess sich nicht ausstellen."; }
rm -f ca-key.tmp
cat short.crt short.key | docker compose exec -T certs sh -c 'cat > /certs/tls/server.pem'
rm -f short.key short.csr
[[ "$(serial)" == 1092 ]] || fail "nginx liefert das kurze Zertifikat nicht aus (Seriennummer $(serial))."
before_nginx="$(nginx_state)"
docker compose restart certs </dev/null >/dev/null 2>&1
renewed=""
for _ in $(seq 1 30); do
  renewed="$(serial)"
  [[ -n "$renewed" && "$renewed" != 1092 ]] && break
  sleep 1
done
[[ -n "$renewed" && "$renewed" != 1092 ]] || fail "certs hat das Zertifikat mit 10 Tagen Rest nicht erneuert."
curl -fsS -o /dev/null --cacert "$WORK/ca.pem" "https://localhost:${WQ_HTTPS_PORT}/" || fail "Erneuertes Zertifikat stammt nicht von der CA."
docker compose exec -T certs dotnet WordQuest.Api.dll tls show </dev/null >tls-show.log
[[ "$(ca_fp tls-show.log)" == "$ca1" ]] || fail "Erneuerung hat die CA gewechselt."
[[ "$(nginx_state)" == "$before_nginx" ]] || fail "nginx wurde bei der Erneuerung neu gestartet."
[[ "$(certs_lines '✓ Zertifikat für WordQuest erneuert')" -gt 0 ]] || fail "certs-Log ohne '✓ Zertifikat für WordQuest erneuert'."
echo "TLS-ERNEUERUNG OK"

# Kaputte server.pem: wait_https meldet den Fehler statt Erfolg, ./setup.sh heilt (Codex 6).
printf 'kaputt\n' | docker compose exec -T certs sh -c 'cat > /certs/tls/server.pem'
awk '/^(say|die)\(\)/ { print; next } /^wait_https\(\) \{/ { open = 1 } open { print } open && /^}$/ { open = 0 }' setup.sh >wait-https.sh
status=0
(. ./wait-https.sh; wait_https "$WQ_HTTPS_PORT") >tls-broken.log 2>&1 || status=$?
[[ "$status" != 0 ]] || fail "wait_https mit kaputter server.pem: Exit 0."
grep -qF 'WordQuest antwortet nicht über HTTPS.' tls-broken.log || fail "wait_https ohne Meldung: $(cat tls-broken.log)"
./setup.sh </dev/null >tls-heal.log 2>&1 || { cat tls-heal.log; fail "setup.sh nach kaputter server.pem endete nicht mit 0."; }
grep -qF '✓ WordQuest antwortet über HTTPS.' tls-heal.log || fail "setup.sh heilt die kaputte server.pem nicht."
echo "TLS-KAPUTT OK"

# Unvollstaendige CA: Abbruch mit Meldung, ca.key bleibt; der Ausweg der Anleitung
# legt eine neue CA an (Codex 2).
key_sum() { docker compose run --rm --no-deps -T --entrypoint sha256sum certs /certs/ca/ca.key </dev/null 2>/dev/null | awk '{ print $1 }'; }
key_before="$(docker compose exec -T certs sha256sum /certs/ca/ca.key </dev/null | awk '{ print $1 }')"
docker compose exec -T certs rm /certs/ca/ca.crt </dev/null
status=0
./setup.sh </dev/null >tls-ca.log 2>&1 || status=$?
cat tls-ca.log
[[ "$status" != 0 ]] || fail "setup.sh mit unvollstaendiger CA: Exit 0."
grep -qF 'Die Zertifizierungsstelle ist unvollständig' tls-ca.log || fail "Keine Meldung zur unvollstaendigen CA."
grep -qF 'Zertifizierungsstelle neu anlegen' tls-ca.log || fail "Meldung nennt den Ausweg nicht."
if grep -qF 'Fertig.' tls-ca.log; then fail "setup.sh meldet trotz unvollstaendiger CA Erfolg."; fi
[[ -n "$key_before" && "$(key_sum)" == "$key_before" ]] || fail "ca.key hat sich geaendert."
docker compose down </dev/null >/dev/null 2>&1
docker volume rm "${COMPOSE_PROJECT_NAME}_tls-ca" "${COMPOSE_PROJECT_NAME}_tls" >/dev/null
./setup.sh </dev/null >tls-new-ca.log 2>&1 || { cat tls-new-ca.log; fail "setup.sh nach dem Ausweg endete nicht mit 0."; }
[[ -n "$(ca_fp tls-new-ca.log)" && "$(ca_fp tls-new-ca.log)" != "$ca1" ]] || fail "Ausweg ohne neue CA."
docker compose exec -T certs cat /certs/ca/ca.crt </dev/null >"$WORK/ca.pem"
code="$(login eltern@example.de geheim-123)"
[[ "$code" == 200 ]] || fail "Login nach dem Ausweg: HTTP $code statt 200."
echo "TLS-CA OK"
echo "TLS OK"

echo "== Port belegt (Setup-Hinweis)"
# Der Stack wq-smoke haelt beide Ports; ein zweites Projekt im selben Ordner bekommt den Port nicht.
status=0
COMPOSE_PROJECT_NAME=wq-smoke-port ./setup.sh </dev/null >port.log 2>&1 || status=$?
cat port.log
[[ "$status" != 0 ]] || fail "setup.sh bei belegtem Port: Exit 0."
# Die Vorpruefung erkennt beide Ports vor dem Start; Docker kommt gar nicht zum Zug.
grep -qF "Auf diesem Gerät ist schon belegt: ${WQ_HTTP_PORT} und ${WQ_HTTPS_PORT}." port.log || fail "Kein deutscher Hinweis auf die belegten Ports."
grep -qF 'WQ_HTTP_PORT und WQ_HTTPS_PORT' port.log || fail "Hinweis nennt WQ_HTTP_PORT und WQ_HTTPS_PORT nicht."
COMPOSE_PROJECT_NAME=wq-smoke-port docker compose down -v --remove-orphans </dev/null
code="$(curl_wq -s -o /dev/null -w '%{http_code}' "https://localhost:${WQ_HTTPS_PORT}/")"
[[ "$code" == 200 ]] || fail "Stack wq-smoke nach dem Port-Test: HTTP $code statt 200."
echo "PORT-HINWEIS OK"

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
WQ_E2E_FIRST_RUN=1 WQ_E2E_BASE_URL="http://localhost:${WQ_HTTP_PORT}" \
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
code="$(curl_wq -s -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.9.9.9' \
  -d "$wrong_login" "https://localhost:${WQ_HTTPS_PORT}/api/v1/auth/login")"
[[ "$code" == 429 ]] || fail "Ein gefaelschter X-Forwarded-For-Kopf oeffnet einen neuen Topf: HTTP $code statt 429."
# busybox-wget endet bei 401 mit Exit ungleich 0; die Ausgabe wird trotzdem gebraucht.
second="$(docker compose exec -T db sh -c "wget -S -O /dev/null --header 'Content-Type: application/json' --post-data '$wrong_login' http://web:8080/api/v1/auth/login 2>&1" </dev/null || true)"
grep -q '401' <<<"$second" || fail "Der zweite Absender bekommt kein 401: $second"
if grep -q '429' <<<"$second"; then fail "Der zweite Absender ist mitgesperrt (429): $second"; fi
code="$(curl_wq -s -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' -d '{"refreshToken":"ungueltig"}' \
  "https://localhost:${WQ_HTTPS_PORT}/api/v1/auth/refresh")"
[[ "$code" == 401 ]] || fail "Refresh vom gesperrten Host: HTTP $code statt 401."
echo "RATE-LIMIT OK"

echo "SMOKE OK"
