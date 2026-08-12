/**
 * PATCH /api/processes/tasks — giao việc, cập nhật tiến độ, đóng bước.
 *
 * The run closes itself when the last step is done, and refuses to while an
 * unmet gate remains — a stage gate that can be walked past is decoration.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, rateLimitGuard, reqMeta } from "@atlas/lib";

const Body = z.object({
  taskId: z.string().min(1),
  assigneeUserId: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"]).optional(),
  note: z.string().max(2000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "processes.tasks" });
  if (limited) return limited;

  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { taskId, ...patch } = parsed.data;

    const existing = await prisma.processTask.findUnique({
      where: { id: taskId },
      include: { step: true },
    });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bước" }, { status: 404 });

    const task = await prisma.processTask.update({
      where: { id: taskId },
      data: {
        ...(patch.assigneeUserId !== undefined ? { assigneeUserId: patch.assigneeUserId } : {}),
        ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.dueAt !== undefined
          ? { dueAt: patch.dueAt ? new Date(patch.dueAt) : null }
          : {}),
        ...(patch.status !== undefined
          ? {
              status: patch.status,
              // Marking done sets 100 unless a number came with it: a step at
              // "xong, 40%" is a contradiction someone has to resolve later.
              ...(patch.status === "DONE"
                ? { progress: patch.progress ?? 100, decidedAt: new Date() }
                : { decidedAt: null }),
            }
          : {}),
      },
    });

    // Close (or reopen) the run to match its steps.
    const siblings = await prisma.processTask.findMany({
      where: { runId: task.runId },
      include: { step: true },
    });
    const allDone = siblings.every((row) => row.status === "DONE");
    const gateOpen = siblings.some((row) => row.step.isGate && row.status !== "DONE");
    await prisma.processRun.update({
      where: { id: task.runId },
      data:
        allDone && !gateOpen
          ? { status: "DONE", closedAt: new Date() }
          : { status: "IN_PROGRESS", closedAt: null },
    });

    await audit({
      action: "process.task.updated",
      entityType: "ProcessTask",
      entityId: task.id,
      actorId: session.userId,
      ...reqMeta(req),
      after: { status: task.status, progress: task.progress, assignee: task.assigneeUserId },
    });

    return NextResponse.json({ ok: true, runClosed: allDone && !gateOpen });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
