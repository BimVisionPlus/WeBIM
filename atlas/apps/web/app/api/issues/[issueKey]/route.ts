/**
 * PATCH /api/issues/[issueKey]
 *
 * Edit a single issue's mutable scalar fields. Status transitions go through
 * /api/issues/transition (workflow-guarded) — this route is for editing the
 * descriptive content + assignment metadata after creation, not for state
 * moves. Subtype-specific fields (RFI.question, NCR.severity, …) belong to
 * their own routes; this PATCH only touches the base `Issue` columns.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const PatchBody = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  locationZone: z.string().max(120).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { issueKey: string } }) {
  const __rl = await rateLimitGuard(req, { name: "issues" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const key = decodeURIComponent(params.issueKey);
    const before = await prisma.issue.findUnique({ where: { key } });
    if (!before) return NextResponse.json({ error: "Issue không tồn tại" }, { status: 404 });
    await requireProject(before.projectId);

    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.priority !== undefined) update.priority = data.priority;
    if (data.assigneeId !== undefined) update.assigneeId = data.assigneeId || null;
    if (data.locationZone !== undefined) update.locationZone = data.locationZone || null;
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, issue: before, noop: true });
    }

    const issue = await prisma.issue.update({ where: { key }, data: update });

    await audit({
      action: "issue.update",
      entityType: "Issue",
      entityId: issue.id,
      actorId: session.userId,
      projectId: issue.projectId,
      ...reqMeta(req),
      before: {
        title: before.title,
        priority: before.priority,
        assigneeId: before.assigneeId,
        dueDate: before.dueDate,
        locationZone: before.locationZone,
      },
      after: update,
    });

    return NextResponse.json({ ok: true, issue });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
