# aecplatform.vn — Production Deploy Runbook

Self-host deployment for the **Atlas AEC platform** at three subdomains:

| Host | Purpose | Service |
|---|---|---|
| `aecplatform.vn` | Landing — marketing + 47 module cards | `landing` (Next.js, port 3001) |
| `app.aecplatform.vn` | Auth-gated workflow app | `web` (Next.js, port 3000) |
| `status.aecplatform.vn` | Public Site Status pages | `web` (no auth route) |

Caddy (`caddy:2-alpine`) terminates TLS via Let's Encrypt for all three hostnames.

---

## Prerequisites

**VPS (1 box, ≥ 8 GB RAM, ≥ 40 GB SSD):**
- Ubuntu 22.04 LTS or Debian 12
- Docker 24+ and the Docker Compose v2 plugin
- Ports **80** and **443** reachable from public internet

**DNS — three A records pointing at the VPS public IP:**
```
aecplatform.vn         A    <VPS_IP>
www.aecplatform.vn     A    <VPS_IP>
app.aecplatform.vn     A    <VPS_IP>
status.aecplatform.vn  A    <VPS_IP>
```

**External services (free tiers are fine for pilot):**
- Managed Postgres — [Neon](https://neon.tech) free 0.5 GB or your own
- Managed Redis — [Upstash](https://upstash.com) free 10k cmd/day
- S3-compatible storage — [Cloudflare R2](https://developers.cloudflare.com/r2/) free 10 GB
- Transactional email — [Resend](https://resend.com) free 100/day

---

## Five-minute deploy

```bash
# 1. Pull the repo on the VPS
git clone https://github.com/<your-org>/atlas-aec.git
cd atlas-aec

# 2. Configure secrets
cp .env.production.example .env.production
nano .env.production
#   - AUTH_SECRET: openssl rand -base64 32
#   - DATABASE_URL: your Neon pooler URL
#   - REDIS_URL: your Upstash rediss:// URL
#   - S3_* : R2 endpoint + access keys
#   - SMTP_* / RESEND_API_KEY: email provider
#   - WINWORK_SCRAPE_SECRET: openssl rand -hex 24

# 3. Boot
./scripts/deploy.sh

# 4. Verify TLS (~30s after boot)
curl -I https://aecplatform.vn
curl -I https://app.aecplatform.vn/api/health
```

The deploy script: validates env → builds 4 images → boots `landing` + `web` + `worker` + `scraper` + `caddy` → runs `prisma migrate deploy` → smoke-tests health endpoints.

---

## What's running

```
docker compose -f docker-compose.prod.yml ps
```

```
NAME                       IMAGE                       PORTS              STATUS
atlas-aec-caddy-1          caddy:2-alpine              :80→80, :443→443   healthy
atlas-aec-landing-1        atlas-aec/landing:latest    :3001 (internal)   healthy
atlas-aec-web-1            atlas-aec/web:latest        :3000 (internal)   healthy
atlas-aec-worker-1         atlas-aec/worker:latest                        running
atlas-aec-scraper-1        atlas-aec/scraper:latest                       running
```

Caddy is the only ingress; landing/web are **not** exposed to the public network (`expose:` instead of `ports:`).

---

## Tasks after first boot

### Seed demo data (optional)

For a sandbox / demo tenant — creates `anh.nguyen@cofico.vn` + 4 orgs + 1 project + 47 modules of seed content:

```bash
docker compose -f docker-compose.prod.yml exec web sh -c 'pnpm --filter @atlas/db exec tsx prisma/seed.ts'

# 20 new modules — run each seed script:
for s in paymentrail volumemeter dinhmuc bondvault hoancong supervise qaqc tenderforge \
         eiaflow hsetrain workforce registry materialtrace labreports methods portal \
         consult stakeholders docchat monitor; do
  docker compose -f docker-compose.prod.yml exec web sh -c "pnpm --filter @atlas/db exec tsx ../../scripts/seed-${s}.ts"
done
```

Login at `https://app.aecplatform.vn/signin` with `anh.nguyen@cofico.vn / demo1234!`.

### Run E2E tests against prod (smoke check)

```bash
E2E_BASE_URL=https://app.aecplatform.vn \
E2E_DEMO_EMAIL=anh.nguyen@cofico.vn \
E2E_DEMO_PASSWORD=demo1234! \
  pnpm --filter @atlas/web exec playwright test e2e/modules-smoke.spec.ts
```

20 module pages render + screenshot in `apps/web/e2e-screenshots/`.

### Backups

Daily Postgres + S3 backup cron (`scripts/backup.sh` to come — for now use your managed DB's PITR).

---

## DNS + TLS troubleshooting

```bash
# DNS propagation
dig +short aecplatform.vn app.aecplatform.vn status.aecplatform.vn

# Caddy TLS provisioning (first ~30s after boot)
docker compose -f docker-compose.prod.yml logs -f caddy

# If Let's Encrypt rate-limits you: uncomment the staging acme_ca line in
# caddy/Caddyfile, redeploy, then comment it back when ready for prod certs.
```

---

## Tear down + redeploy

```bash
docker compose -f docker-compose.prod.yml down                   # stop, keep volumes
docker compose -f docker-compose.prod.yml down -v                # stop + drop caddy certs (Let's Encrypt will re-issue)
git pull && ./scripts/deploy.sh                                  # rebuild + redeploy
```

---

## Scale-out path

When pilot grows past ~10 paying firms:

1. Pull Postgres + Redis off VPS → fully managed (already external).
2. Move S3 to dedicated bucket per tenant or per region (R2 → AWS S3 ap-southeast-1).
3. Split `web` to its own VPS, scale to 2-3 replicas behind Caddy load balancing.
4. Spin a GPU instance for the OSS AI stack (Ollama + qwen2.5-14b + bge-m3 + whisper) — set `OLLAMA_BASE_URL` / `WHISPER_BASE_URL`.
5. Add Sentry (`SENTRY_DSN`) for error tracking + PostHog/Plausible for product analytics.

---

## Module inventory

47 modules currently shipped — see `apps/landing/components/modules.tsx` for the full list (13 Atlas suite + 34 aec-platform vertical, of which 20 are the new pháp-lý-VN pack with full CRUD + workflow + E2E test coverage).

Regulatory anchors covered: **NĐ 06/2021** (chất lượng + bảo trì + hoàn công VIIIb) · **NĐ 99/2021** (thanh toán) · **NĐ 15/2021** (năng lực hành nghề) · **NĐ 44/2016** (huấn luyện ATLĐ) · **NĐ 08/2022** (ĐTM/GPMT) · **TT 26/2016** (BBNT) · **TT 13/2021** (đo bóc khối lượng) · **TT 10/2019** (định mức) · **Luật ĐT 22/2023** (đấu thầu) · **Luật XD 50/2014** (hành nghề KTS/KS) · **QCVN 7:2018** (hợp quy thép) · **QCVN 16:2023** (hợp quy XM/kính/gạch).
