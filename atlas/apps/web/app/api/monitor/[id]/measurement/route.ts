// POST /api/monitor/[id]/measurement — Record a measurement; auto-compute alertLevel
// from the point's thresholds. ALERT level auto-creates an NCR Issue.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ value: z.string().regex(/^-?\d+(\.\d+)?$/), notes: z.string().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "monitor.measurement" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const point = await prisma.monitorPoint.findUnique({ where: { id: params.id } });
    if (!point) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(point.projectId);

    const value = Number(parsed.data.value);
    const warn = point.thresholdWarn ? Number(point.thresholdWarn) : null;
    const alert = point.thresholdAlert ? Number(point.thresholdAlert) : null;
    let alertLevel: "NORMAL" | "WARN" | "ALERT" = "NORMAL";
    if (alert !== null && value >= alert) alertLevel = "ALERT";
    else if (warn !== null && value >= warn) alertLevel = "WARN";

    const last = await prisma.monitorMeasurement.findFirst({ where: { pointId: point.id }, orderBy: { measuredAt: "desc" } });
    const rate24h = last ? value - Number(last.value) : 0;

    const m = await prisma.monitorMeasurement.create({
      data: {
        pointId: point.id, measuredAt: new Date(),
        value: parsed.data.value as unknown as never,
        cumulative: parsed.data.value as unknown as never,
        rate24h: String(rate24h) as unknown as never,
        alertLevel, notes: parsed.data.notes ?? null,
      },
    });

    // ALERT → auto-NCR
    if (alertLevel === "ALERT") {
      const project = await prisma.project.findUnique({ where: { id: point.projectId } });
      const count = await prisma.issue.count({ where: { projectId: point.projectId, type: "NCR" } });
      await prisma.issue.create({
        data: {
          projectId: point.projectId, key: `${project?.key ?? "PRJ"}-NCR-${String(count + 1).padStart(3, "0")}`,
          type: "NCR", title: `Quan trắc vượt ngưỡng nguy hiểm: ${point.pointCode}`,
          description: `Điểm ${point.pointCode} đo ${value} ${point.unit} ≥ ngưỡng nguy hiểm ${alert} ${point.unit}.`,
          state: "OPEN", priority: "CRITICAL", reporterId: session.userId,
        },
      }).catch(() => null);
    }

    await audit({ action: "monitor.measurement", entityType: "MonitorMeasurement", entityId: m.id, actorId: session.userId, projectId: point.projectId, ...reqMeta(req), after: { pointCode: point.pointCode, value, alertLevel } });
    return NextResponse.json({ ok: true, id: m.id, alertLevel });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
