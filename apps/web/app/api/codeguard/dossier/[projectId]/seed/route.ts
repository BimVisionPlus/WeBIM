/**
 * POST /api/codeguard/dossier/:projectId/seed — initialize dossier from NĐ 15/2021 template.
 * Idempotent: existing rows kept, missing template items added.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { DOSSIER_TEMPLATE, audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  
  const __rl = await rateLimitGuard(req, { name: "codeguard.dossier.projectId.seed" });
  if (__rl) return __rl;
try {
    const { session } = await requireProject(params.projectId);

    const existing = await prisma.qualityDossierItem.findMany({
      where: { projectId: params.projectId },
      select: { itemCode: true },
    });
    const existingCodes = new Set(existing.map((e) => e.itemCode));
    const toCreate = DOSSIER_TEMPLATE.filter((t) => !existingCodes.has(t.itemCode));

    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0, existing: existing.length });
    }

    await prisma.qualityDossierItem.createMany({
      data: toCreate.map((t) => ({
        projectId: params.projectId,
        category: t.category,
        itemCode: t.itemCode,
        itemTitle: t.itemTitle,
        required: t.required,
      })),
    });

    await audit({
      action: "dossier.seed",
      entityType: "QualityDossierItem",
      actorId: session.userId,
      projectId: params.projectId,
      ...reqMeta(req),
      after: { created: toCreate.length },
    });

    return NextResponse.json({ created: toCreate.length });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
