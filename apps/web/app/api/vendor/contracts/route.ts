/**
 * POST /api/vendor/contracts — create vendor contract.
 * Either vendorOrgId OR supplierId must be set (poly FK).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  vendorOrgId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  vendorName: z.string().min(2).max(200),
  contractNo: z.string().min(1).max(80),
  type: z.enum(["FRAMEWORK", "SPOT_PO", "ANNUAL", "RAMP_UP"]),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  valueVnd: z.coerce.bigint().optional().nullable(),
  scope: z.string().max(5000).optional(),
  terms: z.string().max(5000).optional(),
  state: z.enum(["DRAFT", "NEGOTIATING", "ACTIVE", "EXPIRED", "TERMINATED"]).default("DRAFT"),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "vendor.contracts.create" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const rec = await prisma.vendorContract.create({
      data: {
        orgId: d.orgId,
        vendorOrgId: d.vendorOrgId || null,
        supplierId: d.supplierId || null,
        vendorName: d.vendorName, contractNo: d.contractNo, type: d.type,
        startDate: new Date(d.startDate),
        endDate: d.endDate ? new Date(d.endDate) : null,
        valueVnd: d.valueVnd ?? null, scope: d.scope, terms: d.terms,
        state: d.state, signedAt: d.state === "ACTIVE" ? new Date() : null,
      },
    });
    await audit({ action: "vendorcontract.create", entityType: "VendorContract", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { contractNo: rec.contractNo, vendor: rec.vendorName, value: rec.valueVnd?.toString() ?? null } });
    return NextResponse.json({
      contract: {
        ...rec,
        valueVnd: rec.valueVnd?.toString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if ((e as any)?.code === "P2002") return NextResponse.json({ error: "Số hợp đồng đã tồn tại" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
