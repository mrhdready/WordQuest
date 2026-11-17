#!/usr/bin/env bash
#
# Funktionspruefung fuer setup.sh (261025-fpi-03): Namensliste fuer das
# Zertifikat, Portpruefung mit echten Listenern, .env-Schreiben und die
# Startmeldung bei belegtem Port. setup.sh selbst laeuft nicht; geladen werden
# nur seine Funktionen in Spalte 0. Nur Bash-3.2-Mittel (macOS).
#
#   bash .planning/phases/01-safe-home-network-install/smoke/setup-functions-check.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
T="$(mktemp -d)"
LISTENER_PID=""
CONTAINER="wq-funktionen-$$"

fail() { echo "FUNKTIONEN FEHLER: $*" >&2; exit 1; }

cleanup() {
  if [[ -n "$LISTENER_PID" ]]; then kill "$LISTENER_PID" 2>/dev/null || true; wait "$LISTENER_PID" 2>/dev/null || true; fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$T"
}
trap cleanup EXIT

# Einzeilige Funktionen `name() { …; }` und mehrzeilige bis zur Zeile `}`.
awk '/^[a-z_]+\(\) *\{.*\}$/ { print; next }
  /^[a-z_]+\(\) *\{/ { open = 1 }
  open { print }
  open && /^}$/ { open = 0 }' "$ROOT/setup.sh" >"$T/functions.sh"
for f in valid_label bridge_gateways tls_names is_terminal own_port port_free port_usable choose_ports set_env start_stack; do
  grep -q "^$f()" "$T/functions.sh" || fail "Funktion $f fehlt in setup.sh (Spalte 0)."
done

# Stubs: hostname vorn im PATH, gesteuert ueber STUB_NAME, STUB_ADDR, STUB_ADDR_FAIL.
mkdir "$T/bin"
cat >"$T/bin/hostname" <<'EOF'
#!/bin/sh
if [ "${1:-}" = -I ]; then
  [ -z "${STUB_ADDR_FAIL:-}" ] || exit 1
  echo "$STUB_ADDR"
  exit 0
fi
echo "$STUB_NAME"
EOF
chmod +x "$T/bin/hostname"
export PATH="$T/bin:$PATH"

# Jede Pruefung laeuft in einer Subshell in einem eigenen Ordner mit .env;
# die stellt STUB_* und die Stub-Funktionen bereit.
load() {
  # shellcheck disable=SC1090
  . "$T/functions.sh"
  # Wie docker network inspect mit mehreren Netzen: eine Zeile je Netz (VM-Abnahme 2026-10-26).
  bridge_gateways() { [[ -z "${STUB_GW:-}" ]] || printf '%s \n' $STUB_GW; }
  is_terminal() { [[ "${STUB_TTY:-0}" == 1 ]]; }
  own_port() { if [[ "$1" == 8080 ]]; then echo "${STUB_OWN_HTTP:-}"; else echo "${STUB_OWN_HTTPS:-}"; fi; }
}
cases=0
ok() { cases=$((cases + 1)); }

echo "== valid_label"
for label in pi pi-5 "$(printf 'a%.0s' $(seq 1 63))"; do
  (load; valid_label "$label") || fail "valid_label lehnt '$label' ab."
  ok
done
for label in bad_name -x x- Pi 123 "$(printf 'a%.0s' $(seq 1 64))" ''; do
  if (load; valid_label "$label"); then fail "valid_label nimmt '$label' an."; fi
  ok
done

echo "== tls_names"
names() { (load; tls_names) 2>"$T/names.err"; }
got="$(STUB_NAME=Pi-Wohnzimmer STUB_ADDR='192.168.178.20 172.17.0.1 172.18.0.1 127.0.0.1 10.0.0.01 fd00::1' STUB_GW='172.17.0.1 172.18.0.1' names)"
[[ "$got" == pi-wohnzimmer,pi-wohnzimmer.local,pi-wohnzimmer.fritz.box,192.168.178.20,localhost,127.0.0.1 ]] \
  || fail "tls_names fuer Pi-Wohnzimmer: $got"
[[ ! -s "$T/names.err" ]] || fail "tls_names fuer Pi-Wohnzimmer warnt: $(cat "$T/names.err")"
ok
got="$(STUB_NAME=pi_1 STUB_ADDR='192.168.178.20' names)"
[[ "$got" == 192.168.178.20,localhost,127.0.0.1 ]] || fail "tls_names fuer pi_1: $got"
grep -qF 'Der Gerätename pi_1 passt nicht in das Zertifikat. WordQuest ist dann nur über die IP-Adresse erreichbar.' "$T/names.err" \
  || fail "tls_names fuer pi_1 ohne Warnung auf stderr."
ok
got="$(STUB_NAME=pi STUB_ADDR_FAIL=1 names)"
[[ "$got" == pi,pi.local,pi.fritz.box,localhost,127.0.0.1 ]] || fail "tls_names ohne hostname -I: $got"
ok
got="$(STUB_NAME=pi.fritz.box STUB_ADDR='' names)"
[[ "$got" == pi,pi.local,pi.fritz.box,localhost,127.0.0.1 ]] || fail "tls_names fuer pi.fritz.box: $got"
ok

echo "== set_env"
mkdir "$T/env"
cd "$T/env"
printf 'A=1\nB=2\n' >.env
chmod 600 .env
cp -p .env env.before
(load; set_env A 1)
cmp -s .env env.before || fail "set_env mit gleichem Wert aendert .env."
ok
(load; set_env B 3)
[[ "$(cat .env)" == "$(printf 'A=1\nB=3')" ]] || fail "set_env ersetzt nicht: $(cat .env | tr '\n' '|')"
[[ "$(ls -l .env | cut -c1-10)" == -rw------- ]] || fail "set_env aendert die Rechte von .env: $(ls -l .env | cut -c1-10)"
[[ ! -e .env.tmp ]] || fail "set_env laesst .env.tmp liegen."
ok
printf 'A=1' >.env
(load; set_env C 4)
[[ "$(cat .env)" == "$(printf 'A=1\nC=4')" ]] || fail "set_env haengt nicht als eigene Zeile an: $(cat .env | tr '\n' '|')"
ok

echo "== port_free mit echten Listenern"
probe_image="$(cd "$ROOT" && docker compose -f docker-compose.quick.yml config --images db </dev/null)"
docker image inspect "$probe_image" >/dev/null 2>&1 || docker pull -q "$probe_image" >/dev/null
export probe_image
P_DUAL=18491 P_V6=18492 P_DOCKER=18493 P_LO=18494 P_FREE1=18495 P_FREE2=18496 P_FREE3=18497
for p in $P_DUAL $P_V6 $P_DOCKER $P_LO $P_FREE1 $P_FREE2 $P_FREE3; do
  (load; port_free "$p") || fail "Port $p ist vor der Pruefung schon belegt; die Funktionspruefung braucht 18491-18497."
done
node -e '
  const net = require("net")
  const [dual, v6, lo] = process.argv.slice(1).map(Number)
  const specs = [{ port: dual, host: "::" }, { port: v6, host: "::", ipv6Only: true }, { port: lo, host: "127.0.0.1" }]
  let up = 0
  for (const s of specs) net.createServer().listen(s, () => { if (++up === specs.length) console.log("bereit") })
' "$P_DUAL" "$P_V6" "$P_LO" >"$T/listener.log" 2>&1 &
LISTENER_PID=$!
docker run -d --name "$CONTAINER" -p "$P_DOCKER:8080" --entrypoint sleep "$probe_image" 600 >/dev/null
for _ in $(seq 1 50); do grep -q bereit "$T/listener.log" && break; sleep 0.1; done
grep -q bereit "$T/listener.log" || fail "Listener starten nicht: $(cat "$T/listener.log")"
for p in $P_DUAL $P_V6 $P_DOCKER; do
  if (load; port_free "$p"); then fail "port_free meldet den belegten Port $p als frei."; fi
  ok
done
if [[ "$(uname -s)" == Darwin ]]; then
  echo "SKIP 127.0.0.1-Listener (macOS)"
else
  if (load; port_free "$P_LO"); then fail "port_free meldet den 127.0.0.1-Listener auf $P_LO als frei."; fi
  ok
fi
(load; port_free "$P_FREE1") || fail "port_free meldet den freien Port $P_FREE1 als belegt."
ok

echo "== choose_ports"
mkdir "$T/ports"
cd "$T/ports"
reset_env() { printf 'COMPOSE_FILE=docker-compose.quick.yml\n' >.env; chmod 600 .env; cp -p .env env.before; }
# Standard und Ausweich zeigen auf Testports; 80/443 und 8080/8443 fasst die Pruefung nicht an.
# $1 Standard-HTTP, $2 Standard-HTTPS, $3 Ausweich-HTTP, $4 Ausweich-HTTPS; Eingabe auf stdin.
choose() {
  local status=0
  (load; http_default="$1"; https_default="$2"; http_alt="$3"; https_alt="$4"; choose_ports
    echo "PORTS $http_port $https_port"; IFS= read -r rest || rest="(leer)"; echo "REST $rest") >"$T/out" 2>&1 || status=$?
  return "$status"
}
unset WQ_HTTP_PORT WQ_HTTPS_PORT

reset_env
choose "$P_FREE1" "$P_FREE2" "$P_FREE3" "$P_FREE3" </dev/null || fail "choose_ports bei freien Ports: Exit ungleich 0: $(cat "$T/out")"
[[ "$(head -n 1 "$T/out")" == "PORTS $P_FREE1 $P_FREE2" ]] || fail "choose_ports bei freien Ports gibt etwas aus: $(cat "$T/out")"
cmp -s .env env.before || fail "choose_ports bei freien Ports aendert .env."
ok

reset_env
STUB_OWN_HTTP="$P_DUAL" choose "$P_DUAL" "$P_FREE2" "$P_FREE3" "$P_FREE3" </dev/null \
  || fail "choose_ports mit eigenem Container auf dem Port: $(cat "$T/out")"
[[ "$(head -n 1 "$T/out")" == "PORTS $P_DUAL $P_FREE2" ]] || fail "choose_ports mit eigenem Container: $(cat "$T/out")"
ok

reset_env
printf 'x\nj\nweiter\n' | STUB_TTY=1 choose "$P_DUAL" "$P_FREE2" "$P_FREE1" "$P_FREE3" \
  || fail "choose_ports mit x, j am Terminal: $(cat "$T/out")"
grep -qxF 'Bitte j oder n eingeben.' <(sed 's/\x1b\[[0-9;]*m//g' "$T/out") || fail "Kein Hinweis auf die ungueltige Eingabe x: $(cat "$T/out")"
grep -qF "✓ WordQuest nutzt die Ports $P_FREE1 und $P_FREE3." "$T/out" || fail "Keine Bestaetigung der Ausweichports: $(cat "$T/out")"
grep -qxF "PORTS $P_FREE1 $P_FREE3" "$T/out" || fail "Ausweichports nicht uebernommen: $(cat "$T/out")"
grep -qx "WQ_HTTP_PORT=$P_FREE1" .env && grep -qx "WQ_HTTPS_PORT=$P_FREE3" .env || fail ".env ohne Ausweichports: $(cat .env | tr '\n' '|')"
[[ "$(ls -l .env | cut -c1-10)" == -rw------- ]] || fail "choose_ports aendert die Rechte von .env."
grep -qxF 'REST weiter' "$T/out" || fail "choose_ports liest mehr als seine Antworten von stdin: $(cat "$T/out")"
ok

reset_env
status=0
printf 'n\n' | STUB_TTY=1 choose "$P_DUAL" "$P_FREE2" "$P_FREE1" "$P_FREE3" || status=$?
[[ "$status" == 1 ]] || fail "choose_ports mit n: Exit $status statt 1."
grep -qF "Dann gib die Ports $P_DUAL und $P_FREE2 frei oder trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT eigene Werte ein und starte ./setup.sh noch einmal." "$T/out" \
  || fail "choose_ports mit n: Meldung fehlt: $(cat "$T/out")"
cmp -s .env env.before || fail "choose_ports mit n aendert .env."
ok

reset_env
status=0
STUB_TTY=1 choose "$P_DUAL" "$P_FREE2" "$P_FREE1" "$P_FREE3" </dev/null || status=$?
[[ "$status" == 1 ]] || fail "choose_ports bei Eingabeende: Exit $status statt 1."
grep -qF 'Eingabe beendet, bevor die Ports feststanden. Es wurde nichts geändert.' "$T/out" || fail "choose_ports bei Eingabeende: $(cat "$T/out")"
cmp -s .env env.before || fail "choose_ports bei Eingabeende aendert .env."
ok

reset_env
printf 'erste\nzweite\n' >"$T/stdin"
status=0
{ STUB_TTY=0 choose "$P_DUAL" "$P_FREE2" "$P_FREE1" "$P_FREE3" || status=$?; IFS= read -r first; } <"$T/stdin"
[[ "$status" == 1 ]] || fail "choose_ports ohne Terminal: Exit $status statt 1."
grep -qF "Port $P_DUAL oder $P_FREE2 ist auf diesem Gerät schon belegt, und ohne Terminal fragt setup.sh nicht nach. Trage in .env WQ_HTTP_PORT=$P_FREE1 und WQ_HTTPS_PORT=$P_FREE3 ein und starte ./setup.sh noch einmal." "$T/out" \
  || fail "choose_ports ohne Terminal: Meldung fehlt: $(cat "$T/out")"
cmp -s .env env.before || fail "choose_ports ohne Terminal aendert .env."
[[ "$first" == erste ]] || fail "choose_ports ohne Terminal liest von stdin (naechste Zeile: '$first')."
ok

reset_env
status=0
WQ_HTTPS_PORT="$P_V6" choose "$P_FREE1" "$P_FREE2" "$P_FREE3" "$P_FREE3" </dev/null || status=$?
[[ "$status" == 1 ]] || fail "choose_ports mit belegtem WQ_HTTPS_PORT: Exit $status statt 1."
grep -qF "Auf diesem Gerät ist schon belegt: $P_V6. Trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT freie Werte ein, zum Beispiel 8081 und 8444, und starte ./setup.sh noch einmal." "$T/out" \
  || fail "choose_ports mit belegtem WQ_HTTPS_PORT: $(cat "$T/out")"
ok

reset_env
status=0
WQ_HTTPS_PORT="$P_FREE2" choose "$P_DOCKER" "$P_FREE1" "$P_FREE3" "$P_FREE3" </dev/null || status=$?
[[ "$status" == 1 ]] || fail "choose_ports mit gesetztem WQ_HTTPS_PORT und belegtem Standard-HTTP-Port: Exit $status statt 1."
grep -qF "Auf diesem Gerät ist schon belegt: $P_DOCKER." "$T/out" \
  || fail "choose_ports prueft den Standard-HTTP-Port nicht, wenn nur WQ_HTTPS_PORT gesetzt ist: $(cat "$T/out")"
ok

reset_env
status=0
printf 'j\n' | STUB_TTY=1 choose "$P_DUAL" "$P_FREE1" "$P_V6" "$P_DOCKER" || status=$?
[[ "$status" == 1 ]] || fail "choose_ports bei belegtem Standard und Ausweich: Exit $status statt 1."
grep -qF "Auf diesem Gerät ist schon belegt: $P_DUAL und $P_V6 und $P_DOCKER." "$T/out" \
  || fail "choose_ports nennt nicht alle belegten Ports: $(cat "$T/out")"
cmp -s .env env.before || fail "choose_ports bei belegtem Standard und Ausweich aendert .env."
ok

echo "== start_stack bei einem Port, der nach der Pruefung belegt wird"
mkdir "$T/docker"
cat >"$T/docker/docker" <<'EOF'
#!/bin/sh
if [ "$1 $2" = "compose up" ]; then
  echo "Error response from daemon: Bind for 0.0.0.0:18081 failed: port is already allocated" >&2
  exit 1
fi
exit 0
EOF
chmod +x "$T/docker/docker"
status=0
(PATH="$T/docker:$PATH"; load; http_port=18081; https_port=18441; start_stack) >"$T/out" 2>&1 || status=$?
[[ "$status" == 1 ]] || fail "start_stack bei belegtem Port: Exit $status statt 1."
grep -qF 'Ein Port für WordQuest ist schon belegt: 18081 oder 18441. Trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT freie Werte ein, zum Beispiel 8081 und 8444, und starte ./setup.sh noch einmal.' "$T/out" \
  || fail "start_stack: Meldung fehlt: $(cat "$T/out")"
ok

echo "Faelle: $cases"
echo "FUNKTIONEN OK"
