#!/usr/bin/env bash
# One-shot bring-up of WeBIM on a fresh Ubuntu/Debian server.
#
#   sudo bash deploy/bootstrap.sh webim.vn
#
# Installs Docker if missing, writes deploy/.env (keeping any value already
# there), then builds and starts Caddy + relay. Safe to re-run: it is the
# same path as a redeploy.
#
# It refuses to start when DNS does not yet point here. Caddy would
# otherwise sit in an ACME retry loop and the only symptom is a site that
# never comes up — better to say so in one line.

set -euo pipefail

DOMAIN="${1:-}"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$DOMAIN" ]]; then
  echo "Cách dùng: sudo bash deploy/bootstrap.sh <domain>   (vd: webim.vn)" >&2
  exit 1
fi

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# Whichever resolver the image happens to ship. A missing tool must not read
# as "domain does not resolve" — that would block a perfectly good deploy.
resolve_ip() {
  local host="$1"
  if command -v getent >/dev/null 2>&1; then
    getent hosts "$host" | awk '{print $1}' | head -1 && return 0
  fi
  if command -v dig >/dev/null 2>&1; then
    dig +short "$host" A | grep -E '^[0-9.]+$' | head -1 && return 0
  fi
  if command -v host >/dev/null 2>&1; then
    host -t A "$host" | awk '/has address/ {print $4; exit}' && return 0
  fi
  python3 -c "import socket,sys; print(socket.gethostbyname(sys.argv[1]))" "$host" 2>/dev/null
}

# ── 1. DNS ───────────────────────────────────────────────────────────────
say "Kiểm tra DNS cho $DOMAIN"
resolved="$(resolve_ip "$DOMAIN" | head -1 || true)"
public_ip="$(curl -fsS --max-time 10 https://api.ipify.org || true)"

if [[ -z "$resolved" ]]; then
  cat >&2 <<EOF
$DOMAIN chưa phân giải ra IP nào.

Trỏ bản ghi A của $DOMAIN về IP máy này (${public_ip:-<IP máy chủ>}) rồi
chạy lại. Let's Encrypt xác thực qua HTTP nên DNS phải đúng TRƯỚC khi
Caddy khởi động.
EOF
  exit 1
fi

echo "$DOMAIN → $resolved"
if [[ -n "$public_ip" && "$resolved" != "$public_ip" ]]; then
  echo "Cảnh báo: IP công khai của máy này là $public_ip, khác với DNS." >&2
  echo "Nếu đang đứng sau NAT/proxy thì bỏ qua; nếu không, sửa DNS trước." >&2
fi

# ── 2. Docker ────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  say "Cài Docker"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Thiếu plugin 'docker compose'. Cài docker-compose-plugin rồi chạy lại." >&2
  exit 1
fi

# ── 3. .env ──────────────────────────────────────────────────────────────
ENV_FILE="$DEPLOY_DIR/.env"

# `sed -i` differs between GNU and BSD, so rewrite through a temp file.
set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" \
    'BEGIN{done=0} $0 ~ "^"k"=" {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' \
    "$ENV_FILE" >"$tmp"
  mv "$tmp" "$ENV_FILE"
}

if [[ ! -f "$ENV_FILE" ]]; then
  say "Tạo deploy/.env"
  cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  # A secret generated once and left alone; regenerating it logs everyone out.
  set_env WEBIM_SECRET "$(openssl rand -hex 32)"
  echo "Đã sinh WEBIM_SECRET."
else
  echo "Giữ nguyên deploy/.env đang có."
fi
set_env WEBIM_DOMAIN "$DOMAIN"

if [[ ! -f "$DEPLOY_DIR/users.json" ]]; then
  cat >&2 <<'EOF'

Chưa có deploy/users.json — server sẽ chạy ở OPEN MODE (ai cũng ghi được).
Tạo tài khoản trước khi mở cho người khác:

    node web/relay/auth.mjs hash '<mật-khẩu>'

rồi ghép vào deploy/users.json theo web/relay/users.example.json.
EOF
fi

# ── 4. Chạy ──────────────────────────────────────────────────────────────
say "Build & khởi động"
cd "$DEPLOY_DIR"
docker compose --env-file .env up -d --build

say "Chờ chứng chỉ + health check"
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    echo
    curl -fsS "https://$DOMAIN/api/health"
    echo
    say "Xong — https://$DOMAIN"
    exit 0
  fi
  sleep 5
  printf '.'
done

cat >&2 <<EOF

Chưa gọi được https://$DOMAIN/api/health sau 150 giây.
Xem log để biết Caddy đang kẹt ở đâu:

    docker compose --env-file .env logs -f caddy relay
EOF
exit 1
