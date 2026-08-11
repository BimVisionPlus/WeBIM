# Deploy runbook — 2026-06-05 batch

This session built 11 features but couldn't `git commit / push / deploy`
because the shell lost write access to the repo mid-session (macOS TCC
revoked permissions). All files are on disk and ready. Run this from a
**fresh terminal** with normal permissions to ship.

## Pre-flight

```bash
# Quit the affected terminal completely, open a fresh one
cd /Users/vsf-thuynt519-l/Documents/GitHub/atlas-aec

# Verify the files this session created exist
ls apps/web/app/\(app\)/demo/DemoTour.tsx
ls apps/web/app/\(app\)/pricing/page.tsx
ls apps/web/app/\(app\)/compare/page.tsx
ls apps/web/app/\(app\)/api-docs/page.tsx
ls apps/web/app/\(app\)/insights/page.tsx
ls apps/web/app/\(app\)/connect/page.tsx
ls apps/web/app/\(app\)/marketplace/page.tsx
ls apps/web/e2e/atlas-suite.spec.ts
ls scripts/panic/*.sh
ls docs/security-audit-2026-06-05.md
ls apps/web/app/api/field/checkin/route.ts.patched
```

If any file is missing, re-grant Full Disk Access to Terminal in
System Settings → Privacy & Security → Full Disk Access.

## Step 1 — Apply the HIGH security patch

```bash
# Replace the vulnerable route with the patched version
mv apps/web/app/api/field/checkin/route.ts apps/web/app/api/field/checkin/route.ts.OLD
mv apps/web/app/api/field/checkin/route.ts.patched apps/web/app/api/field/checkin/route.ts

# Verify
diff -u apps/web/app/api/field/checkin/route.ts.OLD apps/web/app/api/field/checkin/route.ts | grep "+ await requireProject"
# Expected output: +    await requireProject(projectId);

# Clean up
rm apps/web/app/api/field/checkin/route.ts.OLD
```

## Step 2 — Typecheck

```bash
pnpm -F @atlas/web typecheck
pnpm -F @atlas/ai typecheck
```

Both should exit 0. If not, paste error here and we fix together.

## Step 3 — Commit everything

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(suite+content+hardening): A+B+C+E bundle — 11 deliverables

Pre-demo polish (A):
- /demo Tour mode: floating button bottom-right opens modal with 7 stops
  auto-walking through key flows. Progress bar, dot nav, ?tour=1 auto-open.
- DEMO-WALKTHROUGH-V2.md: 12-flow / 21-min cheat sheet adding Vendor /
  Cost / Compliance / Field / BU scripted flows + new FAQ + killshots.
- scripts/panic/: 5 emergency recovery scripts (restart-web, reset-invite,
  fix-workflow, reset-ai-banner, reset-demo-project) — idempotent.

Customer-facing content (C):
- /pricing: 3 tiers (Pilot 30d / Pro 490k₫/seat / Enterprise on-prem).
  Reference Procore benchmark + quick-compare table + FAQ.
- /compare: side-by-side feature matrix Viwase vs Procore vs ACC.
  38 features × 3 vendors with notes column, score hero + honest
  "when to choose competitor" framing.
- /api-docs: REST reference 30+ endpoints across 11 sections with
  method/path/body/auth columns + quick-start curl + rate limits + errors.

Defensive hardening (B):
- e2e/atlas-suite.spec.ts: Playwright spec covering 5 new Atlas modules
  + demo launchpad + 3 customer-facing pages. 17 test cases total.
- docs/security-audit-2026-06-05.md: audit report on 5 new POST routes
  finding 1 HIGH + 3 LOW issues.
- SECURITY PATCH HIGH: /api/field/checkin now calls requireProject(projectId)
  to prevent cross-project Attendance pollution.

Roadmap 06-08 (E):
- /insights: Atlas Insights phase-1 page — win rate, profitability heatmap
  per phòng × status, contractor scorecard, overrun radar. Phase 2 ML
  roadmap documented inline.
- /connect: Atlas Connect integrations catalog — 25 connectors across ERP
  (Bravo/FAST/Mego/MISA), banking (BIDV/Vietinbank/ZaloPay/MoMo/VietQR),
  e-Gov (TCT/DVCQG/BHXH/eFootprint), comm (Zalo OA/Stringee/Resend/Teams),
  BIM (ACC/Forge/Trimble/Bluebeam), compliance (PC07/Sở XD). Status
  badges live/beta/wip/planned.
- /marketplace: Atlas Marketplace vendor discovery — hot tender broadcast,
  province heatmap, top contractor scorecard, supplier catalog grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

## Step 4 — Deploy to prod

```bash
./scripts/sync-to-prod.sh

ssh -i ~/.ssh/aecplatform_deploy root@142.132.170.171 \
  'cd /opt/atlas-aec && \
   docker compose -f docker-compose.prod.yml --env-file .env.production build web && \
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate web'

# Wait for health
until curl -fsS -o /dev/null https://app.aecplatform.vn/api/health; do sleep 2; done
echo "READY"
```

## Step 5 — Smoke test new pages

```bash
# Re-use existing login session if you have it, otherwise:
JAR=/tmp/cookie.jar
csrf=$(curl -sS -c $JAR https://app.aecplatform.vn/api/auth/csrf | jq -r .csrfToken)
curl -sS -c $JAR -b $JAR -o /dev/null -X POST \
  https://app.aecplatform.vn/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$csrf" \
  --data-urlencode "email=anh.nguyen@cofico.vn" \
  --data-urlencode "password=demo1234!" \
  --data-urlencode "callbackUrl=https://app.aecplatform.vn/"

# Each new page should HTTP 200
for path in /pricing /compare /api-docs /insights /connect /marketplace; do
  code=$(curl -sS -b $JAR -o /dev/null -L -w "%{http_code}" "https://app.aecplatform.vn$path")
  printf "%-15s HTTP %s\n" "$path" "$code"
done

# Tour button should be in /demo HTML
curl -sS -b $JAR "https://app.aecplatform.vn/demo" | grep -c 'data-testid="open-tour"'
# Expected: 1

# Security: cross-project field check-in should now return 403
# (Use a real projectId from a DIFFERENT org than the demo user)
```

## Step 6 — Re-run E2E to confirm no regression

```bash
# If you have a local dev server running
pnpm -F @atlas/web exec playwright test e2e/atlas-suite.spec.ts

# Or point at prod:
E2E_BASE_URL=https://app.aecplatform.vn \
  pnpm -F @atlas/web exec playwright test e2e/atlas-suite.spec.ts
```

## Step 7 — Update /demo MODULES array (optional polish)

Add the 3 new roadmap modules to the demo launchpad TILES so customers can
discover them from /demo:

Edit `apps/web/app/(app)/demo/page.tsx`, find the `MODULES` array, and
add to the "Atlas Suite (02→05)" group OR create a new group "Roadmap 06→08":

```ts
{ icon: "🔮", group: "Roadmap 06→08", name: "Atlas Insights", href: "/insights", tagline: "Cross-project ML analytics" },
{ icon: "🔌", group: "Roadmap 06→08", name: "Atlas Connect", href: "/connect", tagline: "Integrations marketplace — ERP, bank, e-Gov, BIM" },
{ icon: "🛒", group: "Roadmap 06→08", name: "Atlas Marketplace", href: "/marketplace", tagline: "Vendor discovery + tender broadcast" },
```

Then re-deploy with the same Step 4 commands.

---

## Summary of what was built this session

| # | Deliverable | Path |
|---|---|---|
| A1 | Tour mode on /demo | `apps/web/app/(app)/demo/DemoTour.tsx` |
| A2 | Demo walkthrough v2 | `pitch-decks/46-atlas-aec/DEMO-WALKTHROUGH-V2.md` |
| A3 | Panic kit (5 scripts) | `scripts/panic/*.sh` + `README.md` |
| C1 | Pricing page | `apps/web/app/(app)/pricing/page.tsx` |
| C2 | Compare vs Procore/ACC | `apps/web/app/(app)/compare/page.tsx` |
| C3 | API docs reference | `apps/web/app/(app)/api-docs/page.tsx` |
| B1 | E2E spec for 5 modules | `apps/web/e2e/atlas-suite.spec.ts` |
| B2 | Security audit report | `docs/security-audit-2026-06-05.md` |
| B2 | HIGH patch (field/checkin) | `apps/web/app/api/field/checkin/route.ts.patched` |
| E1 | Atlas Insights (06) | `apps/web/app/(app)/insights/page.tsx` |
| E2 | Atlas Connect (07) | `apps/web/app/(app)/connect/page.tsx` |
| E3 | Atlas Marketplace (08) | `apps/web/app/(app)/marketplace/page.tsx` |

All files written, none tested locally due to terminal permission loss.
Ship via this runbook from a clean terminal.
