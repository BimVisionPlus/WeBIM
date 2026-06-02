import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  title: z.string().min(2).max(200).optional(),
  body: z.string().min(2).max(20000).optional(),
  pctComplete: z.coerce.number().min(0).max(100).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string; updateId: string } | Promise<{ id: string; updateId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "project.statusupdate.patch" }); if (rl) return rl;
  try {
    const { id, updateId } = await ctx.params;
    const { session } = await requireProject(id);
    const upd = await prisma.projectStatusUpdate.findUnique({ where: { id: updateId } });
    if (!upd || upd.projectId !== id) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.projectStatusUpdate.update({ where: { id: updateId }, data: parsed.data });
    await audit({ action: "project.status.update.patch", entityType: "ProjectStatusUpdate", entityId: updateId, actorId: session.userId, projectId: id, ...reqMeta(req) });
    return NextResponse.json({ update: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string; updateId: string } | Promise<{ id: string; updateId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "project.statusupdate.delete" }); if (rl) return rl;
  try {
    const { id, updateId } = await ctx.params;
    const { session } = await requireProject(id);
    const upd = await prisma.projectStatusUpdate.findUnique({ where: { id: updateId } });
    if (!upd || upd.projectId !== id) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    await prisma.projectStatusUpdate.delete({ where: { id: updateId } });
    await audit({ action: "project.status.update.delete", entityType: "ProjectStatusUpdate", entityId: updateId, actorId: session.userId, projectId: id, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
