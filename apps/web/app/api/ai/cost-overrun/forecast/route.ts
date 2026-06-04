/**
 * POST /api/ai/cost-overrun/forecast
 *
 * Body: { projectId, persist?: boolean }
 *
 * Computes EVM, runs AI overrun analysis, optionally persists a
 * CostOverrunSignal when severity ≥ WATCH.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { costOverrunAi } from "@atlas/ai";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ projectId: z.string(), persist: z.boolean().optional() });
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.cost.forecast" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { projectId, persist } = parsed.data;
    const { session } = await requireProject(projectId);

    // Pull BoQ + lines
    const boq = await prisma.boQ.findFirst({ where: { projectId, isCurrent: true } });
    if (!boq) return NextResponse.json({ error: "Dự án chưa có BoQ — không thể chạy forecast" }, { status: 400 });

    const lines = await prisma.boQLine.findMany({ where: { boqId: boq.id }, select: { category: true, totalVnd: true, unitPriceVnd: true, qty: true, qtyCompleted: true } });
    const boqLines = lines.map((l) => ({
      category: l.category ?? "Khác",
      totalVnd: Number(l.totalVnd),
      doneVnd: Number(l.unitPriceVnd) * (l.qtyCompleted ?? 0),
    }));

    // AC = sum paid
    const paid = await prisma.progressPayment.aggregate({
      where: { projectId, state: "PAID" },
      _sum: { workDoneVnd: true },
    });
    const acVnd = Number(paid._sum.workDoneVnd ?? 0);

    // Schedule progress
    const tasks = await prisma.scheduleTask.findMany({ where: { projectId }, select: { pctComplete: true, plannedStart: true, plannedEnd: true, state: true } });
    const scheduleProgressPct = tasks.length ? tasks.reduce((s, t) => s + t.pctComplete, 0) / tasks.length : 0;
    const now = Date.now();
    let expectedSum = 0, expCount = 0;
    for (const t of tasks) {
      const total = t.plannedEnd.getTime() - t.plannedStart.getTime();
      if (total <= 0) continue;
      const elapsed = Math.max(0, Math.min(total, now - t.plannedStart.getTime()));
      expectedSum += (elapsed / total) * 100;
      expCount++;
    }
    const expectedScheduleProgressPct = expCount ? expectedSum / expCount : 0;

    const r = await costOverrunAi.forecastCostOverrun({
      bac: Number(boq.contractValueVnd ?? 0),
      boqLines, acVnd, scheduleProgressPct, expectedScheduleProgressPct,
    });

    if (!r.ok) return NextResponse.json({ error: r.error ?? r.reason }, { status: 500 });
    const d = r.data;

    // Persist signal if requested & severity not ON_TRACK
    let signalId: string | null = null;
    if (persist && d.severity !== "ON_TRACK") {
      const baselineVnd = BigInt(Math.round(d.bac));
      const forecastedVnd = BigInt(Math.round(d.eacTimeAdjusted));
      const sig = await prisma.costOverrunSignal.create({
        data: {
          projectId,
          category: d.topCategories[0]?.category ?? null,
          forecastedVnd, baselineVnd,
          deltaPct: (Number(forecastedVnd - baselineVnd) / Number(baselineVnd)) * 100,
          weeksAhead: Math.max(0, Math.floor((100 - d.cpi * 100) / 5)),
          severity: d.severity === "CRITICAL" ? "CRITICAL" : d.severity === "ELEVATED" ? "ALERT" : "WATCH",
          status: "OPEN",
          evidence: {
            bac: d.bac, ev: d.ev, ac: d.ac, cpi: d.cpi, spi: d.spi,
            eac: d.eac, eacTimeAdjusted: d.eacTimeAdjusted, vac: d.vac, vacPct: d.vacPct,
            drivers: d.drivers, action: d.action,
          } as any,
        },
      });
      signalId = sig.id;
    }

    await audit({
      action: "ai.cost.forecast",
      entityType: "Project", entityId: projectId,
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { severity: d.severity, cpi: d.cpi.toFixed(3), vacPct: d.vacPct.toFixed(1), source: d.source, signalId },
    });

    return NextResponse.json({
      ok: true,
      forecast: {
        ...d,
        // Convert big numbers to formatted strings for client convenience
        bac: d.bac, ev: d.ev, ac: d.ac, eac: d.eac, eacTimeAdjusted: d.eacTimeAdjusted, vac: d.vac,
      },
      signalId,
    });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
