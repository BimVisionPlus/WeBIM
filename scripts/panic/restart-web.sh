#!/usr/bin/env bash
# Hot-restart the web container on prod. No rebuild.
# Use when: 500 errors, cache stuck, AI banner stuck, anything weird.
# Time: 15-25 seconds.

set -euo pipefail

VPS=${VPS:-root@142.132.170.171}
VPS_KEY=${VPS_KEY:-$HOME/.ssh/aecplatform_deploy}
BASE=${BASE:-https://app.aecplatform.vn}

echo "→ Restarting web container on $VPS"
ssh -i "$VPS_KEY" "$VPS" 'cd /opt/atlas-aec && docker compose -f docker-compose.prod.yml --env-file .env.production restart web' 2>&1 | tail -3

echo "→ Waiting for healthy response from $BASE..."
until /usr/bin/curl -fsS -o /dev/null "$BASE/api/health" 2>/dev/null; do
  printf "."
  sleep 2
done
echo " UP"

# Quick smoke
H=$(/usr/bin/curl -sS "$BASE/api/health" | python3 -c "import sys,json;d=json.load(sys.stdin);print('hard.postgres', d['hard']['postgres']['ok'], '| soft.ollama', d['soft']['ollama']['ok'], '| soft.whisper', d['soft']['whisper']['ok'])")
echo "→ Health: $H"
echo "✓ Web restored. Refresh browser (⌘⇧R) to clear any client cache."
