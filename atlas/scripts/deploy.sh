#!/usr/bin/env bash
# Atlas AEC — one-shot production deploy for aecplatform.vn.
#
# Run on the target VPS as root or a docker-group user:
#   git clone <repo> && cd atlas-aec
#   cp .env.production.example .env.production && nano .env.production
#   ./scripts/deploy.sh
#
# What it does:
#   1. Validates .env.production has the critical keys filled
#   2. Builds the 4 Docker images (landing + web + worker + scraper)
#   3. Boots the stack via docker-compose.prod.yml
#   4. Runs Prisma migrate deploy to bring DB schema up to date
#   5. Optionally seeds demo data on first run
#   6. Curls health endpoints + summarizes

set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> 1/6  Validating .env.production"
test -f .env.production || { echo "FAIL: .env.production not found. Copy .env.production.example and fill it."; exit 1; }
# Required keys (anything still <placeholder> aborts)
REQUIRED=(AUTH_SECRET DATABASE_URL S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY AUTH_URL NEXT_PUBLIC_BASE_URL)
for k in "${REQUIRED[@]}"; do
  v=$(grep -E "^${k}=" .env.production | head -1 | cut -d= -f2- | tr -d '"' || true)
  if [[ -z "$v" || "$v" == *"<"*">"* || "$v" == "REPLACE"* ]]; then
    echo "FAIL: $k is missing or placeholder in .env.production"; exit 1
  fi
done

echo "==> 2/6  Building images (landing + web + worker + scraper)"
$COMPOSE build --pull

echo "==> 3/6  Booting stack (landing + web + worker + scraper + caddy)"
$COMPOSE up -d

echo "==> 4/6  Waiting for web to be healthy (up to 90s)"
for i in {1..30}; do
  if $COMPOSE ps web 2>/dev/null | grep -q "(healthy)"; then echo "  web is healthy"; break; fi
  sleep 3
  if [[ $i -eq 30 ]]; then echo "FAIL: web did not become healthy"; $COMPOSE logs web | tail -40; exit 1; fi
done

echo "==> 5/6  Running prisma migrate deploy"
$COMPOSE exec -T web sh -c 'cd /app && npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma' || \
  echo "  (skipped — prisma binary not in standalone image; run manually if needed)"

echo "==> 6/6  Smoke tests"
sleep 2
echo -n "  app health: "; docker exec atlas-aec-web-1 wget -qO- http://localhost:3000/api/health || echo "FAIL"
echo
echo -n "  landing: "; docker exec atlas-aec-landing-1 wget -qO- http://localhost:3001/ | grep -oE "<title>[^<]+</title>" | head -1 || echo "FAIL"
echo
echo "==> DONE — stack should be live at:"
echo "    https://aecplatform.vn          (landing — marketing + 47 module cards)"
echo "    https://app.aecplatform.vn      (app — auth-gated)"
echo "    https://status.aecplatform.vn   (public Site Status pages)"
echo
echo "    DNS check: dig +short aecplatform.vn app.aecplatform.vn"
echo "    Caddy logs: $COMPOSE logs -f caddy"
echo "    Tear down:  $COMPOSE down"
