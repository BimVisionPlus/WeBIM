import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(200).optional(),
  category: z.enum(["BE_TONG","COT_THEP","GACH_DA","XI_MANG_VOI","SON_PHU","ME_HVAC","ME_DIEN","ME_NUOC","PCCC","CUA_KINH","THIET_BI_THI_CONG","KHAC"]).optional(),
  unit: z.string().min(1).max(20).optional(),
  spec: z.string().max(2000).optional().nullable(),
  baselineUnitPriceVnd: z.coerce.bigint().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "catalog.items.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const before = await prisma.catalogItem.findUnique({ where: { id }, select: { id: true, name: true, active: true } });
    if (!before) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const updated = await prisma.catalogItem.update({ where: { id }, data: parsed.data });
    await audit({ action: "catalog.item.update", entityType: "CatalogItem", entityId: id, actorId: session.userId, ...reqMeta(req), before: { active: before.active }, after: { active: updated.active } });
    return NextResponse.json({ item: { ...updated, baselineUnitPriceVnd: updated.baselineUnitPriceVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// Soft delete via active=false (CatalogItem has children: SupplierCatalogItem, SubmittalItem refs)
export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "catalog.items.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const session = await requireSession();
    const before = await prisma.catalogItem.findUnique({ where: { id }, select: { id: true } });
    if (!before) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const childCount = await prisma.supplierCatalogItem.count({ where: { catalogItemId: id } });
    if (childCount > 0) {
      await prisma.catalogItem.update({ where: { id }, data: { active: false } });
      await audit({ action: "catalog.item.deactivate", entityType: "CatalogItem", entityId: id, actorId: session.userId, ...reqMeta(req), after: { childCount, soft: true } });
      return NextResponse.json({ ok: true, soft: true, childCount });
    }
    await prisma.catalogItem.delete({ where: { id } });
    await audit({ action: "catalog.item.delete", entityType: "CatalogItem", entityId: id, actorId: session.userId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
