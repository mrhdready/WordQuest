#!/usr/bin/env bash
#
# WordQuest — Update auf das neueste Release
# Laedt das neueste Release-Paket und prueft es, sichert die Datenbank, ersetzt
# die Dateien von WordQuest und startet sich mit der neuen Fassung neu. Die neue
# Fassung laedt die neue Version, traegt sie in .env ein und startet WordQuest
# damit (D-16). Aufruf im Installationsordner: ./upgrade.sh
#
set -euo pipefail

cd "$(dirname "$0")"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# Letzter Wert einer Variable aus .env, leer wenn nicht gesetzt.
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }
# WQ_VERSION aus einer .env.example; scheitert ohne gueltigen Wert. Nur Zeichen
# eines Image-Tags: Ein | oder & verdurbe sonst den sed-Ersatz unten (W-7).
version_in() {
  local v
  v="$(grep -E '^WQ_VERSION=' "$1" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  [[ "$v" =~ ^[A-Za-z0-9._-]+$ ]] || return 1
  printf '%s' "$v"
}

# Dateien des Release-Pakets (.github/release-package.sh). Nur sie werden
# ersetzt; .env, secrets/ und backups/ bleiben unberuehrt.
PKG_FILES='docker-compose.quick.yml docker-compose.yml .env.example setup.sh upgrade.sh restore.sh frontend/nginx-traefik-realip.conf'
RELEASE_URL_DEFAULT=https://github.com/mrhdready/WordQuest/releases/latest/download

command -v docker >/dev/null || die "Docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' ist nicht verfügbar."
[[ -f .env ]] || die "Keine .env gefunden. Ist WordQuest hier mit setup.sh eingerichtet?"

# Phase B: Die neue Fassung uebernimmt nach dem Ersetzen mit der Sicherung aus Phase A.
backup=""
if [[ "${1:-}" == --continue ]]; then
  backup="${2:-}"
fi
current="$(env_value WQ_VERSION)"

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
# Sichert die Datenbank nach $backup; ohne geprüfte Sicherung aendert upgrade.sh nichts.
make_backup() {
  mkdir -p backups
  # Legt docker compose den Ordner zuerst an, gehoert er root; dann scheitert die Sicherung.
  [[ -O backups ]] || die "Der Ordner backups gehört nicht dir. Ändere den Besitzer mit: sudo chown -R \"\$(id -un)\" backups — und starte upgrade.sh erneut."
  # --no-recreate: Gesichert wird mit der laufenden Datenbank.
  docker compose up -d --wait --no-recreate db </dev/null \
    || die "Die Datenbank ließ sich nicht starten. Es wurde nichts geändert."
  backup="backups/vor-update-$(date +%Y%m%d-%H%M%S).sql.gz"
  if ! backup_now "$backup"; then
    rm -f "$backup"
    die "Die Sicherung vor dem Update ist fehlgeschlagen. Es wurde nichts geändert."
  fi
  say "✓ Sicherung geprüft: $backup"
}

# --- Phase A: Paket laden, pruefen, sichern, ersetzen -----------------------------
if [[ -z "$backup" ]]; then
  # Adresse wie COMPOSE_FILE in setup.sh: Umgebung, dann .env, dann GitHub.
  url="${WQ_RELEASE_URL:-$(env_value WQ_RELEASE_URL)}"
  url="${url:-$RELEASE_URL_DEFAULT}"
  url="${url%/}"

  say "Lade das neueste WordQuest-Paket …"
  # Im Installationsordner, damit mv unten im selben Dateisystem umbenennt.
  work="$(mktemp -d ./.upgrade.XXXXXX)"
  trap 'rm -rf "$work"' EXIT
  pkg="$work/wordquest.tar.gz"
  { curl -fsSL -o "$pkg" "$url/wordquest.tar.gz" && curl -fsSL -o "$pkg.sha256" "$url/wordquest.tar.gz.sha256"; } \
    || die "Das WordQuest-Paket ließ sich nicht herunterladen. Prüfe die Internetverbindung und starte upgrade.sh erneut. Es wurde nichts geändert."
  expected="$(awk 'NR == 1 { print $1 }' "$pkg.sha256")"
  actual="$(sha256sum "$pkg" | awk '{ print $1 }')"
  [[ "$expected" =~ ^[0-9a-f]{64}$ && "$expected" == "$actual" ]] \
    || die "Die Prüfsumme des WordQuest-Pakets stimmt nicht. Starte upgrade.sh später erneut. Es wurde nichts geändert."
  say "✓ Prüfsumme stimmt."

  mkdir "$work/neu"
  tar -xzf "$pkg" -C "$work/neu" --strip-components=1 \
    || die "Das WordQuest-Paket ist unvollständig oder nennt keine gültige Version. Es wurde nichts geändert."
  target="$(version_in "$work/neu/.env.example" || true)"
  [[ -n "$target" ]] || die "Das WordQuest-Paket ist unvollständig oder nennt keine gültige Version. Es wurde nichts geändert."
  say "Aktualisiere WordQuest von ${current:-unbekannt} auf ${target}."
  make_backup

  say "Ersetze die Dateien von WordQuest …"
  # mv benennt im selben Dateisystem um: Die laufende Fassung liest ihre alte
  # Datei weiter, auch wenn Bash Skripte stueckweise liest. Nur die Liste, nie
  # .env, secrets/ oder backups/.
  replace_files() {
    local f
    for f in $PKG_FILES; do
      mkdir -p "$(dirname "$f")" || return 1
      mv -f "$work/neu/$f" "$f" || return 1
    done
  }
  replace_files \
    || die "Die neuen Dateien ließen sich nicht einspielen. WordQuest läuft unverändert weiter; starte upgrade.sh erneut. Die Sicherung liegt in $backup."
  rm -rf "$work"
  trap - EXIT
  # Schnittstelle zwischen alter und neuer Fassung; bleibt in allen Versionen gleich.
  exec ./upgrade.sh --continue "$backup"
fi

# --- Phase B: neue Version laden und starten --------------------------------------
target="$(version_in .env.example || true)"
[[ -n "$target" ]] || die "In .env.example steht keine gültige Version (WQ_VERSION=). WordQuest läuft unverändert mit der bisherigen Version weiter; starte ./upgrade.sh erneut. Die Sicherung liegt in $backup."

# Erst laden, dann .env schreiben: Fehlt ein Image, bleiben .env und die
# laufenden Container wie sie sind (D-05, 03-RESEARCH Pitfall 9). Die Variable
# in der Shell schlaegt .env.
say "Lade Version $target …"
WQ_VERSION="$target" docker compose pull --ignore-buildable </dev/null \
  || die "Die Version $target ließ sich nicht laden. Wenn sie gerade erst erschienen ist, versuche es in einer Viertelstunde erneut; sonst prüfe die Internetverbindung und WQ_IMAGE_PREFIX in .env. WordQuest läuft unverändert mit der bisherigen Version weiter; ein neuer Aufruf von ./upgrade.sh setzt das Update fort. Die Sicherung liegt in $backup."

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
    || { rm -f .env.tmp; die "Die Datei .env ließ sich nicht schreiben. WordQuest läuft unverändert mit der bisherigen Version weiter. Die Sicherung liegt in $backup."; }
else
  # Fehlt das letzte Zeilenende, klebte die neue Zeile an der letzten Variable (IN-02).
  { [[ -z "$(tail -c 1 .env)" ]] || echo; printf 'WQ_VERSION=%s\n' "$target"; } >>.env \
    || die "Die Datei .env ließ sich nicht schreiben. WordQuest läuft unverändert mit der bisherigen Version weiter. Die Sicherung liegt in $backup."
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
# nginx loest api nur beim Start auf (Block location /api/ in frontend/nginx.conf, wie restore.sh):
# Wurde nur api neu erzeugt, liefe web sonst ins Leere.
docker compose restart web </dev/null || start_failed "Der Start der Version $target ist fehlgeschlagen."
trap - INT TERM
say "✓ API ist bereit."

say "Fertig. WordQuest läuft jetzt mit Version $target. Die Sicherung von vorher liegt in $backup."
