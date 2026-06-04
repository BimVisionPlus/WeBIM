#!/usr/bin/env bash
# Force an Issue to a specific state, bypassing FSM guard.
# Use when: workflow got stuck mid-demo, or you want to reset a CO back to DRAFT
# so you can demo the transition again.
#
# Usage: ./fix-workflow.sh ISSUE-KEY NEW-STATE
# Examples:
#   ./fix-workflow.sh KHFKKSDJF-CO-001 DRAFT
#   ./fix-workflow.sh VHGP-S9-RFI-005 OPEN
#
# Time: ~3 seconds

set -euo pipefail
KEY=${1:?usage: ./fix-workflow.sh <issue-key> <state>}
NEW=${2:?usage: ./fix-workflow.sh <issue-key> <state>}
VPS=${VPS:-root@142.132.170.171}
VPS_KEY=${VPS_KEY:-$HOME/.ssh/aecplatform_deploy}

DBURL=$(ssh -i "$VPS_KEY" "$VPS" 'grep ^DATABASE_URL /opt/atlas-aec/.env.production | cut -d= -f2- | tr -d "\""')

OLD=$(ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"SELECT state FROM \\\"Issue\\\" WHERE key='$KEY'\"" | tail -1)
if [ -z "$OLD" ]; then
  echo "✗ Issue $KEY not found"
  exit 1
fi

ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"UPDATE \\\"Issue\\\" SET state='$NEW', \\\"closedAt\\\"=NULL WHERE key='$KEY' RETURNING key,state\"" | tail -1

echo "✓ $KEY: $OLD → $NEW"
