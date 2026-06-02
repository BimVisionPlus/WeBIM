import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  name: z.string().min(2).max(120),
  province: z.string().max(80).optional(),
  scope: z.string().max(2000).optional(),
  ownerUserId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "territories.create" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const rec = await prisma.marketTerritory.create({ data: { orgId: d.orgId, name: d.name, province: d.province, scope: d.scope, ownerUserId: d.ownerUserId } });
    await audit({ action: "territory.create", entityType: "MarketTerritory", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { name: rec.name } });
    return NextResponse.json({ territory: rec });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
