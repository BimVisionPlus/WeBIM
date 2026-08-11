import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  fullName: z.string().min(2).max(120).optional(),
  trade: z.string().max(80).optional(),
  level: z.string().max(40).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  state: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
});

async function getOwned(id: string) {
  return prisma.siteWorker.findUnique({ where: { id }, select: { id: true, orgId: true, state: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "workforce.manage.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.siteWorker.update({ where: { id }, data: parsed.data });
    await audit({ action: "worker.update", entityType: "SiteWorker", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { state: rec.state }, after: { state: updated.state } });
    return NextResponse.json({ worker: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "workforce.manage.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const attCount = await prisma.attendance.count({ where: { workerId: id } });
    if (attCount > 0) {
      await prisma.siteWorker.update({ where: { id }, data: { state: "TERMINATED" } });
      await audit({ action: "worker.terminate", entityType: "SiteWorker", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), after: { attCount, soft: true } });
      return NextResponse.json({ ok: true, soft: true, attCount });
    }
    await prisma.siteWorker.delete({ where: { id } });
    await audit({ action: "worker.delete", entityType: "SiteWorker", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
