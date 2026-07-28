#!/bin/sh
set -eu

BACKUP_ROOT="${STARS_BACKUP_ROOT:-/backups}"
INTERVAL_SECONDS="${STARS_BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION_DAYS="${STARS_BACKUP_RETENTION_DAYS:-14}"

case "$INTERVAL_SECONDS:$RETENTION_DAYS" in
  *[!0-9:]*|:*|*:) echo "invalid backup interval or retention" >&2; exit 2 ;;
esac
if [ "$INTERVAL_SECONDS" -lt 60 ] || [ "$RETENTION_DAYS" -lt 1 ]; then
  echo "backup interval must be at least 60 seconds and retention at least 1 day" >&2
  exit 2
fi

mkdir -p "$BACKUP_ROOT"
lock_held=false
current_work_dir=''

cleanup() {
  if [ -n "$current_work_dir" ]; then rm -rf "$current_work_dir"; fi
  if [ "$lock_held" = "true" ]; then
    rmdir "$BACKUP_ROOT/.backup.lock" 2>/dev/null || true
    lock_held=false
  fi
}
trap cleanup EXIT INT TERM

create_backup_payload() {
  pg_dump \
    --host="${PGHOST:-postgres}" \
    --port="${PGPORT:-5432}" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --file="$work_dir/postgres.dump" || return 1
  counts="$(psql \
    --host="${PGHOST:-postgres}" \
    --port="${PGPORT:-5432}" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --tuples-only \
    --no-align \
    --field-separator='|' \
    --command='
      SELECT
        COALESCE((SELECT MAX(version) FROM schema_migrations), 0),
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
    ')" || return 1
  IFS='|' read -r database_schema_version account_count campaign_count order_count ledger_count payout_count plugin_count entitlement_count <<EOF
$counts
EOF
  shared_file_count="$(find /data -type f | wc -l | tr -d ' ')" || return 1
  cat > "$work_dir/manifest.json" <<EOF
{
  "schemaVersion": 2,
  "createdAt": "$timestamp",
  "databaseSchemaVersion": $database_schema_version,
  "accounts": $account_count,
  "campaigns": $campaign_count,
  "orders": $order_count,
  "ledgerEntries": $ledger_count,
  "payouts": $payout_count,
  "plugins": $plugin_count,
  "entitlements": $entitlement_count,
  "sharedFiles": $shared_file_count
}
EOF
  tar -C /data -czf "$work_dir/shared-data.tar.gz" . || return 1
  tar -C "$work_dir" -czf "$work_dir/$archive_name" \
    manifest.json postgres.dump shared-data.tar.gz || return 1
  (cd "$work_dir" && sha256sum "$archive_name" > "$archive_name.sha256")
}

while true; do
  if ! mkdir "$BACKUP_ROOT/.backup.lock" 2>/dev/null; then
    printf '{"timestamp":"%s","level":"warning","event":"backup_skipped","reason":"lock-held"}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
    if [ "${STARS_BACKUP_ONCE:-false}" = "true" ]; then exit 3; fi
    sleep "$INTERVAL_SECONDS"
    continue
  fi
  lock_held=true
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  work_dir="$BACKUP_ROOT/.backup-$timestamp"
  current_work_dir="$work_dir"
  archive_name="astraltrace-$timestamp.tar.gz"
  archive="$BACKUP_ROOT/$archive_name"
  mkdir -p "$work_dir"

  if create_backup_payload; then
    mv "$work_dir/$archive_name" "$archive"
    mv "$work_dir/$archive_name.sha256" "$archive.sha256"
    date -u +%s > "$BACKUP_ROOT/.last-success.tmp"
    mv "$BACKUP_ROOT/.last-success.tmp" "$BACKUP_ROOT/.last-success"
    printf '{"timestamp":"%s","level":"info","event":"backup_completed","archive":"%s"}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$archive"
  else
    printf '{"timestamp":"%s","level":"error","event":"backup_failed"}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
  fi
  rm -rf "$work_dir"
  current_work_dir=''
  rmdir "$BACKUP_ROOT/.backup.lock"
  lock_held=false
  find "$BACKUP_ROOT" -type f \
    \( -name 'astraltrace-*.tar.gz' -o -name 'astraltrace-*.tar.gz.sha256' \) \
    -mtime "+$RETENTION_DAYS" -delete
  if [ "${STARS_BACKUP_ONCE:-false}" = "true" ]; then exit 0; fi
  sleep "$INTERVAL_SECONDS"
done
