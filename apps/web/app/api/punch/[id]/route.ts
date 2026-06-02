import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  trade: z.string().max(80).optional(),
  zone: z.string().max(120).optional(),
  photoBeforeUrl: z.string().max(500).optional().nullable(),
  photoAfterUrl: z.string().max(500).optional().nullable(),
  acceptedAt: z.string().optional().nullable(),
});

async function getOwned(issueId: string) {
  return prisma.punchItem.findUnique({ where: { issueId }, include: { issue: { select: { id: true, projectId: true } } } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "punch.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.issue.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.punchItem.update({
      where: { issueId: id },
      data: { ...d, acceptedAt: d.acceptedAt ? new Date(d.acceptedAt) : (d.acceptedAt === null ? null : undefined) },
    });
    await audit({ action: "punch.update", entityType: "PunchItem", entityId: id, actorId: session.userId, projectId: rec.issue.projectId, ...reqMeta(req) });
    return NextResponse.json({ item: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "punch.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.issue.projectId);
    if (rec.acceptedAt) return NextResponse.json({ error: "Đã nghiệm thu — không thể xoá" }, { status: 409 });
    // Cascade via parent Issue
    await prisma.issue.delete({ where: { id } });
    await audit({ action: "punch.delete", entityType: "PunchItem", entityId: id, actorId: session.userId, projectId: rec.issue.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
