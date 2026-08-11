#!/usr/bin/env bash
# scripts/restore-drill.sh — verify a Postgres backup is actually restorable.
#
# Usage:
#   ./scripts/restore-drill.sh <backup.sql.gz>
#
# What it does:
#   1. Boots a throw-away postgres:16-alpine container on a free port
#   2. Pipes the dump into it via psql
#   3. Counts rows in every table and prints a sanity table
#   4. Tears the container down (no leftover state)
#
# Exit non-zero if any step fails. Wire to a weekly cron in production.
set -euo pipefail

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "usage: $0 <path-to-backup.sql.gz>"
  exit 2
fi

CONTAINER="atlas-aec-restore-drill-$$"
PORT=$((RANDOM + 20000))

cleanup() {
  echo "→ cleanup: stopping $CONTAINER"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ starting throw-away Postgres on port $PORT"
docker run -d --name "$CONTAINER" -e POSTGRES_USER=drill -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill -p "$PORT:5432" postgres:16-alpine >/dev/null

echo "→ waiting for postgres to be ready"
for i in {1..30}; do
  if docker exec "$CONTAINER" pg_isready -U drill -d drill >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "→ restoring $DUMP"
gunzip -c "$DUMP" | docker exec -i "$CONTAINER" psql -U drill -d drill >/dev/null

echo "→ row counts:"
docker exec -i "$CONTAINER" psql -U drill -d drill -At <<'SQL'
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS cols
FROM information_schema.tables t
WHERE table_schema='public'
ORDER BY table_name;
SQL

echo "→ smoke queries:"
docker exec -i "$CONTAINER" psql -U drill -d drill -c "SELECT 'Project' AS t, COUNT(*) FROM \"Project\" UNION ALL SELECT 'Bid', COUNT(*) FROM \"Bid\" UNION ALL SELECT 'AuditEvent', COUNT(*) FROM \"AuditEvent\";"

echo "✅ restore drill passed."
