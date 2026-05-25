# syntax=docker/dockerfile:1.7
# Atlas AEC — cron worker.
# Lightweight (no Next.js); runs scheduled jobs against the prod DB.

FROM node:20-bookworm-slim AS base
# Debian slim has ca-certificates + openssl preinstalled. Add wget for healthchecks.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && \
    apt-get update && apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── deps ───
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/lib/package.json packages/lib/
RUN pnpm install --frozen-lockfile

# ─── builder ───
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm --filter @atlas/db generate

# ─── runner ───
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/packages ./packages
COPY --from=builder --chown=worker:nodejs /app/apps/worker ./apps/worker
USER worker
CMD ["node", "--import=tsx/esm", "apps/worker/src/index.ts"]
