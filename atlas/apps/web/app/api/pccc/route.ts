/**
 * POST /api/pccc — open a fire-safety (PCCC) application for a project (NĐ 136/2020).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  stage: z.enum(["THAM_DUYET_THIET_KE", "NGHIEM_THU_PCCC", "CAP_GIAY_DU_DIEU_KIEN"]),
  applicationCode: z.string().max(80).optional(),
  submittedAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "pccc.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    const app = await prisma.pcccApplication.create({
      data: {
        projectId: d.projectId,
        stage: d.stage,
        applicationCode: d.applicationCode,
        submittedAt: d.submittedAt ? new Date(d.submittedAt) : undefined,
        state: d.submittedAt ? "SUBMITTED" : "DRAFT",
      },
    });

    await audit({
      action: "pccc.application.create",
      entityType: "PcccApplication",
      entityId: app.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { stage: app.stage },
    });

    return NextResponse.json({ application: app });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
