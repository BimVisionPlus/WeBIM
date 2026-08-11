import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  contractorName: z.string().min(2).max(200).optional(),
  scope: z.string().min(2).max(5000).optional(),
  amountVnd: z.coerce.bigint().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  pctComplete: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(["ACTIVE","COMPLETED","ON_HOLD","CANCELLED"]).optional(),
});

async function fetchOwned(id: string) {
  return prisma.contractorAssignment.findUnique({ where: { id }, select: { id: true, projectId: true, status: true, pctComplete: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "contractorassigns.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await fetchOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.contractorAssignment.update({
      where: { id },
      data: { ...d, startDate: d.startDate ? new Date(d.startDate) : undefined, endDate: d.endDate ? new Date(d.endDate) : undefined },
    });
    await audit({ action: "contractor.assign.update", entityType: "ContractorAssignment", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), before: { status: rec.status, pct: rec.pctComplete }, after: { status: updated.status, pct: updated.pctComplete } });
    return NextResponse.json({ assignment: { ...updated, amountVnd: updated.amountVnd.toString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "contractorassigns.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await fetchOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    await prisma.contractorAssignment.delete({ where: { id } });
    await audit({ action: "contractor.assign.delete", entityType: "ContractorAssignment", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
