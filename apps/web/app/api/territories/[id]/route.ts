import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(120).optional(),
  province: z.string().max(80).optional().nullable(),
  scope: z.string().max(2000).optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

async function getOwned(id: string) {
  return prisma.marketTerritory.findUnique({ where: { id }, select: { id: true, orgId: true, active: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "territories.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.marketTerritory.update({ where: { id }, data: parsed.data });
    await audit({ action: "territory.update", entityType: "MarketTerritory", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { active: rec.active }, after: { active: updated.active } });
    return NextResponse.json({ territory: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// Territory uses soft delete via `active = false` because ProjectLead.territoryId
// FK requires the territory to survive even if archived. Hard delete only when no leads.
export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "territories.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const leadCount = await prisma.projectLead.count({ where: { territoryId: id } });
    if (leadCount > 0) {
      // Soft delete — preserve FK integrity
      await prisma.marketTerritory.update({ where: { id }, data: { active: false } });
      await audit({ action: "territory.deactivate", entityType: "MarketTerritory", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), after: { leadCount, soft: true } });
      return NextResponse.json({ ok: true, soft: true, leadCount });
    }
    await prisma.marketTerritory.delete({ where: { id } });
    await audit({ action: "territory.delete", entityType: "MarketTerritory", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
