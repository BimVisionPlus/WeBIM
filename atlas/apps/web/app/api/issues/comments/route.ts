import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, actorOrgRolesForProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ issueKey: z.string(), body: z.string().min(1).max(5000) });

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "issues.comments" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const issue = await prisma.issue.findUnique({ where: { key: parsed.data.issueKey } });
    if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    const orgRoles = await actorOrgRolesForProject(session.userId, issue.projectId);
    if (orgRoles.length === 0 && !session.isSuperAdmin) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const c = await prisma.comment.create({
      data: { issueId: issue.id, authorId: session.userId, body: parsed.data.body },
    });

    await audit({
      action: "issue.comment",
      entityType: "Comment",
      entityId: c.id,
      actorId: session.userId,
      projectId: issue.projectId,
      ...reqMeta(req),
      after: { body: parsed.data.body.slice(0, 200) },
    });

    return NextResponse.json({ ok: true, commentId: c.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
