import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "hoancong.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.hoanCongDossier.findUnique({ where: { id }, select: { id: true, projectId: true, state: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    if (rec.state === "ACCEPTED") return NextResponse.json({ error: "Đã chấp nhận — không thể xoá" }, { status: 409 });
    await prisma.hoanCongDossier.delete({ where: { id } });
    await audit({ action: "hoancong.delete", entityType: "HoanCongDossier", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
