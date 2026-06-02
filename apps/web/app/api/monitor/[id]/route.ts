import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  pointCode: z.string().min(1).max(40).optional(),
  description: z.string().max(2000).optional().nullable(),
  installedAt: z.string().optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.monitorPoint.findUnique({ where: { id }, select: { id: true, projectId: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "monitor.point.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.monitorPoint.update({
      where: { id },
      data: { ...d, installedAt: d.installedAt ? new Date(d.installedAt) : (d.installedAt === null ? null : undefined) },
    });
    await audit({ action: "monitor.point.update", entityType: "MonitorPoint", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ point: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "monitor.point.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    // Cascade monitor measurements + alerts
    await prisma.monitorMeasurement.deleteMany({ where: { pointId: id } });
    await prisma.monitorPoint.delete({ where: { id } });
    await audit({ action: "monitor.point.delete", entityType: "MonitorPoint", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
