#!/usr/bin/env bash
# Tell me exactly why the domain is not ready yet.
#
#   bash deploy/check-dns.sh webim.vn [IP-máy-chủ]
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
EXPECT_IP="${2:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Cách dùng: bash deploy/check-dns.sh <domain> [IP-máy-chủ]" >&2
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

check_a "$DOMAIN" required
check_a "atlas.$DOMAIN" optional

# ── 4. Đã lan ra ngoài chưa ──────────────────────────────────────────────
public="$(dig +short "$DOMAIN" A @1.1.1.1 2>/dev/null | grep -E '^[0-9.]+$' | head -1)"
if [[ -z "$public" ]]; then
  warn "Resolver công cộng (1.1.1.1) chưa thấy — chờ TTL hết hạn rồi kiểm lại."
  warn "Let's Encrypt tra qua resolver công cộng, nên đợi bước này xong hẵng deploy."
else
  pass "1.1.1.1 thấy $DOMAIN → $public"
fi

echo
if [[ "$ok" -eq 0 && -n "$public" ]]; then
  echo "Sẵn sàng:  sudo bash deploy/bootstrap.sh $DOMAIN --with-atlas"
else
  echo "Chưa deploy được — xử lý các dòng ✗ ở trên rồi chạy lại."
fi
echo
exit "$ok"
