/**
 * POST /api/vendor/credit — log a vendor credit txn (PURCHASE/PAYMENT/RETURN/ADJUST).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  contractId: z.string().optional().nullable(),
  vendorOrgId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  vendorName: z.string().min(2).max(200),
  txnDate: z.string(),
  txnNo: z.string().max(80).optional(),
  type: z.enum(["PURCHASE", "PAYMENT", "RETURN", "ADJUST"]),
  amountVnd: z.coerce.bigint(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "vendor.credit.create" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const rec = await prisma.vendorCreditEntry.create({
      data: {
        orgId: d.orgId,
        contractId: d.contractId || null,
        vendorOrgId: d.vendorOrgId || null,
        supplierId: d.supplierId || null,
        vendorName: d.vendorName,
        txnDate: new Date(d.txnDate),
        txnNo: d.txnNo, type: d.type,
        amountVnd: d.amountVnd, notes: d.notes,
      },
    });
    await audit({ action: "vendorcredit.create", entityType: "VendorCreditEntry", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { type: rec.type, vendor: rec.vendorName, amount: rec.amountVnd.toString() } });
    return NextResponse.json({ entry: rec });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
