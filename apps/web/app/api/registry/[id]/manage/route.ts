import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  legalName: z.string().min(2).max(200).optional(),
  mst: z.string().max(20).optional().nullable(),
  capabilityClass: z.enum(["HANG_I", "HANG_II", "HANG_III", "CHUA_PHAN_HANG"]).optional(),
  capabilityNo: z.string().max(80).optional().nullable(),
  charteredEng: z.coerce.number().int().min(0).max(1000).optional(),
  totalStaff: z.coerce.number().int().min(0).max(100000).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.contractorProfile.findUnique({ where: { id }, select: { id: true, orgId: true, blacklisted: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "registry.manage.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.contractorProfile.update({ where: { id }, data: parsed.data });
    await audit({ action: "contractor.profile.update", entityType: "ContractorProfile", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ profile: { ...updated, charterCapVnd: updated.charterCapVnd?.toString() ?? null, pastValueVnd: updated.pastValueVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "registry.manage.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    await prisma.contractorPerformance.deleteMany({ where: { contractorId: id } });
    await prisma.contractorReference.deleteMany({ where: { contractorId: id } });
    await prisma.contractorProfile.delete({ where: { id } });
    await audit({ action: "contractor.profile.delete", entityType: "ContractorProfile", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
