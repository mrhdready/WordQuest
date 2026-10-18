#!/usr/bin/env bash
#
# WordQuest — Update auf die Version, die das Repo mitbringt
# Sichert vorher die Datenbank, laedt die neue Version, traegt sie in .env ein
# und startet WordQuest damit. Aufruf im Installationsordner:
#
#   git pull
#   ./upgrade.sh
#
set -euo pipefail

cd "$(dirname "$0")"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# Letzter Wert einer Variable aus .env, leer wenn nicht gesetzt.
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }

command -v docker >/dev/null || die "Docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' ist nicht verfügbar."
[[ -f .env ]] || die "Keine .env gefunden. Ist WordQuest hier mit setup.sh eingerichtet?"

# Zielversion ist die, die das ausgecheckte Repo mitbringt (D-05). Nur Zeichen
# eines Image-Tags: Ein | oder & verdurbe sonst den sed-Ersatz unten (W-7).
target="$(grep -E '^WQ_VERSION=' .env.example 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
[[ "$target" =~ ^[A-Za-z0-9._-]+$ ]] || die "In .env.example steht keine gültige Version (WQ_VERSION=). Lade WordQuest mit git pull vollständig herunter und starte upgrade.sh erneut. Es wurde nichts geändert."
current="$(env_value WQ_VERSION)"
say "Aktualisiere WordQuest von ${current:-unbekannt} auf ${target}."

# --- Sicherung -----------------------------------------------------------------
mkdir -p backups
# Legt docker compose den Ordner zuerst an, gehoert er root; dann scheitert die Sicherung.
[[ -O backups ]] || die "Der Ordner backups gehört nicht dir. Ändere den Besitzer mit: sudo chown -R \"\$(id -un)\" backups — und starte upgrade.sh erneut."

# --no-recreate: Gesichert wird mit der laufenden Datenbank. Hat git pull die
# Datei geaendert, gilt die neue Fassung erst beim Start der neuen Version.
docker compose up -d --wait --no-recreate db </dev/null \
  || die "Die Datenbank ließ sich nicht starten. Es wurde nichts geändert."

# Wie restore.sh: tail und grep -c lesen den ganzen Strom, sonst bricht gunzip
# unter pipefail mit SIGPIPE ab (03-RESEARCH Pitfall 4).
dump_complete() {
  gzip -t "$1" 2>/dev/null || return 1
  gunzip -c "$1" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || return 1
}
check_dump() {
  dump_complete "$1" || return 1
  [[ "$(gunzip -c "$1" | grep -c 'COPY public.app_user' || true)" -gt 0 ]] || return 1
}
# Die Funktion laeuft ueber if; dort greift set -e in ihr nicht, deshalb gibt
# jeder Schritt seinen Fehler selbst weiter (wie restore.sh).
backup_now() {
  # umask: Die Datei ist nur fuer dich lesbar, auch wenn backups/ gerade erst entstanden ist.
  (umask 077 && docker compose exec -T db pg_dump -U wordquest -d wordquest </dev/null | gzip >"$1") || return 1
  check_dump "$1" || return 1
}
backup="backups/vor-update-$(date +%Y%m%d-%H%M%S).sql.gz"
if ! backup_now "$backup"; then
  rm -f "$backup"
  die "Die Sicherung vor dem Update ist fehlgeschlagen. Es wurde nichts geändert."
fi
say "✓ Sicherung geprüft: $backup"

# --- Neue Version laden ----------------------------------------------------------
# Erst laden, dann .env schreiben: Nach einem neuen Release braucht die CI
# einige Minuten fuer die Images. Fehlt eines noch, bleibt alles beim Alten
# (D-05, 03-RESEARCH Pitfall 9). Die Variable in der Shell schlaegt .env.
say "Lade Version $target …"
WQ_VERSION="$target" docker compose pull --ignore-buildable </dev/null \
  || die "Die Version $target ließ sich nicht laden. Wenn sie gerade erst erschienen ist, versuche es in einer Viertelstunde erneut; sonst prüfe die Internetverbindung und WQ_IMAGE_PREFIX in .env. Es wurde nichts geändert. Die Sicherung liegt in $backup."

# Ab dem Schreiben der .env endet jeder Fehler mit dem Weg zurueck.
start_failed() {
  local back="Spiele die Sicherung mit ./restore.sh $backup ein."
  [[ -z "$current" ]] || back="Zurück zur Version $current: Trage in .env WQ_VERSION=$current ein und spiele danach die Sicherung mit ./restore.sh $backup ein."
  die "$1 Deine Daten von vorher liegen in $backup. Sieh mit \`docker compose logs api\` nach; die Meldung dort nennt meist den Ausweg. $back"
}

# Strg+C ab hier: .env und Container koennen halb umgestellt sein.
trap 'start_failed "Abgebrochen."' INT TERM

# BSD/GNU sed kompatibel: temporaere Datei statt -i (wie setup.sh). cp -p
# zuerst: Die Umleitung in eine bestehende Datei behaelt deren Rechte, sonst
# waere .env danach fuer alle lesbar (Traefik-Variante: DNS-Token, WR-01).
if grep -qE '^WQ_VERSION=' .env; then
  { cp -p .env .env.tmp && sed -e "s|^WQ_VERSION=.*|WQ_VERSION=${target}|" .env >.env.tmp && mv .env.tmp .env; } \
    || { rm -f .env.tmp; die "Die Datei .env ließ sich nicht schreiben. Es wurde nichts geändert. Die Sicherung liegt in $backup."; }
else
  # Fehlt das letzte Zeilenende, klebte die neue Zeile an der letzten Variable (IN-02).
  { [[ -z "$(tail -c 1 .env)" ]] || echo; printf 'WQ_VERSION=%s\n' "$target"; } >>.env \
    || die "Die Datei .env ließ sich nicht schreiben. Es wurde nichts geändert. Die Sicherung liegt in $backup."
fi

# --- Start ------------------------------------------------------------------------
say "Starte Version $target …"
# Mit ||: set -e beendete das Skript hier sonst vor der Meldung mit dem Weg
# zurueck (Review 03-03 HIGH).
docker compose up -d </dev/null || start_failed "Der Start der Version $target ist fehlgeschlagen."

say "Warte auf die API …"
ready=0
for _ in $(seq 1 60); do
  if docker compose exec -T api wget -qO- http://localhost:8080/health/ready </dev/null >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" == 1 ]] || start_failed "Die API ist nach zwei Minuten nicht bereit."
# nginx loest api nur beim Start auf (frontend/nginx.conf:40, wie restore.sh):
# Wurde nur api neu erzeugt, liefe web sonst ins Leere.
docker compose restart web </dev/null || start_failed "Der Start der Version $target ist fehlgeschlagen."
trap - INT TERM
say "✓ API ist bereit."

say "Fertig. WordQuest läuft jetzt mit Version $target. Die Sicherung von vorher liegt in $backup."
