# Atlas AEC — Deploy production hoàn toàn FREE

> Stack: Vercel (web) + Neon (Postgres) + Upstash (Redis) + Cloudflare R2 (S3) + GitHub Actions (cron) + Resend + Sentry + UptimeRobot.
>
> **Tổng chi phí: 0đ/tháng** đến khi:
> - DB > 0.5 GB (Neon free) — đủ cho ~10k issues
> - Bandwidth > 100 GB/tháng (Vercel Hobby) — đủ cho ~5k pageviews/day
> - Email > 3k/tháng (Resend) — đủ cho ~100 user
> - Storage > 10 GB (R2) — đủ cho ~1000 BIM uploads
>
> Khi vượt limit, mỗi service ~$5–25/month. Tổng max ~$50/month cho 100-user pilot.

Estimated total time: **2–3 giờ** chia làm 3 phiên.

---

## Phiên 1 · Setup managed services (~45 phút)

### Bước 1 · Neon Postgres (10 phút)

1. Vào https://neon.tech → **Sign up** với Google (`sophie.nguyenthuthuy@gmail.com`)
2. Tạo project:
   - **Project name**: `atlas-aec-prod`
   - **Postgres version**: 16
   - **Region**: **Asia Pacific (Singapore) — `ap-southeast-1`** (gần VN nhất)
3. Sau khi tạo, Neon hiện **Connection string**, dạng:
   ```
   postgresql://USER:PASSWORD@ep-xxx-yyy.ap-southeast-1.aws.neon.tech/atlas_aec?sslmode=require
   ```
4. Copy connection string → dán vào file note tạm. **Đây là `DATABASE_URL`**.
5. **Bật connection pooling** (quan trọng cho Vercel serverless):
   - Settings → Connection Pooling → ON
   - Pooler endpoint sẽ là `ep-xxx-yyy-pooler.ap-southeast-1.aws.neon.tech`
   - Dùng URL **pooler** thay vì URL gốc cho `DATABASE_URL`

### Bước 2 · Apply schema (5 phút)

```bash
# Local terminal
cd ~/Documents/GitHub/atlas-aec
DATABASE_URL="<paste pooler URL từ Neon>" pnpm --filter @atlas/db exec prisma migrate deploy
DATABASE_URL="<paste pooler URL từ Neon>" pnpm --filter @atlas/db seed
```

Verify trong Neon dashboard → **SQL Editor** → run `SELECT COUNT(*) FROM "Plan";` → kỳ vọng `4`.

### Bước 3 · Upstash Redis (5 phút)

1. Vào https://upstash.com → **Sign up** với Google
2. **Create Database**:
   - Name: `atlas-aec-prod`
   - Type: **Regional** (free tier không hỗ trợ Global)
   - Region: **Asia Pacific (Singapore)**
   - TLS: **enabled**
3. Sau khi tạo, copy **Endpoint** + **Password** → ghép thành:
   ```
   rediss://default:<password>@<endpoint>:6379
   ```
   Đây là `REDIS_URL`.

### Bước 4 · Cloudflare R2 (15 phút)

1. Đăng ký Cloudflare account (nếu chưa có) tại https://dash.cloudflare.com/
2. Sidebar trái → **R2 Object Storage** → **Get Started**
3. Activate R2 — yêu cầu add card nhưng chỉ charge khi vượt 10 GB
4. **Create bucket**:
   - Name: `atlas-aec-prod`
   - Location: **Asia-Pacific (APAC)**
5. **Generate API token**:
   - R2 → **Manage R2 API Tokens** → **Create API token**
   - Permission: **Object Read & Write**
   - Specify bucket: `atlas-aec-prod`
   - TTL: forever (or 1 year)
   - Copy:
     - **Access Key ID** → `S3_ACCESS_KEY`
     - **Secret Access Key** → `S3_SECRET_KEY`
     - **Jurisdiction-specific endpoint** → `S3_ENDPOINT` (dạng `https://<account-id>.r2.cloudflarestorage.com`)

### Bước 5 · Domain DNS (10 phút)

Vào Mắt Bão → `aecplatform.vn` → DNS Records, add:

```
Type  Name              Value                              TTL
CNAME app               cname.vercel-dns.com               Auto
CNAME www               cname.vercel-dns.com               Auto
```

(Đợi 5–30 phút để propagate)

---

## Phiên 2 · Deploy Vercel (~30 phút)

### Bước 6 · Push code lên GitHub

Nếu chưa có repo GitHub:
```bash
cd ~/Documents/GitHub/atlas-aec
git init
git add -A
git commit -m "Initial commit"
gh repo create atlas-aec --private --source=. --push
```

Hoặc nếu đã có repo, push branch hiện tại:
```bash
git push origin main
```

### Bước 7 · Vercel project

1. Vào https://vercel.com → **Sign up with GitHub**
2. **Import Project** → chọn repo `atlas-aec`
3. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detect)
   - **Root Directory**: leave empty (Vercel reads `vercel.json` — đã commit sẵn)
   - **Build Command**: tự nhận từ vercel.json
4. **Environment Variables** — paste 1 lần (bulk paste):

```env
# Database (Neon pooler)
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/atlas_aec?sslmode=require

# NextAuth
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://app.aecplatform.vn
NEXT_PUBLIC_BASE_URL=https://app.aecplatform.vn
AUTH_TRUST_HOST=true

# Redis (Upstash)
REDIS_URL=rediss://default:PASSWORD@HOST:6379

# Storage (R2)
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<R2 Access Key ID>
S3_SECRET_KEY=<R2 Secret Access Key>
S3_BUCKET_MODELS=atlas-aec-prod
S3_BUCKET_DRAWINGS=atlas-aec-prod
S3_BUCKET_ATTACHMENTS=atlas-aec-prod
S3_FORCE_PATH_STYLE=true

# APS (Forge)
APS_CLIENT_ID=NbCwhfJRcCgGle4DLwB288gqaXalIMtpa7pCd98Cgk3CUM8k
APS_CLIENT_SECRET=<rotate trước khi paste — secret cũ đã share trong chat>
APS_BUCKET_KEY=atlas-aec-prod-models

# Email (Resend)
RESEND_API_KEY=<rotate trước khi paste>
EMAIL_FROM=Atlas AEC <no-reply@aecplatform.vn>
AUTH_EMAIL_FROM=Atlas AEC <no-reply@aecplatform.vn>
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<same as RESEND_API_KEY>

# Billing
BANK_NAME=TPBank
BANK_ACCOUNT=0925629416
BANK_HOLDER=NGUYEN THU THUY
BILLING_INBOX=billing@aecplatform.vn

# Scraper trigger
WINWORK_SCRAPE_SECRET=<openssl rand -base64 32>

# Observability
SENTRY_DSN=https://35a50f07d9f0f4c691656475c9db30f0@o4511415862034432.ingest.de.sentry.io/4511415866294352
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# AI (Vercel can't run Ollama — point at a hosted instance or leave empty)
AI_ENABLED=false
```

5. Click **Deploy**.

### Bước 8 · Custom domain

1. Trong Vercel project → **Settings** → **Domains**
2. Add `app.aecplatform.vn`
3. Vercel sẽ tự verify qua CNAME đã set ở Bước 5
4. Đợi 1–5 phút → status chuyển **Valid**
5. Vercel tự issue TLS cert (Let's Encrypt) — không phải làm gì thêm

### Bước 9 · Verify deploy

```bash
# Healthcheck
curl https://app.aecplatform.vn/api/health | jq

# Kỳ vọng:
#   { "ok": true, "hard": { "postgres": { "ok": true, "latencyMs": ... }, "redis": ... } }

# Smoke flow
BASE=https://app.aecplatform.vn pnpm exec tsx scripts/smoke-flow.ts

# Kỳ vọng: 27/27 PASS
```

Nếu smoke flow fail, vào Vercel → Deployments → click latest → **Logs** để debug.

---

## Phiên 3 · Cron jobs + Trust + UptimeRobot (~30 phút)

### Bước 10 · GitHub Actions secrets

Trong repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

```
ATLAS_BASE_URL          https://app.aecplatform.vn
WINWORK_SCRAPE_SECRET   <same as Vercel env>
DATABASE_URL            <same Neon pooler URL>
```

Push file `.github/workflows/cron.yml` (đã commit sẵn):
```bash
git add .github/workflows/cron.yml scripts/cron-*.ts
git commit -m "Add GitHub Actions cron jobs"
git push
```

Verify trong tab **Actions**: 3 workflow xuất hiện (scrape-tenders, bond-expiry, drift-snapshot). Bạn có thể click **Run workflow** để test ngay.

### Bước 11 · UptimeRobot monitor

1. Vào https://uptimerobot.com (đã signup ở Bước 8 trước đó)
2. **+ New Monitor**:
   - Type: `HTTP(s)`
   - Name: `Atlas AEC — production`
   - URL: `https://app.aecplatform.vn/api/health`
   - Interval: 5 minutes
   - Advanced → Keyword: `"ok":true` → Alert when NOT found
3. Alert contact: `sophie.nguyenthuthuy@gmail.com`
4. Save → Pause/Unpause để test alert

### Bước 12 · Final verify

```bash
# 1. App reachable
curl -I https://app.aecplatform.vn → HTTP 200

# 2. Sign in flow
# Mở browser → https://app.aecplatform.vn/signup → tạo tài khoản
# Email verification phải tới hộp thư

# 3. Trust page public
curl https://app.aecplatform.vn/trust → HTML có "Model Cards"

# 4. Status page public (chưa cần auth)
curl https://app.aecplatform.vn/status/VHGP-S9 → HTML "Vinhomes Grand Park"

# 5. UptimeRobot
# Sau 5 phút, dashboard hiện monitor "Up" màu xanh
```

---

## Rotate secrets đã paste trong chat (5 phút)

Quan trọng trước khi public:

### APS Client Secret
1. https://aps.autodesk.com/myapps → click app `Atlas AEC — Prod`
2. **Regenerate Client Secret**
3. Copy → paste vào Vercel env `APS_CLIENT_SECRET` (Settings → Environment Variables → edit)
4. Vercel auto redeploy

### Resend API Key
1. https://resend.com/api-keys
2. **Delete** key `atlas-aec-prod` cũ
3. **Create API Key** mới (Full Access)
4. Copy → paste vào Vercel env `RESEND_API_KEY` + `SMTP_PASS`
5. Vercel auto redeploy

---

## Troubleshoot phổ biến

### "Database connection error" sau cold start
Neon free tier autosleep sau 5 phút idle. Lần đầu request mất 3–5s để wake. Sau pilot có traffic ổn định không bị nữa. Nếu cần SLA tốt hơn: upgrade Neon Launch plan ($19/mo) cho always-on.

### "Function exceeded 10s timeout"
Vercel Hobby giới hạn 10s/function. Routes nặng (smoke flow, scraper trigger) phải chạy qua GH Actions (đã wire). Long-running operations: dùng background worker pattern.

### "Module not found: @atlas/db"
Build cache stale. Vercel → Settings → General → **Redeploy** với checkbox "Use existing build cache" UNCHECKED.

### Cron không chạy
GH Actions cron có lag 5–15 phút và không guarantee chính xác. Cho production-grade, dùng:
- Vercel Cron Jobs (Hobby: max 2 cron, free)
- Hoặc Inngest.com (free 25k events/month)
- Hoặc Render free worker

### Email không gửi
Resend yêu cầu domain verified. Nếu Vercel preview deploys dùng `*.vercel.app`, mặc định email từ `no-reply@aecplatform.vn` sẽ fail SPF. Cho preview: dùng `from: 'onboarding@resend.dev'` qua env override.

---

## Khi vượt free tier

| Khi | Service | Cost |
|---|---|---|
| DB > 0.5 GB | Neon Launch | $19/mo |
| Bandwidth > 100 GB | Vercel Pro | $20/mo |
| Email > 3k/mo | Resend Pro | $20/mo |
| Build > 6k min/mo | Vercel Pro | $20/mo |
| Redis > 10k cmd/day | Upstash Pay-as-go | ~$5/mo |
| R2 > 10 GB | Cloudflare R2 | $0.015/GB |

**Trung bình 50-user pilot:** $0–$50/mo. **100-user pilot:** ~$80/mo.

---

## Liên kết nhanh

| Service | Dashboard |
|---|---|
| Vercel | https://vercel.com/dashboard |
| Neon | https://console.neon.tech/ |
| Upstash | https://console.upstash.com/ |
| Cloudflare R2 | https://dash.cloudflare.com/ |
| Resend | https://resend.com/domains |
| Sentry | https://sentry.io/issues/ |
| UptimeRobot | https://uptimerobot.com/dashboard |
| GitHub Actions | https://github.com/<your-user>/atlas-aec/actions |
| APS | https://aps.autodesk.com/myapps |
| Mắt Bão DNS | https://id.matbao.net/ |

---

## Cheat sheet emergency

```bash
# Web app down
curl https://app.aecplatform.vn/api/health
vercel logs --follow

# DB down
psql "$DATABASE_URL" -c "SELECT 1"  # Neon autosleep?

# Redis quota cạn (10k/day Upstash)
# Đợi 24h reset, hoặc upgrade plan

# Cron không chạy
gh workflow run cron.yml

# Rollback deploy
vercel rollback

# Full restore từ backup
gh api repos/<user>/atlas-aec/contents/backups/latest.sql.gz | jq -r .download_url | xargs curl -L | gunzip | psql "$DATABASE_URL"
```

Demo credentials cho test prod: `anh.nguyen@cofico.vn` / `demo1234!` (sau khi `pnpm db:seed`).
