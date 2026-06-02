import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(300).optional(),
  discipline: z.string().max(80).optional().nullable(),
  zone: z.string().max(120).optional().nullable(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  pctComplete: z.coerce.number().min(0).max(100).optional(),
  state: z.enum(["PLANNED", "IN_PROGRESS", "ON_HOLD", "DONE", "CANCELLED"]).optional(),
  isCritical: z.coerce.boolean().optional(),
});

async function getOwned(id: string) {
  return prisma.scheduleTask.findUnique({ where: { id }, select: { id: true, projectId: true, state: true, pctComplete: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "schedule.task.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.scheduleTask.update({
      where: { id },
      data: { ...d, plannedStart: d.plannedStart ? new Date(d.plannedStart) : undefined, plannedEnd: d.plannedEnd ? new Date(d.plannedEnd) : undefined },
    });
    await audit({ action: "schedule.task.update", entityType: "ScheduleTask", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), before: { state: rec.state, pct: rec.pctComplete }, after: { state: updated.state, pct: updated.pctComplete } });
    return NextResponse.json({ task: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "schedule.task.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    // Cascade deps
    await prisma.scheduleDependency.deleteMany({ where: { OR: [{ predecessorId: id }, { successorId: id }] } });
    await prisma.scheduleTask.delete({ where: { id } });
    await audit({ action: "schedule.task.delete", entityType: "ScheduleTask", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
