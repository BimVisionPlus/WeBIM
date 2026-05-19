import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, nextIssueKey, rateLimitGuard } from "@atlas/lib";
import { ncrWorkflow } from "@atlas/workflows";

const Body = z.object({
  projectId: z.string(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]),
  raisedByOrgId: z.string(),
  responsibleOrgId: z.string(),
  qcvnRef: z.string().max(120).optional(),
  costImpactVnd: z.string().optional(),
  locationZone: z.string().max(120).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH"),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ncr" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const key = await nextIssueKey(tx as any, data.projectId, "NCR");
      return tx.issue.create({
        data: {
          key,
          projectId: data.projectId,
          type: "NCR",
          title: data.title,
          description: data.description,
          state: ncrWorkflow.initial,
          priority: data.priority,
          reporterId: session.userId,
          locationZone: data.locationZone,
          ncr: {
            create: {
              severity: data.severity,
              raisedByOrgId: data.raisedByOrgId,
              responsibleOrgId: data.responsibleOrgId,
              qcvnRef: data.qcvnRef,
              costImpactVnd: data.costImpactVnd ? BigInt(data.costImpactVnd) : null,
            },
          },
        },
      });
    });

    await audit({
      action: "ncr.create",
      entityType: "NCR",
      entityId: issue.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: issue.key, severity: data.severity },
    });

    return NextResponse.json({ ok: true, issue: { id: issue.id, key: issue.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
