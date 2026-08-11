/**
 * GET /api/costpulse/evm/:projectId
 *
 * Returns EVM snapshot computed from the current BoQ + sum of progress
 * payments (treated as actual cost to date for simplicity; production
 * uses accounting integrations).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { computeEvm, severityFromEvm } from "@atlas/lib";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    await requireProject(params.projectId);

    const [boq, payments, project] = await Promise.all([
      prisma.boQ.findFirst({
        where: { projectId: params.projectId, isCurrent: true },
        include: { lines: true },
      }),
      prisma.progressPayment.findMany({
        where: { projectId: params.projectId, state: { in: ["APPROVED", "PAID"] } },
      }),
      prisma.project.findUnique({ where: { id: params.projectId } }),
    ]);

    if (!boq) return NextResponse.json({ evm: null, message: "no BoQ yet" });

    const actualCostVnd = payments.reduce((s, p) => s + p.workDoneVnd, 0n);
    // Schedule % planned — derived from start/end if available
    let plannedPct: number | undefined;
    if (project?.startDate && project.endDate) {
      const now = Date.now();
      const s = project.startDate.getTime();
      const e = project.endDate.getTime();
      plannedPct = e > s ? Math.max(0, Math.min(1, (now - s) / (e - s))) : undefined;
    }

    const evm = computeEvm({
      lines: boq.lines.map((l) => ({
        qty: l.qty,
        qtyCompleted: l.qtyCompleted,
        unitPriceVnd: l.unitPriceVnd,
      })),
      actualCostVnd,
      plannedPctComplete: plannedPct,
    });

    const sev = severityFromEvm(evm);

    return NextResponse.json({
      evm: {
        bac: evm.bac.toString(),
        ev: evm.ev.toString(),
        pv: evm.pv.toString(),
        ac: evm.ac.toString(),
        eac: evm.eac.toString(),
        vac: evm.vac.toString(),
        cv: evm.cv.toString(),
        cpi: evm.cpi,
        spi: evm.spi,
      },
      severity: sev,
      plannedPct,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
