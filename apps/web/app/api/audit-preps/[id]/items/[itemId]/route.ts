/**
 * PATCH /api/audit-preps/[id]/items/[itemId] — update an item state/notes.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  state: z.enum(["PENDING", "IN_PROGRESS", "READY", "NOT_APPLICABLE", "FAILED"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  evidenceUrl: z.string().optional().nullable(),
  signedByName: z.string().max(200).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string; itemId: string } | Promise<{ id: string; itemId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "auditprep.item.patch" }); if (rl) return rl;
  try {
    const { id, itemId } = await ctx.params;
    const item = await prisma.auditPrepItem.findUnique({ where: { id: itemId }, include: { prep: { select: { projectId: true } } } });
    if (!item || item.prepId !== id) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(item.prep.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data: any = { ...parsed.data };
    if (data.state === "READY") {
      data.signedAt = new Date();
      data.signedByName = data.signedByName ?? "Người dùng hiện tại";
    }
    const updated = await prisma.auditPrepItem.update({ where: { id: itemId }, data });
    await audit({ action: "auditprep.item.update", entityType: "AuditPrepItem", entityId: itemId, actorId: session.userId, projectId: item.prep.projectId, ...reqMeta(req), before: { state: item.state }, after: { state: updated.state } });
    return NextResponse.json({ item: updated });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
