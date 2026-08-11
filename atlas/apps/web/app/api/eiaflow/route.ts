// POST /api/eiaflow — Create EiaApplication.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  type: z.enum(["DTM", "DKDT", "GPMT", "BAO_CAO_DK"]),
  code: z.string().min(3).max(64),
  authority: z.string().min(2).max(200),
  consultantOrgId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "eiaflow.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const app = await prisma.eiaApplication.create({
      data: { ...d, consultantOrgId: d.consultantOrgId ?? null, state: "DRAFT" },
    });
    await audit({ action: "eiaflow.create", entityType: "EiaApplication", entityId: app.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { code: d.code, type: d.type } });
    return NextResponse.json({ ok: true, id: app.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
