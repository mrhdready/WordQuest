#!/usr/bin/env bash
# Backend-Gate der Phase 2 (D-14): Build und Tests im SDK-Container gegen ein
# eigenes PostgreSQL im Docker-Netz wq-p2. Der Host-Port 5432 bleibt unberuehrt.
#
# Aufruf (aus dem Repo-Root):
#   bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh
#   bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh 'FullyQualifiedName~SessionEndpointTests'
#   bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh down   # Container und Netz entfernen
set -euo pipefail

NETWORK=wq-p2
DB=wq-p2-db
ROOT="$(git rev-parse --show-toplevel)"

if [ "${1:-}" = "down" ]; then
  docker rm -f "$DB" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  echo "wq-p2 entfernt."
  exit 0
fi

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

if [ "$(docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null || true)" != "true" ]; then
  docker rm -f "$DB" >/dev/null 2>&1 || true
  docker run -d --name "$DB" --network "$NETWORK" \
    -e POSTGRES_DB=wordquest -e POSTGRES_USER=wordquest -e POSTGRES_PASSWORD=devpassword \
    postgres:17-alpine >/dev/null
fi

# Ueber TCP pruefen: Der Init-Server lauscht nur auf dem Socket und gilt sonst
# zu frueh als bereit.
ready=0
for _ in $(seq 1 60); do
  if docker exec "$DB" pg_isready -h 127.0.0.1 -U wordquest -d wordquest >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL ($DB) wurde nicht bereit." >&2
  exit 1
fi

FILTER_ARG=""
if [ -n "${1:-}" ]; then
  FILTER_ARG="--filter '$1'"
fi

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

docker run --rm --network "$NETWORK" \
  -v "$ROOT:/src" -w /src \
  -v wq-nuget:/root/.nuget/packages \
  -e WQ_TEST_DB='Host=wq-p2-db;Port=5432;Username=wordquest;Password=devpassword' \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c "dotnet build backend/WordQuest.slnx -c Release /warnaserror && dotnet test backend/WordQuest.slnx -c Release --no-build $FILTER_ARG" \
  2>&1 | tee "$LOG"
# Ein fehlgeschlagener Build oder Test beendet das Skript schon hier
# (set -e mit pipefail).

# Ein Filter ohne Treffer waere sonst gruen.
if ! grep -Eq 'Passed: *[1-9]' "$LOG"; then
  echo "KEIN TEST GEFUNDEN"
  exit 1
fi
