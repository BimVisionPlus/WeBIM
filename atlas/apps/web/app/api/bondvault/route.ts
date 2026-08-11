// POST /api/bondvault — Create ContractBond.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  bondNumber: z.string().min(3).max(64),
  type: z.enum(["BAO_LANH_DU_THAU", "BAO_LANH_THUC_HIEN", "BAO_LANH_TAM_UNG", "BAO_LANH_BAO_HANH"]),
  issuerBank: z.string().min(2).max(120),
  beneficiary: z.string().min(2).max(200),
  amountVnd: z.string().regex(/^\d+$/),
  pctOfContract: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  contractRef: z.string().max(64).optional(),
  contractValueVnd: z.string().regex(/^\d+$/).optional(),
  contractorOrgId: z.string().optional(),
  issuedAt: z.string(),
  effectiveFrom: z.string(),
  expiresAt: z.string(),
  feeVnd: z.string().regex(/^\d+$/).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "bondvault.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const bond = await prisma.contractBond.create({
      data: {
        projectId: d.projectId,
        bondNumber: d.bondNumber, type: d.type, issuerBank: d.issuerBank, beneficiary: d.beneficiary,
        amountVnd: BigInt(d.amountVnd),
        pctOfContract: d.pctOfContract ? (d.pctOfContract as unknown as never) : null,
        contractRef: d.contractRef ?? null,
        contractValueVnd: d.contractValueVnd ? BigInt(d.contractValueVnd) : null,
        contractorOrgId: d.contractorOrgId ?? null,
        issuedAt: new Date(d.issuedAt), effectiveFrom: new Date(d.effectiveFrom), expiresAt: new Date(d.expiresAt),
        feeVnd: d.feeVnd ? BigInt(d.feeVnd) : null,
        status: "ACTIVE",
        notes: d.notes ?? null,
      },
    });
    await audit({ action: "bondvault.create", entityType: "ContractBond", entityId: bond.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { bondNumber: d.bondNumber, type: d.type } });
    return NextResponse.json({ ok: true, id: bond.id, bondNumber: bond.bondNumber });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
