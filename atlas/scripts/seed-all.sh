#!/usr/bin/env bash
# Fill every module with demo data, in one command.
#
#   cd atlas && bash scripts/seed-all.sh
#
# The per-module seeds are individually runnable but share two traps, and
# hitting either just prints a Prisma stack:
#
#   - DATABASE_URL. The Prisma CLI reads .env; a tsx script does not, so the
#     scripts see no database unless the shell exported it first.
#   - tsx lives in packages/db, not at the root, so `npx tsx scripts/…` from
#     here cannot find it.
#
# Re-runnable: the seeds upsert or check before inserting.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Thiếu atlas/.env — copy .env.example rồi điền DATABASE_URL." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "atlas/.env không có DATABASE_URL." >&2
  exit 1
fi

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

say "Migrate"
(cd packages/db && npx prisma migrate deploy >/dev/null) || {
  echo "migrate deploy thất bại — xem lại DATABASE_URL." >&2
  exit 1
}

say "Seed gốc (tổ chức, người dùng, dự án)"
(cd packages/db && npx tsx prisma/seed.ts) || echo "  (seed gốc lỗi — có thể đã seed rồi)"

say "Seed từng module"
failed=0
for script in scripts/seed-*.ts; do
  name="$(basename "$script" .ts)"
  # Needs a projectId argument; it is not a whole-database seed.
  [[ "$name" == "seed-spec-pages" ]] && continue
  if (cd packages/db && npx tsx "../../$script" >/dev/null 2>&1); then
    printf '  \033[32m✓\033[0m %s\n' "$name"
  else
    printf '  \033[31m✗\033[0m %s\n' "$name"
    failed=$((failed + 1))
  fi
done

say "Xong"
if [[ "$failed" -gt 0 ]]; then
  echo "$failed seed lỗi. Chạy lẻ để xem log:"
  echo "  cd packages/db && npx tsx ../../scripts/<tên>.ts"
  exit 1
fi
echo "Tất cả seed chạy xong. Đăng nhập demo: anh.nguyen@cofico.vn / demo1234!"
