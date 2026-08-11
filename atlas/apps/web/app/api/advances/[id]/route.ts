import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  txnNo: z.string().max(80).optional().nullable(),
  payeeName: z.string().min(2).max(200).optional(),
  amountVnd: z.coerce.bigint().optional(),
  purpose: z.string().min(2).max(500).optional(),
  txnDate: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "SETTLED", "CANCELLED"]).optional(),
  note: z.string().max(2000).optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.advanceTransaction.findUnique({ where: { id }, select: { id: true, orgId: true, status: true, type: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "advances.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.advanceTransaction.update({
      where: { id },
      data: { ...d, txnDate: d.txnDate ? new Date(d.txnDate) : undefined },
    });
    await audit({ action: "advance.update", entityType: "AdvanceTransaction", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { status: rec.status }, after: { status: updated.status } });
    return NextResponse.json({ txn: { ...updated, amountVnd: updated.amountVnd.toString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "advances.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    // Block delete if child returns exist (referential safety)
    const childCount = await prisma.advanceTransaction.count({ where: { parentTxnId: id } });
    if (childCount > 0) return NextResponse.json({ error: `Có ${childCount} giao dịch hoàn ứng liên kết — không thể xoá` }, { status: 409 });
    await prisma.advanceTransaction.delete({ where: { id } });
    await audit({ action: "advance.delete", entityType: "AdvanceTransaction", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
