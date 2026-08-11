import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  vendorName: z.string().min(2).max(200).optional(),
  contractNo: z.string().min(1).max(80).optional(),
  type: z.enum(["FRAMEWORK", "SPOT_PO", "ANNUAL", "RAMP_UP"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  valueVnd: z.coerce.bigint().optional().nullable(),
  scope: z.string().max(5000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  state: z.enum(["DRAFT", "NEGOTIATING", "ACTIVE", "EXPIRED", "TERMINATED"]).optional(),
});

async function getOwned(id: string) {
  return prisma.vendorContract.findUnique({ where: { id }, select: { id: true, orgId: true, state: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "vendor.contracts.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data: any = { ...parsed.data };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) data.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.state === "ACTIVE" && rec.state !== "ACTIVE") data.signedAt = new Date();
    const updated = await prisma.vendorContract.update({ where: { id }, data });
    await audit({ action: "vendorcontract.update", entityType: "VendorContract", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { state: rec.state }, after: { state: updated.state } });
    return NextResponse.json({ contract: { ...updated, valueVnd: updated.valueVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if ((e as any)?.code === "P2002") return NextResponse.json({ error: "Số hợp đồng trùng" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "vendor.contracts.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const credit = await prisma.vendorCreditEntry.count({ where: { contractId: id } });
    if (credit > 0) {
      await prisma.vendorContract.update({ where: { id }, data: { state: "TERMINATED" } });
      await audit({ action: "vendorcontract.terminate", entityType: "VendorContract", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), after: { credit, soft: true } });
      return NextResponse.json({ ok: true, soft: true, credit });
    }
    await prisma.vendorContract.delete({ where: { id } });
    await audit({ action: "vendorcontract.delete", entityType: "VendorContract", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
