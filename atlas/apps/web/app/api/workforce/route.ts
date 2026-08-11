// POST /api/workforce — Create SiteWorker.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  workerCode: z.string().min(2).max(32),
  fullName: z.string().min(2).max(120),
  idNo: z.string().max(20).optional(),
  trade: z.string().min(2).max(120),
  level: z.string().max(40).optional(),
  isStaff: z.boolean().default(false),
  hseGroup: z.enum(["N1", "N2", "N3", "N4", "N5", "N6"]).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "workforce.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const membership = await prisma.membership.findFirst({ where: { userId: session.userId } });
    if (!membership) return NextResponse.json({ error: "User chưa có org" }, { status: 400 });
    const worker = await prisma.siteWorker.create({
      data: {
        orgId: membership.orgId, projectId: d.projectId,
        workerCode: d.workerCode, fullName: d.fullName,
        idNo: d.idNo ?? null, trade: d.trade, level: d.level ?? null,
        isStaff: d.isStaff, hseGroup: d.hseGroup ?? null,
        startedAt: new Date(),
        badgeQrCode: `https://app.aecplatform.vn/workforce/badge/${d.workerCode}`,
        state: "ACTIVE",
      },
    });
    await audit({ action: "workforce.create", entityType: "SiteWorker", entityId: worker.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { workerCode: d.workerCode, fullName: d.fullName } });
    return NextResponse.json({ ok: true, id: worker.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
