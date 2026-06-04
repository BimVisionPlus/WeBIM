#!/usr/bin/env bash
# Force the AI offline banner to clear. Restarts web (which re-runs
# /api/health probe at next page load) and verifies the response shape.
#
# Use when: AI banner stuck even though prod env has GROQ_API_KEY.
#
# Time: ~25 seconds.

set -euo pipefail
VPS=${VPS:-root@142.132.170.171}
VPS_KEY=${VPS_KEY:-$HOME/.ssh/aecplatform_deploy}
BASE=${BASE:-https://app.aecplatform.vn}

# 1) Verify env actually has the key
KEY_SET=$(ssh -i "$VPS_KEY" "$VPS" 'grep ^GROQ_API_KEY /opt/atlas-aec/.env.production | grep -v ^# | wc -l')
if [ "$KEY_SET" = "0" ]; then
  echo "✗ GROQ_API_KEY missing from /opt/atlas-aec/.env.production — banner can't clear"
  exit 1
fi

# 2) Restart container
ssh -i "$VPS_KEY" "$VPS" 'cd /opt/atlas-aec && docker compose -f docker-compose.prod.yml --env-file .env.production restart web' 2>&1 | tail -3

# 3) Wait + verify
until /usr/bin/curl -fsS -o /dev/null "$BASE/api/health" 2>/dev/null; do sleep 2; done
H=$(/usr/bin/curl -sS "$BASE/api/health" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"ollama.ok={d['soft']['ollama']['ok']}, whisper.ok={d['soft']['whisper']['ok']}\")")
echo "→ $H"

if /usr/bin/curl -sS "$BASE/api/health" | grep -q '"ollama":{"ok":true'; then
  echo "✓ AI banner will clear. Refresh demo browser (⌘⇧R)."
else
  echo "⚠ Health still reports ollama.ok=false. Check /api/ai/health for provider details."
fi
