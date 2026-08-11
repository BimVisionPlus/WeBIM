import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  applicationCode: z.string().max(80).optional().nullable(),
  applicant: z.string().min(2).max(200).optional(),
  state: z.enum(["DRAFT", "SUBMITTED", "REVIEWING", "APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
  submittedAt: z.string().optional().nullable(),
  decisionAt: z.string().optional().nullable(),
  decisionNote: z.string().max(5000).optional().nullable(),
});

async function getOwned(id: string) {
  return prisma.permitApplication.findUnique({ where: { id }, select: { id: true, projectId: true, state: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "permitflow.patch" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const updated = await prisma.permitApplication.update({
      where: { id },
      data: { ...d,
        submittedAt: d.submittedAt ? new Date(d.submittedAt) : (d.submittedAt === null ? null : undefined),
        decisionAt: d.decisionAt ? new Date(d.decisionAt) : (d.decisionAt === null ? null : undefined),
      },
    });
    await audit({ action: "permit.application.update", entityType: "PermitApplication", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req), before: { state: rec.state }, after: { state: updated.state } });
    return NextResponse.json({ application: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "permitflow.delete" }); if (rl) return rl;
  try {
    const { id } = await ctx.params;
    const rec = await getOwned(id);
    if (!rec) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const { session } = await requireProject(rec.projectId);
    await prisma.permitChecklist.deleteMany({ where: { applicationId: id } });
    await prisma.permitApplication.delete({ where: { id } });
    await audit({ action: "permit.application.delete", entityType: "PermitApplication", entityId: id, actorId: session.userId, projectId: rec.projectId, ...reqMeta(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
