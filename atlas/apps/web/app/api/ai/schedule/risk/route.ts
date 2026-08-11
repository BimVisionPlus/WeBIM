/**
 * POST /api/ai/schedule/risk
 *
 * Body: { taskId: string }
 *   — analyzes a single ScheduleTask, returns {riskPct, factors, explanation}.
 *
 * Body: { projectId: string }
 *   — analyzes every IN_PROGRESS/PLANNED critical-path task on the project,
 *     returns per-task array. Cap 30 tasks to fit Groq free tier.
 *
 * Auth: requireProject (membership on the project's org-graph).
 * Rate-limited.
 * Audited as ai.schedule.risk.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { scheduleRiskAi } from "@atlas/ai";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.union([
  z.object({ taskId: z.string() }),
  z.object({ projectId: z.string() }),
]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.schedule.risk" });
  if (rl) return rl;

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    // Resolve target tasks
    let tasks: Array<any> = [];
    let projectId: string;

    if ("taskId" in input) {
      const t = await prisma.scheduleTask.findUnique({ where: { id: input.taskId } });
      if (!t) return NextResponse.json({ error: "Task không tồn tại" }, { status: 404 });
      projectId = t.projectId;
      tasks = [t];
    } else {
      projectId = input.projectId;
      tasks = await prisma.scheduleTask.findMany({
        where: { projectId, state: { in: ["PLANNED", "IN_PROGRESS"] } },
        orderBy: [{ isCritical: "desc" }, { plannedEnd: "asc" }],
        take: 30,
      });
    }

    const { session } = await requireProject(projectId);

    // Recent logs (shared across tasks of the same project)
    const recentLogs = await prisma.dailyLog.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      take: 7,
      select: { date: true, workforce: true, safetyNotes: true },
    });

    // No weather integration yet — placeholder. (Open-meteo wiring is a
    // separate enhancement; the prompt handles "(không có dữ liệu)".)
    const weather = null as string | null;

    const results = [];
    for (const t of tasks) {
      const r = await scheduleRiskAi.assessScheduleRisk({
        task: {
          code: t.code, name: t.name, discipline: t.discipline, zone: t.zone,
          plannedStart: t.plannedStart, plannedEnd: t.plannedEnd, actualStart: t.actualStart,
          pctComplete: t.pctComplete, state: t.state, isCritical: t.isCritical,
        },
        recentDailyLogs: recentLogs,
        weatherForecastNext7d: weather,
      });
      if (r.ok) {
        results.push({
          taskId: t.id, taskCode: t.code, taskName: t.name, isCritical: t.isCritical,
          plannedEnd: t.plannedEnd, pctComplete: t.pctComplete,
          ...r.data,
        });
      } else {
        results.push({ taskId: t.id, taskCode: t.code, error: r.error ?? r.reason });
      }
    }

    await audit({
      action: "ai.schedule.risk",
      entityType: "Project",
      entityId: projectId,
      actorId: session.userId,
      ...reqMeta(req),
      after: { taskCount: results.length, mode: "taskId" in input ? "single" : "project" },
    });

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
