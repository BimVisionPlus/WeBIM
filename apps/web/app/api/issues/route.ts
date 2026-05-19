import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, requireSession } from "@atlas/auth";
import { audit, reqMeta, nextIssueKey, rateLimitGuard } from "@atlas/lib";
import type { IssueType } from "@atlas/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type") as IssueType | null;
    const state = searchParams.get("state") ?? undefined;

    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const where: any = { projectId };
    if (type) where.type = type;
    if (state) where.state = state;

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { assignee: { select: { id: true, name: true } }, reporter: { select: { id: true, name: true } } },
      take: 200,
    });
    return NextResponse.json({ issues });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

const CreateBody = z.object({
  projectId: z.string(),
  type: z.enum(["TASK", "SAFETY"]),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  locationZone: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "issues" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const key = await nextIssueKey(tx as any, data.projectId, data.type as IssueType);
      return tx.issue.create({
        data: {
          key,
          projectId: data.projectId,
          type: data.type,
          title: data.title,
          description: data.description,
          state: "OPEN",
          priority: data.priority,
          reporterId: session.userId,
          assigneeId: data.assigneeId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          locationZone: data.locationZone,
        },
      });
    });

    await audit({
      action: "issue.create",
      entityType: "Issue",
      entityId: issue.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: issue.key, type: issue.type, title: issue.title },
    });

    return NextResponse.json({ ok: true, issue: { id: issue.id, key: issue.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
