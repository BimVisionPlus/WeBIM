# syntax=docker/dockerfile:1.7
# Multi-stage build for Atlas AEC landing (aecplatform.vn). Slim runtime (~220 MB).

FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && \
    apt-get update && apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── deps ───
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/landing/package.json apps/landing/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/lib/package.json packages/lib/
COPY packages/ui/package.json packages/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/workflows/package.json packages/workflows/
COPY packages/ai/package.json packages/ai/
RUN pnpm install --frozen-lockfile

# ─── builder ───
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/landing/node_modules ./apps/landing/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV STANDALONE_BUILD=1
# NEXT_PUBLIC_* are inlined at build time by Next.js — must be present here,
# not just at runtime. Passed via --build-arg from docker compose.
ARG NEXT_PUBLIC_INDEXABLE=true
ARG NEXT_PUBLIC_LANDING_URL=https://aecplatform.vn
ARG NEXT_PUBLIC_APP_NAME="AEC Platform"
ENV NEXT_PUBLIC_INDEXABLE=$NEXT_PUBLIC_INDEXABLE
ENV NEXT_PUBLIC_LANDING_URL=$NEXT_PUBLIC_LANDING_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm --filter @atlas/db generate
RUN pnpm --filter @atlas/landing build

# ─── runner ───
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/public ./apps/landing/public
USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME="0.0.0.0"
CMD ["node", "apps/landing/server.js"]
