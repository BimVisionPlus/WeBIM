// POST /api/qaqc — Create a QaqcCheck from an ITP template at a given location.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  templateId: z.string().optional(),
  location: z.string().min(2).max(200),
  scheduledAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "qaqc.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const check = await prisma.qaqcCheck.create({
      data: {
        projectId: d.projectId,
        templateId: d.templateId ?? null,
        location: d.location,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        inspectorUserId: session.userId,
        photoUrls: [],
        result: "PENDING",
      },
    });
    await audit({ action: "qaqc.create", entityType: "QaqcCheck", entityId: check.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { location: d.location } });
    return NextResponse.json({ ok: true, id: check.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
