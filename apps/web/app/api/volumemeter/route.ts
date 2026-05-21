// POST /api/volumemeter — Create a TakeoffSheet.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  code: z.string().min(3).max(64),
  title: z.string().min(2).max(200),
  scope: z.string().min(2).max(300),
  source: z.enum(["MANUAL", "IFC_AUTO", "HYBRID", "IMPORTED"]).default("MANUAL"),
  modelId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "volumemeter.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const sheet = await prisma.takeoffSheet.create({
      data: { ...d, modelId: d.modelId ?? null, notes: d.notes ?? null, state: "DRAFT" },
    });
    await audit({ action: "volumemeter.create", entityType: "TakeoffSheet", entityId: sheet.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { code: d.code } });
    return NextResponse.json({ ok: true, id: sheet.id, code: sheet.code });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
