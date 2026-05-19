# Atlas AEC — your step-by-step runbook to first paying customer

> Status: every piece of code is in place. The 11 items below are the ones only **you** can do because they involve external accounts, real money, real domain names, or real decisions.

Estimated total time: **6–8 hours** of focused work over **3–5 calendar days** (because some signups have manual verification windows).

---

## ☑️ Hard pre-flight — must complete before going live

### Step 1 · Rotate every secret · 15 min

```bash
# I built you a helper. Run it once during a planned rotation window:
./scripts/rotate-secrets.sh > /tmp/atlas-prod-secrets.txt
```

You'll get a block like:

```
AUTH_SECRET="agDc0xNY8KijUr1nG+I3rOYJCyC5xbra9bMFHn5400M="
POSTGRES_PASSWORD="c6ba5dbb6c8d60402660a4901c5fa0be"
WINWORK_SCRAPE_SECRET="++dQG6m+Y5B/HaTZ2miasntvRQwAD5F2VN0nuN7ZRU8="
…
```

**What you do:**
1. Open your secret store (pick one: **Vault**, **Doppler**, **1Password Secrets Automation**, **Render env**, **Vercel env**, or AWS Parameter Store)
2. Paste each line as a separate secret. Replace the `<paste …>` placeholders with values you'll get from steps 2, 3 and 7 below
3. `shred -u /tmp/atlas-prod-secrets.txt` (or `rm -P` on macOS) so the local file is gone
4. Confirm nothing got committed: `git status` should show no `.env*` files

> ⚠️ Do not put real values in `.env.example` or `.env.production.example` — those are templates.

---

### Step 2 · Register an Autodesk APS app · 10 min

DrawBridge can't translate `.rvt`/`.ifc` uploads without this.

1. Go to <https://aps.autodesk.com/>, click **Sign In**, create an Autodesk ID if needed
2. Click **My apps** → **Create app**
3. Pick **APIs**: `Data Management API` + `Model Derivative API` (both free tier)
4. App type: **Server-to-server**
5. Name it `Atlas AEC — Prod`
6. Save → copy the **Client ID** + **Client Secret**
7. Add to your secret store:
   ```
   APS_CLIENT_ID="<paste>"
   APS_CLIENT_SECRET="<paste>"
   APS_BUCKET_KEY="atlas-aec-prod-models"
   ```
8. Verify after deploy: upload a small `.ifc` and watch `apsTranslationStatus` go `PENDING → INPROGRESS → SUCCESS`

> 💰 Cost: first 100 cloud credits/month free, ~$0.10 per drawing thereafter. A 50-seat firm using BIM weekly hits ~$15/month.

---

### Step 3 · Wire transactional email · 20 min

You can't ship without password reset, invite, or signup verification working.

**A. Sign up for Resend** (recommended — easiest):
1. <https://resend.com> → **Sign up**
2. **Domains** → **Add Domain** → enter `atlas-aec.vn` (or your domain)
3. Resend gives you 3 DNS records to add at your DNS provider (Cloudflare, Route53, etc.):
   - `MX` for `send.your-domain.vn`
   - `TXT` SPF (`v=spf1 include:amazonses.com ~all`)
   - `TXT` DKIM (one record per key)
4. Wait 5-30 min for verification (Resend shows green when ready)
5. **API Keys** → **Create API Key** → name it `atlas-aec-prod` → copy
6. Add to secret store:
   ```
   EMAIL_FROM="Atlas AEC <no-reply@your-domain.vn>"
   SMTP_HOST="smtp.resend.com"
   SMTP_PORT="465"
   SMTP_USER="resend"
   SMTP_PASS="<paste API key>"
   RESEND_API_KEY="<same paste, optional alt path>"
   ```

**B. Verify the pipeline works** (after deploy):
```bash
TO=you@your-domain.vn pnpm exec tsx scripts/test-email.ts
# Expect: { "ok": true, "transport": "resend" } and an email in your inbox
```

If `transport: "log"` shows up instead, the env vars aren't reaching the deploy.

---

### Step 4 · Pick a payment provider · choose one path

**Path A — Bank transfer (works today, zero integration)**
The flow is already built. Customers click "Gửi yêu cầu nâng cấp" on `/settings/billing` → it calls `POST /api/billing/upgrade-request` → billing team gets an email with the org / plan / contact → you reply with a VAT invoice (TT 78/2021) and activate the plan via Prisma:

```ts
// In a one-off admin script after the transfer lands:
await prisma.subscription.upsert({
  where: { orgId: "<theirOrgId>" },
  update: { planId: PRO_PLAN_ID, status: "ACTIVE", aiCreditVnd: BigInt(1_000_000) },
  create: { orgId: "<theirOrgId>", planId: PRO_PLAN_ID, status: "ACTIVE", aiCreditVnd: BigInt(1_000_000) },
});
```

Set `BILLING_INBOX=billing@your-domain.vn` in env so requests land in the right inbox.

**This is fine for the first 10 paying customers.** Self-serve checkout can wait.

**Path B — VNPAY (when you outgrow manual)**
1. Register a merchant at <https://vnpay.vn> (requires VN business license)
2. Get `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`
3. Build a redirect-style checkout (~2 days of work): VNPAY → `/api/billing/vnpay/return` → activate subscription

I left the schema columns and pricing logic ready; the redirect handler is the only missing piece.

**Path C — MoMo Merchant** — similar effort to VNPAY, register at <https://business.momo.vn>.

**Path D — Stripe** — only useful for FDI customers paying in USD. Same shape as VNPAY.

---

### Step 5 · Build the tender scraper · 30 min to deploy (already coded)

I built a Python sidecar that:
- Scrapes muasamcong.mpi.gov.vn (Playwright + Chromium headless)
- Scrapes dauthau.asia (public JSON API + HTML fallback)
- POSTs every fresh tender to `/api/winwork/tenders` using `x-scrape-secret`
- Runs on a 24h loop, de-duped server-side

**What you do:**

1. Check the code in `services/scraper-py/`:
   ```
   services/scraper-py/
   ├── Dockerfile
   ├── requirements.txt
   └── src/
       ├── run.py                  ← entry point
       ├── scrape_muasamcong.py    ← Playwright DOM parse
       └── scrape_dauthau_asia.py  ← JSON API
   ```

2. Local smoke test (before deploying):
   ```bash
   cd services/scraper-py
   pip install -r requirements.txt
   playwright install chromium
   ATLAS_BASE_URL=http://localhost:3170 WINWORK_SCRAPE_SECRET="$(grep WINWORK_SCRAPE_SECRET ../../.env | cut -d= -f2- | tr -d '"')" python src/run.py
   ```

3. Deploy alongside web + worker — already wired in `docker-compose.prod.yml`:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

4. Watch it: `docker logs -f atlas-aec-scraper-1`

**Expected first-day numbers:** 10–30 fresh opportunities/day across both sources. Bump `SCRAPE_PAGE_LIMIT=5` env to widen.

> ⚠️ Selector fragility: muasamcong.mpi.gov.vn's HTML changes occasionally. If counts drop to zero, check the cell-heuristic regexes in `scrape_muasamcong.py`. I made them defensive but not bulletproof.

---

### Step 6 · Grandfather or re-verify existing users · 5 min

The verification flow is wired for new signups. Existing users have `emailVerified = null`.

**Decision:** do you make them re-verify, or grandfather them?

**Option A — Grandfather (cleaner UX, less email volume):**
```bash
# Dry-run first — shows count
docker exec -i atlas-aec-postgres psql -U atlas -d atlas_aec < scripts/grandfather-verify.sql

# Then edit scripts/grandfather-verify.sql, uncomment the UPDATE block, re-run
```

**Option B — Email everyone (safer if you have any spammy signups):**
```bash
# Dry-run
pnpm exec tsx scripts/send-verify-all.ts

# Send for real
APPLY=1 pnpm exec tsx scripts/send-verify-all.ts
```

Pick A unless you suspect signup abuse — A is what most products do at this stage.

---

## ⚠️ Strongly recommended (do same week as launch)

### Step 7 · Sentry DSN · 5 min

1. <https://sentry.io/signup/> — free tier covers small pilots
2. **Create project** → platform **Node.js**, name `atlas-aec-prod`
3. Copy the DSN (`https://abc@sentry.io/12345`)
4. Add to secret store:
   ```
   SENTRY_DSN="<paste>"
   SENTRY_ENVIRONMENT="production"
   SENTRY_TRACES_SAMPLE_RATE="0.1"
   ```
5. Install the SDK (one-time):
   ```bash
   pnpm --filter @atlas/lib add @sentry/node
   ```
6. Verify after deploy:
   ```bash
   SENTRY_DSN=$YOUR_DSN pnpm exec tsx scripts/test-sentry.ts
   # Then check Sentry dashboard → Issues → should see 1 deliberate exception
   ```

---

### Step 8 · Uptime monitoring · 5 min

1. <https://uptimerobot.com> → free tier (50 monitors, 5-min checks)
2. **Add New Monitor** →
   - Type: `HTTP(s)`
   - URL: `https://app.your-domain.vn/api/health`
   - Interval: 5 min
   - **Advanced**: alert when status code ≠ 200 OR response body doesn't contain `"ok":true`
3. Add a 2nd monitor for `https://status.your-domain.vn` (if you put Site Status on a sub)
4. Pick alert contacts: your email + a Zalo OA webhook if you set up #11 in the long-tail

The deep health check reports per-dependency, so UptimeRobot's alert email will tell you "Postgres up, Ollama down" specifically.

---

### Step 9 · Domain + TLS · 30 min

Pick one of three deploy targets:

**A. Self-host (Caddy)** — I built the Caddyfile.
```bash
# DNS: point app.your-domain.vn → your server's public IP

# On the server:
docker run -d --name caddy -p 80:80 -p 443:443 \
  -v $PWD/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data -v caddy_config:/config \
  --network atlas-aec_default \
  caddy:2

# Caddy auto-fetches Let's Encrypt cert + renews. Done.
```
Edit `caddy/Caddyfile` and replace `app.atlas-aec.vn` with your real domain.

**B. Vercel** — `vercel --prod`. Set every env from step 1-7 in the Vercel dashboard. Vercel handles TLS.

**C. Render** — connect the GitHub repo, set env vars, enable health check `/api/health`. Render handles TLS.

For either B or C, also set:
```
AUTH_URL="https://app.your-domain.vn"
NEXT_PUBLIC_BASE_URL="https://app.your-domain.vn"
```

---

### Step 10 · Run a restore drill · 5 min, then weekly

I already ran it against your current DB and it passed (`67 audit events, 1 project, 7 bids` restored cleanly).

To make this routine:

```bash
# Weekly cron — take backup + verify restore:
0 3 * * 0  docker exec atlas-aec-postgres pg_dump -U atlas atlas_aec | gzip > /backups/atlas-$(date +\%F).sql.gz && /opt/atlas-aec/scripts/restore-drill.sh /backups/atlas-$(date +\%F).sql.gz
```

Add to your prod server's crontab. Pipe failures into Sentry via `captureMessage` or to your `BILLING_INBOX` so you notice if a backup ever fails to restore.

---

### Step 11 · Deploy the worker · 10 min (already coded)

The cron worker (`apps/worker/`) is built and Dockerized. To deploy:

```bash
# After web is up:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d worker scraper
```

The worker runs three jobs:
- `scrape-tenders` every 24h (calls the same code as the Python sidecar — pick one or the other; they're redundant by design)
- `bond-expiry` every 24h (auto-marks past-due BLDTs as EXPIRED, surfaces 30-day warnings)
- `drift-snapshot` hourly (writes `DriftSnapshot` rows for the Trust page)

Verify in logs: `docker logs -f atlas-aec-worker-1` — should see `{"msg": "worker.job_done"}` lines.

---

## 🟡 Long-tail · do when you sign customers 2–3

These don't block the first pilot. Schedule them after PMF.

| Item | Effort | When to do |
|---|---|---|
| Mobile native app (iOS + Android) | 2 months | When > 30% of usage is on phones |
| Zalo OA real wiring | 1 week | When customers ask "có Zalo không?" |
| E-invoice CQT cấp mã (TT 78/2021) | 2 weeks | When a customer with > 10tr/tháng billing needs hóa đơn đỏ |
| Chữ ký số (VNPT-CA / Viettel-CA) | 2 weeks | When BBNT signing is the blocker |
| MISA / Base / BIM 360 OAuth connectors | 1 week each | When a customer asks for bidirectional sync |
| SOC 2 Type I → Type II | 6 months + auditor fee | When a DNNN or FDI says "we need SOC 2" |
| WCAG 2.1 AA audit | 1 month + consultant | Government tenders only |
| CDN | 1 day | When you have international users |

---

## Verify-everything checklist before flipping the DNS

Run all of these from your laptop, against the production URL:

```bash
# 1. Smoke flow (must return 27/27)
BASE=https://app.your-domain.vn pnpm exec tsx scripts/smoke-flow.ts

# 2. Email pipeline (must deliver)
TO=you@your-domain.vn pnpm exec tsx scripts/test-email.ts

# 3. Sentry (one issue should appear in dashboard within 30s)
SENTRY_DSN=$YOUR_DSN pnpm exec tsx scripts/test-sentry.ts

# 4. Health check (must report all deps)
curl https://app.your-domain.vn/api/health | jq

# 5. Compliance engine (one POST that runs all 9 rules)
curl https://app.your-domain.vn/api/winwork/bids/<test-bid>/compliance -X POST -H "Cookie: ..."

# 6. Restore drill against latest backup
./scripts/restore-drill.sh /backups/atlas-latest.sql.gz
```

When all 6 pass → flip the DNS, post to your pilot's Zalo, take the call.

---

## When something breaks at 3am

```
1.  curl https://app.your-domain.vn/api/health    → which dep is down?
2.  Check Sentry → most recent unhandled exception
3.  Check UptimeRobot incident log → when did the alert fire?
4.  docker logs --tail 200 atlas-aec-web-1
5.  docker logs --tail 200 atlas-aec-worker-1
6.  If Postgres is the issue: pg_isready -h <host>; check connection pool exhaustion
7.  If Ollama is the issue: it's a soft dep; the app stays up, just the AI panels degrade
8.  Last resort: docker compose restart web (preserves DB)
```

Demo credentials for your own debugging: `anh.nguyen@cofico.vn` / `demo1234!`
