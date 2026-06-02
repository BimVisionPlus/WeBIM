import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  description: z.string().min(5).max(5000).optional(),
  category: z.enum(["AN_TOAN_LAO_DONG","CHAY_NO","SUP_DO","ROI_NGA","DIEN_GIAT","HOA_CHAT","MOI_TRUONG","KHAC"]).optional(),
  severity: z.enum(["NEAR_MISS","MINOR","MAJOR","CRITICAL"]).optional(),
  location: z.string().max(200).optional().nullable(),
  injured: z.coerce.number().int().min(0).optional(),
  rootCause: z.string().max(5000).optional().nullable(),
  immediateAction: z.string().max(5000).optional().nullable(),
  closedAt: z.string().optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.incidentReport.findUnique({ where: { id }, select: { id: true, projectId: true, severity: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "siteeye.incident.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.incidentReport.update({
      where: { id },
      data: { ...d, closedAt: d.closedAt ? new Date(d.closedAt) : (d.closedAt === null ? null : undefined) },
    });
    await audit({ action: "incident.update", entityType: "IncidentReport", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), before: { severity: rec.severity }, after: { severity: updated.severity } });
    return NextResponse.json({ incident: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "siteeye.incident.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    await prisma.incidentReport.delete({ where: { id } });
    await audit({ action: "incident.delete", entityType: "IncidentReport", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
