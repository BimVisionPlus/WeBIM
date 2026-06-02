import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  title: z.string().min(2).max(300).optional(),
  description: z.string().min(5).max(5000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  category: z.enum(["THAM_DOT","NUT_TUONG","DIEN_GIAT","CAP_THOAT_NUOC","HVAC","SON_HOAN_THIEN","CUA_KHOA","AN_NINH","KHAC"]).optional(),
  unitCode: z.string().max(40).optional().nullable(),
  reporterPhone: z.string().max(40).optional().nullable(),
});

async function getOwned(ticketId: string) {
  return prisma.handoverTicket.findUnique({ where: { id: ticketId }, select: { id: true, projectId: true, state: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { ticketId: string } | Promise<{ ticketId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "handover.manage.patch" }); if (rl) return rl;
  try {
    const { ticketId } = await ctx.params;
    const rec = await getOwned(ticketId);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.handoverTicket.update({ where: { id: ticketId }, data: parsed.data });
    await audit({ action: "handover.update", entityType: "HandoverTicket", entityId: ticketId, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ticket: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { ticketId: string } | Promise<{ ticketId: string }> }) {
  const rl = await rateLimitGuard(req, { name: "handover.manage.delete" }); if (rl) return rl;
  try {
    const { ticketId } = await ctx.params;
    const rec = await getOwned(ticketId);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    if (["VERIFIED", "CLOSED"].includes(rec.state)) return NextResponse.json({ error: "Đã hoàn tất — không thể xoá" }, { status: 409 });
    await prisma.handoverTicket.delete({ where: { id: ticketId } });
    await audit({ action: "handover.delete", entityType: "HandoverTicket", entityId: ticketId, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
