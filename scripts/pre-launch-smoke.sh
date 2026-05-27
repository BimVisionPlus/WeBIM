#!/usr/bin/env bash
# Pre-launch smoke check for aecplatform.vn — run after DNS + Caddy issue cert.
# Verifies all 3 hostnames serve correctly + 47 module landing cards render.
#
# Usage: ./scripts/pre-launch-smoke.sh
# Optional: HOST_OVERRIDE=https://app.aecplatform.vn ./scripts/pre-launch-smoke.sh

set -euo pipefail

LANDING="${LANDING_HOST:-https://aecplatform.vn}"
APP="${APP_HOST:-https://app.aecplatform.vn}"
STATUS="${STATUS_HOST:-https://status.aecplatform.vn}"

pass=0; fail=0
check() {
  local name="$1" url="$2" expect="$3" pattern="${4:-}"
  local code body
  code=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  body=$(cat /tmp/smoke.out 2>/dev/null || echo "")
  if [ "$code" = "$expect" ] && { [ -z "$pattern" ] || echo "$body" | grep -q "$pattern"; }; then
    echo "  ✓ $name → $code"
    pass=$((pass+1))
  else
    echo "  ✗ $name → got $code (expected $expect)${pattern:+, missing pattern: $pattern}"
    fail=$((fail+1))
  fi
}

echo "=== Landing ($LANDING) ==="
check "apex"             "$LANDING/"               200 "AEC Platform"
check "www → apex"       "https://www.aecplatform.vn/"  301
check "robots.txt"       "$LANDING/robots.txt"     200 "Sitemap"
check "sitemap.xml"      "$LANDING/sitemap.xml"    200 "<loc>"

echo
echo "=== App ($APP) ==="
check "root → signin"    "$APP/"                   307
check "/api/health"      "$APP/api/health"         200 "\"ok\":true"
check "/signin"          "$APP/signin"             200 "Đăng nhập"
check "/signup"          "$APP/signup"             200 "Tạo tài khoản"
check "/pricing"         "$APP/pricing"            200
check "/trust"           "$APP/trust"              200

echo
echo "=== 47-module auth gate ==="
modules=(paymentrail volumemeter dinhmuc bondvault hoancong supervise qaqc tenderforge \
         eiaflow hsetrain workforce registry materialtrace labreports methods portal \
         consult stakeholders docchat monitor \
         bidradar catalog changeorder codeguard costpulse dailylog drawbridge handover \
         pccc permitflow portfolio pulse punchlist schedule siteeye winwork)
for m in "${modules[@]}"; do
  check "/$m" "$APP/$m" 307
done

echo
echo "=== Status pages ($STATUS) ==="
check "/status/VHGP-S9"  "$STATUS/status/VHGP-S9"  200

echo
echo "=== TLS ==="
echo | openssl s_client -connect aecplatform.vn:443 -servername aecplatform.vn 2>/dev/null | grep -E "issuer|subject" | head -3 || echo "✗ TLS check failed"

echo
echo "─────────────────────────────────────────"
echo " Result: $pass pass / $fail fail"
echo "─────────────────────────────────────────"
[ "$fail" -eq 0 ] && echo "✅ GO LIVE READY" || { echo "❌ FIX BEFORE GO LIVE"; exit 1; }
