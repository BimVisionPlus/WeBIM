# Atlas AEC — Ship Checklist

> What's left before this can run in front of a paying customer.
> Audited 19/05/2026 against the repo (not from memory).

Status legend: 🔴 hard blocker · 🟠 would feel broken · 🟡 long-tail

---

## 🔴 P0 — Hard blockers (can't ship without these)

### 1. Production secrets aren't rotated
**State:** `.env` has `AUTH_SECRET="dev-secret-at-least-32-chars-long-for-testing-only"`, DB password `atlas`, MinIO key `atlas-secret-key`. `.env.example` ships these as defaults.
**Fix:** Per-env secrets via Vault / 1Password / Doppler / Render env. `.env` removed from git, `.env.production.example` documents the required keys without values. Rotation policy in `docs/DEPLOY.md`.
**Effort:** half-day.

### 2. Prisma migrations — currently using `db push`
**State:** `packages/db/prisma/migrations/` does not exist. Production schema changes via `db push` are data-loss-prone.
**Fix:** `pnpm prisma migrate dev --name init` to baseline. Switch CI + DEPLOY to `prisma migrate deploy`. Add a backup-then-migrate guard in the deploy script.
**Effort:** 1 day (baseline + back-fill migration history).

### 3. CI doesn't run lint or smoke-flow
**State:** `.github/workflows/ci.yml` runs `typecheck` + workflow vitest + web build. Missing: `pnpm lint`, end-to-end smoke (`scripts/smoke-flow.ts`), Playwright e2e (`apps/web/test:e2e`).
**Fix:** Add three steps to the build job; `services: postgres` already exists so smoke flow can run against it.
**Effort:** 2 hours.

### 4. Tender scrapers are stubs
**State:** `packages/lib/src/winwork/scrapers.ts` — every adapter returns `[]`. The whole WinWork value prop is auto-aggregation; without live scrapers, customers see "1 manual cơ hội" forever.
**Fix:** Wire real HTTP fetchers for muasamcong.mpi.gov.vn + dauthau.asia. Best built as a Python sidecar (Playwright + parsing) talking to the Node API via webhook, so we don't fight DOM scraping in serverless.
**Effort:** 1 week per source.

### 5. APS Forge credentials empty
**State:** `APS_CLIENT_ID=""` / `APS_CLIENT_SECRET=""`. BIM viewer never translates uploads. README is honest about this ("stays PENDING") but a customer paying for DrawBridge expects RVT/IFC to render.
**Fix:** Register an APS app, set the env, smoke-test with a real `.ifc`. Document the cost (free up to 100 cloud credits / mo).
**Effort:** half-day + ongoing APS bill.

### 6. Subscription enforcement = 0
**State:** `Plan` + `Subscription` models exist. **Zero code anywhere reads them.** Free / Pro / Business / Enterprise have identical capability. No payment provider wired. `aiCreditVnd` is a column that nothing increments or decrements.
**Fix:**
  - `lib/billing/requireFeature(orgId, feature)` middleware
  - Apply to AI routes (deduct from `aiCreditVnd`), to module routes (gate by plan code)
  - Pick a provider — **VNPAY + MoMo** for SME, **Stripe** for FDI
  - Build /settings/billing UI (upgrade, payment method, invoices)
**Effort:** 2 weeks. **Without this, no revenue model exists.**

### 7. Transactional email isn't wired
**State:** `AUTH_EMAIL_FROM=""` empty in `.env.example`. Password reset emails currently no-op silently. Invite emails likely fail. NextAuth email provider isn't enabled.
**Fix:** Wire **Resend** (cheapest, fastest) or **Postmark**. Set `EMAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`. Verify password-reset, invite, waitlist confirmation, NPS survey all deliver.
**Effort:** 1 day.

### 8. Email-verification on signup is bypassed
**State:** `VerificationToken` Prisma model is unused. New users sign up and immediately have full access. A bad actor can create unlimited Cofico-look-alike orgs.
**Fix:** Block route access until `User.emailVerified IS NOT NULL`. Send verification email on signup using the token model that already exists.
**Effort:** half-day (paired with #7).

### 9. Rate limiting only on 4 auth routes
**State:** `packages/lib/src/ratelimit.ts` is applied only to: `/api/auth/reset`, `/api/auth/forgot`, `/api/auth/register`, `/api/invites/accept`, `/api/waitlist`. Every other mutation route is wide open — `POST /api/winwork/bids`, `POST /api/siteeye/incidents`, `POST /api/codeguard/dossier/*/seed`, etc. A logged-in user can DoS the DB.
**Fix:** Add `await ratelimit(...)` to every POST/PATCH/DELETE. Use per-user buckets (60 req/min default) + per-IP for unauthenticated POST routes.
**Effort:** 1 day.

---

## 🟠 P1 — Would feel broken (not a blocker, but customers notice)

### 10. UI has 0 loading / empty / error states
**State:** Grep for `isLoading`, `useFormState`, "Empty state" returns 0 files. Every async surface is "blank → instant" or "blank → 500". Forms show server errors as raw Zod `flatten()` JSON.
**Fix:** Pattern: every fetch shows skeleton → table-empty → table-loaded; every form maps `error.fieldErrors` to inline messages. Build one `<TableEmpty />` + `<TableSkeleton />` + `<FormErrorList />` and apply.
**Effort:** 2-3 days.

### 11. No observability
**State:** `pino` logs to stdout. No Sentry, no OpenTelemetry, no log aggregation, no uptime monitor. When prod 500s at 2am, nobody knows until a customer screenshots Zalo.
**Fix:** Sentry (frontend + backend) — 30 min. UptimeRobot or BetterUptime — 15 min. Optional Grafana Cloud free tier for `pino` logs — 1 day.
**Effort:** 1 day.

### 12. Health check is anaemic
**State:** `/api/health` only pings Postgres. Doesn't check Redis, MinIO, Ollama, APS.
**Fix:** Per-dependency check returning `{ ok: boolean, latencyMs }`. Wire it to UptimeRobot.
**Effort:** 2 hours.

### 13. Org switcher missing
**State:** UI assumes one org. The smoke flow user is in two orgs (`cofico`, `hoa-binh` after seed extension) — no way to switch context in the UI.
**Fix:** Header dropdown reading `Membership[]`, persisting the active org in a cookie, server components reading it.
**Effort:** half-day.

### 14. Backup has no restore drill
**State:** `scripts/backup.sh` exists. Nothing in CI verifies a backup can actually be restored. No offsite copy (S3 cross-region or B2).
**Fix:** Nightly cron via GitHub Actions / docker cron sidecar that pushes to a separate region. Quarterly automated restore-into-staging.
**Effort:** 1 day.

### 15. Status page / "Site Status" module not built
**State:** README claims "Statuspage → Site Status — Public tiến độ for CĐT / shareholders". No code.
**Fix:** Either build a minimal public-facing project status page (CĐT shareholders view), or remove the claim.
**Effort:** 3 days for v1.

### 16. 5 TODOs left in code
**State:** `grep -rn "TODO\|FIXME"` returns 5 — mostly in scraper stubs (#4) but check the rest aren't security holes.
**Fix:** Resolve or ticket each.
**Effort:** half-day audit.

### 17. AI errors aren't surfaced
**State:** When Ollama is down, `aiConfig().enabled` is false and panels hide silently. Customer paying for Pro who expects AI doesn't know why it's not working.
**Fix:** Show "AI offline — đang khôi phục" banner in Settings → AI when health check fails. Don't silently hide the buttons.
**Effort:** 2 hours.

### 18. No cron / background worker
**State:** Scrapers ran once if you manually POST `/api/winwork/tenders/scrape`. Drift snapshots, NPS surveys, recurring tasks, weather refresh, bond expiry warnings — all need scheduling.
**Fix:** Add a small worker process (`apps/worker`) that runs cron jobs. Or use **Inngest** / **Trigger.dev** if you want managed.
**Effort:** 1 day for the worker + 2 hours per recurring job to wire.

### 19. Form errors are unfriendly
**State:** API returns `{ error: parsed.error.flatten() }` — frontend renders the raw structure.
**Fix:** Standard error envelope `{ error: { code, message, fields: { fieldName: "Vietnamese-friendly message" } } }`. Build once, apply across.
**Effort:** half-day.

---

## 🟡 P2 — Long-tail (acceptable pre-PMF, mandatory for enterprise)

20. **Mobile native app** (iOS + Android) — field workers need offline-first + push.
21. **WebSocket / SSE** — real-time chat, notifications, dashboard updates.
22. **Zalo OA real wiring** — schema exists, no actual OA app credentials / webhook receiver.
23. **E-invoice TT 78/2021** — schema exists, no CQT cấp mã integration.
24. **Chữ ký số (VNPT-CA / Viettel-CA)** — schema exists, no real signing pipeline.
25. **MISA / Base / BIM 360 / M365 connectors** — schemas only, no OAuth.
26. **i18n English / Korean** for FDI projects.
27. **WCAG 2.1 AA audit** — never done.
28. **SOC 2 Type I → Type II / ISO 27001** — required for any state-owned enterprise (DNNN) deal.
29. **CDN** for static + image optimization.
30. **OpenAPI / Swagger** — required when partners want to integrate.
31. **Layer 3 Agentic UI** — schema done, dashboard not built. The "agent run history" page is the differentiator vs MISA AVA's chatbot.
32. **Layer 4 Trust UI deepening** — drift snapshot timeline chart, bias audit report, right-to-explanation flow.
33. **Layer 5 VN-Native UIs** — FengShui analyzer, CCCD onboarding scanner, lunar calendar in scheduler.
34. **Layer 6 admin consoles** — Webhook log viewer, ApiKey manager, Connector marketplace.
35. **Layer 7 offline service-worker + voice PWA** — schema there, client work pending.
36. **Layer 8 NPS / Referral flows** — schema there, no in-product survey or referral link UX.

---

## What "shippable" actually means for v1 paid pilot

If the goal is **one paying SME pilot (10–20 seat) within 4 weeks**, the must-haves shrink considerably:

**Week 1**
- P0 #1 secrets, #2 migrations, #3 CI, #7 email, #8 verification, #9 rate-limit
- P1 #11 Sentry, #12 deep health, #19 friendly errors

**Week 2**
- P0 #6 subscription enforcement (Free + Pro only, VNPAY or bank-transfer manual)
- P1 #10 loading/empty/error states everywhere
- P0 #5 APS Forge real wiring

**Week 3**
- P0 #4 muasamcong scraper (Python sidecar) — only one source
- P1 #13 org switcher, #14 backup restore drill, #17 AI offline UX, #18 cron worker

**Week 4**
- P1 #15 site status page (basic public tiến độ)
- QA pass + smoke-flow expanded to cover billing + verification
- Sign first customer

Everything else can land post-PMF.

---

## What's *not* on this list (because it already works)

- ✅ Schema integrity (35+ models, all FK reconcile)
- ✅ Multi-tenant RBAC + audit log on every mutation
- ✅ FSM workflows for RFI / Submittal / NCR / Punch / Change Order / Acceptance / Payment / Bid
- ✅ Compliance engine (9 rules · server-side enforced via FSM guard)
- ✅ Clash detector pure function
- ✅ EVM calc pure function (CPI · SPI · EAC verified by smoke flow)
- ✅ Open-meteo live integration
- ✅ Dossier per NĐ 15/2021 Phụ lục I (idempotent seed)
- ✅ TCVN/QCVN library (10 baseline regs, machine-checkable `check` spec)
- ✅ OSS AI stack (Ollama + faster-whisper + bge-m3) graceful degrade
- ✅ Trust layer model cards public
- ✅ 27/27 end-to-end smoke flow passes
- ✅ Production build clean (58 routes)
- ✅ Typecheck + lint + vitest all green
- ✅ Demo deck + slideshow + DEMO.md storyboard
