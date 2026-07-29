#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${STARS_STAGING_ENV_FILE:-$REPO_ROOT/.env.staging}"
RESTORE_ARCHIVE=''

usage() {
  printf '用法：%s [--env <path>] [--restore <backup.tar.gz>]\n' "$0" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --restore)
      RESTORE_ARCHIVE="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

ENV_FILE="$(readlink -f -- "$ENV_FILE")"
if [[ ! -f "$ENV_FILE" ]]; then
  printf '找不到 staging 环境文件：%s\n' "$ENV_FILE" >&2
  exit 2
fi
mode="$(stat -c '%a' "$ENV_FILE")"
if (( (10#$mode % 100) != 0 )); then
  printf 'staging 环境文件权限过宽，请执行 chmod 600 %s\n' "$ENV_FILE" >&2
  exit 2
fi

env_value() {
  local key="$1"
  sed -nE "s/^${key}=(.*)$/\\1/p" "$ENV_FILE" | tail -n 1
}

project="$(env_value COMPOSE_PROJECT_NAME)"
origin="$(env_value STARS_PUBLIC_ORIGIN)"
port="$(env_value STARS_PORT)"
backup_path="$(env_value STARS_BACKUP_HOST_PATH)"
password="$(env_value STARS_POSTGRES_PASSWORD)"
metrics_token="$(env_value STARS_METRICS_TOKEN)"

if [[ "$project" != 'astraltrace-staging' ]]; then
  printf 'COMPOSE_PROJECT_NAME 必须是 astraltrace-staging，避免覆盖生产卷。\n' >&2
  exit 2
fi
if [[ "$origin" != 'https://staging.astraltracevtt.com' || "$port" != '8081' ]]; then
  printf 'staging 必须使用 staging.astraltracevtt.com 和本机端口 8081。\n' >&2
  exit 2
fi
if [[ "$backup_path" != /* || "$backup_path" == '/opt/astraltrace/backups' ]]; then
  printf 'staging 必须使用独立的绝对备份目录。\n' >&2
  exit 2
fi
if [[ ${#password} -lt 24 || "$password" == *'replace-with'* ]]; then
  printf '请配置至少 24 字符的独立 staging PostgreSQL 密码。\n' >&2
  exit 2
fi
if [[ ${#metrics_token} -lt 24 || "$metrics_token" == *'replace-with'* ]]; then
  printf '请配置至少 24 字符的独立 staging 指标令牌。\n' >&2
  exit 2
fi

mkdir -p -- "$backup_path"
chmod 700 -- "$backup_path"

cd -- "$REPO_ROOT"
if grep -q 'filter=lfs' .gitattributes; then
  if ! command -v git-lfs >/dev/null 2>&1; then
    printf '仓库包含 Git LFS 美术资源；请先安装 git-lfs，再重新执行 staging 发布。\n' >&2
    exit 2
  fi
  git lfs pull
  # `head` closes the pipe after one line. With `set -o pipefail`, a large LFS
  # catalog can then make `git lfs ls-files` exit on SIGPIPE and abort a valid
  # deployment before the image build starts.
  first_lfs_asset="$(git lfs ls-files --name-only | sed -n '1p')"
  if [[ -n "$first_lfs_asset" ]] \
    && grep -q '^version https://git-lfs.github.com/spec/v1$' "$first_lfs_asset"; then
    printf 'Git LFS 资源仍是指针文件，拒绝构建缺少美术资源的 staging 镜像：%s\n' "$first_lfs_asset" >&2
    exit 2
  fi
fi

build_id="$(git rev-parse --short=12 HEAD)"
STARS_BUILD_ID="$build_id" docker compose --env-file "$ENV_FILE" build dndstars
STARS_BUILD_ID="$build_id" docker compose --env-file "$ENV_FILE" \
  up -d postgres dndstars backup

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${port}/api/readyz" >/dev/null; then break; fi
  sleep 2
done
curl -fsS "http://127.0.0.1:${port}/api/readyz" >/dev/null

if [[ -n "$RESTORE_ARCHIVE" ]]; then
  RESTORE_ARCHIVE="$(readlink -f -- "$RESTORE_ARCHIVE")"
  STARS_COMPOSE_DIR="$REPO_ROOT" \
  STARS_COMPOSE_ENV_FILE="$ENV_FILE" \
  STARS_BACKUP_HOST_PATH="$backup_path" \
    bash "$SCRIPT_DIR/restore-postgres-backup.sh" "$RESTORE_ARCHIVE" --yes
fi

local_health="$(curl -fsS "http://127.0.0.1:${port}/api/healthz")"
local_ready="$(curl -fsS "http://127.0.0.1:${port}/api/readyz")"
public_ready="$(curl -fsS "${origin}/api/readyz")"
printf '%s\n' "$local_health"
printf '%s\n' "$local_ready"
printf '%s\n' "$public_ready"
printf 'staging 发布完成：%s（build %s）\n' "$origin" "$build_id"
