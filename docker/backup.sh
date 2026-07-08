#!/bin/sh
set -eu

: "${PGPASSFILE:?PGPASSFILE must be set}"
if [ ! -f "$PGPASSFILE" ]; then
  echo "[$(date)] FATAL: $PGPASSFILE missing — refusing to run backup" >&2
  exit 2
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/fluxcore_${TIMESTAMP}.sql.gz"

pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" | gzip > "$BACKUP_FILE"

# Remove backups older than retention period
find /backups -name "fluxcore_*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS:-7}" -delete

echo "[$(date)] Backup completed: $BACKUP_FILE"
