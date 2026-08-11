#!/usr/bin/env bash
# Generate strong values for every secret Atlas AEC needs in production.
#
# Output is a ready-to-copy block of KEY=value lines you paste into your
# secret store (Vault / Doppler / 1Password / Render env / Vercel env).
#
# Usage:
#   ./scripts/rotate-secrets.sh                 # print to stdout
#   ./scripts/rotate-secrets.sh > prod.secrets  # save to a file (then move to your secret store + delete)
#
# Re-runnable. Generates a fresh value for every secret each time — so only
# run it during a planned rotation window.
set -euo pipefail

rand_b64() { openssl rand -base64 32 | tr -d '\n'; }
rand_hex() { openssl rand -hex 16 | tr -d '\n'; }

cat <<EOF
# ─── Atlas AEC production secrets — generated $(date -u +%Y-%m-%dT%H:%M:%SZ) ───

# Auth + session
AUTH_SECRET="$(rand_b64)"

# Database (replace user/host/db with your managed Postgres details)
POSTGRES_PASSWORD="$(rand_hex)"
DATABASE_URL="postgresql://atlas_prod:\${POSTGRES_PASSWORD}@db.your-host:5432/atlas_aec?schema=public&sslmode=require"

# Redis (replace with your managed Redis password + host)
REDIS_PASSWORD="$(rand_hex)"
REDIS_URL="rediss://default:\${REDIS_PASSWORD}@redis.your-host:6380"

# S3 / MinIO (rotate AWS IAM access key in the IAM console, paste here)
S3_ACCESS_KEY="<paste from AWS IAM console>"
S3_SECRET_KEY="<paste from AWS IAM console>"

# Tender scraper trigger
WINWORK_SCRAPE_SECRET="$(rand_b64)"

# Email (paste your provider API key — Resend recommended)
SMTP_PASS="<paste Resend API key>"

# Observability
SENTRY_DSN="<paste from Sentry project settings>"

# ───────────────────────────────────────────────────────────────────────
# After pasting these into your secret store:
#   1. Delete any file you wrote this to (shred / rm -P)
#   2. Verify the deployment picks them up (curl https://your-domain/api/health)
#   3. Roll any deployment that was using the previous values
#   4. If a value was leaked, mark the rotation in your incident log
EOF
