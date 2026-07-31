#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  MINGW*|MSYS*) export MSYS_NO_PATHCONV=1 ;;
esac

POSTGRES_IMAGE="${STARS_POSTGRES_IMAGE:-postgres:17-alpine}"
HELPER_IMAGE="${STARS_BACKUP_HELPER_IMAGE:-alpine:3.21}"
APP_IMAGE="${STARS_APP_IMAGE:-}"

usage() {
  printf '用法：STARS_APP_IMAGE=<image> %s <astraltrace-*.tar.gz>\n' "$0" >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi
if [[ -z "$APP_IMAGE" ]]; then
  printf '必须通过 STARS_APP_IMAGE 指定待验证的应用镜像。\n' >&2
  exit 2
fi

archive_path="$(readlink -f -- "$1")"
if [[ ! -f "$archive_path" || ! -f "${archive_path}.sha256" ]]; then
  printf '找不到备份或校验文件：%s\n' "$archive_path" >&2
  exit 2
fi
archive_dir="$(dirname -- "$archive_path")"
archive_name="$(basename -- "$archive_path")"
(
  cd -- "$archive_dir"
  sha256sum -c "${archive_name}.sha256"
)

entries="$(tar -tzf "$archive_path")"
if [[ -z "$entries" ]] || printf '%s\n' "$entries" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  printf '备份归档包含不安全路径。\n' >&2
  exit 2
fi
for required in manifest.json postgres.dump shared-data.tar.gz; do
  if ! printf '%s\n' "$entries" | grep -Eq "^(\./)?${required}$"; then
    printf '备份缺少 %s。\n' "$required" >&2
    exit 2
  fi
done

suffix="$(date +%s)-$$"
network="astraltrace-restore-drill-${suffix}"
postgres_volume="${network}-postgres"
data_volume="${network}-data"
postgres_container="${network}-db"
app_container="${network}-app"
work_dir="$(mktemp -d "$archive_dir/.restore-drill.XXXXXX")"
password="restore-drill-password-${suffix}"

docker_host_path() {
  case "$(uname -s)" in
    MINGW*|MSYS*) cygpath -am "$1" ;;
    *) printf '%s' "$1" ;;
  esac
}

cleanup() {
  docker rm -f "$app_container" "$postgres_container" >/dev/null 2>&1 || true
  docker volume rm "$data_volume" "$postgres_volume" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

tar -xzf "$archive_path" -C "$work_dir"
inner_entries="$(tar -tzf "$work_dir/shared-data.tar.gz")"
if printf '%s\n' "$inner_entries" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  printf '共享数据归档包含不安全路径。\n' >&2
  exit 2
fi

manifest_number() {
  local key="$1"
  local value
  value="$(sed -nE "s/^[[:space:]]*\"${key}\":[[:space:]]*([0-9]+),?$/\\1/p" \
    "$work_dir/manifest.json")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    printf 'manifest.json 缺少有效字段：%s\n' "$key" >&2
    exit 2
  fi
  printf '%s' "$value"
}

expected_accounts="$(manifest_number accounts)"
expected_campaigns="$(manifest_number campaigns)"
expected_orders="$(manifest_number orders)"
expected_ledger="$(manifest_number ledgerEntries)"
expected_payouts="$(manifest_number payouts)"
expected_plugins="$(manifest_number plugins)"
expected_entitlements="$(manifest_number entitlements)"
expected_files="$(manifest_number sharedFiles)"

docker network create "$network" >/dev/null
docker volume create "$postgres_volume" >/dev/null
docker volume create "$data_volume" >/dev/null
docker run -d \
  --name "$postgres_container" \
  --network "$network" \
  --network-alias postgres \
  -e POSTGRES_DB=astraltrace \
  -e POSTGRES_USER=astraltrace \
  -e "POSTGRES_PASSWORD=$password" \
  --mount "type=volume,src=${postgres_volume},dst=/var/lib/postgresql/data" \
  "$POSTGRES_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$postgres_container" pg_isready -U astraltrace -d astraltrace >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$postgres_container" pg_isready -U astraltrace -d astraltrace >/dev/null

docker run --rm \
  --network "$network" \
  -e PGPASSWORD="$password" \
  --mount "type=bind,src=$(docker_host_path "$work_dir"),dst=/restore,readonly" \
  "$POSTGRES_IMAGE" \
  pg_restore \
    --host=postgres \
    --username=astraltrace \
    --dbname=astraltrace \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    /restore/postgres.dump

docker run --rm \
  --mount "type=volume,src=${data_volume},dst=/data" \
  --mount "type=bind,src=$(docker_host_path "$work_dir"),dst=/restore,readonly" \
  "$HELPER_IMAGE" \
  sh -ceu '
    tar -C /data -xzf /restore/shared-data.tar.gz
    chown -R 1000:1000 /data
  '

docker run -d \
  --name "$app_container" \
  --network "$network" \
  --read-only \
  --tmpfs /tmp:size=64m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  -e NODE_ENV=production \
  -e STARS_SECURITY_MODE=production \
  -e STARS_PUBLIC_ORIGIN=http://localhost \
  -e STARS_SHARED_ROOT=/data \
  -e STARS_ACCOUNT_STORAGE=postgres \
  -e "STARS_DATABASE_URL=postgresql://astraltrace:${password}@postgres:5432/astraltrace" \
  -e STARS_METRICS_TOKEN=restore-drill-metrics-token \
  --mount "type=volume,src=${data_volume},dst=/data" \
  "$APP_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$app_container" node -e \
    "fetch('http://127.0.0.1:8080/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  then
    break
  fi
  sleep 1
done
docker exec "$app_container" node -e \
  "fetch('http://127.0.0.1:8080/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

actual_counts="$(
  docker exec -e PGPASSWORD="$password" "$postgres_container" \
    psql -U astraltrace -d astraltrace -tA -F '|' -c '
      SELECT
        (SELECT COUNT(*) FROM accounts),
        (SELECT COUNT(*) FROM campaigns),
        (SELECT COUNT(*) FROM marketplace_orders),
        (SELECT COUNT(*) FROM marketplace_ledger_entries),
        (SELECT COUNT(*) FROM marketplace_payouts),
        COALESCE((
          SELECT jsonb_array_length(document_json -> $q$entries$q$)
          FROM marketplace_registry
          WHERE singleton = TRUE
        ), 0),
        COALESCE((
          SELECT jsonb_array_length(document_json -> $q$entitlements$q$)
          FROM marketplace_registry
          WHERE singleton = TRUE
        ), 0);
    '
)"
expected_counts="${expected_accounts}|${expected_campaigns}|${expected_orders}|${expected_ledger}|${expected_payouts}|${expected_plugins}|${expected_entitlements}"
if [[ "$actual_counts" != "$expected_counts" ]]; then
  printf '数据库计数不一致：expected=%s actual=%s\n' "$expected_counts" "$actual_counts" >&2
  exit 5
fi

actual_files="$(
  docker run --rm --mount "type=volume,src=${data_volume},dst=/data,readonly" \
    "$HELPER_IMAGE" sh -ceu "find /data -type f | wc -l | tr -d ' '"
)"
if [[ "$actual_files" != "$expected_files" ]]; then
  printf '共享文件计数不一致：expected=%s actual=%s\n' "$expected_files" "$actual_files" >&2
  exit 5
fi

docker exec "$app_container" node --input-type=module -e '
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
'

printf '完整恢复演练通过：数据库、市场账本、战役索引、共享房间数据与应用健康检查一致。\n'
