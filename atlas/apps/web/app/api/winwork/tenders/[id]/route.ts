import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  title: z.string().min(2).max(300).optional(),
  invitor: z.string().max(200).optional().nullable(),
  budgetVnd: z.coerce.bigint().optional().nullable(),
  province: z.string().max(60).optional().nullable(),
  closingAt: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "winwork.tenders.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const rec = await prisma.tenderOpportunity.findUnique({ where: { id }, select: { id: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.tenderOpportunity.update({
      where: { id },
      data: { ...d, closingAt: d.closingAt ? new Date(d.closingAt) : (d.closingAt === null ? null : undefined) },
    });
    await audit({ action: "winwork.tender.update", entityType: "TenderOpportunity", entityId: id, actorId: session.userId, ...reqMeta(req) });
    return NextResponse.json({ tender: { ...updated, budgetVnd: updated.budgetVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "winwork.tenders.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const rec = await prisma.tenderOpportunity.findUnique({ where: { id }, select: { id: true } });
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const bidCount = await prisma.bid.count({ where: { opportunityId: id } });
    if (bidCount > 0) return NextResponse.json({ error: `Có ${bidCount} HSDT gắn cơ hội này — không thể xoá` }, { status: 409 });
    await prisma.tenderOpportunity.delete({ where: { id } });
    await audit({ action: "winwork.tender.delete", entityType: "TenderOpportunity", entityId: id, actorId: session.userId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
