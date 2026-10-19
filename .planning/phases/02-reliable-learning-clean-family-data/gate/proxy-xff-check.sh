#!/usr/bin/env bash
# Prueft die X-Forwarded-For-Kette beider nginx-Varianten (FIX-01, T-02-22, T-02-36)
# gegen einen Echo-Upstream, der den Kopf zurueckgibt, den nginx an die API schickt.
#   Heimnetz-Stack: nur frontend/nginx.conf; die API sieht genau die Adresse des
#     Absenders, ein gefaelschter Kopf kommt nicht an.
#   Traefik-Stack: zusaetzlich frontend/nginx-traefik-realip.conf; die API sieht
#     genau den letzten Wert (den von Traefik), ein vorangestellter kommt nicht an.
# Dazu die Sicherheits-Header beider Varianten an jedem Pfad, auch an Fehlerantworten
# (D-12, D-21), die Einbindung in docker-compose.yml und ein unveraendertes
# docker-compose.quick.yml.
#
# Aufruf (aus dem Repo-Root):
#   bash .planning/phases/02-reliable-learning-clean-family-data/gate/proxy-xff-check.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Basis-Image des Web-Containers (frontend/Dockerfile), kein neues Image.
IMAGE=nginxinc/nginx-unprivileged:alpine
NET="wq-xff-$$"
TMP="$(mktemp -d)"

cleanup() {
  docker rm -f "$NET-api" "$NET-home" "$NET-traefik" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

fail() { echo "PROXY-XFF FEHLER: $*" >&2; exit 1; }

# Echo-Upstream an Stelle der API (Netz-Alias api, wie in frontend/nginx.conf).
cat >"$TMP/echo.conf" <<'EOF'
server {
    listen 8080;
    location / {
        default_type text/plain;
        return 200 "$http_x_forwarded_for";
    }
    # Fehlerantwort des Upstreams fuer die Header-Pruefung.
    location = /api/fehlt {
        return 404;
    }
}
EOF
chmod 755 "$TMP"
chmod 644 "$TMP/echo.conf"

# Eigene Web-Wurzel: BusyBox-wget zeigt bei 404 keine Koepfe, deshalb muessen
# die Erfolgsfaelle der Header-Pruefung 200 liefern.
mkdir -p "$TMP/html/assets"
echo '<!doctype html><title>WordQuest</title>' >"$TMP/html/index.html"
echo '// sw' >"$TMP/html/sw.js"
echo '// app' >"$TMP/html/assets/app.js"
chmod 755 "$TMP/html" "$TMP/html/assets"
chmod 644 "$TMP/html/index.html" "$TMP/html/sw.js" "$TMP/html/assets/app.js"

docker network create "$NET" >/dev/null
docker run -d --name "$NET-api" --network "$NET" --network-alias api \
  --mount "type=bind,src=$TMP/echo.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  "$IMAGE" >/dev/null

# Wartet, bis der Container ueber nginx bis zum Echo-Upstream antwortet.
wait_ready() {
  for _ in $(seq 1 30); do
    if docker exec "$1" wget -q -O /dev/null http://127.0.0.1:8080/api/bereit 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  docker logs "$1" >&2 || true
  fail "$1 wurde nicht bereit."
}

# Schickt aus einem Wegwerf-Container im Pruefnetz eine Anfrage mit dem Kopf $2
# an $1 (Pfad $3, Standard /api/xff); Ausgabe: Zeile 1 eigene Adresse, Zeile 2
# der Kopf, den der Upstream sah.
send() {
  docker run --rm --network "$NET" --entrypoint sh "$IMAGE" -c \
    "hostname -i | awk '{print \$1}'; wget -q -O - --header 'X-Forwarded-For: $2' http://$1:8080${3:-/api/xff}"
}

wait_ready "$NET-api"

echo "== Heimnetz-Variante (frontend/nginx.conf)"
docker run -d --name "$NET-home" --network "$NET" \
  --mount "type=bind,src=$ROOT/frontend/nginx.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  --mount "type=bind,src=$TMP/html,dst=/usr/share/nginx/html,readonly" \
  "$IMAGE" >/dev/null
wait_ready "$NET-home"
out="$(send "$NET-home" '203.0.113.9')"
sender="$(sed -n 1p <<<"$out")"
seen="$(sed -n 2p <<<"$out")"
[[ -n "$sender" && "$seen" == "$sender" ]] \
  || fail "Heimnetz: die API sieht '$seen' statt der Absenderadresse '$sender'."
echo "Heimnetz: Absender $sender, die API sieht $seen"
# Jeder Proxy-Pfad, nicht nur /api/ (W-4).
out="$(send "$NET-home" '203.0.113.9' /health/xff)"
sender="$(sed -n 1p <<<"$out")"
seen="$(sed -n 2p <<<"$out")"
[[ -n "$sender" && "$seen" == "$sender" ]] \
  || fail "Heimnetz /health/: die API sieht '$seen' statt der Absenderadresse '$sender'."
echo "Heimnetz /health/: Absender $sender, die API sieht $seen"

echo "== Traefik-Variante (zusaetzlich frontend/nginx-traefik-realip.conf)"
[[ -f frontend/nginx-traefik-realip.conf ]] || fail "frontend/nginx-traefik-realip.conf fehlt."
docker run -d --name "$NET-traefik" --network "$NET" \
  --mount "type=bind,src=$ROOT/frontend/nginx.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  --mount "type=bind,src=$ROOT/frontend/nginx-traefik-realip.conf,dst=/etc/nginx/conf.d/realip.conf,readonly" \
  --mount "type=bind,src=$TMP/html,dst=/usr/share/nginx/html,readonly" \
  "$IMAGE" >/dev/null
wait_ready "$NET-traefik"
# Der Absender steht an Stelle von Traefik; 203.0.113.9 hat das Geraet vorangestellt.
out="$(send "$NET-traefik" '203.0.113.9, 198.51.100.7')"
seen="$(sed -n 2p <<<"$out")"
[[ "$seen" == "198.51.100.7" ]] \
  || fail "Traefik: die API sieht '$seen' statt genau 198.51.100.7."
echo "Traefik: die API sieht $seen"
# Im Heimnetz ist die Geraeteadresse selbst privat; mit real_ip_recursive on
# wuerde nginx sie als Proxy ueberspringen und den vorangestellten Wert nehmen.
out="$(send "$NET-traefik" '203.0.113.9, 192.168.178.20')"
seen="$(sed -n 2p <<<"$out")"
[[ "$seen" == "192.168.178.20" ]] \
  || fail "Traefik: bei privater Geraeteadresse sieht die API '$seen' statt genau 192.168.178.20."
echo "Traefik (private Geraeteadresse): die API sieht $seen"

echo "== Sicherheits-Header (D-12, D-21)"
# Prueft je Pfad die Koepfe der Antwort von Container $1 (Variante $2).
check_headers() {
  local path resp
  for path in / /verwalten /index.html /assets/app.js /sw.js; do
    resp="$(docker exec "$1" wget -S -O /dev/null "http://127.0.0.1:8080$path" 2>&1)" \
      || fail "$2 $path: keine erfolgreiche Antwort."
    grep -q 'Content-Security-Policy: ' <<<"$resp" || fail "$2 $path: Content-Security-Policy fehlt."
    grep -q 'X-Frame-Options: DENY' <<<"$resp" || fail "$2 $path: X-Frame-Options: DENY fehlt."
  done
  # Fehlerantworten roh per BusyBox-nc, weil wget bei 404 keine Koepfe zeigt:
  # fehlendes Asset (nginx selbst) und 404 des Upstreams.
  for path in /assets/gibt-es-nicht.js /api/fehlt; do
    resp="$(docker exec "$1" sh -c "printf 'GET $path HTTP/1.0\r\nHost: localhost\r\n\r\n' | nc 127.0.0.1 8080")" \
      || fail "$2 $path: keine Antwort."
    resp="$(tr -d '\r' <<<"$resp")"
    sed -n 1p <<<"$resp" | grep -q ' 404 ' || fail "$2 $path: Status ist nicht 404."
    grep -q 'Content-Security-Policy: ' <<<"$resp" || fail "$2 $path (404): Content-Security-Policy fehlt."
    grep -q 'X-Frame-Options: DENY' <<<"$resp" || fail "$2 $path (404): X-Frame-Options: DENY fehlt."
  done
  echo "$2: Sicherheits-Header an allen Pfaden, auch an 404"
}
check_headers "$NET-home" Heimnetz
check_headers "$NET-traefik" Traefik

echo "== Einbindung in den Compose-Dateien"
config="$(docker compose -f docker-compose.yml config 2>/dev/null)" \
  || fail "docker compose -f docker-compose.yml config schlaegt fehl."
grep -q 'nginx-traefik-realip.conf' <<<"$config" \
  || fail "docker-compose.yml bindet frontend/nginx-traefik-realip.conf nicht ein."
grep -q '/etc/nginx/conf.d/realip.conf' <<<"$config" \
  || fail "docker-compose.yml bindet die Datei nicht nach /etc/nginx/conf.d/realip.conf ein."
git diff --quiet HEAD -- docker-compose.quick.yml \
  || fail "docker-compose.quick.yml hat nicht committete Aenderungen."
# Auch committet darf der Heimnetz-Stack realip nie einbinden.
quick="$(docker compose -f docker-compose.quick.yml config 2>/dev/null)" \
  || fail "docker compose -f docker-compose.quick.yml config schlaegt fehl."
if grep -q 'realip' <<<"$quick"; then
  fail "docker-compose.quick.yml bindet realip ein; Geraete im Heimnetz koennten ihre Adresse selbst waehlen."
fi

echo "PROXY-XFF OK"
