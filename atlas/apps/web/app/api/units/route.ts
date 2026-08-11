/**
 * POST /api/units — create BusinessUnit (Đơn vị).
 *
 * Body: { orgId, code, name, description?, parentId?, leaderUserId?, province? }
 * Auth: requireOrgMember(orgId).
 * Audit: businessunit.create.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  code: z.string().min(1).max(40).regex(/^[A-Za-z0-9\-_.]+$/, "Mã chỉ chấp nhận chữ/số/-_."),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  parentId: z.string().optional(),
  leaderUserId: z.string().optional(),
  province: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "units.create" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const rec = await prisma.businessUnit.create({
      data: {
        orgId: d.orgId, code: d.code, name: d.name, description: d.description ?? null,
        parentId: d.parentId ?? null, leaderUserId: d.leaderUserId ?? null, province: d.province ?? null,
      },
    });
    await audit({ action: "businessunit.create", entityType: "BusinessUnit", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { code: rec.code, name: rec.name } });
    return NextResponse.json({ unit: rec });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if ((e as any)?.code === "P2002") return NextResponse.json({ error: "Mã đơn vị đã tồn tại trong tổ chức" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
