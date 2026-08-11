#!/usr/bin/env bash
# One-shot bring-up of WeBIM on a fresh Ubuntu/Debian server.
#
#   sudo bash deploy/bootstrap.sh webim.vn
#   sudo bash deploy/bootstrap.sh webim.vn --with-atlas
#
# Installs Docker if missing, writes deploy/.env (keeping any value already
# there), then builds and starts Caddy + relay. Safe to re-run: it is the
# same path as a redeploy.
#
# --with-atlas also brings up the Atlas project (atlas/ + atlas-override.yml)
# behind the same Caddy on $ATLAS_DOMAIN.
#
# It refuses to start when DNS does not yet point here. Caddy would
# otherwise sit in an ACME retry loop and the only symptom is a site that
# never comes up — better to say so in one line.

set -euo pipefail

DOMAIN="${1:-}"
WITH_ATLAS=0
for arg in "${@:2}"; do
  case "$arg" in
    --with-atlas) WITH_ATLAS=1 ;;
    *) echo "Tham số lạ: $arg" >&2; exit 1 ;;
  esac
done

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

if [[ -z "$DOMAIN" ]]; then
  echo "Cách dùng: sudo bash deploy/bootstrap.sh <domain> [--with-atlas]" >&2
  echo "  vd: sudo bash deploy/bootstrap.sh webim.vn --with-atlas" >&2
  exit 1
fi
ATLAS_DOMAIN="${ATLAS_DOMAIN:-atlas.$DOMAIN}"

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

# Caddy asks for every hostname in the Caddyfile, so an unresolved Atlas
# name stalls the whole certificate step, not just its own vhost.
atlas_resolved="$(resolve_ip "$ATLAS_DOMAIN" | head -1 || true)"
if [[ -z "$atlas_resolved" ]]; then
  if [[ "$WITH_ATLAS" == "1" ]]; then
    echo "$ATLAS_DOMAIN chưa phân giải — trỏ A record về ${public_ip:-IP máy này} rồi chạy lại." >&2
    exit 1
  fi
  echo "Lưu ý: $ATLAS_DOMAIN chưa phân giải, Caddy sẽ xin chứng chỉ cho nó không xong." >&2
  echo "Trỏ A record về máy này, hoặc bỏ dòng ATLAS_DOMAIN trong deploy/.env." >&2
else
  echo "$ATLAS_DOMAIN → $atlas_resolved"
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

set_env ATLAS_DOMAIN "$ATLAS_DOMAIN"

# ── 4. Swap ──────────────────────────────────────────────────────────────
# Next.js builds Atlas from source and peaks around 4 GB. On an 8 GB box
# with no swap that is an OOM kill two minutes into `up --build`, reported
# as an unexplained "exit code 137".
ram_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 99999)"
swap_mb="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
if [[ "$WITH_ATLAS" == "1" && "$ram_mb" -lt 12000 && "$swap_mb" -lt 2000 ]]; then
  say "Cấp 4 GB swap (RAM ${ram_mb} MB — build Next dễ bị OOM)"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# ── 5. Chạy ──────────────────────────────────────────────────────────────
say "Mạng chung cho Caddy ↔ Atlas"
docker network create webim_edge >/dev/null 2>&1 || echo "webim_edge đã có."

say "Build & khởi động WeBIM"
cd "$DEPLOY_DIR"
docker compose --env-file .env up -d --build

if [[ "$WITH_ATLAS" == "1" ]]; then
  ATLAS_ENV="$REPO_DIR/atlas/.env.production"
  if [[ ! -f "$ATLAS_ENV" ]]; then
    say "Tạo atlas/.env.production"
    cp "$REPO_DIR/atlas/.env.production.example" "$ATLAS_ENV"
    chmod 600 "$ATLAS_ENV"
    pg_pass="$(openssl rand -hex 16)"
    redis_pass="$(openssl rand -hex 16)"
    minio_pass="$(openssl rand -base64 24 | tr -d '\n')"
    ENV_FILE="$ATLAS_ENV"
    set_env POSTGRES_USER atlas
    set_env POSTGRES_DB atlas_aec
    set_env POSTGRES_PASSWORD "$pg_pass"
    set_env REDIS_PASSWORD "$redis_pass"
    set_env DATABASE_URL "postgresql://atlas:$pg_pass@postgres:5432/atlas_aec?schema=public"
    set_env REDIS_URL "redis://default:$redis_pass@redis:6379"
    set_env MINIO_ROOT_USER atlas
    set_env MINIO_ROOT_PASSWORD "$minio_pass"
    set_env S3_ACCESS_KEY atlas
    set_env S3_SECRET_KEY "$minio_pass"
    set_env S3_ENDPOINT "http://minio:9000"
    set_env AUTH_SECRET "$(openssl rand -base64 32 | tr -d '\n')"
    set_env AUTH_URL "https://$ATLAS_DOMAIN"
    set_env NEXT_PUBLIC_BASE_URL "https://$ATLAS_DOMAIN"
    set_env AUTH_TRUST_HOST true
    set_env WINWORK_SCRAPE_SECRET "$(openssl rand -base64 32 | tr -d '\n')"
    # Without this the browser cannot call /api/webim/* from WeBIM Web.
    set_env WEBIM_ALLOWED_ORIGINS "https://$DOMAIN"
    ENV_FILE="$DEPLOY_DIR/.env"
    echo "Đã sinh mật khẩu Postgres/Redis/MinIO + AUTH_SECRET."
  else
    echo "Giữ nguyên atlas/.env.production đang có."
  fi

  say "Build & khởi động Atlas (lần đầu ~10–20 phút)"
  docker compose -p atlas \
    -f "$REPO_DIR/atlas/docker-compose.prod.yml" \
    -f "$DEPLOY_DIR/atlas-override.yml" \
    --env-file "$ATLAS_ENV" up -d --build

  pg_url="postgresql://atlas:$(grep '^POSTGRES_PASSWORD=' "$ATLAS_ENV" | cut -d= -f2-)@127.0.0.1:55432/atlas_aec?schema=public"
  cat <<EOF

Atlas đã chạy, nhưng schema thì chưa. Chạy migration một lần từ repo trên
máy này (cần node 20 + pnpm; Postgres đã mở ở 127.0.0.1:55432):

    cd $REPO_DIR/atlas
    export DATABASE_URL='$pg_url'
    pnpm install
    pnpm --filter @atlas/db exec prisma migrate deploy

Rồi phát hành API key cho cầu nối WeBIM → Atlas:

    pnpm exec tsx scripts/webim-issue-key.ts --user <email>

Dán key đó vào WeBIM Web → tab Atlas.

EOF
fi

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
