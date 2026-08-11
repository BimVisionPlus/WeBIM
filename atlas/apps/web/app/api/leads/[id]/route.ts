import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(300).optional(),
  clientName: z.string().max(200).optional().nullable(),
  province: z.string().max(80).optional().nullable(),
  estValueVnd: z.coerce.bigint().optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  status: z.enum(["POTENTIAL", "TRACKING", "WON", "LOST", "ARCHIVED"]).optional(),
  nextActionAt: z.string().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  territoryId: z.string().optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.projectLead.findUnique({ where: { id }, select: { id: true, orgId: true, status: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "leads.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.projectLead.update({
      where: { id },
      data: { ...d, nextActionAt: d.nextActionAt ? new Date(d.nextActionAt) : (d.nextActionAt === null ? null : undefined) },
    });
    await audit({ action: "lead.update", entityType: "ProjectLead", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { status: rec.status }, after: { status: updated.status } });
    return NextResponse.json({ lead: { ...updated, estValueVnd: updated.estValueVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "leads.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    await prisma.projectLead.delete({ where: { id } });
    await audit({ action: "lead.delete", entityType: "ProjectLead", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
