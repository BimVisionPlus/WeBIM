import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(200).optional(),
  mst: z.string().max(20).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "catalog.suppliers.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const before = await prisma.supplier.findUnique({ where: { id }, select: { id: true, active: true } });
    if (!before) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const updated = await prisma.supplier.update({ where: { id }, data: parsed.data });
    await audit({ action: "supplier.update", entityType: "Supplier", entityId: id, actorId: session.userId, ...reqMeta(req), before: { active: before.active }, after: { active: updated.active } });
    return NextResponse.json({ supplier: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "catalog.suppliers.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const before = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!before) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const childCount = await prisma.supplierCatalogItem.count({ where: { supplierId: id } });
    if (childCount > 0) {
      await prisma.supplier.update({ where: { id }, data: { active: false } });
      await audit({ action: "supplier.deactivate", entityType: "Supplier", entityId: id, actorId: session.userId, ...reqMeta(req), after: { childCount, soft: true } });
      return NextResponse.json({ ok: true, soft: true, childCount });
    }
    await prisma.supplier.delete({ where: { id } });
    await audit({ action: "supplier.delete", entityType: "Supplier", entityId: id, actorId: session.userId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
