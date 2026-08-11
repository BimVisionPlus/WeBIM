// PATCH /api/materialtrace/[id] — Accept / Reject / Mark used.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["ACCEPT", "REJECT", "TEST", "USE_PARTIAL", "USE_UP"]),
  reason: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "materialtrace.update" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const lot = await prisma.materialLot.findUnique({ where: { params } as never }).catch(() => null);
    const actual = await prisma.materialLot.findUnique({ where: { id: params.id } });
    if (!actual) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(actual.projectId);
    const now = new Date();
    const update: Record<string, unknown> = {};
    if (parsed.data.action === "ACCEPT") { update.state = "ACCEPTED"; update.acceptedAt = now; update.acceptedByUserId = session.userId; }
    if (parsed.data.action === "REJECT") { update.state = "REJECTED"; update.rejectedReason = parsed.data.reason ?? "Không đạt"; }
    if (parsed.data.action === "TEST") { update.state = "TESTING"; }
    if (parsed.data.action === "USE_PARTIAL") { update.state = "PARTIAL_USED"; }
    if (parsed.data.action === "USE_UP") { update.state = "USED_UP"; }
    await prisma.materialLot.update({ where: { id: params.id }, data: update });
    await audit({ action: `materialtrace.${parsed.data.action.toLowerCase()}`, entityType: "MaterialLot", entityId: params.id, actorId: session.userId, projectId: actual.projectId, ...reqMeta(req), after: { state: update.state } });
    void lot;
    return NextResponse.json({ ok: true, state: update.state });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "materialtrace.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.materialLot.findUnique({ where: { id }, select: { id: true, projectId: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const labCount = await prisma.labReport.count({ where: { materialLotId: id } });
    if (labCount > 0) return NextResponse.json({ error: `Có ${labCount} báo cáo LAS gắn lô — không thể xoá` }, { status: 409 });
    await prisma.materialLot.delete({ where: { id } });
    await audit({ action: "materialtrace.delete", entityType: "MaterialLot", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "internal" }, { status: e.status ?? 500 });
  }
}
