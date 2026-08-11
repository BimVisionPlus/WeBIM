/**
 * POST /api/field/checkin
 *
 * Body: { workerCode?, lat, lon, accuracy?, gateCode?, mode?: "in"|"out" }
 *
 * Resolves SiteWorker by code OR by current user's first project assignment,
 * creates Attendance row. Records GPS even if no project geo-fence configured.
 * Mode "in" = new Attendance; "out" = updates the latest open Attendance with
 * checkOutAt.
 *
 * SECURITY: requireProject(projectId) validates the caller belongs to an
 * organization that participates in the target project, preventing
 * cross-project Attendance pollution.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  workerCode: z.string().optional(),
  workerId: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  accuracy: z.number().optional(),
  gateCode: z.string().optional(),
  projectId: z.string().optional(),
  mode: z.enum(["in", "out"]).default("in"),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "field.checkin" }); if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    // Resolve worker — prefer explicit ID, then code, then first match for the session user's org.
    let worker = null as null | { id: string; projectId: string | null; orgId: string; fullName: string };
    if (d.workerId) {
      worker = await prisma.siteWorker.findUnique({ where: { id: d.workerId }, select: { id: true, projectId: true, orgId: true, fullName: true } });
    } else if (d.workerCode) {
      worker = await prisma.siteWorker.findFirst({ where: { workerCode: d.workerCode, state: "ACTIVE" }, select: { id: true, projectId: true, orgId: true, fullName: true } });
    }
    if (!worker) {
      const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
      worker = await prisma.siteWorker.findFirst({ where: { orgId: { in: memberships.map((m) => m.orgId) }, state: "ACTIVE" }, select: { id: true, projectId: true, orgId: true, fullName: true } });
    }
    if (!worker) return NextResponse.json({ error: "Không tìm thấy hồ sơ NLĐ" }, { status: 404 });

    const projectId = d.projectId ?? worker.projectId;
    if (!projectId) return NextResponse.json({ error: "Chưa biết dự án — vui lòng truyền projectId" }, { status: 400 });

    // SECURITY: verify the caller has access to this project before any write.
    // This blocks a Cofico user creating an Attendance row on a Vinhomes project.
    await requireProject(projectId);

    const now = new Date();

    if (d.mode === "out") {
      const open = await prisma.attendance.findFirst({
        where: { workerId: worker.id, projectId, checkOutAt: null },
        orderBy: { checkInAt: "desc" },
      });
      if (!open) return NextResponse.json({ error: "Không tìm thấy ca chấm công đang mở" }, { status: 404 });
      const updated = await prisma.attendance.update({
        where: { id: open.id },
        data: { checkOutAt: now, gpsLat: d.lat, gpsLng: d.lon, gateCode: d.gateCode ?? open.gateCode },
      });
      await audit({ action: "field.checkout", entityType: "Attendance", entityId: open.id, actorId: session.userId, projectId, ...reqMeta(req), after: { lat: d.lat, lon: d.lon } });
      return NextResponse.json({ ok: true, mode: "out", attendance: { id: updated.id, checkInAt: updated.checkInAt, checkOutAt: updated.checkOutAt }, worker: { fullName: worker.fullName } });
    }

    // Default = check-in
    const att = await prisma.attendance.create({
      data: {
        workerId: worker.id, projectId, checkInAt: now,
        gpsLat: d.lat, gpsLng: d.lon, gateCode: d.gateCode ?? "GPS",
        method: "GPS",
      },
    });
    await audit({ action: "field.checkin", entityType: "Attendance", entityId: att.id, actorId: session.userId, projectId, ...reqMeta(req), after: { lat: d.lat, lon: d.lon, accuracy: d.accuracy } });
    return NextResponse.json({ ok: true, mode: "in", attendance: { id: att.id, checkInAt: att.checkInAt }, worker: { fullName: worker.fullName } });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
