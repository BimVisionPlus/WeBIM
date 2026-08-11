# syntax=docker/dockerfile:1.7
# Multi-stage build for Atlas AEC web app.
# Self-host friendly: produces a slim runtime image (~250 MB).

FROM node:20-bookworm-slim AS base
# Debian slim has ca-certificates + openssl preinstalled. apt minimal extras:
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && \
    apt-get update && apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── deps ───
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/lib/package.json packages/lib/
COPY packages/ui/package.json packages/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/workflows/package.json packages/workflows/
# `@atlas/ai` is pulled transitively by apps/web. Without its package.json
# in this stage, pnpm install doesn't register the workspace symlink, so
# the builder stage fails with "Cannot find module '@atlas/lib'" the first
# time @atlas/ai's source files (which import @atlas/lib) are type-checked.
COPY packages/ai/package.json packages/ai/
RUN pnpm install --frozen-lockfile

# ─── builder ───
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV STANDALONE_BUILD=1
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm --filter @atlas/db generate
RUN pnpm --filter @atlas/web build

# ─── runner ───
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
