#!/usr/bin/env bash
#
# Atlas AEC — daily backup script.
#
# Snapshots Postgres + S3/MinIO buckets to a backup target (S3 prefix or local
# disk). Designed to run from cron / systemd timer / Kubernetes CronJob.
#
# Required env:
#   DATABASE_URL              — Postgres connection string
#   BACKUP_DIR                — local staging dir (default /var/backups/atlas-aec)
#   BACKUP_RETENTION_DAYS     — keep N days of dumps (default 30)
#   BACKUP_S3_BUCKET          — optional: aws s3 sync destination
#   BACKUP_S3_ENDPOINT        — optional: for MinIO / non-AWS
#
# Restore:  pg_restore -d $DATABASE_URL --clean --if-exists  <dump.sql.gz>
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/atlas-aec}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

DB_DUMP="$BACKUP_DIR/atlas-aec-db-$TS.sql.gz"

echo "[backup] $TS pg_dump → $DB_DUMP"
pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$DB_DUMP"

echo "[backup] integrity check"
gunzip -t "$DB_DUMP"

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "[backup] sync to $BACKUP_S3_BUCKET"
  AWS_ARGS=()
  [[ -n "${BACKUP_S3_ENDPOINT:-}" ]] && AWS_ARGS+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
  aws "${AWS_ARGS[@]}" s3 cp "$DB_DUMP" "s3://$BACKUP_S3_BUCKET/db/" --only-show-errors
fi

echo "[backup] prune older than $RETENTION days"
find "$BACKUP_DIR" -name 'atlas-aec-db-*.sql.gz' -mtime "+$RETENTION" -delete

echo "[backup] done"
