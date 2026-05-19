/**
 * POST /api/drawbridge/issue-links — link an issue to BIM elements (one or more).
 * DELETE /api/drawbridge/issue-links?issueId=...&elementId=... — unlink.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  issueId: z.string(),
  elementIds: z.array(z.string()).min(1).max(50),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "drawbridge.issue-links" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const created = await prisma.issueElementLink.createMany({
      data: parsed.data.elementIds.map((eid) => ({
        issueId: parsed.data.issueId,
        elementId: eid,
        note: parsed.data.note,
      })),
      skipDuplicates: true,
    });

    await audit({
      action: "drawbridge.link.create",
      entityType: "Issue",
      entityId: parsed.data.issueId,
      actorId: session.userId,
      ...reqMeta(req),
      after: { count: parsed.data.elementIds.length },
    });

    return NextResponse.json({ created: created.count });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "drawbridge.issue-links" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const url = new URL(req.url);
    const issueId = url.searchParams.get("issueId");
    const elementId = url.searchParams.get("elementId");
    if (!issueId || !elementId) return NextResponse.json({ error: "issueId+elementId required" }, { status: 400 });

    const deleted = await prisma.issueElementLink.deleteMany({ where: { issueId, elementId } });
    await audit({
      action: "drawbridge.link.delete",
      entityType: "Issue",
      entityId: issueId,
      actorId: session.userId,
      ...reqMeta(req),
      after: { elementId },
    });
    return NextResponse.json({ deleted: deleted.count });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
