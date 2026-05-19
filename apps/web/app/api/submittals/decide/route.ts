import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, actorOrgRolesForProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  issueKey: z.string(),
  decision: z.enum(["APPROVED", "APPROVED_AS_NOTED", "REVISE_RESUBMIT", "REJECTED"]),
  note: z.string().max(2000).optional(),
});

const DECISION_TO_STATE = {
  APPROVED: "APPROVED",
  APPROVED_AS_NOTED: "APPROVED_AS_NOTED",
  REVISE_RESUBMIT: "REVISE_RESUBMIT",
  REJECTED: "REJECTED",
} as const;

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "submittals.decide" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;

    const issue = await prisma.issue.findUnique({
      where: { key: data.issueKey },
      include: { submittal: true },
    });
    if (!issue || !issue.submittal) return NextResponse.json({ error: "Submittal không tồn tại" }, { status: 404 });

    const orgRoles = await actorOrgRolesForProject(session.userId, issue.projectId);
    const canDecide =
      session.isSuperAdmin ||
      orgRoles.includes("TU_VAN_GIAM_SAT") ||
      orgRoles.includes("TU_VAN_THIET_KE");
    if (!canDecide) return NextResponse.json({ error: "Chỉ TVGS/TVTK mới được phê duyệt" }, { status: 403 });

    await prisma.$transaction([
      prisma.submittal.update({
        where: { issueId: issue.id },
        data: { decision: data.decision, decidedAt: new Date() },
      }),
      prisma.issue.update({ where: { id: issue.id }, data: { state: DECISION_TO_STATE[data.decision] } }),
      prisma.transition.create({
        data: {
          issueId: issue.id,
          fromState: issue.state,
          toState: DECISION_TO_STATE[data.decision],
          byUserId: session.userId,
          reason: data.note ?? null,
        },
      }),
    ]);

    await audit({
      action: "submittal.decide",
      entityType: "Submittal",
      entityId: issue.id,
      actorId: session.userId,
      projectId: issue.projectId,
      ...reqMeta(req),
      after: { decision: data.decision },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
