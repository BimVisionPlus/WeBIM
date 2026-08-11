import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, actorOrgRolesForProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  issueKey: z.string(),
  answer: z.string().min(2).max(10000),
  costImpactVnd: z.string().optional(),
  scheduleImpactDays: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "rfi.answer" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;

    const issue = await prisma.issue.findUnique({
      where: { key: data.issueKey },
      include: { rfi: true, project: true },
    });
    if (!issue || !issue.rfi) return NextResponse.json({ error: "RFI không tồn tại" }, { status: 404 });

    const orgRoles = await actorOrgRolesForProject(session.userId, issue.projectId);
    const canAnswer =
      session.isSuperAdmin ||
      orgRoles.includes("TU_VAN_THIET_KE") ||
      orgRoles.includes("CHU_DAU_TU");
    if (!canAnswer) return NextResponse.json({ error: "Chỉ TVTK hoặc CĐT mới được trả lời RFI" }, { status: 403 });

    await prisma.$transaction([
      prisma.rFI.update({
        where: { issueId: issue.id },
        data: {
          answer: data.answer,
          costImpactVnd: data.costImpactVnd ? BigInt(data.costImpactVnd) : null,
          scheduleImpactDays: data.scheduleImpactDays,
          answeredAt: new Date(),
        },
      }),
      prisma.issue.update({ where: { id: issue.id }, data: { state: "ANSWERED" } }),
      prisma.transition.create({
        data: { issueId: issue.id, fromState: issue.state, toState: "ANSWERED", byUserId: session.userId },
      }),
    ]);

    await audit({
      action: "rfi.answer",
      entityType: "RFI",
      entityId: issue.id,
      actorId: session.userId,
      projectId: issue.projectId,
      ...reqMeta(req),
      after: { answer: data.answer.slice(0, 200) },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
