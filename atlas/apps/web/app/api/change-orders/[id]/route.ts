import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  reason: z.string().max(20000).optional(),
  scopeChange: z.string().max(20000).optional(),
  costDeltaVnd: z.coerce.bigint().optional(),
  scheduleDeltaDays: z.coerce.number().int().optional(),
});

async function getOwned(issueId: string) {
  return prisma.changeOrder.findUnique({
    where: { issueId },
    include: { issue: { select: { id: true, projectId: true } } },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "change-orders.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (rec.approvedAt) return NextResponse.json({ error: "Đã duyệt — không thể sửa" }, { status: 409 });
    const { session } = await requireProject(rec.issue.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.changeOrder.update({ where: { issueId: id }, data: parsed.data });
    await audit({ action: "changeorder.update", entityType: "ChangeOrder", entityId: id, actorId: session.userId, projectId: rec.issue.projectId, ...reqMeta(req) });
    return NextResponse.json({ co: { ...updated, costDeltaVnd: updated.costDeltaVnd.toString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "change-orders.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (rec.approvedAt) return NextResponse.json({ error: "Đã duyệt — không thể xoá" }, { status: 409 });
    const { session } = await requireProject(rec.issue.projectId);
    // Cascade: deleting the parent Issue cascades to ChangeOrder.
    await prisma.issue.delete({ where: { id } });
    await audit({ action: "changeorder.delete", entityType: "ChangeOrder", entityId: id, actorId: session.userId, projectId: rec.issue.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
