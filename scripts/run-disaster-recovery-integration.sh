#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  MINGW*|MSYS*) export MSYS_NO_PATHCONV=1 ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
APP_IMAGE="${STARS_APP_IMAGE:-dndstars-5e:ci}"
POSTGRES_IMAGE="${STARS_POSTGRES_IMAGE:-postgres:17-alpine}"
suffix="$(date +%s)-$$"
network="astraltrace-backup-ci-${suffix}"
postgres_container="${network}-db"
data_volume="${network}-data"
mkdir -p "$REPO_ROOT/tmp"
work_dir="$(mktemp -d "$REPO_ROOT/tmp/backup-ci.XXXXXX")"
password="backup-integration-password-${suffix}"

docker_host_path() {
  case "$(uname -s)" in
    MINGW*|MSYS*) cygpath -am "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

cleanup() {
  docker rm -f "$postgres_container" >/dev/null 2>&1 || true
  docker volume rm "$data_volume" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

docker network create "$network" >/dev/null
docker volume create "$data_volume" >/dev/null
docker run -d \
  --name "$postgres_container" \
  --network "$network" \
  --network-alias postgres \
  -p 127.0.0.1::5432 \
  -e POSTGRES_DB=astraltrace \
  -e POSTGRES_USER=astraltrace \
  -e "POSTGRES_PASSWORD=$password" \
  "$POSTGRES_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$postgres_container" pg_isready -U astraltrace -d astraltrace >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$postgres_container" pg_isready -U astraltrace -d astraltrace >/dev/null

published_port="$(docker port "$postgres_container" 5432/tcp | head -n 1 | sed -E 's/.*:([0-9]+)$/\1/')"
if [[ ! "$published_port" =~ ^[0-9]+$ ]]; then
  printf '无法解析 PostgreSQL 临时端口。\n' >&2
  exit 4
fi
(
  cd -- "$REPO_ROOT"
  STARS_TEST_DATABASE_URL="postgresql://astraltrace:${password}@127.0.0.1:${published_port}/astraltrace" \
    npm run test:postgres
)

docker run --rm \
  --mount "type=volume,src=${data_volume},dst=/data" \
  alpine:3.21 \
  sh -ceu '
    mkdir -p /data/state/rooms/RECOVERY
    printf "%s\n" "{\"schemaVersion\":1,\"maps\":[],\"activeMapId\":null}" \
      > /data/state/rooms/RECOVERY/maps.json
    chown -R 1000:1000 /data
  '

docker run --rm \
  --network "$network" \
  -e PGHOST=postgres \
  -e PGPORT=5432 \
  -e PGDATABASE=astraltrace \
  -e PGUSER=astraltrace \
  -e "PGPASSWORD=$password" \
  -e STARS_BACKUP_ROOT=/backups \
  -e STARS_BACKUP_INTERVAL_SECONDS=86400 \
  -e STARS_BACKUP_RETENTION_DAYS=14 \
  -e STARS_BACKUP_ONCE=true \
  --mount "type=bind,src=$(docker_host_path "${SCRIPT_DIR}/postgres-backup-loop.sh"),dst=/opt/astraltrace/postgres-backup-loop.sh,readonly" \
  --mount "type=volume,src=${data_volume},dst=/data,readonly" \
  --mount "type=bind,src=$(docker_host_path "$work_dir"),dst=/backups" \
  "$POSTGRES_IMAGE" \
  /bin/sh /opt/astraltrace/postgres-backup-loop.sh

archive_path="$(find "$work_dir" -maxdepth 1 -type f -name 'astraltrace-*.tar.gz' | head -n 1)"
if [[ -z "$archive_path" ]]; then
  printf '集成测试没有生成备份归档。\n' >&2
  exit 5
fi

STARS_APP_IMAGE="$APP_IMAGE" \
STARS_POSTGRES_IMAGE="$POSTGRES_IMAGE" \
  bash "$SCRIPT_DIR/verify-postgres-backup.sh" "$archive_path"

printf '灾备流水线集成测试通过。\n'
