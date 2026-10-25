#!/usr/bin/env bash
#
# WordQuest — Ersteinrichtung im Heimnetz
# Erzeugt Secrets und .env, faehrt den Stack hoch und legt das Elternkonto an.
# Ein zweiter Lauf aendert nichts an Secrets oder Konto; .env nur, wenn sich
# Name oder Adressen des Geraets geaendert haben (Namensliste fuer das Zertifikat).
#
set -euo pipefail

cd "$(dirname "$0")"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# Letzter Wert einer Variable aus .env, leer wenn nicht gesetzt.
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }

# Setzt NAME=WERT in .env. Steht genau dieser Wert schon da, bleibt die Datei bytegleich.
# BSD/GNU sed kompatibel: temporaere Datei statt -i. cp -p zuerst: Die Umleitung in eine
# bestehende Datei behaelt deren Rechte (wie upgrade.sh, WR-01).
set_env() {
  [[ "$(env_value "$1")" == "$2" ]] && return 0
  if grep -qE "^$1=" .env; then
    cp -p .env .env.tmp && sed -e "s|^$1=.*|$1=$2|" .env >.env.tmp && mv .env.tmp .env
  else
    # Fehlt das letzte Zeilenende, klebte die neue Zeile an der letzten Variable (IN-02).
    cp -p .env .env.tmp && { cat .env; [[ -z "$(tail -c 1 .env)" ]] || echo; printf '%s=%s\n' "$1" "$2"; } >.env.tmp && mv .env.tmp .env
  fi
}

# Namensregel wie `tls watch` (TlsCertificates.TryParseNames, Codex 8): ein Label aus
# Kleinbuchstaben, Ziffern und Bindestrich, hoechstens 63 Zeichen, nicht nur aus Ziffern.
valid_label() {
  local re='^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
  [[ "$1" =~ $re && ! "$1" =~ ^[0-9]+$ ]]
}

# Gateways aller Docker-Netze: Sie stehen in `hostname -I`, sind von anderen Geraeten
# aus aber nicht erreichbar und gehoeren nicht ins Zertifikat (OU-2).
bridge_gateways() { docker network inspect $(docker network ls -q 2>/dev/null) --format '{{range .IPAM.Config}}{{.Gateway}} {{end}}' </dev/null 2>/dev/null || true; }

# Namensliste fuer WQ_TLS_NAMES (OD-1): Kurzname, .local, .fritz.box, die IPv4-Adressen
# des Geraets, localhost und 127.0.0.1, kommagetrennt.
tls_names() {
  local name ip gateways list=""
  local ipv4='^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$'
  name="$(hostname 2>/dev/null || true)"
  name="$(printf '%s' "${name%%.*}" | tr '[:upper:]' '[:lower:]')"
  if valid_label "$name"; then
    list="${name},${name}.local,${name}.fritz.box,"
  else
    warn "Der Gerätename ${name} passt nicht in das Zertifikat. WordQuest ist dann nur über die IP-Adresse erreichbar." >&2
  fi
  gateways=" $(bridge_gateways) "
  for ip in $(hostname -I 2>/dev/null || true); do
    [[ "$ip" =~ $ipv4 && "$ip" != 127.0.0.1 && "$gateways" != *" $ip "* ]] || continue
    list="${list}${ip},"
  done
  printf '%s\n' "${list}localhost,127.0.0.1"
}

is_terminal() { [[ -t 0 ]]; }

# Host-Port, auf dem der eigene laufende web-Container den Containerport anbietet, sonst leer.
own_port() { docker compose port web "$1" </dev/null 2>/dev/null | head -n 1 | sed 's/.*://' || true; }

# Echter Bind ueber Docker auf allen Adressen; jeder Fehlschlag gilt als belegt (OD-2).
port_free() { docker run --rm --entrypoint true -p "$1:8080" "$probe_image" </dev/null >/dev/null 2>&1; }

# Nutzbar: der eigene Container haelt den Port schon, oder er ist frei.
port_usable() { [[ "$(own_port "$2")" == "$1" ]] || port_free "$1"; }

# Waehlt die Ports vor dem Start (OD-2). Gesetzte Werte gelten, wie sie sind; ist der
# Standard belegt, fragt setup.sh nur am Terminal nach dem Ausweich und liest sonst
# nichts von stdin.
choose_ports() {
  local set_http set_https busy="" alt_busy="" answer
  set_http="${WQ_HTTP_PORT:-$(env_value WQ_HTTP_PORT)}"
  set_https="${WQ_HTTPS_PORT:-$(env_value WQ_HTTPS_PORT)}"
  http_port="${set_http:-$http_default}"
  https_port="${set_https:-$https_default}"
  port_usable "$http_port" 8080 || busy="$http_port"
  port_usable "$https_port" 8443 || busy="${busy:+$busy und }$https_port"
  [[ -n "$busy" ]] || return 0
  if [[ -z "$set_http$set_https" ]]; then
    port_usable "$http_alt" 8080 || alt_busy=" und $http_alt"
    port_usable "$https_alt" 8443 || alt_busy="$alt_busy und $https_alt"
  fi
  if [[ -n "$set_http$set_https$alt_busy" ]]; then
    die "Auf diesem Gerät ist schon belegt: ${busy}${alt_busy}. Trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT freie Werte ein, zum Beispiel 8081 und 8444, und starte ./setup.sh noch einmal."
  fi
  is_terminal || die "Port ${http_default} oder ${https_default} ist auf diesem Gerät schon belegt, und ohne Terminal fragt setup.sh nicht nach. Trage in .env WQ_HTTP_PORT=${http_alt} und WQ_HTTPS_PORT=${https_alt} ein und starte ./setup.sh noch einmal."
  while true; do
    read -rp "Port ${http_default} oder ${https_default} ist auf diesem Gerät schon belegt. WordQuest kann stattdessen ${http_alt} und ${https_alt} nutzen; die Adresse endet dann auf :${https_alt}. Einverstanden? [J/n] " answer \
      || die "Eingabe beendet, bevor die Ports feststanden. Es wurde nichts geändert."
    case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
      ''|j|ja)
        set_env WQ_HTTP_PORT "$http_alt"
        set_env WQ_HTTPS_PORT "$https_alt"
        http_port="$http_alt"
        https_port="$https_alt"
        say "✓ WordQuest nutzt die Ports ${http_alt} und ${https_alt}."
        return 0
        ;;
      n|nein) die "Dann gib die Ports ${http_default} und ${https_default} frei oder trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT eigene Werte ein und starte ./setup.sh noch einmal." ;;
      *) warn "Bitte j oder n eingeben." ;;
    esac
  done
}

# Startet den Stack. Dockers englische Meldung zum belegten Port laesst Laien ohne Ausweg.
# tee in eine Datei statt Variable: Der Fortschritt bleibt live sichtbar (Warten auf db).
start_stack() {
  local log status=0 taken=0
  log="$(mktemp)"
  docker compose up -d </dev/null 2>&1 | tee "$log" >&2 || status=$?
  if grep -qE 'port is already allocated|address already in use' "$log"; then taken=1; fi
  rm -f "$log"
  if (( status != 0 )); then
    if [[ "$taken" == 1 ]]; then
      die "Ein Port für WordQuest ist schon belegt: ${http_port} oder ${https_port}. Trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT freie Werte ein, zum Beispiel 8081 und 8444, und starte ./setup.sh noch einmal."
    fi
    exit "$status"
  fi
  # Neustart, damit certs die Namensliste bei jedem Lauf sofort prueft; schreiben
  # darf nur certs selbst (`tls watch`), setup.sh liest danach nur.
  docker compose restart certs </dev/null >/dev/null 2>&1 \
    || die "Der Zertifikatsdienst ließ sich nicht neu starten. Sieh mit \`docker compose logs certs\` nach, was fehlt."
}

# Wartet, bis `tls show` das Zertifikat fuer die aktuelle Namensliste meldet, und merkt
# sich die Fingerabdruecke. Stoppt certs mit einer Meldung zur CA, kommt sie sofort.
wait_cert() {
  local last
  for _ in $(seq 1 60); do
    if fingerprints="$(docker compose exec -T certs dotnet WordQuest.Api.dll tls show </dev/null 2>/dev/null)"; then
      say "✓ Zertifikat ist bereit."
      return 0
    fi
    last="$(docker compose logs --no-color --no-log-prefix --tail 1 certs </dev/null 2>/dev/null || true)"
    if [[ "$last" == *"Es wurde nichts geändert."* ]]; then die "$last"; fi
    sleep 2
  done
  die "Das Zertifikat ist nach zwei Minuten nicht bereit. Sieh mit \`docker compose logs certs\` nach, was fehlt."
}

# Erfolg erst nach einem echten TLS-Handshake gegen die eigene CA (Codex 6).
wait_https() {
  local ca ok=0
  ca="$(mktemp)"
  if docker compose exec -T certs cat /certs/ca/ca.crt </dev/null >"$ca" 2>/dev/null; then
    for _ in $(seq 1 30); do
      if curl -fsS -o /dev/null --cacert "$ca" --resolve "localhost:$1:127.0.0.1" "https://localhost:$1/" 2>/dev/null; then
        ok=1
        break
      fi
      sleep 2
    done
  fi
  rm -f "$ca"
  [[ "$ok" == 1 ]] || die "WordQuest antwortet nicht über HTTPS. Sieh mit \`docker compose logs web\` nach, was fehlt."
  say "✓ WordQuest antwortet über HTTPS."
}

command -v docker >/dev/null || die "Docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' ist nicht verfügbar."

# --- Secrets -----------------------------------------------------------------
mkdir -p secrets
chmod 700 secrets

gen_secret() {
  # 48 Byte Zufall, base64, ohne Sonderzeichen die in Connection Strings stoeren.
  if command -v openssl >/dev/null; then
    openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48
  else
    head -c 64 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-48
  fi
}

for name in db_password jwt_key; do
  f="secrets/${name}.txt"
  if [[ -f "$f" ]]; then
    [[ -s "$f" ]] || die "secrets/${name}.txt ist leer. Lösche die Datei und starte setup.sh erneut."
    say "✓ secrets/${name}.txt existiert bereits — unverändert."
  else
    # Eigene Zuweisung: ein Fehler in $(...) als printf-Argument loest set -e nicht aus.
    secret="$(gen_secret)"
    (( ${#secret} >= 32 )) || die "Konnte kein Secret erzeugen. Ist openssl oder /dev/urandom verfügbar?"
    printf '%s' "$secret" > "$f"
    unset secret
    say "✓ secrets/${name}.txt erzeugt."
  fi
  # Einzelne read-only Dateimounts muessen fuer den Non-Root-Container lesbar sein.
  # Das Hostverzeichnis bleibt mit 0700 vor anderen Benutzern geschuetzt.
  chmod 644 "$f"
done

# --- Sicherungen -------------------------------------------------------------
# Die Dumps enthalten alle Familiendaten samt Passwort-Hashes: nur fuer den Besitzer.
mkdir -p backups
# Legt docker compose den Ordner zuerst an, gehoert er root; dann scheitert chmod.
[[ -O backups ]] || die "Der Ordner backups gehört nicht dir. Ändere den Besitzer mit: sudo chown -R \"\$(id -un)\" backups — und starte setup.sh erneut."
chmod 700 backups

# --- .env --------------------------------------------------------------------
if [[ -f .env ]]; then
  say "✓ .env existiert bereits — unverändert."
else
  # Erst fragen, dann .env in einem Schritt schreiben: ein Abbruch hinterlaesst keine halbe .env.
  # Eltern sollen keinen Registry-Pfad kennen muessen: Enter uebernimmt den Standard.
  # Eine Quelle fuer den Wert ist .env.example, nicht eine zweite Stelle hier (D-04).
  default_prefix="$(grep -E '^WQ_IMAGE_PREFIX=' .env.example | tail -n 1 | cut -d= -f2- || true)"
  while true; do
    read -rp "Image-Präfix [${default_prefix}], Enter übernimmt ihn: " prefix || die "Eingabe beendet, bevor .env fertig war."
    prefix="${prefix:-$default_prefix}"
    [[ "$prefix" =~ ^[a-z0-9._/:-]+$ ]] && break
    warn "Das Image-Präfix besteht aus Kleinbuchstaben, Ziffern und . _ / : - (z. B. ghcr.io/mein-account/wordquest)."
  done

  # BSD/GNU sed kompatibel: temporaere Datei statt -i.
  sed -e "s|^WQ_IMAGE_PREFIX=.*|WQ_IMAGE_PREFIX=${prefix}|" .env.example > .env.tmp && mv .env.tmp .env
  say "✓ .env angelegt."
fi

# Aeltere .env-Vorlagen hatten Demo-Daten an: dann gaebe es ein Konto mit bekanntem Passwort.
# .NET liest true ohne Ruecksicht auf Gross-/Kleinschreibung, auch in Anfuehrungszeichen.
seed_demo="$(env_value WQ_SEED_DEMO_DATA | tr -d "\"' " | tr '[:upper:]' '[:lower:]')"
if [[ "$seed_demo" == "true" ]]; then
  die "In .env steht WQ_SEED_DEMO_DATA=true. Damit entsteht ein Demo-Konto mit bekanntem Passwort. Setze den Wert in .env auf false und starte setup.sh erneut."
fi

# --- Start -------------------------------------------------------------------
# stdin aus /dev/null: sonst lesen docker-Befehle die folgenden Antworten mit.
say ""
say "Lade Images …"
if ! docker compose pull --ignore-buildable </dev/null; then
  die "Images konnten nicht geladen werden. Stimmt WQ_IMAGE_PREFIX in .env, und sind die Pakete öffentlich?"
fi

# Ports: Standard und Ausweich (OD-2). Geprobt wird mit dem db-Image, das pull schon geladen hat.
http_default=80
https_default=443
http_alt=8080
https_alt=8443
probe_image="$(docker compose config --images db </dev/null)"
choose_ports

# Namensaenderungen wirken ab hier; certs stellt dann ein neues Zertifikat derselben CA aus.
names="$(tls_names)"
set_env WQ_TLS_NAMES "$names"

say "Starte WordQuest …"
start_stack

say ""
say "Warte auf die API …"
ready=0
for _ in $(seq 1 60); do
  if docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null 2>&1; then
    ready=1
    say "✓ API ist bereit."
    break
  fi
  sleep 2
done
[[ "$ready" == 1 ]] || die "Die API ist nach zwei Minuten nicht bereit. Sieh mit \`docker compose logs api\` nach, was fehlt."

say ""
say "Warte auf das Zertifikat …"
wait_cert
wait_https "$https_port"

# --- Elternkonto -------------------------------------------------------------
cli() { docker compose exec -T api dotnet WordQuest.Api.dll "$@"; }

email=""
status=0
cli has-owner </dev/null >/dev/null || status=$?
case "$status" in
  0) say "✓ Elternkonto ist schon angelegt — unverändert." ;;
  10)
    while true; do
      read -rp "E-Mail-Adresse für dein Elternkonto: " email || die "Eingabe beendet, bevor das Elternkonto angelegt war."
      if [[ ! "$email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
        warn "Das sieht nicht nach einer E-Mail-Adresse aus. Bitte noch einmal."
        continue
      fi

      # IFS= : sonst entfernt read fuehrende und abschliessende Leerzeichen still;
      # das Passwort gilt genau so, wie es eingegeben wurde.
      while true; do
        IFS= read -rsp "Passwort für dein Elternkonto (mindestens 8 Zeichen, die Eingabe bleibt unsichtbar): " password \
          || die "Eingabe beendet, bevor das Elternkonto angelegt war."
        [[ -t 0 ]] && echo
        if (( ${#password} < 8 )); then
          warn "Das Passwort muss mindestens 8 Zeichen lang sein."
          continue
        fi
        IFS= read -rsp "Passwort wiederholen: " repeat || die "Eingabe beendet, bevor das Elternkonto angelegt war."
        [[ -t 0 ]] && echo
        if [[ "$password" != "$repeat" ]]; then
          warn "Die beiden Passwörter stimmen nicht überein. Bitte noch einmal."
          continue
        fi
        break
      done

      # Passwort per stdin (printf ist ein Bash-Builtin): nie in der Prozessliste.
      status=0
      printf '%s\n' "$password" | cli create-owner "$email" || status=$?
      case "$status" in
        0) say "✓ Elternkonto angelegt."; break ;;
        2) continue ;;
        3) email=""; say "✓ Elternkonto ist schon angelegt — unverändert."; break ;;
        *) die "Das Elternkonto konnte nicht angelegt werden. Sieh mit \`docker compose logs api\` nach." ;;
      esac
    done
    unset password repeat
    ;;
  *) die "Konnte nicht prüfen, ob es schon ein Elternkonto gibt. Sieh mit \`docker compose logs api\` nach." ;;
esac

# --- Abschluss ---------------------------------------------------------------
# Adresse: erste IPv4 aus der Namensliste, sonst localhost.
host="$(printf '%s\n' "$names" | tr ',' '\n' | grep -E '^[0-9.]+$' | grep -vx '127\.0\.0\.1' | head -n 1 || true)"
host="${host:-localhost}"
url="https://${host}"
[[ "$https_port" == 443 ]] || url="${url}:${https_port}"
ca_url="http://${host}"
[[ "$http_port" == 80 ]] || ca_url="${ca_url}:${http_port}"

say ""
if [[ -n "$email" ]]; then
  say "Fertig. WordQuest läuft unter: ${url} — Melde dich dort mit ${email} und deinem Passwort an."
else
  say "Fertig. WordQuest läuft unter: ${url} — Melde dich dort mit deinem Elternkonto an."
fi
say "Beim ersten Besuch warnt der Browser vor dem Zertifikat. Prüfe dann den Fingerabdruck, wie es die Installationsanleitung unter „Zertifikat prüfen“ beschreibt:"
say "$fingerprints"
say "Ohne Warnung geht es, wenn du die Zertifizierungsstelle auf dem Gerät installierst: ${ca_url}/wordquest-ca.crt"
say "Als Nächstes: Lege unter „Kinder“ das erste Kind an, dann unter „Vokabeln“ ein Vokabelset."
say "Tägliche Sicherungen liegen in: $(pwd)/backups"

