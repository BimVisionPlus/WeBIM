import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "tenderforge.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.tenderPackage.findUnique({ where: { id }, select: { id: true, orgId: true, state: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    if (!["DRAFT", "ARCHIVED"].includes(rec.state)) return NextResponse.json({ error: `Trạng thái ${rec.state} — không thể xoá` }, { status: 409 });
    await prisma.tenderPackage.delete({ where: { id } });
    await audit({ action: "tenderforge.delete", entityType: "TenderPackage", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
