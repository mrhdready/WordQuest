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

cd "$(dirname "$0")"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' ist nicht verfügbar."
[[ -f .env ]] || die "Keine .env gefunden. Ist WordQuest hier mit setup.sh eingerichtet?"

# Vollstaendiger Dump: gzip heil, Endzeile von pg_dump. tail und grep -c lesen
# den ganzen Strom, sonst bricht gunzip unter pipefail mit SIGPIPE ab
# (03-RESEARCH Pitfall 4).
dump_complete() {
  gzip -t "$1" 2>/dev/null || return 1
  gunzip -c "$1" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || return 1
}
# WordQuest-Sicherung: vollstaendig und mit Kontotabelle, also keine fremde Datei.
check_dump() {
  dump_complete "$1" || return 1
  [[ "$(gunzip -c "$1" | grep -c 'COPY public.app_user' || true)" -gt 0 ]] || return 1
}

# --- Datei waehlen -----------------------------------------------------------
if [[ $# -gt 0 ]]; then
  file="$1"
  [[ -f "$file" ]] || die "Die Datei $file gibt es nicht. Es wurde nichts geändert."
else
  # Neueste zuerst. Der Sicherungsdienst legt dieselbe Datei per Hardlink in
  # last/, daily/, weekly/ und monthly/ ab: jede Inode nur einmal; die
  # latest-Verweise zeigen auf eine dieser Dateien.
  files=()
  while IFS= read -r f; do
    files+=("$f")
  done < <(ls -1ti backups/*.sql.gz backups/*/*.sql.gz 2>/dev/null \
    | awk '!seen[$1]++ { print $2 }' | grep -v -- '-latest\.sql\.gz$' || true)
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

before="backups/vor-wiederherstellung-$(date +%Y%m%d-%H%M%S).sql.gz"
backup_now() {
  docker compose exec -T db pg_dump -U wordquest -d wordquest </dev/null | gzip >"$1" || return 1
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
  { gunzip -c "$1" && echo 'DELETE FROM public.refresh_token;'; } \
    | docker compose exec -T db psql -U wordquest -d wordquest -v ON_ERROR_STOP=1 -1 -q >/dev/null \
    || return 1
}

# Startet alles und wartet auf die API; nginx loest api nur beim Start auf
# (frontend/nginx.conf:40), deshalb danach web neu starten.
start_app() {
  local _
  docker compose up -d </dev/null || return 1
  for _ in $(seq 1 60); do
    if docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null 2>&1; then
      docker compose restart web </dev/null || return 1
      return 0
    fi
    sleep 2
  done
  return 1
}

if ! load_dump "$file"; then
  die "Das Einspielen von $file ist fehlgeschlagen. Die API bleibt gestoppt. Deine Daten von vorher liegen in $before."
fi

say "Starte WordQuest …"
start_app || die "Die API ist nach zwei Minuten nicht bereit. Sieh mit \`docker compose logs api\` nach. Der Stand von vorher liegt in $before."

say "Fertig. WordQuest zeigt jetzt den Stand aus $file. Der Stand von vorher liegt in $before."
