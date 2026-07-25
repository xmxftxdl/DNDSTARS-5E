#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${STARS_COMPOSE_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
BACKUP_DIR="${STARS_BACKUP_DIR:-/opt/astraltrace/backups}"
HELPER_IMAGE="${STARS_BACKUP_HELPER_IMAGE:-alpine:3.21}"

if [[ "${1:-}" == "--latest" ]]; then
  archive_path="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'astraltrace-data-*.tar.gz' -printf '%T@ %p\n' |
    sort -nr | head -n 1 | cut -d' ' -f2-)"
else
  archive_path="$(readlink -f -- "${1:-}")"
fi
if [[ -z "${archive_path:-}" || ! -f "$archive_path" ]]; then
  printf '找不到待验证的备份归档。\n' >&2
  exit 2
fi

archive_dir="$(dirname -- "$archive_path")"
archive_name="$(basename -- "$archive_path")"
(
  cd -- "$archive_dir"
  sha256sum -c "${archive_name}.sha256"
)

cd -- "$COMPOSE_DIR"
source_container="$(docker compose ps -aq dndstars | head -n 1)"
app_image="$(docker inspect --format '{{.Config.Image}}' "$source_container")"
if [[ -z "$app_image" ]]; then
  printf '无法确定当前 dndstars 镜像。\n' >&2
  exit 4
fi

suffix="$(date +%s)-$$"
drill_volume="astraltrace-restore-drill-${suffix}"
drill_container="astraltrace-restore-drill-${suffix}"
cleanup() {
  docker rm -f "$drill_container" >/dev/null 2>&1 || true
  docker volume rm "$drill_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker volume create "$drill_volume" >/dev/null
docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || docker pull "$HELPER_IMAGE" >/dev/null
docker run --rm \
  --mount "type=volume,src=${drill_volume},dst=/data" \
  --mount "type=bind,src=${archive_dir},dst=/backup,readonly" \
  "$HELPER_IMAGE" \
  sh -ceu 'tar -C / -xzf "/backup/$1"; chown -R 1000:1000 /data' -- "$archive_name"

docker run -d \
  --name "$drill_container" \
  --read-only \
  --tmpfs /tmp:size=64m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  -e NODE_ENV=production \
  -e STARS_SECURITY_MODE=production \
  -e STARS_PUBLIC_ORIGIN=http://localhost \
  -e STARS_SHARED_ROOT=/data \
  --mount "type=volume,src=${drill_volume},dst=/data" \
  "$app_image" >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$drill_container" node -e \
    "fetch('http://127.0.0.1:8080/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  then
    printf '恢复演练通过：%s 可由镜像 %s 正常启动。\n' "$archive_path" "$app_image"
    exit 0
  fi
  sleep 2
done

docker logs "$drill_container" >&2 || true
printf '恢复演练失败：临时容器未通过健康检查。\n' >&2
exit 5
