import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  vehiclePlate: z.string().min(2).max(20).optional(),
  driverName: z.string().min(2).max(120).optional(),
  purpose: z.string().min(2).max(300).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_USE", "RETURNED", "CANCELLED"]).optional(),
  note: z.string().max(2000).optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.vehicleDispatch.findUnique({ where: { id }, select: { id: true, orgId: true, status: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "vehicledispatch.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.vehicleDispatch.update({
      where: { id },
      data: { ...d, startAt: d.startAt ? new Date(d.startAt) : undefined, endAt: d.endAt ? new Date(d.endAt) : (d.endAt === null ? null : undefined) },
    });
    await audit({ action: "vehicledispatch.update", entityType: "VehicleDispatch", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req), before: { status: rec.status }, after: { status: updated.status } });
    return NextResponse.json({ dispatch: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "vehicledispatch.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireOrgMember(rec.orgId);
    await prisma.vehicleDispatch.delete({ where: { id } });
    await audit({ action: "vehicledispatch.delete", entityType: "VehicleDispatch", entityId: id, actorId: session.userId, orgId: rec.orgId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
