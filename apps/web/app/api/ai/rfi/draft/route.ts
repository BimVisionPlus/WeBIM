import { rateLimitGuard } from "@atlas/lib";
// On-demand: classify + draft answer for an existing RFI. Returns suggestion
// payload; UI shows it and lets a reviewer click "Áp dụng" to copy into the
// answer field. Persists to AiSuggestion for audit.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { rfiAi, saveSuggestion } from "@atlas/ai";

const Body = z.object({ issueId: z.string() });

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ai.rfi.draft" });
  if (__rl) return __rl;
try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const issue = await prisma.issue.findUnique({
      where: { id: parsed.data.issueId },
      include: { rfi: true, project: { select: { name: true } } },
    });
    if (!issue || !issue.rfi) {
      return NextResponse.json({ error: "RFI not found" }, { status: 404 });
    }
    await requireProject(issue.projectId);

    const baseCtx = {
      title: issue.title,
      question: issue.rfi.question,
      projectName: issue.project.name,
      locationZone: issue.locationZone ?? undefined,
    };

    const [cls, draft] = await Promise.all([
      rfiAi.classifyRfi(baseCtx),
      rfiAi.draftRfiAnswer({ ...baseCtx, category: issue.rfi.category }),
    ]);

    await Promise.all([
      saveSuggestion({
        kind: "rfi.classify", entityType: "Issue", entityId: issue.id,
        projectId: issue.projectId, result: cls,
      }),
      saveSuggestion({
        kind: "rfi.draft_answer", entityType: "Issue", entityId: issue.id,
        projectId: issue.projectId, result: draft,
      }),
    ]);

    return NextResponse.json({
      classify: cls.ok ? { ...cls.data, model: cls.model, latencyMs: cls.latencyMs }
                       : { error: cls.reason },
      draft: draft.ok ? { ...draft.data, model: draft.model, latencyMs: draft.latencyMs }
                      : { error: draft.reason },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
