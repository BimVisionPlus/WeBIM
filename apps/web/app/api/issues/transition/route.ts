import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, actorOrgRolesForProject } from "@atlas/auth";
import { canTransition, getWorkflow, type WorkflowKey } from "@atlas/workflows";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  issueKey: z.string(),
  toState: z.string(),
  payload: z.record(z.any()).optional(),
  reason: z.string().max(500).optional(),
});

const TYPE_TO_WF: Partial<Record<string, WorkflowKey>> = {
  RFI: "RFI",
  SUBMITTAL: "SUBMITTAL",
  NCR: "NCR",
  PUNCH: "PUNCH",
  CHANGE_ORDER: "CHANGE_ORDER",
};

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "issues.transition" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { issueKey, toState, payload, reason } = parsed.data;

    const issue = await prisma.issue.findUnique({
      where: { key: issueKey },
      include: { project: { include: { stakeholders: true } } },
    });
    if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const wfKey = TYPE_TO_WF[issue.type];
    if (!wfKey) return NextResponse.json({ error: "No workflow for issue type" }, { status: 400 });

    const orgRoles = await actorOrgRolesForProject(session.userId, issue.projectId);
    if (orgRoles.length === 0 && !session.isSuperAdmin) {
      return NextResponse.json({ error: "Bạn không có quyền với dự án này" }, { status: 403 });
    }

    const wf = getWorkflow(wfKey);
    const check = canTransition(
      wf,
      issue.state as any,
      toState as any,
      { userId: session.userId, orgRoles, isAdmin: session.isSuperAdmin },
      payload,
    );
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 403 });

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.issue.update({
        where: { id: issue.id },
        data: {
          state: toState,
          closedAt: wf.terminal.includes(toState as any) ? new Date() : null,
        },
      });
      await tx.transition.create({
        data: {
          issueId: issue.id,
          fromState: issue.state,
          toState,
          byUserId: session.userId,
          reason: reason ?? null,
        },
      });
      return next;
    });

    await audit({
      action: "issue.transition",
      entityType: "Issue",
      entityId: issue.id,
      actorId: session.userId,
      projectId: issue.projectId,
      ...reqMeta(req),
      before: { state: issue.state },
      after: { state: toState, reason },
    });

    return NextResponse.json({ ok: true, issue: { key: updated.key, state: updated.state } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
