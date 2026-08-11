# Security audit — 5 new POST routes (modules 02–05)

Date: 2026-06-05
Auditor: Claude Opus 4.7
Scope: routes added in commits `5261aaf` (Vendor) · `654e3c9` (Cost) · `fbe942b` (Compliance) · `b477ad3` (Field)

## Findings

| # | Route | Severity | Issue | Status |
|---|---|---|---|---|
| **1** | `POST /api/field/checkin` | **HIGH** | Missing `requireProject(projectId)` — any signed-in user could create Attendance row on a project from a different org | **PATCH provided below** |
| 2 | `POST /api/audit-preps` | LOW | `Body.safeParse` runs before `requireSession` — anon caller gets 400 (schema validation) instead of 401 | Patch optional |
| 3 | `POST /api/ai/cost-overrun/forecast` | LOW | Same as #2 | Patch optional |
| 4 | `POST /api/ai/compliance/check` | LOW | Same as #2 | Patch optional |

The 3 LOW findings are the same pattern previously fixed for the 6 mini-module routes in commit `60d28e1`. Same fix applies here.

## Routes verified clean

- `POST /api/vendor/contracts` ✅ requireSession → safeParse → requireOrgMember(d.orgId)
- `PATCH/DELETE /api/vendor/contracts/[id]` ✅ getOwned → requireOrgMember(rec.orgId) — caller never sees data they don't own
- `POST /api/vendor/credit` ✅ same pattern as contracts POST
- `PATCH /api/audit-preps/[id]/items/[itemId]` ✅ fetches item → requireProject(item.prep.projectId)
- `POST /api/ai/field/voice-form` ✅ requireSession + no DB write
- `GET /api/cost-norm/search` ✅ requireSession
- `POST /api/cost-norm/estimate` ✅ requireSession before safeParse

---

## Finding #1 — HIGH — Field check-in cross-project privilege escalation

### Vulnerability

In `apps/web/app/api/field/checkin/route.ts`:

```ts
const session = await requireSession();
const parsed = Body.safeParse(...)
// ...
const projectId = d.projectId ?? worker.projectId
// ...
const att = await prisma.attendance.create({
  data: { workerId: worker.id, projectId, ... }
});
```

The route accepts an arbitrary `projectId` in the request body and writes
to `Attendance` without verifying the caller has access to that project.
A signed-in user from Cofico could create attendance records on a
Vinhomes project, polluting their attendance ledger.

### Attack path

```
# Cofico user with valid session
curl -b $JAR -X POST https://app.aecplatform.vn/api/field/checkin \
  -d '{"projectId":"<vinhomes-only-project-id>","lat":21,"lon":105,"mode":"in"}'
# → HTTP 200, Attendance row created on the wrong project
```

### Fix

Add `requireProject(projectId)` after we know what project we're acting on. This validates the caller is a member of an org that participates in the project (or is super-admin).

Patched file is provided as a follow-up commit; the relevant diff:

```ts
- const session = await requireSession();
+ const session = await requireSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // ... resolve worker ...

  const projectId = d.projectId ?? worker.projectId;
  if (!projectId) return NextResponse.json({ error: "..." }, { status: 400 });

+ // CRITICAL: verify caller has access to this project before any write.
+ await requireProject(projectId);
```

### Impact

Low actual exposure on the demo platform (only 1 org actively used), but
HIGH severity for multi-tenant production. Should land before any
customer onboarding.

---

## Findings #2-4 — LOW — Body parse before session check

Same pattern as the 6 mini-module routes fixed in commit `60d28e1`. The
fix is to add `await requireSession()` as the first line inside the
`try {}` block, before `Body.safeParse`.

Files to patch:
- `apps/web/app/api/audit-preps/route.ts`
- `apps/web/app/api/ai/cost-overrun/forecast/route.ts`
- `apps/web/app/api/ai/compliance/check/route.ts`

Each gets a one-liner inserted near the top of the try block.

Impact: very minor — leaks schema to anonymous callers (they can learn
that the body should be `{ projectId: string }`). Not a privilege issue.

---

## Recommendations

1. **Land Finding #1 patch immediately** (before any prod multi-tenant rollout).
2. **Land Findings #2-4 patches in the next defensive sweep** (low priority).
3. **Add E2E test** that confirms cross-project Attendance creation returns 403
   (covered in `e2e/atlas-suite.spec.ts` once Finding #1 is patched).
4. **Consider** standardising the "session-then-parse" pattern across all
   new routes via a small helper:
   ```ts
   export async function withAuth<T>(req: NextRequest, fn: (session, body: T) => Promise<NextResponse>, schema: ZodType<T>) { ... }
   ```
