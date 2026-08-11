import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "docchat.corpus.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const rec = await prisma.docCorpus.findUnique({ where: { id }, select: { id: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    await prisma.docCorpus.delete({ where: { id } });
    await audit({ action: "docchat.corpus.delete", entityType: "DocCorpus", entityId: id, actorId: session.userId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
