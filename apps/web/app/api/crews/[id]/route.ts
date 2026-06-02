import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(120).optional(),
  trade: z.string().max(80).optional(),
  foremanName: z.string().max(120).optional().nullable(),
  headcount: z.coerce.number().int().min(0).max(500).optional(),
  active: z.boolean().optional(),
});

async function getOwned(id: string) {
  return prisma.crew.findUnique({ where: { id }, select: { id: true, projectId: true, active: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "crews.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.crew.update({ where: { id }, data: parsed.data });
    await audit({ action: "crew.update", entityType: "Crew", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), before: { active: rec.active }, after: { active: updated.active } });
    return NextResponse.json({ crew: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "crews.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const assignCount = await prisma.crewAssignment.count({ where: { crewId: id } });
    if (assignCount > 0) {
      await prisma.crew.update({ where: { id }, data: { active: false } });
      await audit({ action: "crew.deactivate", entityType: "Crew", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), after: { assignCount, soft: true } });
      return NextResponse.json({ ok: true, soft: true, assignCount });
    }
    await prisma.crew.delete({ where: { id } });
    await audit({ action: "crew.delete", entityType: "Crew", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
