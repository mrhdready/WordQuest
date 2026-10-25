#!/usr/bin/env bash
# Prueft die X-Forwarded-For-Kette von nginx (frontend/nginx.conf; FIX-01, T-02-22,
# T-02-36) gegen einen Echo-Upstream, der den Kopf zurueckgibt, den nginx an die API
# schickt: Die API sieht genau die Adresse des Absenders, ein gefaelschter Kopf kommt
# nicht an, ueber HTTPS wie im Betrieb. Dazu die Sicherheits-Header an jedem Pfad
# (D-12, D-21) und die Umleitung von HTTP auf HTTPS ohne Strict-Transport-Security
# (OD-2, TLS-03).
# Ausserdem fuer jeden Dienst jeder Compose-Datei: Nur certs bindet das CA-Volume
# (Name endet auf -ca) ein, /etc/nginx/tls nur schreibgeschuetzt, certs ohne Netz,
# Ports und Secrets (TLS-01, T-fpi-01, T-fpi-08). Bind-Mounts auf /certs/ca zaehlen mit.
# Kein Dienst bindet etwas unter /etc/nginx/conf.d oder /etc/nginx/templates ein
# (FIX-01, T-fpi-12).
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
  docker rm -f "$NET-api" "$NET-home" "$NET-home443" >/dev/null 2>&1 || true
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

# Wegwerf-Zertifikat nur fuer dieses Gate (1 Tag); server.pem wie von `tls watch`
# mit Zertifikat und Schluessel. Gelesen vom nginx-Benutzer im Container.
mkdir -p "$TMP/tls"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -keyout "$TMP/tls/key.pem" -out "$TMP/tls/cert.pem" 2>/dev/null \
  || fail "openssl konnte kein Wegwerf-Zertifikat anlegen."
cat "$TMP/tls/cert.pem" "$TMP/tls/key.pem" >"$TMP/tls/server.pem"
chmod 755 "$TMP/tls"
chmod 644 "$TMP/tls/server.pem"

docker network create "$NET" >/dev/null
docker run -d --name "$NET-api" --network "$NET" --network-alias api \
  --mount "type=bind,src=$TMP/echo.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  "$IMAGE" >/dev/null

# Wartet, bis der Container $1 ueber nginx bis zum Echo-Upstream antwortet (Basis $2).
# Ohne Zertifikatspruefung: Das Wegwerf-Zertifikat ist nirgends vertraut.
wait_ready() {
  for _ in $(seq 1 30); do
    if docker exec "$1" wget -q --no-check-certificate -O /dev/null "$2/api/bereit" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  docker logs "$1" >&2 || true
  fail "$1 wurde nicht bereit."
}

# Schickt aus einem Wegwerf-Container im Pruefnetz eine Anfrage mit dem Kopf $2
# an $1 (Pfad $3, Standard /api/xff) ueber HTTPS; Ausgabe: Zeile 1 eigene Adresse,
# Zeile 2 der Kopf, den der Upstream sah.
send() {
  docker run --rm --network "$NET" --entrypoint sh "$IMAGE" -c \
    "hostname -i | awk '{print \$1}'; wget -q --no-check-certificate -O - --header 'X-Forwarded-For: $2' https://$1:8443${3:-/api/xff}"
}

wait_ready "$NET-api" http://127.0.0.1:8080

# Startet nginx.conf als Template wie im Web-Image; $2 ist der HTTPS-Port, den die
# Umleitung nennt.
start_home() {
  docker run -d --name "$1" --network "$NET" \
    -e "WQ_HTTPS_PORT=$2" -e NGINX_ENVSUBST_FILTER=WQ_ \
    --mount "type=bind,src=$ROOT/frontend/nginx.conf,dst=/etc/nginx/templates/default.conf.template,readonly" \
    --mount "type=bind,src=$ROOT/frontend/nginx-security-headers.conf,dst=/etc/nginx/security-headers.conf,readonly" \
    --mount "type=bind,src=$TMP/html,dst=/usr/share/nginx/html,readonly" \
    --mount "type=bind,src=$TMP/tls,dst=/etc/nginx/tls,readonly" \
    "$IMAGE" >/dev/null
  wait_ready "$1" https://127.0.0.1:8443
}

echo "== Heimnetz-Stack (frontend/nginx.conf, HTTPS)"
start_home "$NET-home" 8443
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

echo "== Sicherheits-Header (D-12, D-21)"
# Prueft je Pfad die Koepfe der Antwort von Container $1 (Stack $2).
check_headers() {
  local path resp
  for path in / /verwalten /index.html /assets/app.js /sw.js; do
    resp="$(docker exec "$1" wget -S --no-check-certificate -O /dev/null "https://127.0.0.1:8443$path" 2>&1)" \
      || fail "$2 $path: keine erfolgreiche Antwort."
    grep -q 'Content-Security-Policy: ' <<<"$resp" || fail "$2 $path: Content-Security-Policy fehlt."
    grep -q 'X-Frame-Options: DENY' <<<"$resp" || fail "$2 $path: X-Frame-Options: DENY fehlt."
    grep -q 'X-Content-Type-Options: nosniff' <<<"$resp" || fail "$2 $path: X-Content-Type-Options: nosniff fehlt."
    grep -q 'Referrer-Policy: same-origin' <<<"$resp" || fail "$2 $path: Referrer-Policy: same-origin fehlt."
    grep -q 'Permissions-Policy: ' <<<"$resp" || fail "$2 $path: Permissions-Policy fehlt."
    ! grep -qi 'Strict-Transport-Security' <<<"$resp" || fail "$2 $path: Strict-Transport-Security gesetzt."
  done
  # Die 404-Faelle (fehlendes Asset, 404 des Upstreams) prueft headers.spec gegen das
  # gebaute Image ueber HTTPS; roh per nc ginge nur ueber HTTP, und dort antwortet
  # nginx nur noch mit der Umleitung.
  echo "$2: Sicherheits-Header an allen Pfaden, kein Strict-Transport-Security"
}
check_headers "$NET-home" Heimnetz

echo "== Umleitung von HTTP auf HTTPS (OD-2, TLS-03)"
# Roh per BusyBox-nc auf 8080; $2 ist der erwartete Port in der Location.
check_redirect() {
  local resp
  resp="$(docker exec "$1" sh -c "printf 'GET /x?y=1 HTTP/1.0\r\nHost: wq.test\r\n\r\n' | nc 127.0.0.1 8080")" \
    || fail "$1: keine Antwort auf HTTP."
  resp="$(tr -d '\r' <<<"$resp")"
  sed -n 1p <<<"$resp" | grep -q ' 301 ' || fail "$1: HTTP antwortet nicht mit 301."
  grep -qx "Location: https://wq.test:$2/x?y=1" <<<"$resp" || fail "$1: Location ist nicht https://wq.test:$2/x?y=1."
  grep -q 'Content-Security-Policy: ' <<<"$resp" || fail "$1 (301): Content-Security-Policy fehlt."
  grep -q 'X-Frame-Options: DENY' <<<"$resp" || fail "$1 (301): X-Frame-Options: DENY fehlt."
  grep -q 'X-Content-Type-Options: nosniff' <<<"$resp" || fail "$1 (301): X-Content-Type-Options: nosniff fehlt."
  grep -q 'Referrer-Policy: same-origin' <<<"$resp" || fail "$1 (301): Referrer-Policy: same-origin fehlt."
  grep -q 'Permissions-Policy: ' <<<"$resp" || fail "$1 (301): Permissions-Policy fehlt."
  ! grep -qi 'Strict-Transport-Security' <<<"$resp" || fail "$1 (301): Strict-Transport-Security gesetzt."
  echo "HTTP auf https://wq.test:$2/x?y=1, Sicherheits-Header, kein Strict-Transport-Security"
}
check_redirect "$NET-home" 8443
start_home "$NET-home443" 443
check_redirect "$NET-home443" 443

echo "== CA-Volume nur im Dienst certs"
# node nur hier im Gate auf dem Entwicklungsrechner, nicht im Betrieb.
for file in docker-compose*.yml frontend/e2e/docker-compose.e2e.yml; do
  # Das Build-Overlay gilt nur zusammen mit der Betriebsdatei; allein fehlten certs
  # dort network_mode und Volumes.
  files=(-f "$file")
  [ "$file" != docker-compose.build.yml ] || files=(-f docker-compose.quick.yml -f "$file")
  json="$(docker compose "${files[@]}" config --format json 2>/dev/null)" \
    || fail "docker compose ${files[*]} config schlaegt fehl."
  problem="$(node -e '
    const config = JSON.parse(require("fs").readFileSync(0, "utf8"))
    for (const [name, service] of Object.entries(config.services ?? {})) {
      for (const volume of service.volumes ?? []) {
        if (name !== "certs" && (/-ca$/.test(volume.source ?? "") || (volume.target ?? "").startsWith("/certs/ca")))
          console.log(`Dienst ${name} bindet das CA-Volume ${volume.source} ein.`)
        if (volume.target === "/etc/nginx/tls" && !volume.read_only)
          console.log(`Dienst ${name} bindet /etc/nginx/tls nicht schreibgeschuetzt ein.`)
        // Eine eingebundene nginx-Konfiguration (etwa set_real_ip_from) umginge die XFF-Pruefung oben (FIX-01).
        if (/^\/etc\/nginx\/(conf\.d|templates)/.test(volume.target ?? ""))
          console.log(`Dienst ${name} bindet ${volume.target} ein; die XFF-Pruefung deckt nur frontend/nginx.conf ab.`)
      }
      if (name === "certs") {
        if (service.network_mode !== "none") console.log("Dienst certs hat Netz (network_mode ist nicht none).")
        if ((service.ports ?? []).length > 0) console.log("Dienst certs veroeffentlicht Ports.")
        if ((service.secrets ?? []).length > 0) console.log("Dienst certs bekommt Secrets.")
      }
    }' <<<"$json")" || fail "$file: Pruefung der Volumes schlaegt fehl."
  [ -z "$problem" ] || fail "$file: $problem"
  echo "$file: CA-Volume nur in certs"
done

echo "PROXY-XFF OK"
