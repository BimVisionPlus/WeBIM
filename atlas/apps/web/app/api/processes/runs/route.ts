/**
 * POST /api/processes/runs — áp một quy trình vào một dự án.
 *
 * Creating the run also creates one task per step, in a transaction: a run
 * with a missing task looks complete when it is not, and the gate check
 * would pass on a step that was never written.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, rateLimitGuard, reqMeta } from "@atlas/lib";

const Body = z.object({
  templateId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  name: z.string().min(2).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "processes.runs" });
  if (limited) return limited;

  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { templateId, projectId, name } = parsed.data;
    if (projectId) await requireProject(projectId);

    const template = await prisma.processTemplate.findUnique({
      where: { id: templateId },
      include: { steps: { orderBy: { seq: "asc" } } },
    });
    if (!template) return NextResponse.json({ error: "Không tìm thấy quy trình" }, { status: 404 });
    if (template.steps.length === 0) {
      return NextResponse.json({ error: "Quy trình chưa có bước nào" }, { status: 400 });
    }

    // Due dates accumulate: step 3 is due after steps 1 and 2 have had their
    // days, which is what a sequential procedure actually means.
    let elapsed = 0;
    const startedAt = new Date();

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.processRun.create({
        data: {
          templateId,
          projectId: projectId ?? null,
          name: name?.trim() || `${template.name} — ${startedAt.toISOString().slice(0, 10)}`,
          startedAt,
        },
      });
      for (const step of template.steps) {
        elapsed += step.slaDays;
        await tx.processTask.create({
          data: {
            runId: created.id,
            stepId: step.id,
            dueAt: new Date(startedAt.getTime() + elapsed * 86_400_000),
          },
        });
      }
      return created;
    });

    await audit({
      action: "process.run.started",
      entityType: "ProcessRun",
      entityId: run.id,
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { templateId, steps: template.steps.length },
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
