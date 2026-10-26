#!/usr/bin/env bash
#
# WordQuest — Sicherung wiederherstellen
# Zeigt die Sicherungen aus backups/, sichert vor dem Einspielen den heutigen
# Stand und ersetzt dann die Datenbank durch den Stand der gewaehlten Datei.
#
#   ./restore.sh                         Auswahl aus der Liste
#   ./restore.sh backups/<Datei>.sql.gz  eine bestimmte Datei
#
set -euo pipefail

# Ein Pfad-Argument gilt ab dem Aufrufort, nicht ab dem Installationsordner (IN-04).
here="$PWD"
cd "$(dirname "$0")"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' ist nicht verfügbar."
[[ -f .env ]] || die "Keine .env gefunden. Ist WordQuest hier mit setup.sh eingerichtet?"

# Vollstaendiger Dump: gzip heil, Endzeile von pg_dump. tail und grep -c lesen
# den ganzen Strom, sonst bricht gunzip bzw. tail unter pipefail mit SIGPIPE ab
# (03-RESEARCH Pitfall 4). Die Endzeile steht seit pg_dump 17.6 fuenftletzt
# (\unrestrict danach); 20 Zeilen lassen kuenftigen Zusaetzen Platz, einem
# abgebrochenen Dump fehlt sie ganz. Ganze Zeile (-x), damit eine Datenzeile
# mit demselben Text nicht zaehlt.
dump_complete() {
  gzip -t "$1" 2>/dev/null || return 1
  [[ "$(gunzip -c "$1" | tail -n 20 | grep -cx -- '-- PostgreSQL database dump complete' || true)" -gt 0 ]] || return 1
}
# WordQuest-Sicherung: vollstaendig und mit Kontotabelle, also keine fremde Datei.
check_dump() {
  dump_complete "$1" || return 1
  [[ "$(gunzip -c "$1" | grep -c 'COPY public.app_user' || true)" -gt 0 ]] || return 1
}

# --- Datei waehlen -----------------------------------------------------------
if [[ $# -gt 0 ]]; then
  file="$1"
  [[ "$file" == /* || "$here" == "$PWD" ]] || file="$here/$file"
  [[ -f "$file" ]] || die "Die Datei $file gibt es nicht. Es wurde nichts geändert."
else
  # Neueste zuerst. Der Sicherungsdienst legt dieselbe Datei per Hardlink in
  # last/, daily/, weekly/ und monthly/ ab: jede Inode nur einmal. Die
  # latest-Verweise fliegen vorher raus, damit sie keine Datei verdecken.
  # awk schneidet nur die Inode ab, Leerzeichen im Namen bleiben.
  files=()
  while IFS= read -r f; do
    files+=("$f")
  done < <(ls -1ti backups/*.sql.gz backups/*/*.sql.gz 2>/dev/null \
    | grep -v -- '-latest\.sql\.gz$' \
    | awk '{ ino = $1; sub(/^ *[0-9]+ /, "") } !seen[ino]++' || true)
  (( ${#files[@]} > 0 )) || die "Es gibt noch keine Sicherung in backups/."

  say "Vorhandene Sicherungen, die neueste zuerst:"
  i=1
  for f in "${files[@]}"; do
    printf '%3d) %s\n' "$i" "$f"
    i=$((i + 1))
  done
  while true; do
    read -rp "Nummer der Sicherung: " choice || die "Eingabe beendet. Es wurde nichts geändert."
    if [[ "$choice" =~ ^[1-9][0-9]{0,5}$ ]] && (( choice <= ${#files[@]} )); then
      break
    fi
    warn "Bitte eine Nummer zwischen 1 und ${#files[@]} eingeben."
  done
  file="${files[$((choice - 1))]}"
fi

# Erst pruefen, dann aendern: Eine kaputte Datei faellt hier auf, nicht nach dem Loeschen.
check_dump "$file" || die "$file ist keine vollständige WordQuest-Sicherung. Es wurde nichts geändert."

# --- Bestaetigen ---------------------------------------------------------------
# Der Satz kommt per say: read -p zeigt ohne Terminal nichts an.
say "Der heutige Stand von WordQuest wird durch den Stand aus $file ersetzt. Vorher wird der heutige Stand gesichert."
read -rp "Zum Fortfahren ja eingeben: " answer || answer=""
[[ "$answer" == ja ]] || die "Abgebrochen. Es wurde nichts geändert."

# --- Heutigen Stand sichern ------------------------------------------------------
mkdir -p backups
[[ -O backups ]] || die "Der Ordner backups gehört nicht dir. Ändere den Besitzer mit: sudo chown -R \"\$(id -un)\" backups — und starte restore.sh erneut."
chmod 700 backups

docker compose up -d --wait db </dev/null || die "Die Datenbank startet nicht. Es wurde nichts geändert. Sieh mit \`docker compose logs db\` nach."

# Fehlt die Datenbank ganz (der Rueckfall eines frueheren Laufs scheiterte nach
# dem Loeschen), leer anlegen: Es gibt nichts zu verlieren, und pg_dump braucht sie.
exists="$(docker compose exec -T db psql -U wordquest -d postgres -Atc "select 1 from pg_database where datname = 'wordquest'" </dev/null)" \
  || die "Die Datenbank ist nicht erreichbar. Es wurde nichts geändert. Sieh mit \`docker compose logs db\` nach."
if [[ -z "$exists" ]]; then
  docker compose exec -T db psql -U wordquest -d postgres -q -c 'CREATE DATABASE wordquest OWNER wordquest' </dev/null \
    || die "Die Datenbank fehlt und ließ sich nicht anlegen. Sieh mit \`docker compose logs db\` nach."
fi

before="backups/vor-wiederherstellung-$(date +%Y%m%d-%H%M%S).sql.gz"
backup_now() {
  # umask: Die Datei ist nur fuer dich lesbar, wie in upgrade.sh (W-2).
  (umask 077 && docker compose exec -T db pg_dump -U wordquest -d wordquest </dev/null | gzip >"$1") || return 1
  # Ohne Kontopruefung: Auch eine leere Datenbank nach einem gescheiterten
  # Rueckfall muss sich sichern lassen, sonst liesse sich die Vorher-Datei
  # aus der Fehlermeldung nicht mehr einspielen.
  dump_complete "$1" || return 1
}
if ! backup_now "$before"; then
  rm -f "$before"
  die "Die Sicherung des heutigen Stands ist fehlgeschlagen. Es wurde nichts geändert."
fi
say "✓ Heutiger Stand gesichert in $before."

# --- Einspielen ------------------------------------------------------------------
docker compose stop api backup </dev/null \
  || die "WordQuest ließ sich nicht anhalten. Die Datenbank ist unverändert. Starte WordQuest wieder mit: docker compose up -d"

# Spielt eine Sicherung in eine frisch angelegte Datenbank ein. Die Funktion
# wird ueber if aufgerufen; dort greift set -e in ihr nicht (reproduziert in
# 03-REVIEWS, Review 03-02 HIGH). Deshalb gibt jeder Teilschritt seinen Fehler
# selbst weiter.
load_dump() {
  # IF EXISTS: Ist die Datenbank nach einem halben Versuch schon weg, gelingt der Rueckfall trotzdem.
  docker compose exec -T db psql -U wordquest -d postgres -q -v ON_ERROR_STOP=1 \
    -c 'DROP DATABASE IF EXISTS wordquest WITH (FORCE)' \
    -c 'CREATE DATABASE wordquest OWNER wordquest' </dev/null || return 1
  # pipefail: Die Pipeline scheitert auch, wenn nur das Lesen scheitert. psql
  # committet einen abgebrochenen Strom sonst als Erfolg, und eine leere
  # Datenbank gaelte als wiederhergestellt.
  # Refresh-Tokens: Seit der Sicherung widerrufene Anmeldungen duerfen nicht
  # wieder gueltig werden. Access-Tokens laufen nach hoechstens 15 Minuten aus
  # (AuthOptions.cs:15).
  # -1 -f -: eine Transaktion; laut psql-Doku gilt -1 nur zusammen mit -f/-c.
  # Scheitert eine Anweisung, bleibt nichts davon (im Container geprueft, W-1).
  { gunzip -c "$1" && echo 'DELETE FROM public.refresh_token;'; } \
    | docker compose exec -T db psql -U wordquest -d wordquest -v ON_ERROR_STOP=1 -1 -q -f - >/dev/null \
    || return 1
}

# Startet alles und wartet auf die API; nginx loest api nur beim Start auf
# (Block location /api/ in frontend/nginx.conf), deshalb danach web neu starten.
start_app() {
  local _ certs_before
  certs_before="$(docker compose ps -q certs </dev/null 2>/dev/null || true)"
  docker compose up -d </dev/null || return 1
  # Wie start_stack in setup.sh: certs prueft die CA nur beim Start. Neu gestartet
  # wird nur ein Container, den up unveraendert gelassen hat; ein neuer prueft
  # ohnehin, und ein Neustart mitten im Anlegen hinterliesse die CA unvollstaendig.
  if [[ -n "$certs_before" && "$(docker compose ps -q certs </dev/null 2>/dev/null || true)" == "$certs_before" ]]; then
    docker compose restart certs </dev/null >/dev/null 2>&1 \
      || die "Der Zertifikatsdienst ließ sich nicht neu starten. Sieh mit \`docker compose logs certs\` nach, was fehlt. Der Stand von vorher liegt in $before."
  fi
  for _ in $(seq 1 60); do
    if docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null 2>&1; then
      docker compose restart web </dev/null || return 1
      return 0
    fi
    sleep 2
  done
  return 1
}

# Wartelogik aus setup.sh (own_port, wait_cert, wait_https): "Fertig" erst nach einem
# gueltigen Zertifikat und einem echten TLS-Handshake. Die Meldung sagt dazu, dass die
# Daten schon eingespielt sind.
own_port() { docker compose port web "$1" </dev/null 2>/dev/null | head -n 1 | sed 's/.*://' || true; }
wait_cert() {
  local last
  for _ in $(seq 1 60); do
    if docker compose exec -T certs dotnet WordQuest.Api.dll tls show </dev/null >/dev/null 2>&1; then
      say "✓ Zertifikat ist bereit."
      return 0
    fi
    last="$(docker compose logs --no-color --no-log-prefix --tail 1 certs </dev/null 2>/dev/null || true)"
    if [[ "$last" == *"Es wurde nichts geändert."* ]]; then die "Der Zertifikatsdienst meldet: $last $1"; fi
    sleep 2
  done
  die "Das Zertifikat ist nach zwei Minuten nicht bereit. Sieh mit \`docker compose logs certs\` nach, was fehlt. $1"
}
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
  [[ "$ok" == 1 ]] || die "WordQuest antwortet nicht über HTTPS. Sieh mit \`docker compose logs web\` nach, was fehlt. $2"
  say "✓ WordQuest antwortet über HTTPS."
}

# Strg+C mitten im Einspielen: psql committet den bis dahin gelesenen Teil.
# Dann darf die API nicht starten, und die Meldung nennt den Weg zurueck.
trap 'die "Abgebrochen. Die Datenbank ist womöglich unvollständig, die API bleibt gestoppt. Spiele den Stand von vorher wieder ein mit: ./restore.sh $before"' INT TERM
if ! load_dump "$file"; then
  warn "Das Einspielen von $file ist fehlgeschlagen. Der Stand von vorher wird aus $before zurückgespielt …"
  # Die API darf nicht auf einer leeren Datenbank starten: Sie legte ein neues
  # Schema an, und das saehe wie eine Neuinstallation aus.
  load_dump "$before" \
    || die "Das Einspielen ist fehlgeschlagen, und der vorherige Stand ließ sich nicht zurückspielen. Die API bleibt gestoppt. Deine Daten liegen in $before. Sieh mit \`docker compose logs db\` nach."
  trap - INT TERM
  start_app \
    || die "Das Einspielen von $file ist fehlgeschlagen. Der vorherige Stand aus $before ist wieder eingespielt, aber die API ist nach zwei Minuten nicht bereit. Sieh mit \`docker compose logs api\` nach."
  die "Das Einspielen von $file ist fehlgeschlagen. Der vorherige Stand aus $before ist wieder eingespielt, WordQuest läuft weiter."
fi
trap - INT TERM

say "Starte WordQuest …"
start_app || die "Die API ist nach zwei Minuten nicht bereit. Sieh mit \`docker compose logs api\` nach. Der Stand von vorher liegt in $before."
loaded="Der Stand aus $file ist eingespielt, der Stand von vorher liegt in $before."
wait_cert "$loaded"
wait_https "$(own_port 8443)" "$loaded"

say "Fertig. WordQuest zeigt jetzt den Stand aus $file. Der Stand von vorher liegt in $before."
