#!/usr/bin/env bash
# Tell me exactly why the domain is not ready yet.
#
#   bash deploy/check-dns.sh webim.vn [IP-máy-chủ]
#   bash deploy/check-dns.sh webim.vn --cname www   # bản demo trên Pages
#
# Between buying a domain and running bootstrap.sh there are three separate
# things that can be missing, and an ordinary `dig` reports all three the
# same way — as nothing at all:
#
#   1. tên miền chưa đăng ký            → registry has no delegation
#   2. zone chưa bật ở nhà cung cấp DNS → nameserver answers REFUSED
#   3. chưa thêm bản ghi A              → nameserver answers, record absent
#
# Queries the delegated nameservers directly, so a cached NXDOMAIN from
# before the domain existed cannot make a working setup look broken.

set -uo pipefail

DOMAIN="${1:-}"
EXPECT_IP=""
# The static demo lives on a CNAME (Cloudflare Pages) rather than on an A
# record of our own, so checking for an A record there reports a working
# setup as broken. Same three failure modes, different record type.
CNAME_HOST=""
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cname) CNAME_HOST="${2:-www}"; shift 2 ;;
    *)       EXPECT_IP="$1"; shift ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "Cách dùng: bash deploy/check-dns.sh <domain> [IP-máy-chủ] [--cname <host>]" >&2
  exit 1
fi

command -v dig >/dev/null 2>&1 || {
  echo "Cần dig (macOS đã có sẵn; Ubuntu: apt install dnsutils)." >&2
  exit 1
}

ok=0
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; ok=1; }
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

registry_ns() {
  local tld="${1##*.}" server
  server="$(dig +short "$tld." NS | head -1)"
  [[ -z "$server" ]] && return 1
  # +norecurse so we see the registry's own delegation, not a resolver's view.
  dig +norecurse "$1" NS @"$server" 2>/dev/null |
    awk '/[[:space:]]NS[[:space:]]/ && $1 ~ /^'"${1//./\\.}"'\.$/ {print $NF}'
}

echo
echo "Kiểm tra $DOMAIN"
echo

# ── 1. Uỷ quyền tại registry ─────────────────────────────────────────────
# `mapfile` is bash 4+; macOS still ships 3.2 and this script is meant to be
# run from a laptop while waiting for DNS, so read into a plain list.
nameservers=""
while IFS= read -r ns; do
  [[ -n "$ns" ]] && nameservers="${nameservers}${ns} "
done < <(registry_ns "$DOMAIN" | sort -u)

if [[ -z "$nameservers" ]]; then
  fail "Chưa đăng ký, hoặc chưa uỷ quyền cho nameserver nào."
  echo
  echo "  → Mua tên miền, hoặc khai nameserver ở trang quản lý của nhà đăng ký."
  exit 1
fi
pass "Đã uỷ quyền cho: $nameservers"

# ── 2. Zone đã bật trên nameserver chưa ──────────────────────────────────
authoritative=""
for ns in $nameservers; do
  status="$(dig "$DOMAIN" SOA @"$ns" 2>/dev/null | awk -F'status: ' '/status:/ {split($2,a,","); print a[1]; exit}')"
  case "$status" in
    NOERROR) authoritative="$ns"; break ;;
    REFUSED) warn "$ns trả REFUSED — chưa nạp zone $DOMAIN" ;;
    "")      warn "$ns không trả lời" ;;
    *)       warn "$ns trả $status" ;;
  esac
done

if [[ -z "$authoritative" ]]; then
  fail "Chưa nameserver nào phục vụ zone $DOMAIN."
  echo
  echo "  → Vào trang quản lý DNS của nhà đăng ký, bật/tạo zone cho $DOMAIN."
  echo "    Tên miền đã là của chị rồi; chỉ là dịch vụ DNS chưa được kích hoạt."
  exit 1
fi
pass "Zone đang chạy trên $authoritative"

# ── 3. Bản ghi A ─────────────────────────────────────────────────────────
check_a() {
  local host="$1" required="$2" ip
  ip="$(dig +short "$host" A @"$authoritative" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)"
  if [[ -z "$ip" ]]; then
    if [[ "$required" == "required" ]]; then
      fail "$host — chưa có bản ghi A"
    else
      warn "$host — chưa có bản ghi A (cần khi chạy --with-atlas)"
    fi
    return
  fi
  if [[ -n "$EXPECT_IP" && "$ip" != "$EXPECT_IP" ]]; then
    fail "$host → $ip (mong đợi $EXPECT_IP)"
  else
    pass "$host → $ip"
  fi
}

if [[ -n "$CNAME_HOST" ]]; then
  target="$(dig +short "$CNAME_HOST.$DOMAIN" CNAME @"$authoritative" 2>/dev/null | head -1)"
  if [[ -z "$target" ]]; then
    fail "$CNAME_HOST.$DOMAIN — chưa có bản ghi CNAME"
    echo
    echo "  → Thêm ở PA: Host $CNAME_HOST · Loại CNAME · Giá trị <project>.pages.dev"
  else
    pass "$CNAME_HOST.$DOMAIN → $target"
  fi
  # Apex cannot hold a CNAME (RFC 1034), so say so rather than leaving the
  # reader to discover it when someone types the domain without the www.
  apex="$(dig +short "$DOMAIN" A @"$authoritative" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)"
  [[ -z "$apex" ]] && warn "$DOMAIN trần chưa trỏ đi đâu — người gõ thiếu $CNAME_HOST sẽ thấy lỗi."
else
  check_a "$DOMAIN" required
  check_a "atlas.$DOMAIN" optional
fi

# ── 4. Đã lan ra ngoài chưa ──────────────────────────────────────────────
watched="${CNAME_HOST:+$CNAME_HOST.}$DOMAIN"
public="$(dig +short "$watched" @1.1.1.1 2>/dev/null | tail -1)"
if [[ -z "$public" ]]; then
  warn "Resolver công cộng (1.1.1.1) chưa thấy $watched — chờ TTL hết hạn rồi kiểm lại."
  warn "Bên cấp chứng chỉ cũng tra qua resolver công cộng, nên đợi bước này xong hẵng deploy."
else
  pass "1.1.1.1 thấy $watched → $public"
fi

echo
if [[ "$ok" -ne 0 || -z "$public" ]]; then
  echo "Chưa deploy được — xử lý các dòng ✗ ở trên rồi chạy lại."
elif [[ -n "$CNAME_HOST" ]]; then
  echo "Sẵn sàng: thêm $watched vào Custom domains của project Cloudflare Pages."
else
  echo "Sẵn sàng:  sudo bash deploy/bootstrap.sh $DOMAIN --with-atlas"
fi
echo
exit "$ok"
