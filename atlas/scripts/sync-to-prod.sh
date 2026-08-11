#!/usr/bin/env bash
# Sync local working tree to the production VPS without touching .env files.
#
# Usage:  ./scripts/sync-to-prod.sh
# Then SSH and run `./scripts/deploy.sh` (or just rebuild what changed).
#
# Why this exists: a plain `rsync --delete` from local clobbered /opt/atlas-aec/.env
# with the dev .env (which is missing MINIO_ROOT_PASSWORD / WINWORK_SCRAPE_SECRET).
# This wrapper enforces the safe exclude list.

set -euo pipefail

VPS_HOST="${VPS_HOST:-root@142.132.170.171}"
VPS_PATH="${VPS_PATH:-/opt/atlas-aec/}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/aecplatform_deploy}"

cd "$(dirname "$0")/.."

echo "==> Syncing → $VPS_HOST:$VPS_PATH"
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  --exclude '*.tsbuildinfo' \
  --exclude 'apps/web/e2e/.auth.json' \
  --exclude '/tmp/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude '.env.*.local' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
  ./ "$VPS_HOST:$VPS_PATH"

echo "==> Done. Now SSH and rebuild what changed, e.g.:"
echo "    ssh -i $SSH_KEY $VPS_HOST 'cd /opt/atlas-aec && docker compose -f docker-compose.prod.yml --env-file .env.production build web && docker compose -f docker-compose.prod.yml --env-file .env.production up -d web'"
