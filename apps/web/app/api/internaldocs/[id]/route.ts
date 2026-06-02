import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  title: z.string().min(2).max(300).optional(),
  body: z.string().max(20000).optional().nullable(),
  category: z.enum(["QUYET_DINH", "THONG_BAO", "QUY_CHE", "QUY_TRINH", "BIEN_BAN", "KHAC"]).optional(),
  issuedAt: z.string().optional(),
});

async function getOwned(id: string) {
  const rec = await prisma.internalDocument.findUnique({ where: { id }, select: { id: true, orgId: true } });
  return rec;
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "internaldocs.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const before = await prisma.internalDocument.findUnique({ where: { id } });
    const updated = await prisma.internalDocument.update({
      where: { id },
      data: { ...d, issuedAt: d.issuedAt ? new Date(d.issuedAt) : undefined },
    });
    await audit({ action: "internaldoc.update", entityType: "InternalDocument", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { title: before?.title, category: before?.category }, after: { title: updated.title, category: updated.category } });
    return NextResponse.json({ doc: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "internaldocs.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    await prisma.internalDocument.delete({ where: { id } });
    await audit({ action: "internaldoc.delete", entityType: "InternalDocument", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
