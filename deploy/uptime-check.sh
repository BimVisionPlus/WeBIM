#!/usr/bin/env bash
# Uptime check 5 phút/lần (cron) — không có dashboard nào cứu được một
# health check không ai chạy.
#
# Ghi MỘT dòng mỗi lần fail (và một dòng RECOVERED khi hồi) vào
# /var/log/webim-uptime.log — im lặng khi mọi thứ xanh, để log là danh sách
# sự cố chứ không phải nhịp tim spam. Muốn alert chủ động (Telegram/email)
# thì thêm vào chỗ đánh dấu bên dưới khi có credential.

set -u
LOG=/var/log/webim-uptime.log
STATE_DIR=/run/webim-uptime
mkdir -p "$STATE_DIR"

check() {
  local name="$1" url="$2" expect="$3"
  local state_file="$STATE_DIR/$name.down"
  local body
  body=$(curl -sS -m 10 "$url" 2>&1)
  if echo "$body" | grep -q "$expect"; then
    if [ -f "$state_file" ]; then
      echo "$(date -u +%FT%TZ) RECOVERED $name" >> "$LOG"
      rm -f "$state_file"
    fi
  else
    if [ ! -f "$state_file" ]; then
      echo "$(date -u +%FT%TZ) DOWN $name: ${body:0:120}" >> "$LOG"
      touch "$state_file"
      # >>> chỗ gắn alert chủ động (Telegram bot / email) khi có credential <<<
    fi
  fi
}

check app-health "https://app.webim.vn/api/health" '"ok":true'
check app-spa "https://app.webim.vn" "WeBIM"
check atlas "https://atlas.webim.vn" "html"
check landing "https://webim.vn" "html"
