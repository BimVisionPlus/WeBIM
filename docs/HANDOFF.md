# Atlas AEC — handoff: what you need to do next

> Status as of 2026-05-19 — every gate green:
> typecheck 10/10 · lint clean · vitest 10/10 · smoke-flow 27/27 · production build 62 routes · seed restorable.

---

## What's now done in the repo (no action needed from you)

| # | Item | How to verify |
|---|---|---|
| P0-1 | `.env.production.example` written, secrets rotation documented | `cat .env.production.example` |
| P0-2 | Prisma migrations baselined (`migrations/20260519000000_init/`) | `ls packages/db/prisma/migrations` |
| P0-3 | CI runs lint + smoke + seed in addition to typecheck + build | `.github/workflows/ci.yml` |
| P0-6 | Subscription enforcement (`checkFeature`, `chargeAiAction`) + `/settings/billing` UI + AI cost telemetry | `apps/web/app/settings/billing/page.tsx` · `packages/lib/src/billing/` |
| P0-7 | Email lib has Resend → SMTP → log fallback (already shipped) | `packages/lib/src/email.ts` |
| P0-8 | Email verification on signup: token issued, `/verify-email` route, `/api/auth/verify-email` consumer | `apps/web/app/api/auth/verify-email/route.ts` |
| P0-9 | Rate limit on **all 38 mutation routes** (codemod-applied) | `grep -l rateLimitGuard apps/web/app/api/**/route.ts` |
| P1-10 | UI primitives: `<EmptyState />` · `<TableSkeleton />` · `<FormErrorList />` | `packages/ui/src/states.tsx` |
| P1-11 | Sentry scaffold (loads only when `SENTRY_DSN` set; pino fallback) | `packages/lib/src/observability.ts` |
| P1-12 | Deep health check: Postgres + Redis + S3/MinIO + Ollama + Whisper | `apps/web/app/api/health/route.ts` |
| P1-13 | Org switcher dropdown in the home header | `apps/web/components/org-switcher.tsx` |
| P1-14 | Restore-drill script (boots throwaway Postgres, restores dump, row counts) | `scripts/restore-drill.sh` |
| P1-15 | Public "Site Status" page at `/status/<projectKey>` | `apps/web/app/status/[projectKey]/page.tsx` |
| P1-16 | TODOs triaged — 5 remaining, all tracked in SHIP-CHECKLIST (scraper stubs + spec-RAG context) | `grep -rn TODO packages/ apps/web/` |
| P1-17 | AI offline banner polls `/api/health` and surfaces degraded state in project layout | `apps/web/components/ai-offline-banner.tsx` |
| P1-18 | Cron worker app (`apps/worker`) with 3 jobs: scrape-tenders · bond-expiry · drift-snapshot | `apps/worker/src/index.ts` |
| P1-19 | Friendly error envelope via shared `apiHandler({}, ...)` helper + Vietnamese field messages | `packages/lib/src/api.ts` |
| Extra | `withRateLimit` codemod is idempotent and re-runnable | `scripts/apply-ratelimit.ts` |
| Extra | Seed.ts now persists 8 BIM elements + 9-line BoQ + 4 incidents + 7 vision events + 4 drift snapshots + 5 extra tenders + 4 extra bids + 24 AI cost events | `pnpm db:seed` |
| Extra | Smoke flow extended to 27 assertions across every Layer 1 module | `scripts/smoke-flow.ts` |
| Extra | Demo deck + slideshow + capture script + DEMO.md | `docs/Atlas-AEC-Demo.pptx`, `docs/demo.html` |

---

## What only you can do — required for production

### 🔴 Hard pre-flight (cannot ship without)

#### 1. Rotate every secret
```bash
# Generate strong values
openssl rand -base64 32   # AUTH_SECRET · WINWORK_SCRAPE_SECRET · S3_SECRET_KEY
openssl rand -hex 16      # POSTGRES_PASSWORD · REDIS_PASSWORD
```
Then put the values into your deployment env (Vault / Doppler / 1Password / Render / Vercel env). **Do not commit `.env`.** `.env.production.example` is the template.

#### 2. Register an Autodesk APS app
1. Go to <https://aps.autodesk.com/>, sign up (free), create a 2-legged app
2. Copy `APS_CLIENT_ID` + `APS_CLIENT_SECRET` into your prod env
3. Cost: ~100 cloud credits/month free; ~$0.10 per drawing translation after that
4. Without this, BIM uploads succeed but stay in `PENDING` state — DrawBridge viewer doesn't render `.rvt`/`.ifc`

#### 3. Wire transactional email
**Resend (recommended)** — sign up at <https://resend.com>, verify your domain, then:
```env
EMAIL_FROM="Atlas AEC <no-reply@your-domain.vn>"
SMTP_HOST="smtp.resend.com"
SMTP_PORT="465"
SMTP_USER="resend"
SMTP_PASS="<your-resend-api-key>"
```
Without this: password reset, invite, signup verification, NPS survey all silently no-op.

#### 4. Pick a payment provider
The billing layer is built — `/settings/billing` reads plans, `chargeAiAction()` decrements credit, `/pricing` shows the 4 tiers. What's missing is the actual checkout flow.

For Vietnam SME pilot:
- **Bank transfer** — already in `/settings/billing` UI (zero integration needed; finance reconciles manually). Good for the first 10 pilots.
- **VNPAY** — register at <https://vnpay.vn>, get `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET`, implement the redirect flow.
- **MoMo Merchant** — register at <https://business.momo.vn>.
- **Stripe** — easier integration but only for FDI customers.

#### 5. Tender scrapers (Layer 1.1 P0)
The scraper stubs in `packages/lib/src/winwork/scrapers.ts` return `[]`. Building real scrapers is a 1-week-per-source job:
- Best architecture: **Python sidecar** (Playwright + BeautifulSoup) that POSTs to `/api/winwork/tenders` using the `WINWORK_SCRAPE_SECRET` you set in step 1
- Targets: muasamcong.mpi.gov.vn (priority 1, has captcha), dauthau.asia (priority 2, JSON-ish API), báo đấu thầu PDFs (priority 3)
- Until this is done: WinWork ships as "manual entry only"

#### 6. SMTP for the verification email + decide what to do with existing unverified users
The verification flow is wired — every new signup gets a token in `VerificationToken` and an email is queued. Existing users have `emailVerified = null` because they predate the flow.

**Decision required:** grandfather them (one-time SQL update) or send them a verification email? Both options are 1 SQL statement; pick one before flipping signup to public.

```sql
-- Grandfather everyone created before the verify-email release
UPDATE "User" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL AND "createdAt" < '2026-05-19';
```

---

### 🟠 Strongly recommended before paying pilot

#### 7. Sentry DSN
Sign up at <https://sentry.io> (free tier covers a small pilot), grab the DSN, set `SENTRY_DSN` in prod env. The scaffold is wired — Sentry initializes automatically on first error.

#### 8. UptimeRobot / BetterUptime
Point at `https://your-domain.vn/api/health`. The deep health check now reports per-dependency, so the monitor can tell you "Postgres up, Ollama down" rather than just "site down."

#### 9. Domain + TLS
`AUTH_URL` and `NEXT_PUBLIC_BASE_URL` need a real domain. The middleware already enforces HTTPS in production. Use Vercel/Render/Caddy/Nginx for TLS termination.

#### 10. Run the restore drill
The script is at `scripts/restore-drill.sh`. Take a production dump, run it through, verify row counts match expectations. Schedule weekly via cron in CI.

```bash
./scripts/restore-drill.sh path/to/latest-backup.sql.gz
```

#### 11. Cron worker deployment
The worker process at `apps/worker` runs the scheduled jobs (scrape-tenders, bond-expiry, drift-snapshot). Deploy it as a sibling container:

```yaml
# docker-compose.prod.yml addition
worker:
  build:
    context: .
    target: worker
  command: pnpm --filter @atlas/worker start
  depends_on: [postgres, redis]
  env_file: .env.production
  restart: unless-stopped
```

---

### 🟡 Long-tail (post-PMF, do when you sign customer #2-3)

12. **Mobile native app** — schema (`DevicePushToken`, `OfflineSyncOp`) is ready; iOS/Android client is its own project.
13. **Zalo OA real wiring** — register OA at <https://oa.zalo.me>, set `ZALO_OA_TOKEN`, implement webhook receiver.
14. **E-invoice CQT integration** — VNPT / Misa / Viettel-Invoice provider account + signing cert.
15. **Chữ ký số (VNPT-CA / Viettel-CA)** — buy a CA certificate, integrate signing service.
16. **MISA / Base / BIM 360 OAuth connectors** — register apps with each, wire OAuth.
17. **SOC 2 Type I → Type II** — only needed when an enterprise (DNNN, FDI) asks.
18. **WCAG 2.1 AA audit** — outsource to an a11y consultant.
19. **CDN** — Cloudflare in front of `/static/*` and `/demo-screens/*`.

---

## How to deploy step-by-step

```bash
# 1. Provision: managed Postgres, Redis, S3 bucket(s), domain, TLS
# 2. Copy template
cp .env.production.example .env  # then fill in REAL values, NOT placeholders

# 3. Build the image
docker build -f apps/web/Dockerfile -t atlas-aec/web:v1 .

# 4. Apply migrations to prod DB
DATABASE_URL=$PROD_DATABASE_URL pnpm --filter @atlas/db exec prisma migrate deploy

# 5. Boot
docker run -d --env-file .env --name atlas-web -p 80:3000 atlas-aec/web:v1
docker run -d --env-file .env --name atlas-worker atlas-aec/worker:v1  # cron worker

# 6. Smoke test against prod
BASE=https://your-domain.vn pnpm exec tsx scripts/smoke-flow.ts
# Expect: 27/27 ✓
```

---

## Quick reference

```
# Verify everything works locally
pnpm typecheck                                    # 10/10
pnpm lint                                         # 2/2
pnpm test                                         # 10/10
pnpm --filter @atlas/web build                     # 62 routes
BASE=http://localhost:3170 pnpm exec tsx scripts/smoke-flow.ts   # 27/27

# Re-seed (idempotent — wipes + reloads everything)
pnpm db:seed

# Capture fresh demo screenshots
BASE=http://localhost:3170 packages/db/node_modules/.bin/tsx scripts/capture-demo.ts
node scripts/build-pptx.js

# Restore drill (verify a backup is restorable)
./scripts/restore-drill.sh path/to/backup.sql.gz
```

**Demo credentials:** `anh.nguyen@cofico.vn` / `demo1234!`
