import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, nextIssueKey, rateLimitGuard } from "@atlas/lib";
import { rfiWorkflow } from "@atlas/workflows";
import { rfiAi, saveSuggestion, aiConfig } from "@atlas/ai";

const Body = z.object({
  projectId: z.string(),
  title: z.string().min(2).max(200),
  question: z.string().min(2).max(5000),
  category: z.string().max(80).optional(),
  requestedById: z.string(),    // org id of requester (e.g. NT_CHINH)
  respondedById: z.string().optional(),
  needBy: z.string().optional(),
  assigneeId: z.string().optional(),
  sheetId: z.string().optional(),
  locationZone: z.string().max(120).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "rfi" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const key = await nextIssueKey(tx as any, data.projectId, "RFI");
      return tx.issue.create({
        data: {
          key,
          projectId: data.projectId,
          type: "RFI",
          title: data.title,
          state: rfiWorkflow.initial,
          priority: data.priority,
          reporterId: session.userId,
          assigneeId: data.assigneeId,
          sheetId: data.sheetId,
          locationZone: data.locationZone,
          rfi: {
            create: {
              question: data.question,
              category: data.category,
              requestedById: data.requestedById,
              respondedById: data.respondedById,
              needBy: data.needBy ? new Date(data.needBy) : null,
            },
          },
        },
      });
    });

    await audit({
      action: "rfi.create",
      entityType: "RFI",
      entityId: issue.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: issue.key, title: data.title },
    });

    // Fire-and-forget AI classification + draft. Failures are swallowed +
    // recorded in AiSuggestion; the user can also re-trigger from the RFI
    // detail page via POST /api/ai/rfi/draft.
    if (aiConfig().enabled) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { name: true },
      });
      void Promise.allSettled([
        rfiAi.classifyRfi({
          title: data.title,
          question: data.question,
          projectName: project?.name,
          locationZone: data.locationZone,
        }).then((res) => saveSuggestion({
          kind: "rfi.classify", entityType: "Issue", entityId: issue.id,
          projectId: data.projectId, result: res,
        })),
        rfiAi.draftRfiAnswer({
          title: data.title,
          question: data.question,
          category: data.category,
          projectName: project?.name,
        }).then((res) => saveSuggestion({
          kind: "rfi.draft_answer", entityType: "Issue", entityId: issue.id,
          projectId: data.projectId, result: res,
        })),
      ]);
    }

    return NextResponse.json({ ok: true, issue: { id: issue.id, key: issue.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
