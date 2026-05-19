import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, nextIssueKey, rateLimitGuard } from "@atlas/lib";
import { punchWorkflow } from "@atlas/workflows";

const Body = z.object({
  projectId: z.string(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  trade: z.string().max(80),
  zone: z.string().max(120),
  photoBeforeUrl: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "punch" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const key = await nextIssueKey(tx as any, data.projectId, "PUNCH");
      return tx.issue.create({
        data: {
          key,
          projectId: data.projectId,
          type: "PUNCH",
          title: data.title,
          description: data.description,
          state: punchWorkflow.initial,
          priority: data.priority,
          reporterId: session.userId,
          assigneeId: data.assigneeId,
          locationZone: data.zone,
          punchItem: {
            create: {
              trade: data.trade,
              zone: data.zone,
              photoBeforeUrl: data.photoBeforeUrl,
            },
          },
        },
      });
    });

    await audit({
      action: "punch.create",
      entityType: "PunchItem",
      entityId: issue.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: issue.key, trade: data.trade, zone: data.zone },
    });

    return NextResponse.json({ ok: true, issue: { id: issue.id, key: issue.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
