#!/bin/sh
set -eu

APP_ENV="${APP_ENV:-local}"
DEST="${BACKUP_DESTINATION:-s3:${BACKUP_S3_BUCKET:-}/vela/${APP_ENV}}"
HOUR="${BACKUP_HOUR_UTC:-21}"
KEEP_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STATUS_DIR="${BACKUP_STATUS_DIR:-/status}"
WORK="${BACKUP_WORK_DIR:-/tmp/vela-backup}"
CHECK_DB="vela_restore_check"

log() {
  printf '{"time":"%s","service":"backup","env":"%s","msg":"%s"%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$APP_ENV" "$1" "${2:-}"
}

configured() {
  [ -n "${BACKUP_AGE_RECIPIENT:-}" ] && [ -n "${DATABASE_URL:-}" ] && [ "$DEST" != "s3:/vela/${APP_ENV}" ]
}

admin_url() {
  printf '%s' "$DATABASE_URL" | sed -E 's#/[^/?]+(\?|$)#/postgres\1#'
}

check_url() {
  printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|$)#/${CHECK_DB}\1#"
}

restore_check() {
  dump="$1"
  psql -q -v ON_ERROR_STOP=1 -d "$(admin_url)" -c "DROP DATABASE IF EXISTS ${CHECK_DB}" -c "CREATE DATABASE ${CHECK_DB}"
  pg_restore --no-owner --no-privileges --exit-on-error -d "$(check_url)" "$dump"
  tables=$(psql -tAq -d "$(check_url)" -c "select count(*) from information_schema.tables where table_schema = 'public'")
  restored=$(psql -tAq -d "$(check_url)" -c "select count(*) from drizzle.__drizzle_migrations")
  source=$(psql -tAq -d "$DATABASE_URL" -c "select count(*) from drizzle.__drizzle_migrations")
  psql -q -d "$(admin_url)" -c "DROP DATABASE IF EXISTS ${CHECK_DB}"
  if [ "$tables" -lt 10 ] || [ "$restored" != "$source" ]; then
    log "restore check failed" ",\"tables\":${tables:-0},\"migrations\":\"${restored}/${source}\""
    return 1
  fi
  log "restore check passed" ",\"tables\":${tables},\"migrations\":${restored}"
}

run_once() {
  if ! configured; then
    log "backups not configured" ',"need":"DATABASE_URL, BACKUP_AGE_RECIPIENT and BACKUP_DESTINATION or BACKUP_S3_BUCKET"'
    return 1
  fi
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p "$WORK" "$STATUS_DIR"
  dump="$WORK/vela-${APP_ENV}-${stamp}.dump"
  sealed="${dump}.age"
  trap 'rm -f "$dump" "$sealed"' EXIT

  pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$dump"
  restore_check "$dump"
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$sealed" "$dump"
  rm -f "$dump"

  size=$(wc -c < "$sealed" | tr -d ' ')
  rclone copyto --s3-no-check-bucket "$sealed" "${DEST}/$(basename "$sealed")"
  uploaded=$(rclone size --json "${DEST}/$(basename "$sealed")" | sed -E 's/.*"bytes":([0-9]+).*/\1/')
  if [ "$uploaded" != "$size" ]; then
    log "upload size mismatch" ",\"local\":${size},\"remote\":\"${uploaded}\""
    return 1
  fi
  rclone delete --min-age "${KEEP_DAYS}d" --include "vela-${APP_ENV}-*.dump.age" "$DEST"

  date -u +%s > "$STATUS_DIR/last-success"
  log "backup uploaded" ",\"file\":\"$(basename "$sealed")\",\"bytes\":${size}"
  rm -f "$sealed"
  trap - EXIT
}

seconds_until_hour() {
  now=$(date -u +%s)
  today=$(date -u +%Y-%m-%d)
  target=$(date -u -d "${today} ${HOUR}:30:00" +%s 2>/dev/null || date -u -D '%Y-%m-%d %H:%M:%S' -d "${today} ${HOUR}:30:00" +%s)
  if [ "$target" -le "$now" ]; then target=$((target + 86400)); fi
  echo $((target - now))
}

restore() {
  name="${1:?usage: vela-backup restore <file name> <age identity file> [database url]}"
  identity="${2:?usage: vela-backup restore <file name> <age identity file> [database url]}"
  target="${3:-$DATABASE_URL}"
  mkdir -p "$WORK"
  rclone copyto "${DEST}/${name}" "$WORK/$name"
  age --decrypt --identity "$identity" --output "$WORK/restore.dump" "$WORK/$name"
  pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error -d "$target" "$WORK/restore.dump"
  rm -f "$WORK/$name" "$WORK/restore.dump"
  log "restored" ",\"file\":\"${name}\""
}

case "${1:-loop}" in
  once)
    run_once
    ;;
  list)
    rclone lsl "$DEST"
    ;;
  restore)
    shift
    restore "$@"
    ;;
  healthy)
    test -f "$STATUS_DIR/last-success" && [ $(( $(date -u +%s) - $(cat "$STATUS_DIR/last-success") )) -lt 108000 ]
    ;;
  loop)
    if ! configured; then
      log "backups not configured" ',"need":"DATABASE_URL, BACKUP_AGE_RECIPIENT and BACKUP_DESTINATION or BACKUP_S3_BUCKET"'
      if [ "$APP_ENV" = "production" ]; then exit 1; fi
      exec sleep infinity
    fi
    run_once || log "backup failed"
    while true; do
      sleep "$(seconds_until_hour)"
      run_once || log "backup failed"
    done
    ;;
  *)
    echo "usage: vela-backup [loop|once|list|restore <file> <identity> [database url]|healthy]" >&2
    exit 2
    ;;
esac
