// POST /api/monitor — Create a MonitorPoint.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  pointCode: z.string().min(2).max(40),
  monitorType: z.enum(["SETTLEMENT", "TILT", "PIEZOMETER", "STRAIN", "CRACK", "VIBRATION", "TEMPERATURE"]),
  description: z.string().max(300).optional(),
  unit: z.string().min(1).max(20),
  thresholdWarn: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  thresholdAlert: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "monitor.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const point = await prisma.monitorPoint.create({
      data: {
        projectId: d.projectId, pointCode: d.pointCode, monitorType: d.monitorType,
        description: d.description ?? null, unit: d.unit,
        thresholdWarn: d.thresholdWarn ? (d.thresholdWarn as unknown as never) : null,
        thresholdAlert: d.thresholdAlert ? (d.thresholdAlert as unknown as never) : null,
        installedAt: new Date(), active: true,
      },
    });
    await audit({ action: "monitor.create", entityType: "MonitorPoint", entityId: point.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { pointCode: d.pointCode } });
    return NextResponse.json({ ok: true, id: point.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
