// POST /api/portal — Create ApprovalRequest for CĐT review.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  source: z.enum(["PAYMENT", "CHANGEORDER", "METHOD", "QAQC", "ACCEPTANCE", "MATERIAL", "PERMIT", "TENDER", "OTHER"]),
  sourceId: z.string().min(2).max(64),
  title: z.string().min(2).max(300),
  summary: z.string().min(2).max(5000),
  amountVnd: z.string().regex(/^-?\d+$/).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "portal.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const r = await prisma.approvalRequest.create({
      data: {
        projectId: d.projectId, source: d.source, sourceId: d.sourceId,
        title: d.title, summary: d.summary,
        amountVnd: d.amountVnd ? BigInt(d.amountVnd) : null,
        priority: d.priority,
        dueAt: d.dueAt ? new Date(d.dueAt) : null,
        requesterUserId: session.userId,
        attachmentIds: [],
      },
    });
    await audit({ action: "portal.create", entityType: "ApprovalRequest", entityId: r.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { source: d.source, title: d.title } });
    return NextResponse.json({ ok: true, id: r.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
