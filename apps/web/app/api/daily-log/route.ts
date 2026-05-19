import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  date: z.string(),                                                // ISO date
  shift: z.enum(["DAY", "NIGHT"]).default("DAY"),
  weather: z.string().max(120).optional(),
  workforce: z.array(z.object({ trade: z.string(), count: z.number().int().min(0) })).default([]),
  workDone: z.string().min(2).max(10000),
  workTomorrow: z.string().max(10000).optional(),
  safetyNotes: z.string().max(10000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const logs = await prisma.dailyLog.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      take: 90,
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "daily-log" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const log = await prisma.dailyLog.upsert({
      where: {
        projectId_date_shift: {
          projectId: data.projectId,
          date: new Date(data.date),
          shift: data.shift,
        },
      },
      update: {
        weather: data.weather,
        workforce: data.workforce as any,
        workDone: data.workDone,
        workTomorrow: data.workTomorrow,
        safetyNotes: data.safetyNotes,
      },
      create: {
        projectId: data.projectId,
        date: new Date(data.date),
        shift: data.shift,
        authorId: session.userId,
        weather: data.weather,
        workforce: data.workforce as any,
        workDone: data.workDone,
        workTomorrow: data.workTomorrow,
        safetyNotes: data.safetyNotes,
      },
    });

    await audit({
      action: "daily_log.upsert",
      entityType: "DailyLog",
      entityId: log.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { date: data.date, shift: data.shift },
    });

    return NextResponse.json({ ok: true, log: { id: log.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
