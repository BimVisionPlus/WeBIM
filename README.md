# Atlas AEC

> Atlassian suite, re-skinned for Architecture · Engineering · Construction. Grounded in Vietnamese building law.

**The pitch.** Procore costs ~120tr/tháng for a 50-seat firm in VN and speaks English. Excel + Zalo costs 0đ and breaks every audit. Atlas AEC is the Atlassian-style workspace that PMs in VN already understand — re-imagined with AEC primitives (RFI, Submittal, NCR, Punch, Daily Log, BIM viewer, BBNT) and wired to NĐ 06/2021 / NĐ 10/2021 / NĐ 123/2020 out of the box.

## Module map (Atlassian → Atlas AEC)

| Atlassian | Atlas AEC | Domain primitives |
|---|---|---|
| Jira | **Site** | RFI · Submittal · NCR · Punch · Change Order · Daily Log |
| Confluence | **Specs** | Project wiki · hồ sơ thiết kế · TCVN/QCVN refs |
| Bitbucket | **Models** | IFC/RVT/NWD/DWG version control + Autodesk Forge Viewer |
| Trello | **Crews** | Daily look-ahead, tổ đội thi công kanban |
| Compass | **Catalog** | Cấu kiện · vật liệu · supplier registry |
| Jira Service Mgmt | **Handover** | Post-handover warranty desk (12/24/60 tháng) |
| Jira Align | **Portfolio** | Multi-project · EVM · S-curve |
| Statuspage | **Site Status** | Public tiến độ for CĐT / shareholders |

## Quick start

```bash
# 1. Infra (Postgres + MinIO + Redis)
cp .env.example .env
# Edit .env — set AUTH_SECRET=$(openssl rand -base64 32)
pnpm infra:up

# 2. Install + migrate + seed
pnpm install
pnpm db:generate
pnpm db:push          # apply schema (incl. NextAuth + Invite + AuditEvent + AiSuggestion)
pnpm db:seed          # demo: Vinhomes Grand Park S9 + Cofico + Apave + AA Corp

# 3. (Optional) Boot the AI stack — Ollama + Whisper, OSS-only
pnpm ai:up            # ~10GB model weights on first boot
# Check status anytime at http://localhost:3000/settings/ai

# 4. Run both apps in parallel
pnpm dev
# → web:     http://localhost:3000   (login required)
# → landing: http://localhost:3001
```

First time, demo path: hit http://localhost:3000 → sign in with `anh.nguyen@cofico.vn` / `demo1234!` → "Vinhomes Grand Park — Lô S9" → Issues → `VHGP-S9-RFI-001` → see the AI suggestion panel ready. (Or sign up + create your own org.)

For the BIM viewer to render uploaded models, set `APS_CLIENT_ID` and `APS_CLIENT_SECRET` (register a free 2-legged app at https://aps.autodesk.com/). Without them, model uploads still succeed but `apsTranslationStatus` stays `PENDING`.

## Tests

```bash
pnpm test              # vitest — workflow state-machine unit tests
pnpm test:e2e          # playwright — signup → org → project → RFI happy path
```

## Deploy

See [`docs/DEPLOY.md`](./docs/DEPLOY.md) for the full self-host runbook (Docker, CI, backups, TLS, security checklist, RTO/RPO).

## Monorepo layout

```
atlas-aec/
├── apps/
│   ├── web/             Next.js — Site + Models + AI surfaces
│   └── landing/         Marketing site + waitlist
├── packages/
│   ├── db/              Prisma schema + client + seed
│   ├── workflows/       FSMs for RFI, Submittal, NCR, Punch, ChangeOrder, Acceptance, Payment
│   ├── lib/             S3/MinIO, Autodesk APS, VN utilities (VND, MST, BBNT helpers)
│   ├── ai/              OSS adapters: Ollama (LLM/VLM/embed) + Whisper + per-domain tasks
│   └── ui/              Shared components (Button, Card, Badge)
└── docker-compose.yml   Postgres 16 + MinIO + Redis  (+ Ollama + Whisper via --profile ai)
```

## State machines (where the VN regulatory work lives)

Every issue subtype has its own FSM in `packages/workflows/src/`. Each transition declares:

- `allowedRoles` — which org-type (CĐT, TVGS, NT_CHINH, …) can perform it
- `guard` — runtime validation (e.g. NCR → RECTIFIED requires photo evidence)
- `ref` — statutory citation rendered in the UI, e.g. "NĐ 06/2021 Điều 21"

See [`docs/workflows.md`](./docs/workflows.md) for the diagrams + legal anchors.

## What's in v1 (pilot-ready)

- ✅ **Auth:** email+password, brute-force lockout, password reset, NextAuth sessions
- ✅ **Multi-tenant RBAC:** Organization · Membership · ProjectStakeholder · per-route tenant guard
- ✅ **Audit log:** immutable `AuditEvent` on every mutation (NĐ 06/2021 compliance posture)
- ✅ **Onboarding:** signup → create org → invite team → create project
- ✅ **Site module:** Issues + RFI/Submittal/NCR/Punch/Change Order/Daily Log with workflow-guarded transitions
- ✅ **Models module:** presigned upload + APS translation pipeline + Forge Viewer
- ✅ **Daily Log** (NĐ 06/2021 Điều 10) — with 🎙 voice-to-form (OSS whisper + LLM)
- ✅ **RFI AI assist:** auto classify + draft answer on create, "Áp dụng" copies into reply (OSS Qwen 2.5)
- ✅ **AI stack:** Ollama (LLM + VLM + embed) + faster-whisper, 100% self-host, see [`docs/ai.md`](./docs/ai.md)
- ✅ **Landing + waitlist** (rate-limited, confirmation email)
- ✅ **Legal:** VN ToS + Privacy (NĐ 13/2023) + user data export (`GET /api/me/export`)
- ✅ **Production:** env validation, rate limit (Redis + memory fallback), structured logging (pino), security headers, HTTPS enforcement, Dockerfile + GH Actions CI + backup script + DEPLOY.md

## AEC Platform — 8-layer architecture (added v2)

| Layer | Module / Surface | Status |
|---|---|---|
| **1.1 WinWork** | Tender scraper (muasamcong/dauthau.asia), Bid FSM, BidBond, Luật ĐT 22/2023 compliance engine | ✅ schema + API + UI + seed |
| **1.2 CodeGuard** | Regulation library (TCVN/QCVN/NĐ baseline), CodeRule + finding, NĐ 15/2021 dossier | ✅ schema + API + UI + seed |
| **1.3 DrawBridge** | ModelElement, Clash (AABB detector), IssueElementLink | ✅ schema + API + UI |
| **1.4 SiteEye** | PPE detection (Qwen2.5-VL), open-meteo weather alert, IncidentReport | ✅ schema + API + UI |
| **1.5 CostPulse** | BoQ + EVM (CPI/SPI/EAC), MaterialPriceIndex, ProgressPayment, OverrunSignal | ✅ schema + API + UI |
| **1.6 ProjectPulse** | Cross-project portfolio + 5-dim risk heatmap + profitability | ✅ UI at `/portfolio` |
| **2 Backbone** | WorkflowTemplate (DAG), RecurringTask, ChatChannel/Message, SlaBreach | ✅ schema |
| **3 Agentic** | Agent + AgentRun + AgentMemory (goal → plan → execute → tier escalation) | ✅ schema |
| **4 MLOps / Trust** | ModelCard, AiCitation, ExplanationRequest, DriftSnapshot (Lyapunov-style), DataLineage, BiasAudit, AiCostEvent | ✅ schema + `/trust` page + seeded cards |
| **5 VN-Native** | ZaloIdentity, OutboundMessage (Zalo/SMS/WhatsApp), EInvoice (TT 78/2021), FengShuiAnalysis, IdCardScan, LunarEvent | ✅ schema |
| **6 Integrations** | ApiKey, Webhook + delivery log, Connector (MISA/Base/BIM360/M365) | ✅ schema |
| **7 UX/Mobile** | DevicePushToken, OfflineSyncOp queue | ✅ schema |
| **8 GTM** | Plan, Subscription, NpsResponse, Referral, TemplateListing | ✅ schema + `/pricing` page + 4 seeded plans |

The above are **shippable scaffolds**: every module typechecks clean and has the schema + the most user-visible surface live. UI for P1/P2/P3 features in the master spec is incrementally added.

## Tech

Next.js 14 (App Router) · Prisma + Postgres 16 · S3 / MinIO · Autodesk Platform Services (Forge) · **Ollama + faster-whisper (OSS AI, self-host)** · pnpm workspaces + Turborepo · Tailwind · Zod · TypeScript end-to-end.
