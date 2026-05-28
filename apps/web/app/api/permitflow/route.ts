/**
 * POST /api/permitflow — open a construction permit application (GPXD) for a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  permitType: z.enum([
    "GPXD_MOI", "GPXD_DIEU_CHINH", "GPXD_SUA_CHUA", "GPXD_TAM", "THONG_BAO_KHOI_CONG", "GPXD_HA_TANG",
  ]),
  applicant: z.string().min(2).max(200),
  applicationCode: z.string().max(80).optional(),
  submittedAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "permitflow.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    const app = await prisma.permitApplication.create({
      data: {
        projectId: d.projectId,
        permitType: d.permitType,
        applicant: d.applicant,
        applicationCode: d.applicationCode,
        submittedAt: d.submittedAt ? new Date(d.submittedAt) : undefined,
        state: d.submittedAt ? "SUBMITTED" : "DRAFT",
      },
    });

    await audit({
      action: "permit.application.create",
      entityType: "PermitApplication",
      entityId: app.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { permitType: app.permitType, applicant: app.applicant },
    });

    return NextResponse.json({ application: app });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
