import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, nextIssueKey, rateLimitGuard } from "@atlas/lib";
import { submittalWorkflow } from "@atlas/workflows";

const Body = z.object({
  projectId: z.string(),
  title: z.string().min(2).max(200),
  specSection: z.string().max(120).optional(),
  materialName: z.string().min(2).max(200),
  manufacturer: z.string().max(200).optional(),
  submitterOrgId: z.string(),
  reviewerOrgId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "submittals" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const key = await nextIssueKey(tx as any, data.projectId, "SUBMITTAL");
      return tx.issue.create({
        data: {
          key,
          projectId: data.projectId,
          type: "SUBMITTAL",
          title: data.title,
          state: submittalWorkflow.initial,
          priority: data.priority,
          reporterId: session.userId,
          submittal: {
            create: {
              specSection: data.specSection,
              materialName: data.materialName,
              manufacturer: data.manufacturer,
              submitterOrgId: data.submitterOrgId,
              reviewerOrgId: data.reviewerOrgId,
            },
          },
        },
      });
    });

    await audit({
      action: "submittal.create",
      entityType: "Submittal",
      entityId: issue.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: issue.key, material: data.materialName },
    });

    return NextResponse.json({ ok: true, issue: { id: issue.id, key: issue.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
