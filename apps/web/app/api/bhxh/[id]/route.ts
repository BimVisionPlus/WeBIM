import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  employeeName: z.string().min(2).max(120).optional(),
  employeeIdNo: z.string().max(20).optional().nullable(),
  bhxhNumber: z.string().max(20).optional().nullable(),
  status: z.enum(["DANG_DONG", "TAM_DUNG", "CHO_DANG_KY", "DA_NGHI", "KHAC"]).optional(),
  monthlyBaseVnd: z.coerce.bigint().optional().nullable(),
  startedAt: z.string().optional(),
  stoppedAt: z.string().optional(),
  note: z.string().max(2000).optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.socialInsuranceRecord.findUnique({ where: { id }, select: { id: true, orgId: true, status: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "bhxh.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.socialInsuranceRecord.update({
      where: { id },
      data: { ...d, startedAt: d.startedAt ? new Date(d.startedAt) : undefined, stoppedAt: d.stoppedAt ? new Date(d.stoppedAt) : undefined },
    });
    await audit({ action: "bhxh.update", entityType: "SocialInsuranceRecord", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { status: rec.status }, after: { status: updated.status } });
    return NextResponse.json({ record: { ...updated, monthlyBaseVnd: updated.monthlyBaseVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "bhxh.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    await prisma.socialInsuranceRecord.delete({ where: { id } });
    await audit({ action: "bhxh.delete", entityType: "SocialInsuranceRecord", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
