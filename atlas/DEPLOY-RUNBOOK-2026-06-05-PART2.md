# Deploy runbook part 2 — D bundle (multi-tenant)

Builds on `DEPLOY-RUNBOOK-2026-06-05.md` (A+B+C+E bundle).
Adds module D — sandbox per customer at `<slug>.aecplatform.vn`.

Same constraint: shell lost write access mid-session. Run from a fresh
terminal after granting Full Disk Access to the new terminal app.

## Files created (D bundle)

| # | Path | Purpose |
|---|---|---|
| D1 | `packages/db/prisma/migrations/20260605120000_add_tenant_fields/migration.sql` | Migration: Org tenant fields + TenantProvisioning + TenantVisit |
| D1 | `packages/db/prisma/schema-patch-tenant.md` | How to patch `schema.prisma` (must apply by hand — see below) |
| D2 | `apps/web/middleware.ts` | Edge middleware: subdomain → `x-tenant-slug` header (PATCHED — added to existing file) |
| D2 | `packages/lib/src/tenant.ts` | `getTenantContext()` + `logTenantVisit()` helpers |
| D3 | `scripts/tenant-clone.ts` | CLI + library: clone template Org → new tenant Org |
| D3 | `apps/web/app/api/tenant/provision/route.ts` | `POST /api/tenant/provision` — self-serve sandbox creation |
| D3 | `apps/web/app/signin-magic/page.tsx` | One-time magic-link signin landing |
| D4 | `apps/web/app/start/page.tsx` + `StartForm.tsx` | Public signup form at `/start` |
| D4 | `apps/web/app/(app)/admin/tenants/page.tsx` + `TenantRowActions.tsx` | Sales CRM at `/admin/tenants` |
| D4 | `apps/web/app/api/tenant/[id]/[verb]/route.ts` | Admin lifecycle actions (extend/archive/convert/expire) |
| D5 | `scripts/tenant-expire-cron.ts` | Daily cron: expire → archive → purge |
| D5 | `docs/multi-tenant-infra.md` | DNS + Caddy/nginx + cron + cost guide |

## Pre-flight

```bash
cd /Users/vsf-thuynt519-l/Documents/GitHub/atlas-aec
ls packages/db/prisma/migrations/20260605120000_add_tenant_fields/migration.sql
ls packages/lib/src/tenant.ts
ls scripts/tenant-clone.ts
ls apps/web/app/api/tenant/provision/route.ts
ls apps/web/app/start/page.tsx
ls apps/web/app/\(app\)/admin/tenants/page.tsx
ls scripts/tenant-expire-cron.ts
ls docs/multi-tenant-infra.md
```

## Step 1 — Patch `schema.prisma`

Open `packages/db/prisma/schema.prisma` and apply edits from
`packages/db/prisma/schema-patch-tenant.md`:

1. Add `enum TenantStatus { ... }` near other enums
2. Inside `model Organization`: add the 12 new tenant + prospect fields
3. Inside `model Organization` relations block: add `tenantProvisionings` + `tenantVisits`
4. Inside `model Organization` index block: add `@@index([isTenantDemo, tenantStatus])`
5. At the bottom of the file: add `model TenantProvisioning { ... }` + `model TenantVisit { ... }`

Then format + verify the schema is valid:
```bash
pnpm -F @atlas/db exec prisma format
pnpm -F @atlas/db exec prisma validate
```

## Step 2 — Apply migration

```bash
DBURL=$(ssh -i ~/.ssh/aecplatform_deploy root@142.132.170.171 \
  'grep ^DATABASE_URL /opt/atlas-aec/.env.production | cut -d= -f2- | tr -d "\""')

DATABASE_URL="$DBURL" pnpm -F @atlas/db exec prisma migrate deploy
DATABASE_URL="$DBURL" pnpm -F @atlas/db exec prisma generate
```

## Step 3 — Typecheck

```bash
pnpm -F @atlas/web typecheck
pnpm -F @atlas/lib typecheck
```

If `tenant.ts` complains about `prisma.tenantVisit` or `tenantProvisioning`
missing, you forgot Step 1 (schema patch) — re-apply + regen client.

## Step 4 — Set env vars on prod

```bash
ssh -i ~/.ssh/aecplatform_deploy root@142.132.170.171 \
  'cd /opt/atlas-aec && cp .env.production .env.production.bak.$(date +%s)'

# Add these two lines to /opt/atlas-aec/.env.production:
# TENANT_BASE_DOMAIN="aecplatform.vn"
# TENANT_TEMPLATE_SLUG="cofico"
```

## Step 5 — DNS + reverse proxy (one-time)

Follow `docs/multi-tenant-infra.md`:
1. Add wildcard A record `*.aecplatform.vn → 142.132.170.171` at your DNS provider
2. Switch from default reverse proxy to Caddy with the wildcard config
3. Test: `dig +short anything.aecplatform.vn` returns the VPS IP

## Step 6 — Commit + push + deploy

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(tenant): D — multi-tenant subdomain sandboxes

Each prospect gets their own URL at <slug>.aecplatform.vn cloned from
the demo template with 5 projects, 384 BoQ lines, 969 issues, voice,
AI features. 14-day pilot, magic-link signin, CRM at /admin/tenants.

Schema:
- Organization: 12 new tenant + prospect fields + tenantStatus enum
- TenantProvisioning: audit log of clone operations
- TenantVisit: per-page analytics

Middleware:
- Edge subdomain resolution → x-tenant-slug header
- Main-only path enforcement (/admin/tenants blocked on subdomains)

API:
- POST /api/tenant/provision: self-serve clone (public, rate-limited)
- POST /api/tenant/[id]/[verb]: admin lifecycle (extend/archive/convert/expire)

UI:
- /start: marketing landing + signup form
- /admin/tenants: sales CRM with pipeline + per-row actions
- /signin-magic: one-time token consumer

Scripts:
- tenant-clone.ts: clone library + CLI
- tenant-expire-cron.ts: daily ACTIVE→EXPIRED→ARCHIVED→purge

Infra docs:
- DNS wildcard + Caddy/nginx config + cron setup + cost analysis

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push origin main

./scripts/sync-to-prod.sh
ssh -i ~/.ssh/aecplatform_deploy root@142.132.170.171 \
  'cd /opt/atlas-aec && docker compose -f docker-compose.prod.yml --env-file .env.production build web && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate web'

until curl -fsS -o /dev/null https://app.aecplatform.vn/api/health; do sleep 2; done
echo "READY"
```

## Step 7 — End-to-end smoke

```bash
# 1) Provision a test tenant
curl -X POST https://aecplatform.vn/api/tenant/provision \
  -H "Content-Type: application/json" \
  -d '{"slug":"smoketest","name":"Smoke Test Co","email":"smoke@example.com","company":"Smoke Test Co"}' \
  | python3 -m json.tool
# Expect: { ok: true, url: "https://smoketest.aecplatform.vn", signinUrl: "...", stats: {...} }

# 2) Verify subdomain serves
curl -fsSI https://smoketest.aecplatform.vn | head -3
# Expect: HTTP/2 200

# 3) Verify CRM lists it
curl -b $JAR "https://app.aecplatform.vn/admin/tenants" | grep -c "smoketest"
# Expect: 1+

# 4) Verify admin lifecycle
curl -b $JAR -X POST "https://app.aecplatform.vn/api/tenant/$(...lookup id...)/extend"
# Expect: { ok: true, verb: "extend" }
```

## Step 8 — Schedule the cron

```bash
ssh -i ~/.ssh/aecplatform_deploy root@142.132.170.171
crontab -e
# Add:
0 20 * * * /usr/bin/docker exec atlas-aec-web-1 sh -c 'cd /app && node /app/scripts/tenant-expire-cron.js' >> /var/log/tenant-cron.log 2>&1
```

(20:00 UTC = 03:00 ICT, daily.)

---

## Smoke test before customer demos

```bash
# Confirm template org has enough data to clone meaningfully
curl https://app.aecplatform.vn/api/projects | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([p for p in d if 'cofico' in (p.get('ownerOrg',{}).get('slug','') or '')]))"
# Expect: 5+
```

## Roll-back

If anything breaks the main domain `app.aecplatform.vn`:
```bash
ssh -i ~/.ssh/aecplatform_deploy root@142.132.170.171 \
  'cd /opt/atlas-aec && cp .env.production.bak.<timestamp> .env.production && \
   docker compose -f docker-compose.prod.yml --env-file .env.production restart web'
```

To revert the migration:
```sql
DROP TABLE "TenantVisit";
DROP TABLE "TenantProvisioning";
ALTER TABLE "Organization"
  DROP COLUMN "isTenantDemo",
  DROP COLUMN "tenantStatus",
  DROP COLUMN "tenantExpiresAt",
  DROP COLUMN "tenantProvisionedFrom",
  DROP COLUMN "tenantProvisionedAt",
  DROP COLUMN "prospectName",
  DROP COLUMN "prospectEmail",
  DROP COLUMN "prospectCompany",
  DROP COLUMN "prospectIndustry",
  DROP COLUMN "prospectSource",
  DROP COLUMN "lastVisitedAt",
  DROP COLUMN "visitCount";
DROP TYPE "TenantStatus";
```
