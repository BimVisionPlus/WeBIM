import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  status: z.enum(["OPEN", "TRIAGED", "RESOLVED", "IGNORED"]).optional(),
  description: z.string().max(5000).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "clashes.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.clash.findUnique({ where: { id }, select: { id: true, projectId: true, status: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.clash.update({ where: { id }, data: parsed.data });
    await audit({ action: "clash.update", entityType: "Clash", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), before: { status: rec.status }, after: { status: updated.status } });
    return NextResponse.json({ clash: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "clashes.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.clash.findUnique({ where: { id }, select: { id: true, projectId: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    await prisma.clash.delete({ where: { id } });
    await audit({ action: "clash.delete", entityType: "Clash", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
