import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function DELETE(req: NextRequest, ctx: { params: { bidId: string } | Promise<{ bidId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "winwork.bids.delete" }); if (rl) return rl;
  try {
    const { bidId } = await ctx.params;
    const rec = await prisma.bid.findUnique({ where: { id: bidId }, select: { id: true, orgId: true, state: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    if (!["DRAFT", "ESTIMATING"].includes(rec.state)) return NextResponse.json({ error: `Trạng thái ${rec.state} — không thể xoá` }, { status: 409 });
    // Cascade compliance + documents + bonds
    await prisma.bidComplianceCheck.deleteMany({ where: { bidId } });
    await prisma.bidBond.deleteMany({ where: { bidId } });
    await prisma.bid.delete({ where: { id: bidId } });
    await audit({ action: "winwork.bid.delete", entityType: "Bid", entityId: bidId, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
