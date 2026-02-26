#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/fluxcore_${TIMESTAMP}.sql.gz"

pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" | gzip > "$BACKUP_FILE"

# Remove backups older than retention period
find /backups -name "fluxcore_*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS:-7}" -delete

echo "[$(date)] Backup completed: $BACKUP_FILE"