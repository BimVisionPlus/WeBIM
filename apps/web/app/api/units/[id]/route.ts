/**
 * PATCH /api/units/[id]  — edit BusinessUnit.
 * DELETE /api/units/[id] — soft-delete (active=false) when projects exist,
 *                          hard-delete otherwise.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  code: z.string().min(1).max(40).regex(/^[A-Za-z0-9\-_.]+$/).optional(),
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  parentId: z.string().optional().nullable(),
  leaderUserId: z.string().optional().nullable(),
  province: z.string().max(80).optional().nullable(),
  active: z.boolean().optional(),
});

async function getOwned(id: string) {
  return prisma.businessUnit.findUnique({ where: { id }, select: { id: true, orgId: true, active: true, code: true, name: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "units.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.businessUnit.update({ where: { id }, data: parsed.data });
    await audit({
      action: "businessunit.update", entityType: "BusinessUnit", entityId: id,
      actorId: session.userId, orgId: rec.orgId, ...reqMeta(req),
      before: { code: rec.code, name: rec.name, active: rec.active },
      after: { code: updated.code, name: updated.name, active: updated.active },
    });
    return NextResponse.json({ unit: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if ((e as any)?.code === "P2002") return NextResponse.json({ error: "Mã đơn vị trùng" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "units.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const projectCount = await prisma.project.count({ where: { businessUnitId: id } });
    const childCount = await prisma.businessUnit.count({ where: { parentId: id } });
    if (projectCount > 0 || childCount > 0) {
      await prisma.businessUnit.update({ where: { id }, data: { active: false } });
      await audit({ action: "businessunit.deactivate", entityType: "BusinessUnit", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), after: { projectCount, childCount, soft: true } });
      return NextResponse.json({ ok: true, soft: true, projectCount, childCount });
    }
    await prisma.businessUnit.delete({ where: { id } });
    await audit({ action: "businessunit.delete", entityType: "BusinessUnit", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
