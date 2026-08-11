// POST /api/workforce/[id]/checkin — Record an Attendance event (QR/FACE/GPS/MANUAL).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  method: z.enum(["QR", "FACE", "GPS", "MANUAL"]).default("QR"),
  gateCode: z.string().max(40).optional(),
  faceMatchScore: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "workforce.checkin" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const worker = await prisma.siteWorker.findUnique({ where: { id: params.id } });
    if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (worker.state !== "ACTIVE") return NextResponse.json({ error: `Worker ${worker.state}` }, { status: 422 });
    if (!worker.projectId) return NextResponse.json({ error: "Worker chưa gắn dự án" }, { status: 422 });
    await requireProject(worker.projectId);
    const a = await prisma.attendance.create({
      data: {
        workerId: worker.id, projectId: worker.projectId,
        checkInAt: new Date(),
        method: parsed.data.method,
        gateCode: parsed.data.gateCode ?? "Cổng A",
        faceMatchScore: parsed.data.faceMatchScore ? (parsed.data.faceMatchScore as unknown as never) : null,
      },
    });
    await audit({ action: "workforce.checkin", entityType: "Attendance", entityId: a.id, actorId: session.userId, projectId: worker.projectId, ...reqMeta(req), after: { workerCode: worker.workerCode, method: parsed.data.method } });
    return NextResponse.json({ ok: true, id: a.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
