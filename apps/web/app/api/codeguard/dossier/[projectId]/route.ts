/**
 * GET    /api/codeguard/dossier/:projectId         — list dossier items + completeness
 * POST   /api/codeguard/dossier/:projectId/seed    — initialize from NĐ 15/2021 template
 * PATCH  /api/codeguard/dossier/:projectId         — update an item (status / evidence)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { DOSSIER_TEMPLATE, audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    await requireProject(params.projectId);
    const items = await prisma.qualityDossierItem.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ category: "asc" }, { itemCode: "asc" }],
    });
    const summary = {
      total: items.length,
      missing: items.filter((i) => i.status === "MISSING").length,
      draft: items.filter((i) => i.status === "DRAFT").length,
      submitted: items.filter((i) => i.status === "SUBMITTED").length,
      accepted: items.filter((i) => i.status === "ACCEPTED").length,
      rejected: items.filter((i) => i.status === "REJECTED").length,
    };
    return NextResponse.json({ items, summary });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

const PatchBody = z.object({
  itemCode: z.string(),
  status: z.enum(["MISSING", "DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED"]).optional(),
  evidenceUrl: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  
  const __rl = await rateLimitGuard(req, { name: "codeguard.dossier.projectId" });
  if (__rl) return __rl;
try {
    const { session } = await requireProject(params.projectId);
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const updated = await prisma.qualityDossierItem.update({
      where: {
        projectId_itemCode: { projectId: params.projectId, itemCode: parsed.data.itemCode },
      },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.evidenceUrl !== undefined ? { evidenceUrl: parsed.data.evidenceUrl } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
        ...(parsed.data.status === "ACCEPTED" ? { reviewedAt: new Date(), reviewerId: session.userId } : {}),
        ...(parsed.data.evidenceUrl ? { uploadedAt: new Date() } : {}),
      },
    });

    await audit({
      action: "dossier.update",
      entityType: "QualityDossierItem",
      entityId: updated.id,
      actorId: session.userId,
      projectId: params.projectId,
      ...reqMeta(req),
      after: { itemCode: updated.itemCode, status: updated.status },
    });

    return NextResponse.json({ item: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
