#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${STARS_COMPOSE_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
BACKUP_DIR="${STARS_BACKUP_DIR:-/opt/astraltrace/backups}"
RETENTION_DAYS="${STARS_BACKUP_RETENTION_DAYS:-14}"
HELPER_IMAGE="${STARS_BACKUP_HELPER_IMAGE:-alpine:3.21}"

log() {
  printf '%s\n' "$*" >&2
}

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  log "STARS_BACKUP_RETENTION_DAYS 必须是非负整数。"
  exit 2
fi

command -v docker >/dev/null 2>&1 || {
  log "找不到 docker。"
  exit 2
}
command -v sha256sum >/dev/null 2>&1 || {
  log "找不到 sha256sum。"
  exit 2
}
mkdir -p -- "$BACKUP_DIR"
lock_acquired=false
if [[ "${STARS_BACKUP_LOCK_HELD:-false}" != "true" ]]; then
  if ! mkdir -- "$BACKUP_DIR/.backup.lock" 2>/dev/null; then
    log "已有备份或恢复任务正在运行。"
    exit 3
  fi
  lock_acquired=true
fi

was_running=false
restart_if_needed() {
  if [[ "$was_running" == "true" ]]; then
    docker compose start dndstars >/dev/null
    was_running=false
  fi
}
cleanup() {
  restart_if_needed
  if [[ "$lock_acquired" == "true" ]]; then
    rmdir -- "$BACKUP_DIR/.backup.lock" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd -- "$COMPOSE_DIR"
container_id="$(docker compose ps -aq dndstars | head -n 1)"
if [[ -z "$container_id" ]]; then
  log "找不到 dndstars Compose 容器；请先执行 docker compose up -d。"
  exit 4
fi

volume_name="$(
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$container_id"
)"
if [[ -z "$volume_name" ]]; then
  log "容器没有挂载 /data 命名卷，拒绝生成不完整备份。"
  exit 4
fi

was_running="$(docker inspect --format '{{.State.Running}}' "$container_id")"

if [[ "$was_running" == "true" ]]; then
  log "正在短暂停止 dndstars，建立一致性备份……"
  docker compose stop dndstars >/dev/null
fi

docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || docker pull "$HELPER_IMAGE" >/dev/null

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
archive_name="astraltrace-data-${timestamp}.tar.gz"
archive_path="$BACKUP_DIR/$archive_name"
temporary_name=".${archive_name}.partial"
rm -f -- "$BACKUP_DIR/$temporary_name"

docker run --rm \
  --mount "type=volume,src=${volume_name},dst=/data,readonly" \
  --mount "type=bind,src=${BACKUP_DIR},dst=/backup" \
  "$HELPER_IMAGE" \
  sh -ceu 'tar -C / -czf "/backup/$1" data' -- "$temporary_name"

mv -- "$BACKUP_DIR/$temporary_name" "$archive_path"
(
  cd -- "$BACKUP_DIR"
  sha256sum "$archive_name" > "${archive_name}.sha256"
)

build_id="$(git -C "$COMPOSE_DIR" rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown')"
cat > "${archive_path}.metadata" <<EOF
schemaVersion=1
createdAt=${timestamp}
composeDirectory=${COMPOSE_DIR}
composeVolume=${volume_name}
buildId=${build_id}
archive=${archive_name}
EOF

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'astraltrace-data-*.tar.gz' -o -name 'astraltrace-data-*.tar.gz.sha256' -o -name 'astraltrace-data-*.tar.gz.metadata' \) \
  -mtime "+${RETENTION_DAYS}" -delete

log "备份完成：$archive_path"
printf '%s\n' "$archive_path"
