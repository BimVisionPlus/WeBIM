// POST /api/hsetrain — Issue HseCertificate.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  courseId: z.string(),
  workerName: z.string().min(2).max(120),
  workerIdNo: z.string().max(20).optional(),
  orgId: z.string().optional(),
  testScore: z.number().int().min(0).max(100).optional(),
  trainerName: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "hsetrain.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const course = await prisma.hseCourse.findUnique({ where: { id: d.courseId } });
    if (!course) return NextResponse.json({ error: "Khoá không tồn tại" }, { status: 404 });
    if (d.testScore !== undefined && d.testScore < course.passScore) {
      return NextResponse.json({ error: `Điểm ${d.testScore}% < passScore ${course.passScore}%, không đạt` }, { status: 422 });
    }
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + course.validityMonths);
    const count = await prisma.hseCertificate.count({ where: { courseId: course.id } });
    const certNumber = `${course.code}-${String(count + 1).padStart(4, "0")}`;
    // Default orgId to user's primary membership so page list shows the new cert.
    let orgId = d.orgId ?? null;
    if (!orgId) {
      const m = await prisma.membership.findFirst({ where: { userId: session.userId } });
      orgId = m?.orgId ?? null;
    }
    const cert = await prisma.hseCertificate.create({
      data: {
        courseId: course.id,
        workerName: d.workerName,
        workerIdNo: d.workerIdNo ?? null,
        orgId,
        certNumber,
        qrCode: `https://app.aecplatform.vn/hse/cert/${certNumber}`,
        issuedAt, expiresAt,
        testScore: d.testScore ?? null,
        trainerName: d.trainerName ?? null,
        state: "ACTIVE",
      },
    });
    await audit({ action: "hsetrain.issue", entityType: "HseCertificate", entityId: cert.id, actorId: session.userId, ...reqMeta(req), after: { certNumber, workerName: d.workerName } });
    return NextResponse.json({ ok: true, id: cert.id, certNumber });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
