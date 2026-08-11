import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  weather: z.string().max(200).optional().nullable(),
  workDone: z.string().max(20000).optional(),
  workTomorrow: z.string().max(20000).optional().nullable(),
  safetyNotes: z.string().max(20000).optional().nullable(),
  shift: z.enum(["DAY", "NIGHT"]).optional(),
});

async function getOwned(id: string) {
  return prisma.dailyLog.findUnique({ where: { id }, select: { id: true, projectId: true, signoffByCdtId: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { logId: string } | Promise<{ logId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "daily-log.patch" }); if (rl) return rl;
  try {
    const { logId: id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (rec.signoffByCdtId) return NextResponse.json({ error: "Đã ký xác nhận — không thể sửa" }, { status: 409 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.dailyLog.update({ where: { id }, data: parsed.data });
    await audit({ action: "daily-log.update", entityType: "DailyLog", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ log: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { logId: string } | Promise<{ logId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "daily-log.delete" }); if (rl) return rl;
  try {
    const { logId: id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (rec.signoffByCdtId) return NextResponse.json({ error: "Đã ký xác nhận — không thể xoá" }, { status: 409 });
    const { session } = await requireProject(rec.projectId);
    await prisma.dailyLog.delete({ where: { id } });
    await audit({ action: "daily-log.delete", entityType: "DailyLog", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
