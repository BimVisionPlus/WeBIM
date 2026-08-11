/**
 * GET  /api/drawbridge/elements?projectId=...   — list elements (paged)
 * POST /api/drawbridge/elements                  — register / bulk-register elements
 *
 * Production wires this to APS' object hierarchy callback after Forge translation
 * succeeds. For now we accept inline JSON so users (or batch importers) can
 * seed elements directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const category = url.searchParams.get("category") ?? undefined;
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const elements = await prisma.modelElement.findMany({
      where: {
        model: { projectId },
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { elementId: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { model: { select: { name: true, format: true, discipline: true } } },
      take: 300,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ elements });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

const Body = z.object({
  modelId: z.string(),
  elements: z
    .array(
      z.object({
        elementId: z.string(),
        name: z.string(),
        category: z.string(),
        discipline: z
          .enum([
            "KIEN_TRUC",
            "KET_CAU",
            "CO_DIEN_M",
            "CO_DIEN_E",
            "CO_DIEN_P",
            "PCCC",
            "CANH_QUAN",
            "HA_TANG",
            "NOI_THAT",
          ])
          .optional(),
        level: z.string().optional(),
        zone: z.string().optional(),
        ifcType: z.string().optional(),
        bbox: z.array(z.number()).length(6).optional(),
        properties: z.any().optional(),
      }),
    )
    .min(1)
    .max(2000),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "drawbridge.elements" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const model = await prisma.model.findUnique({ where: { id: parsed.data.modelId } });
    if (!model) return NextResponse.json({ error: "model not found" }, { status: 404 });
    await requireProject(model.projectId);

    // Upsert each — keep idempotent for re-imports
    let created = 0;
    let updated = 0;
    for (const e of parsed.data.elements) {
      const r = await prisma.modelElement.upsert({
        where: { modelId_elementId: { modelId: model.id, elementId: e.elementId } },
        create: {
          modelId: model.id,
          elementId: e.elementId,
          name: e.name,
          category: e.category,
          discipline: e.discipline,
          level: e.level,
          zone: e.zone,
          ifcType: e.ifcType,
          bbox: e.bbox ?? [],
          properties: e.properties,
        },
        update: {
          name: e.name,
          category: e.category,
          discipline: e.discipline,
          level: e.level,
          zone: e.zone,
          ifcType: e.ifcType,
          bbox: e.bbox ?? [],
          properties: e.properties,
        },
      });
      if (r.createdAt.getTime() === r.createdAt.getTime() && r.createdAt > new Date(Date.now() - 1000)) created++;
      else updated++;
    }

    await audit({
      action: "drawbridge.elements.import",
      entityType: "Model",
      entityId: model.id,
      actorId: session.userId,
      projectId: model.projectId,
      ...reqMeta(req),
      after: { count: parsed.data.elements.length, created, updated },
    });

    return NextResponse.json({ created, updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
