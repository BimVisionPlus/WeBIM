import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  contractNo: z.string().max(80).optional(),
  totalValueVnd: z.coerce.bigint().optional(),
  invoicedVnd: z.coerce.bigint().optional(),
  paidVnd: z.coerce.bigint().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "consult.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.consultantContract.findUnique({ where: { id }, select: { id: true, orgId: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.consultantContract.update({ where: { id }, data: parsed.data });
    await audit({ action: "consult.update", entityType: "ConsultantContract", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ contract: { ...updated, totalValueVnd: updated.totalValueVnd.toString(), invoicedVnd: updated.invoicedVnd.toString(), paidVnd: updated.paidVnd.toString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "consult.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await prisma.consultantContract.findUnique({ where: { id }, select: { id: true, orgId: true, paidVnd: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    if (Number(rec.paidVnd) > 0) return NextResponse.json({ error: "Đã thanh toán — không thể xoá" }, { status: 409 });
    await prisma.consultantContract.delete({ where: { id } });
    await audit({ action: "consult.delete", entityType: "ConsultantContract", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
