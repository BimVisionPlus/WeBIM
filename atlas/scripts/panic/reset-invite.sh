#!/usr/bin/env bash
# Create a fresh invite for an email — wipes any pending invites for that email
# on the demo Org (Cofico), then issues a new one. Use when:
#  - mid-demo, the previous invite was already accepted
#  - Resend says "already invited"
#  - want a clean URL to paste
#
# Usage: ./reset-invite.sh ng.th.thuyy@gmail.com [role=ENGINEER]
#
# Time: ~5 seconds

set -euo pipefail
EMAIL=${1:?usage: ./reset-invite.sh <email> [role]}
ROLE=${2:-ENGINEER}
VPS=${VPS:-root@142.132.170.171}
VPS_KEY=${VPS_KEY:-$HOME/.ssh/aecplatform_deploy}

DBURL=$(ssh -i "$VPS_KEY" "$VPS" 'grep ^DATABASE_URL /opt/atlas-aec/.env.production | cut -d= -f2- | tr -d "\""')

# Find Cofico org
ORG_ID=$(ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"SELECT id FROM \\\"Organization\\\" WHERE slug='cofico'\"" | tail -1)

# Wipe old pending
ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"DELETE FROM \\\"Invite\\\" WHERE email='$EMAIL' AND \\\"acceptedAt\\\" IS NULL\"" > /dev/null

# Issue new (login as super-admin via raw insert with crypto token)
TOKEN=$(python3 -c "import secrets;print(secrets.token_urlsafe(32))")
INVITED_BY=$(ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"SELECT id FROM \\\"User\\\" WHERE \\\"isSuperAdmin\\\"=true LIMIT 1\"" | tail -1)
if [ -z "$INVITED_BY" ]; then
  INVITED_BY=$(ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"SELECT u.id FROM \\\"User\\\" u JOIN \\\"Membership\\\" m ON m.\\\"userId\\\"=u.id WHERE m.\\\"orgId\\\"='$ORG_ID' AND m.role IN ('OWNER','ADMIN') LIMIT 1\"" | tail -1)
fi

EXP=$(python3 -c "from datetime import datetime,timedelta,timezone;print((datetime.now(timezone.utc)+timedelta(days=7)).isoformat())")

ID=$(python3 -c "import secrets;import string;print('c'+''.join(secrets.choice(string.ascii_lowercase+string.digits) for _ in range(24)))")

ssh -i "$VPS_KEY" "$VPS" "docker run --rm postgres:16-alpine psql \"$DBURL\" -tAc \"INSERT INTO \\\"Invite\\\" (id, email, role, \\\"orgId\\\", token, \\\"invitedById\\\", \\\"expiresAt\\\", \\\"createdAt\\\") VALUES ('$ID', '$EMAIL', '$ROLE', '$ORG_ID', '$TOKEN', '$INVITED_BY', '$EXP', NOW()) RETURNING id\"" > /dev/null

echo "✓ Invite issued for $EMAIL ($ROLE)"
echo "  URL: https://app.aecplatform.vn/accept-invite?token=$TOKEN"
echo "  Expires in 7 days"
