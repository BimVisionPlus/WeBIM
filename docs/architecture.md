# Atlas AEC — Architecture overview

## Monorepo

```
atlas-aec/
├── apps/
│   ├── web/             Main app (Site + Models + Daily Log + AI surfaces) — port 3000
│   └── landing/         Marketing site + /api/waitlist — port 3001
├── packages/
│   ├── db/              Prisma 5 schema + client (PG 16) + seed
│   ├── workflows/       FSMs (RFI, Submittal, NCR, Punch, ChangeOrder, Acceptance, Payment)
│   ├── lib/             S3/MinIO · APS (Forge) · VN utilities · env validator ·
│   │                    structured logger · audit emitter · rate limit · upload
│   │                    validation · transactional email · issue-key generator
│   ├── ai/              OSS-only AI: Ollama (LLM/VLM/embed) + Whisper STT +
│   │                    domain tasks (rfi.classify, daily-log.structure, ncr.assess) +
│   │                    AiSuggestion persistence + health probe
│   └── ui/              Shared React components (Button, Card, Badge)
└── docker-compose.yml   Postgres 16 + MinIO + Redis (+ Ollama + Whisper via --profile ai)
```

## Data model (high-level)

```
                 ┌───────────────┐
                 │ Organization  │  CĐT · TVGS · TVTK · NT_CHINH · NT_PHU · SUPPLIER
                 └───────┬───────┘
            ┌────────────┼─────────────┐
            ▼            ▼             ▼
       Membership  ProjectStakeholder  Invite           ← email-scoped, hashed token
            │           │ (per-project role)
            ▼           ▼
          User    ┌─────────┐         ┌──────────────┐
          │ │     │ Project │ ◄────── │   Account    │  ← OAuth providers
          │ │     └────┬────┘         │   Session    │
          │ │          │              │   *Token     │  ← Auth.js-compatible
          │ │     ┌────┴───────────┬──────────┬─────────┬──────────┐
          │ │     ▼                ▼          ▼         ▼          ▼
          │ │  Issue            DrawingSet  Model   Acceptance  ProgressPayment
          │ │  ├── RFI          └─ Sheet                          (VBHN 06/VBHN-BXD)
          │ │  ├── Submittal       └─ Markup
          │ │  ├── NCR
          │ │  ├── PunchItem    SpecPage (Confluence-style wiki)
          │ │  ├── ChangeOrder
          │ │  └── (TASK | SAFETY)
          │ │
          │ └─► Transition (audit trail per issue)
          │
          └────► AuditEvent      ← immutable cross-cutting audit log
                                   (orgId, projectId, actorId, action, before, after)
```

**Key invariant:** each subtype row (RFI, Submittal, …) holds `issueId` as PK + a denormalized `projectId` for cheap per-project scans (avoids joining through Issue when listing "all NCRs on project X").

## Storage layout (S3 / MinIO buckets)

| Bucket | Used for | Example key |
|---|---|---|
| `models` | Original BIM / CAD files | `VHGP-S9/models/2026-05-18/{uuid}-{file}.nwd` |
| `drawings` | Sheet PDFs + thumbnails | `VHGP-S9/drawings/.../A-201-R3.pdf` |
| `markups` | SVG markups overlaid on sheets | public-read |
| `attachments` | Photos, NCR evidence, BBNT scans | private |

Browser-direct uploads via presigned PUT (`POST /api/upload` → presigned URL → `PUT` to S3 → `POST /api/drawings` to create the row). Worker (TODO) pulls from S3, pushes to APS OSS, submits SVF2 translation.

## State machine architecture

All issue subtypes share the same FSM primitive in [`packages/workflows/src/types.ts`](../packages/workflows/src/types.ts):

```ts
type TransitionDef<S> = {
  from: S;
  to: S;
  action: string;          // verb, e.g. "Trả lời" — shown as button label
  allowedRoles: OrgType[]; // CĐT, TVGS, NT_CHINH, …
  guard?: (actor, payload) => true | string;
  ref?: string;            // statutory citation, e.g. "NĐ 06/2021 Điều 21"
};
```

`canTransition()` runs three gates in order:
1. Transition exists (from→to defined).
2. Actor's `orgRoles` ∩ `allowedRoles` ≠ ∅ (or `isAdmin`).
3. Domain guard validates the payload (e.g. NCR → RECTIFIED requires `photoEvidence[]`).

Each successful move writes a `Transition` row. `/api/issues/transition` is the single mutation endpoint — UI buttons enumerate `nextStates(wf, currentState)` to populate the action menu in the issue detail panel.

## VN regulatory bindings

See [`workflows.md`](./workflows.md) for the per-FSM legal anchors. Cross-cutting:

- **Hồ sơ hoàn công** assembled from `Acceptance.attachments` + signed `Daily Log` chain + `Transition` audit trail.
- **Chữ ký số** captured on `Signoff` rows (`caCertSerial` from VNPT-CA / Viettel-CA endpoints — `packages/lib/src/aps.ts`-shaped client adapters live next door).
- **HĐĐT NĐ 123/2020** stems from `ProgressPayment` rows after `state = APPROVED`.
- **Bảo hành** window enforced by `Project.warrantyMonths` (defaults 24mo NĐ 06/2021).

## Production hardening (in tree)

- `packages/lib/src/env.ts` — Zod-validated env-var loader (fails fast on boot)
- `packages/lib/src/log.ts` — pino structured logger with redaction
- `packages/lib/src/audit.ts` — emits `AuditEvent` rows from mutation paths
- `packages/lib/src/ratelimit.ts` — Redis-backed sliding window
- `packages/lib/src/upload-validation.ts` — magic-byte + size cap before presign
- `packages/lib/src/email.ts` — transactional (waitlist confirm, invite, BBNT signoff request)
- `packages/lib/src/issue-key.ts` — collision-free `{PROJECT_KEY}-{TYPE_PREFIX}-{seq}`
