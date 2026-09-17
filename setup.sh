#!/usr/bin/env bash
#
# WordQuest — Ersteinrichtung
# Erzeugt Secrets und .env und faehrt den Stack hoch.
#
set -euo pipefail

cd "$(dirname "$0")"

say()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' ist nicht verfuegbar."

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
    say "✓ secrets/${name}.txt existiert bereits — unveraendert."
  else
    printf '%s' "$(gen_secret)" > "$f"
    chmod 600 "$f"
    say "✓ secrets/${name}.txt erzeugt."
  fi
done

# --- .env --------------------------------------------------------------------
if [[ -f .env ]]; then
  say "✓ .env existiert bereits — unveraendert."
else
  cp .env.example .env
  read -rp "Unter welchem Hostnamen soll WordQuest erreichbar sein? [wordquest.local] " host
  host="${host:-wordquest.local}"
  read -rp "E-Mail-Adresse fuer Let's Encrypt? [admin@example.com] " acme
  acme="${acme:-admin@example.com}"
  read -rp "Image-Praefix (ghcr.io/<account>/wordquest): " prefix
  while [[ -z "$prefix" ]]; do
    warn "Ohne Image-Praefix weiss docker compose nicht, was es ziehen soll."
    read -rp "Image-Praefix (ghcr.io/<account>/wordquest): " prefix
  done

  # BSD/GNU sed kompatibel: temporaere Datei statt -i.
  sed -e "s|^WQ_HOST=.*|WQ_HOST=${host}|" \
      -e "s|^WQ_ACME_EMAIL=.*|WQ_ACME_EMAIL=${acme}|" \
      -e "s|^WQ_IMAGE_PREFIX=.*|WQ_IMAGE_PREFIX=${prefix}|" \
      .env > .env.tmp && mv .env.tmp .env
  say "✓ .env angelegt fuer ${host}."
  warn "  TLS: Ohne gueltiges Zertifikat ist die App NICHT als PWA installierbar."
  warn "  Trage in .env deinen DNS-Provider und API-Token ein (WQ_ACME_DNS_PROVIDER)."
fi

# --- Start -------------------------------------------------------------------
say ""
say "Hole Images …"
if ! docker compose pull; then
  die "Images konnten nicht geladen werden. Stimmt WQ_IMAGE_PREFIX in .env, und sind die Pakete oeffentlich?"
fi

say "Starte den Stack …"
docker compose up -d

say ""
say "Warte auf die API …"
for _ in $(seq 1 60); do
  if docker compose exec -T api wget -qO- http://localhost:8080/health/ready >/dev/null 2>&1; then
    say "✓ API ist bereit."
    break
  fi
  sleep 2
done

host="$(grep -E '^WQ_HOST=' .env | cut -d= -f2-)"
say ""
say "Fertig. WordQuest laeuft unter: https://${host}"
say ""
say "Demo-Zugang (nur wenn WQ_SEED_DEMO_DATA=true):"
say "  Eltern:  demo@wordquest.local / demo1234"
say "  Kind:    Profil 'Max', PIN 1234"
warn ""
warn "Setze WQ_SEED_DEMO_DATA=false in .env, sobald du eigene Konten angelegt hast,"
warn "und aendere das Demo-Passwort."
