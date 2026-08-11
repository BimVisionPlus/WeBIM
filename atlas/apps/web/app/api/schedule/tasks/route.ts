/**
 * POST /api/schedule/tasks — create a schedule task (WBS line) for a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(300),
  discipline: z.string().max(80).optional(),
  zone: z.string().max(120).optional(),
  plannedStart: z.string(),
  plannedEnd: z.string(),
  pctComplete: z.coerce.number().min(0).max(100).default(0),
  state: z.enum(["PLANNED", "IN_PROGRESS", "ON_HOLD", "DONE", "CANCELLED"]).default("PLANNED"),
  isCritical: z.coerce.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "schedule.tasks.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    const start = new Date(d.plannedStart);
    const end = new Date(d.plannedEnd);
    if (end < start) return NextResponse.json({ error: "Ngày kết thúc phải sau ngày bắt đầu" }, { status: 400 });

    const existing = await prisma.scheduleTask.findUnique({ where: { projectId_code: { projectId: d.projectId, code: d.code } } });
    if (existing) return NextResponse.json({ error: `Mã WBS "${d.code}" đã tồn tại trong dự án` }, { status: 409 });

    const task = await prisma.scheduleTask.create({
      data: {
        projectId: d.projectId,
        code: d.code,
        name: d.name,
        discipline: d.discipline,
        zone: d.zone,
        plannedStart: start,
        plannedEnd: end,
        pctComplete: d.pctComplete,
        state: d.state,
        isCritical: d.isCritical,
      },
    });

    await audit({
      action: "schedule.task.create",
      entityType: "ScheduleTask",
      entityId: task.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { code: task.code, name: task.name },
    });

    return NextResponse.json({ task });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
