#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${STARS_COMPOSE_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
BACKUP_DIR="${STARS_BACKUP_DIR:-/opt/astraltrace/backups}"
HELPER_IMAGE="${STARS_BACKUP_HELPER_IMAGE:-alpine:3.21}"

usage() {
  printf '用法：%s <backup.tar.gz> --yes\n' "$0" >&2
}

if [[ $# -ne 2 || "$2" != "--yes" ]]; then
  usage
  exit 2
fi

archive_path="$(readlink -f -- "$1")"
if [[ ! -f "$archive_path" ]]; then
  printf '备份文件不存在：%s\n' "$archive_path" >&2
  exit 2
fi

archive_dir="$(dirname -- "$archive_path")"
archive_name="$(basename -- "$archive_path")"
archive_path_for_tar="$archive_path"
if command -v cygpath >/dev/null 2>&1; then
  archive_path_for_tar="$(cygpath -u "$archive_path")"
fi
checksum_path="${archive_path}.sha256"
if [[ ! -f "$checksum_path" ]]; then
  printf '缺少校验文件：%s\n' "$checksum_path" >&2
  exit 2
fi
(
  cd -- "$archive_dir"
  sha256sum -c "$(basename -- "$checksum_path")"
)

entries="$(tar -tzf "$archive_path_for_tar")"
if [[ -z "$entries" ]] || printf '%s\n' "$entries" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  printf '备份归档包含不安全路径，拒绝恢复。\n' >&2
  exit 2
fi
if printf '%s\n' "$entries" | grep -Evq '^data(/|$)'; then
  printf '备份归档不是受支持的 /data 完整备份。\n' >&2
  exit 2
fi

mkdir -p -- "$BACKUP_DIR"
if ! mkdir -- "$BACKUP_DIR/.backup.lock" 2>/dev/null; then
  printf '已有备份或恢复任务正在运行。\n' >&2
  exit 3
fi
restore_stopped=false
cleanup() {
  if [[ "$restore_stopped" == "true" ]]; then
    cd -- "$COMPOSE_DIR"
    docker compose start dndstars >/dev/null 2>&1 || true
  fi
  rmdir -- "$BACKUP_DIR/.backup.lock" 2>/dev/null || true
}
trap cleanup EXIT
pre_restore="$(
  STARS_COMPOSE_DIR="$COMPOSE_DIR" \
  STARS_BACKUP_DIR="$BACKUP_DIR" \
  STARS_BACKUP_HELPER_IMAGE="$HELPER_IMAGE" \
  STARS_BACKUP_LOCK_HELD=true \
  "$SCRIPT_DIR/backup-docker-data.sh"
)"
printf '恢复前保护备份：%s\n' "$pre_restore" >&2

cd -- "$COMPOSE_DIR"
container_id="$(docker compose ps -aq dndstars | head -n 1)"
volume_name="$(
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$container_id"
)"
if [[ -z "$volume_name" ]]; then
  printf '找不到 dndstars /data 命名卷。\n' >&2
  exit 4
fi

docker compose stop dndstars >/dev/null
restore_stopped=true
docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || docker pull "$HELPER_IMAGE" >/dev/null
docker run --rm \
  --mount "type=volume,src=${volume_name},dst=/data" \
  --mount "type=bind,src=${archive_dir},dst=/backup,readonly" \
  "$HELPER_IMAGE" \
  sh -ceu '
    find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
    tar -C / -xzf "/backup/$1"
    chown -R 1000:1000 /data
  ' -- "$archive_name"

docker compose start dndstars >/dev/null
restore_stopped=false
for attempt in $(seq 1 30); do
  if docker compose exec -T dndstars node -e \
    "fetch('http://127.0.0.1:8080/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  then
    printf '恢复完成，容器健康检查通过。\n'
    exit 0
  fi
  sleep 2
done

printf '恢复后的容器未通过健康检查。可使用保护备份再次恢复：%s\n' "$pre_restore" >&2
exit 5
