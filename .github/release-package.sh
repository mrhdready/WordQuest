#!/usr/bin/env bash
#
# Baut das Release-Paket fuer die Installation ohne Git (D-16):
# <Zielordner>/wordquest.tar.gz und <Zielordner>/wordquest.tar.gz.sha256.
#
#   bash .github/release-package.sh <Zielordner> [<Tag>]
#
# Mit Tag (CI: v1.0.0) muss der Tag "v" plus WQ_VERSION aus .env.example sein,
# sonst entsteht kein Paket. Nur Bash-3.2-Mittel: laeuft unter macOS und in der CI.
#
set -euo pipefail

[[ $# -ge 1 && $# -le 2 ]] || { echo "Aufruf: $0 <Zielordner> [<Tag>]" >&2; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$1"
TAG="${2:-}"

version="$(sed -n 's/^WQ_VERSION=//p' "$ROOT/.env.example" | tail -n 1)"
if [[ -n "$TAG" && "$TAG" != "v$version" ]]; then
  echo "Der Tag $TAG passt nicht zur Version $version (WQ_VERSION in .env.example). Es wurde kein Paket gebaut." >&2
  exit 1
fi

# Feste Liste statt des ganzen Ordners: .env, secrets/ und backups/ eines
# Rechners, auf dem das Paket entsteht, geraten so nie hinein.
FILES='docker-compose.quick.yml docker-compose.yml .env.example setup.sh upgrade.sh restore.sh frontend/nginx-traefik-realip.conf'

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/wordquest/frontend"
for file in $FILES; do
  # -p: Die drei Skripte bleiben ausfuehrbar.
  cp -p "$ROOT/$file" "$stage/wordquest/$file"
done

mkdir -p "$DEST"
# Ohne erweiterte Attribute und ohne ._-Dateien: Ein unter macOS gebautes Paket
# truege sonst LIBARCHIVE.xattr-Koepfe, und GNU-tar auf dem Pi warnte beim Entpacken.
COPYFILE_DISABLE=1 tar --no-xattrs -C "$stage" -czf "$DEST/wordquest.tar.gz" wordquest
(cd "$DEST" && sha256sum wordquest.tar.gz >wordquest.tar.gz.sha256)
