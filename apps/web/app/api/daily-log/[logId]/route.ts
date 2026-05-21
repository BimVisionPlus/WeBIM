/**
 * PATCH /api/daily-log/[logId]
 *
 * Edit an existing DailyLog. The (projectId+date+shift) tuple stays
 * immutable (it's the natural key); only the content fields move.
 *
 * Signing is intentionally NOT done here — see ./sign/route.ts for the
 * CDT/GS signoff endpoint which sets `signedAt`. Once `signedAt` is set,
 * this PATCH refuses further edits (NĐ 06/2021 Điều 10: signed daily
 * logs are legal records that can only be amended via a separate
 * correction entry).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const PatchBody = z.object({
  weather: z.string().max(120).nullable().optional(),
  workforce: z.array(z.object({ trade: z.string(), count: z.number().int().min(0) })).optional(),
  workDone: z.string().min(2).max(10000).optional(),
  workTomorrow: z.string().max(10000).nullable().optional(),
  safetyNotes: z.string().max(10000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { logId: string } }) {
  const __rl = await rateLimitGuard(req, { name: "daily-log" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const before = await prisma.dailyLog.findUnique({ where: { id: params.logId } });
    if (!before) return NextResponse.json({ error: "Nhật ký không tồn tại" }, { status: 404 });
    await requireProject(before.projectId);

    if (before.signedAt) {
      return NextResponse.json(
        { error: "Nhật ký đã ký — NĐ 06/2021 yêu cầu sửa qua nhật ký bổ sung, không sửa trực tiếp." },
        { status: 409 },
      );
    }

    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.weather !== undefined) update.weather = data.weather || null;
    if (data.workforce !== undefined) update.workforce = data.workforce as any;
    if (data.workDone !== undefined) update.workDone = data.workDone;
    if (data.workTomorrow !== undefined) update.workTomorrow = data.workTomorrow || null;
    if (data.safetyNotes !== undefined) update.safetyNotes = data.safetyNotes || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, log: before, noop: true });
    }

    const log = await prisma.dailyLog.update({ where: { id: params.logId }, data: update });

    await audit({
      action: "daily_log.update",
      entityType: "DailyLog",
      entityId: log.id,
      actorId: session.userId,
      projectId: log.projectId,
      ...reqMeta(req),
      after: update,
    });

    return NextResponse.json({ ok: true, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
