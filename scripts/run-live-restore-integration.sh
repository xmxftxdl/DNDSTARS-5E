#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  MINGW*|MSYS*) export MSYS_NO_PATHCONV=1 ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
APP_IMAGE="${STARS_APP_IMAGE:-dndstars-5e:local}"
suffix="$(date +%s)-$$"
project="astraltrace-live-restore-${suffix}"
work_dir="$REPO_ROOT/tmp/live-restore-${suffix}"
backup_dir="$work_dir/backups"
bad_dir="$work_dir/bad"
password="live-restore-password-${suffix}"

docker_host_path() {
  case "$(uname -s)" in
    MINGW*|MSYS*) cygpath -am "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

mkdir -p "$backup_dir" "$bad_dir"
export COMPOSE_PROJECT_NAME="$project"
export STARS_IMAGE="${APP_IMAGE%:*}"
export STARS_IMAGE_TAG="${APP_IMAGE##*:}"
export STARS_POSTGRES_PASSWORD="$password"
export STARS_PUBLIC_ORIGIN="http://localhost"
export STARS_BIND_ADDRESS="127.0.0.1"
export STARS_PORT="$((20000 + ($$ % 20000)))"
export STARS_BACKUP_HOST_PATH
STARS_BACKUP_HOST_PATH="$(docker_host_path "$backup_dir")"
export STARS_BACKUP_INTERVAL_SECONDS=86400
export STARS_BACKUP_RETENTION_DAYS=14

cleanup() {
  (
    cd -- "$REPO_ROOT"
    docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  )
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

cd -- "$REPO_ROOT"
docker compose up -d --no-build postgres dndstars backup >/dev/null
for _ in $(seq 1 60); do
  if docker compose exec -T dndstars node -e \
    "fetch('http://127.0.0.1:8080/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  then
    break
  fi
  sleep 2
done
docker compose exec -T dndstars node -e \
  "fetch('http://127.0.0.1:8080/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

docker compose exec -T postgres psql \
  --username=astraltrace \
  --dbname=astraltrace \
  --command="
    CREATE TABLE recovery_probe(marker TEXT NOT NULL);
    INSERT INTO recovery_probe(marker) VALUES ('before');
  " >/dev/null
docker compose exec -T dndstars sh -ceu \
  "printf 'before' > /data/recovery-probe.txt"

target_archive=''
for _ in $(seq 1 10); do
  if docker compose run --rm -e STARS_BACKUP_ONCE=true backup >/dev/null; then
    target_archive="$(
      find "$backup_dir" -maxdepth 1 -type f -name 'astraltrace-*.tar.gz' \
        -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-
    )"
    break
  fi
  sleep 2
done
if [[ -z "$target_archive" ]]; then
  printf '没有生成在线恢复目标备份。\n' >&2
  exit 5
fi

docker compose exec -T postgres psql \
  --username=astraltrace \
  --dbname=astraltrace \
  --command="UPDATE recovery_probe SET marker = 'after';" >/dev/null
docker compose exec -T dndstars sh -ceu \
  "printf 'after' > /data/recovery-probe.txt"

STARS_COMPOSE_DIR="$REPO_ROOT" \
  bash "$SCRIPT_DIR/restore-postgres-backup.sh" "$target_archive" --yes

database_marker="$(
  docker compose exec -T postgres psql \
    --username=astraltrace \
    --dbname=astraltrace \
    --tuples-only \
    --no-align \
    --command='SELECT marker FROM recovery_probe;'
)"
file_marker="$(docker compose exec -T dndstars cat /data/recovery-probe.txt)"
if [[ "$database_marker" != 'before' || "$file_marker" != 'before' ]]; then
  printf '在线恢复结果不一致：database=%s file=%s\n' "$database_marker" "$file_marker" >&2
  exit 5
fi

tar -xzf "$target_archive" -C "$bad_dir"
printf 'not-a-postgres-dump\n' > "$bad_dir/postgres.dump"
bad_archive="$work_dir/astraltrace-invalid.tar.gz"
tar -C "$bad_dir" -czf "$bad_archive" manifest.json postgres.dump shared-data.tar.gz
(
  cd -- "$work_dir"
  sha256sum "$(basename -- "$bad_archive")" > "$(basename -- "$bad_archive").sha256"
)

set +e
STARS_COMPOSE_DIR="$REPO_ROOT" \
  bash "$SCRIPT_DIR/restore-postgres-backup.sh" "$bad_archive" --yes
bad_restore_status=$?
set -e
if [[ "$bad_restore_status" -eq 0 ]]; then
  printf '损坏数据库备份不应恢复成功。\n' >&2
  exit 5
fi

database_marker="$(
  docker compose exec -T postgres psql \
    --username=astraltrace \
    --dbname=astraltrace \
    --tuples-only \
    --no-align \
    --command='SELECT marker FROM recovery_probe;'
)"
file_marker="$(docker compose exec -T dndstars cat /data/recovery-probe.txt)"
if [[ "$database_marker" != 'before' || "$file_marker" != 'before' ]]; then
  printf '失败恢复后的自动回滚不一致：database=%s file=%s\n' \
    "$database_marker" "$file_marker" >&2
  exit 5
fi

printf '在线恢复与失败自动回滚集成测试通过。\n'
