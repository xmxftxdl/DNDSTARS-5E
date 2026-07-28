#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  MINGW*|MSYS*) export MSYS_NO_PATHCONV=1 ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${STARS_COMPOSE_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
HELPER_IMAGE="${STARS_BACKUP_HELPER_IMAGE:-alpine:3.21}"

usage() {
  printf '用法：%s <astraltrace-*.tar.gz> --yes\n' "$0" >&2
}

if [[ $# -ne 2 || "$2" != "--yes" ]]; then
  usage
  exit 2
fi

archive_path="$(readlink -f -- "$1")"

docker_host_path() {
  case "$(uname -s)" in
    MINGW*|MSYS*) cygpath -am "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

validate_archive() {
  local candidate="$1"
  if [[ ! -f "$candidate" || ! -f "${candidate}.sha256" ]]; then
    printf '找不到备份或校验文件：%s\n' "$candidate" >&2
    return 2
  fi
  (
    cd -- "$(dirname -- "$candidate")"
    sha256sum -c "$(basename -- "${candidate}.sha256")"
  )
  local entries
  entries="$(tar -tzf "$candidate")"
  if [[ -z "$entries" ]] || printf '%s\n' "$entries" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    printf '备份归档包含不安全路径。\n' >&2
    return 2
  fi
  local required
  for required in manifest.json postgres.dump shared-data.tar.gz; do
    if ! printf '%s\n' "$entries" | grep -Eq "^(\./)?${required}$"; then
      printf '备份缺少 %s。\n' "$required" >&2
      return 2
    fi
  done
}

manifest_number() {
  local manifest="$1"
  local key="$2"
  local value
  value="$(sed -nE "s/^[[:space:]]*\"${key}\":[[:space:]]*([0-9]+),?$/\\1/p" "$manifest")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    printf 'manifest.json 缺少有效字段：%s\n' "$key" >&2
    return 2
  fi
  printf '%s' "$value"
}

validate_archive "$archive_path"
cd -- "$COMPOSE_DIR"

compose() {
  if [[ -n "${STARS_COMPOSE_ENV_FILE:-}" ]]; then
    docker compose --env-file "$STARS_COMPOSE_ENV_FILE" "$@"
  else
    docker compose "$@"
  fi
}

app_container="$(compose ps -aq dndstars | head -n 1)"
backup_container="$(compose ps -aq backup | head -n 1)"
if [[ -z "$app_container" || -z "$backup_container" ]]; then
  printf '找不到 dndstars 或 backup Compose 容器，拒绝执行在线恢复。\n' >&2
  exit 4
fi
data_volume="$(
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' \
    "$app_container"
)"
backup_host_path="${STARS_BACKUP_HOST_PATH:-}"
if [[ -z "$backup_host_path" ]]; then
  case "$(uname -s)" in
    MINGW*|MSYS*) backup_host_path="$(dirname -- "$archive_path")" ;;
    *)
      backup_host_path="$(
        docker inspect --format '{{range .Mounts}}{{if eq .Destination "/backups"}}{{.Source}}{{end}}{{end}}' \
          "$backup_container"
      )"
      ;;
  esac
fi
case "$(uname -s)" in
  MINGW*|MSYS*)
    if [[ "$backup_host_path" =~ ^[A-Za-z]:[/\\] ]]; then
      backup_host_path="$(cygpath -u "$backup_host_path")"
    fi
    ;;
esac
if [[ -z "$data_volume" || ! -d "$backup_host_path" ]]; then
  printf '无法解析 /data 卷或 /backups 主机目录。\n' >&2
  exit 4
fi

printf '正在创建恢复前保护备份……\n' >&2
protection_archive=''
for _ in $(seq 1 5); do
  if compose run --rm -e STARS_BACKUP_ONCE=true backup >/dev/null; then
    protection_archive="$(
      find "$backup_host_path" -maxdepth 1 -type f -name 'astraltrace-*.tar.gz' \
        -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-
    )"
    break
  fi
  sleep 2
done
if [[ -z "$protection_archive" ]]; then
  printf '无法建立恢复前保护备份，已安全终止。\n' >&2
  exit 4
fi
validate_archive "$protection_archive"
printf '恢复前保护备份：%s\n' "$protection_archive" >&2

restore_archive() {
  local candidate="$1"
  local work_dir
  work_dir="$(mktemp -d "$(dirname -- "$candidate")/.restore-live.XXXXXX")"
  validate_archive "$candidate"
  tar -xzf "$candidate" -C "$work_dir"
  local inner_entries
  inner_entries="$(tar -tzf "$work_dir/shared-data.tar.gz")"
  if printf '%s\n' "$inner_entries" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    rm -rf -- "$work_dir"
    printf '共享数据归档包含不安全路径。\n' >&2
    return 2
  fi
  local expected_accounts expected_campaigns expected_orders expected_ledger
  local expected_payouts expected_plugins expected_entitlements expected_files
  expected_accounts="$(manifest_number "$work_dir/manifest.json" accounts)" || return 2
  expected_campaigns="$(manifest_number "$work_dir/manifest.json" campaigns)" || return 2
  expected_orders="$(manifest_number "$work_dir/manifest.json" orders)" || return 2
  expected_ledger="$(manifest_number "$work_dir/manifest.json" ledgerEntries)" || return 2
  expected_payouts="$(manifest_number "$work_dir/manifest.json" payouts)" || return 2
  expected_plugins="$(manifest_number "$work_dir/manifest.json" plugins)" || return 2
  expected_entitlements="$(manifest_number "$work_dir/manifest.json" entitlements)" || return 2
  expected_files="$(manifest_number "$work_dir/manifest.json" sharedFiles)" || return 2

  compose stop backup dndstars >/dev/null
  compose exec -T postgres sh -ceu '
    dropdb --if-exists --force --username="$POSTGRES_USER" "$POSTGRES_DB"
    createdb --username="$POSTGRES_USER" "$POSTGRES_DB"
  '
  compose cp "$(docker_host_path "$work_dir/postgres.dump")" \
    postgres:/tmp/astraltrace-restore.dump >/dev/null
  if ! compose exec -T postgres sh -ceu '
    pg_restore \
      --username="$POSTGRES_USER" \
      --dbname="$POSTGRES_DB" \
      --no-owner \
      --no-privileges \
      --exit-on-error \
      /tmp/astraltrace-restore.dump
    rm -f /tmp/astraltrace-restore.dump
  '; then
    rm -rf -- "$work_dir"
    return 5
  fi

  docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || docker pull "$HELPER_IMAGE" >/dev/null
  if ! docker run --rm \
    --mount "type=volume,src=${data_volume},dst=/data" \
    --mount "type=bind,src=$(docker_host_path "$work_dir"),dst=/restore,readonly" \
    "$HELPER_IMAGE" \
    sh -ceu '
      find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
      tar -C /data -xzf /restore/shared-data.tar.gz
      chown -R 1000:1000 /data
    '; then
    rm -rf -- "$work_dir"
    return 5
  fi
  rm -rf -- "$work_dir"

  compose start dndstars backup >/dev/null
  local ready=false
  for _ in $(seq 1 60); do
    if compose exec -T dndstars node -e \
      "fetch('http://127.0.0.1:8080/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
    then
      ready=true
      break
    fi
    sleep 2
  done
  if [[ "$ready" != 'true' ]]; then return 5; fi

  local actual_counts expected_counts actual_files
  actual_counts="$(
    compose exec -T postgres sh -ceu '
      psql \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --tuples-only \
        --no-align \
        --field-separator="|" \
        --command="$1"
    ' -- "
        SELECT
          (SELECT COUNT(*) FROM accounts),
          (SELECT COUNT(*) FROM campaigns),
          (SELECT COUNT(*) FROM marketplace_orders),
          (SELECT COUNT(*) FROM marketplace_ledger_entries),
          (SELECT COUNT(*) FROM marketplace_payouts),
          COALESCE((
            SELECT jsonb_array_length(document_json -> 'entries')
            FROM marketplace_registry
            WHERE singleton = TRUE
          ), 0),
          COALESCE((
            SELECT jsonb_array_length(document_json -> 'entitlements')
            FROM marketplace_registry
            WHERE singleton = TRUE
          ), 0);
      "
  )"
  expected_counts="${expected_accounts}|${expected_campaigns}|${expected_orders}|${expected_ledger}|${expected_payouts}|${expected_plugins}|${expected_entitlements}"
  if [[ "$actual_counts" != "$expected_counts" ]]; then
    printf '恢复后数据库计数不一致：expected=%s actual=%s\n' \
      "$expected_counts" "$actual_counts" >&2
    return 5
  fi
  actual_files="$(
    docker run --rm --mount "type=volume,src=${data_volume},dst=/data,readonly" \
      "$HELPER_IMAGE" sh -ceu "find /data -type f | wc -l | tr -d ' '"
  )"
  if [[ "$actual_files" != "$expected_files" ]]; then
    printf '恢复后共享文件计数不一致：expected=%s actual=%s\n' \
      "$expected_files" "$actual_files" >&2
    return 5
  fi
  if ! compose exec -T dndstars node --input-type=module -e '
    import { readFile, readdir } from "node:fs/promises";
    import path from "node:path";
    async function walk(root) {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        const candidate = path.join(root, entry.name);
        if (entry.isDirectory()) await walk(candidate);
        else if (entry.name.endsWith(".json")) JSON.parse(await readFile(candidate, "utf8"));
      }
    }
    await walk("/data");
  '; then
    printf '恢复后共享 JSON 完整性检查失败。\n' >&2
    return 5
  fi
  return 0
}

if restore_archive "$archive_path"; then
  printf '恢复完成：PostgreSQL、战役索引、市场账本和房间共享数据均已恢复。\n'
  exit 0
fi

printf '目标备份恢复失败，正在自动回滚到保护备份……\n' >&2
if restore_archive "$protection_archive"; then
  printf '自动回滚成功，生产数据已恢复到操作前状态。\n' >&2
else
  printf '自动回滚失败。请保留服务器和保护备份，立即停止写入并人工处理：%s\n' \
    "$protection_archive" >&2
fi
exit 5
