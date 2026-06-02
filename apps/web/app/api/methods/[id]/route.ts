import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "methods.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.methodStatement.findUnique({ where: { id }, select: { id: true, projectId: true, state: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    let session;
    if (rec.projectId) ({ session } = await requireProject(rec.projectId));
    else session = await requireSession();
    if (rec.state === "APPROVED") return NextResponse.json({ error: "Đã duyệt — không thể xoá" }, { status: 409 });
    await prisma.methodStatement.delete({ where: { id } });
    await audit({ action: "methods.delete", entityType: "MethodStatement", entityId: id, actorId: session.userId, projectId: rec.projectId ?? undefined, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
