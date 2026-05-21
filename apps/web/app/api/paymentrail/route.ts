// POST /api/paymentrail — Create a new PaymentApplication (hồ sơ thanh toán).
// Auth: must be member of project owner org or stakeholder.
// Validates: project access, contract value coherence, period format.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  code: z.string().min(3).max(64),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Kỳ phải dạng YYYY-MM"),
  paymentType: z.enum(["TAM_UNG", "GIAI_DOAN", "HOAN_THANH", "QUYET_TOAN"]),
  fundSource: z.enum(["NGAN_SACH", "DOANH_NGHIEP", "FDI", "HON_HOP"]).default("NGAN_SACH"),
  contractorOrgId: z.string().optional(),
  contractRef: z.string().max(64).optional(),
  contractValueVnd: z.string().regex(/^\d+$/).optional(), // BigInt as string
  workDoneVnd: z.string().regex(/^\d+$/),
  cumulativeWorkVnd: z.string().regex(/^\d+$/),
  advanceDeductionVnd: z.string().regex(/^\d+$/).default("0"),
  retentionVnd: z.string().regex(/^\d+$/).default("0"),
  vatRate: z.number().int().min(0).max(20).default(8),
  acceptanceIds: z.array(z.string()).default([]),
  changeOrderIds: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "paymentrail.create" });
  if (rl) return rl;

  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    // Compute VAT + net payable server-side (don't trust client).
    const workDone = BigInt(d.workDoneVnd);
    const retention = BigInt(d.retentionVnd);
    const advDed = BigInt(d.advanceDeductionVnd);
    const vat = (workDone * BigInt(d.vatRate)) / 100n;
    const netPayable = workDone - retention - advDed + vat;

    const app = await prisma.paymentApplication.create({
      data: {
        projectId: d.projectId,
        code: d.code,
        period: d.period,
        paymentType: d.paymentType,
        fundSource: d.fundSource,
        contractorOrgId: d.contractorOrgId ?? null,
        contractRef: d.contractRef ?? null,
        contractValueVnd: d.contractValueVnd ? BigInt(d.contractValueVnd) : null,
        workDoneVnd: workDone,
        cumulativeWorkVnd: BigInt(d.cumulativeWorkVnd),
        advanceDeductionVnd: advDed,
        retentionVnd: retention,
        vatRate: d.vatRate,
        vatVnd: vat,
        netPayableVnd: netPayable,
        acceptanceIds: d.acceptanceIds,
        changeOrderIds: d.changeOrderIds,
        attachmentIds: [],
        state: "DRAFT",
        notes: d.notes ?? null,
      },
    });

    await audit({
      action: "paymentrail.create",
      entityType: "PaymentApplication",
      entityId: app.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { code: d.code, period: d.period, netPayableVnd: netPayable.toString() },
    });

    return NextResponse.json({ ok: true, id: app.id, code: app.code, netPayableVnd: netPayable.toString() });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
