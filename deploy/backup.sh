#!/usr/bin/env bash
# Backup hằng ngày cho production WeBIM — chạy bằng cron trên server.
#
# Sao những thứ KHÔNG dựng lại được từ git:
#   1. Volume relay: users (memberships), data (file CDE, project snapshots)
#   2. users.json + .env của deploy (secret, cấu hình)
#   3. Postgres của Atlas (pg_dump)
#
# Giữ 14 bản gần nhất. Backup nằm cùng máy là backup nửa vời — nhưng hơn
# không có gì; đưa rsync sang máy thứ hai là việc của GĐ3 (C6 trong
# docs/KIEN-TRUC.md).

set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
DEST="/root/backups/$STAMP"
mkdir -p "$DEST"

# 1. Volume relay — đọc qua container tạm để không phụ thuộc đường dẫn volume.
for volume in deploy_relay_users deploy_relay_data; do
  docker run --rm -v "$volume":/src:ro -v "$DEST":/dest alpine \
    tar czf "/dest/$volume.tar.gz" -C /src .
done

# 2. File cấu hình server-only (thứ mà rsync deploy cố tình exclude).
cp /opt/webim/deploy/users.json "$DEST/users.json"
cp /opt/webim/deploy/.env "$DEST/deploy.env"
cp /opt/webim/atlas/.env.production "$DEST/atlas.env.production" 2>/dev/null || true

# 3. Postgres Atlas.
docker exec atlas-postgres-1 pg_dump -U atlas atlas_aec | gzip > "$DEST/atlas_aec.sql.gz"

# Giữ 14 bản mới nhất.
ls -1d /root/backups/*/ 2>/dev/null | sort | head -n -14 | xargs -r rm -rf

echo "backup ok: $DEST ($(du -sh "$DEST" | cut -f1))"
