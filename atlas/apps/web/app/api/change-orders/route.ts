import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, nextIssueKey, rateLimitGuard } from "@atlas/lib";
import { changeOrderWorkflow } from "@atlas/workflows";

const Body = z.object({
  projectId: z.string(),
  title: z.string().min(2).max(200),
  reason: z.string().min(2).max(5000),
  scopeChange: z.string().min(2).max(5000),
  costDeltaVnd: z.string(), // signed BigInt as string
  scheduleDeltaDays: z.number().int().default(0),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH"),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "change-orders" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const key = await nextIssueKey(tx as any, data.projectId, "CHANGE_ORDER");
      return tx.issue.create({
        data: {
          key,
          projectId: data.projectId,
          type: "CHANGE_ORDER",
          title: data.title,
          state: changeOrderWorkflow.initial,
          priority: data.priority,
          reporterId: session.userId,
          changeOrder: {
            create: {
              reason: data.reason,
              scopeChange: data.scopeChange,
              costDeltaVnd: BigInt(data.costDeltaVnd),
              scheduleDeltaDays: data.scheduleDeltaDays,
            },
          },
        },
      });
    });

    await audit({
      action: "change_order.create",
      entityType: "ChangeOrder",
      entityId: issue.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: issue.key, costDelta: data.costDeltaVnd },
    });

    return NextResponse.json({ ok: true, issue: { id: issue.id, key: issue.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
