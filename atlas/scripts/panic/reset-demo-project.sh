#!/usr/bin/env bash
# Restore the demo project (KHFKKSDJF) by re-running seed-demo-rich + seed-vendor + seed-compliance.
# Idempotent — checks for existing rows before inserting.
#
# Use when: someone (you?) accidentally deleted a CO / NCR / etc. mid-demo.
#
# Time: ~30-45 seconds.

set -euo pipefail
REPO=${REPO:-/Users/vsf-thuynt519-l/Documents/GitHub/atlas-aec}
VPS=${VPS:-root@142.132.170.171}
VPS_KEY=${VPS_KEY:-$HOME/.ssh/aecplatform_deploy}

DBURL=$(ssh -i "$VPS_KEY" "$VPS" 'grep ^DATABASE_URL /opt/atlas-aec/.env.production | cut -d= -f2- | tr -d "\""')

cd "$REPO/packages/db"

echo "→ Re-seeding demo data..."
DATABASE_URL="$DBURL" pnpm exec tsx ../../scripts/seed-demo-rich.ts 2>&1 | tail -5
echo
echo "→ Re-seeding vendor..."
DATABASE_URL="$DBURL" pnpm exec tsx ../../scripts/seed-vendor.ts 2>&1 | tail -5
echo
echo "→ Re-seeding compliance..."
DATABASE_URL="$DBURL" pnpm exec tsx ../../scripts/seed-compliance.ts 2>&1 | tail -5
echo
echo "✓ Demo data restored. Hard refresh demo browser (⌘⇧R)."
