/**
 * GET  /api/drawbridge/clashes?projectId=...   — list clashes
 * POST /api/drawbridge/clashes                  — run detection across all elements in a project
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { detectClashes, audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const clashes = await prisma.clash.findMany({
      where: { projectId },
      include: {
        elementA: { select: { id: true, name: true, category: true, discipline: true, level: true } },
        elementB: { select: { id: true, name: true, category: true, discipline: true, level: true } },
      },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: 500,
    });
    return NextResponse.json({ clashes });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

const RunBody = z.object({ projectId: z.string() });

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "drawbridge.clashes" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = RunBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { projectId } = parsed.data;
    await requireProject(projectId);

    const elements = await prisma.modelElement.findMany({
      where: { model: { projectId } },
      select: { id: true, discipline: true, category: true, bbox: true },
    });

    const hits = detectClashes(
      elements.map((e) => ({
        id: e.id,
        discipline: e.discipline,
        category: e.category,
        bbox: e.bbox,
      })),
    );

    // Only create rows for clashes that don't already exist OPEN.
    let created = 0;
    for (const h of hits) {
      const [a, b] = [h.aId, h.bId].sort();
      const exists = await prisma.clash.findFirst({
        where: {
          projectId,
          OR: [
            { elementAId: a, elementBId: b },
            { elementAId: b, elementBId: a },
          ],
          status: { not: "RESOLVED" },
        },
      });
      if (exists) continue;
      await prisma.clash.create({
        data: {
          projectId,
          elementAId: a!,
          elementBId: b!,
          severity: h.severity,
          category: h.category,
          description: `Overlap ${h.overlap.toFixed(3)} m³`,
        },
      });
      created++;
    }

    await audit({
      action: "drawbridge.clash.run",
      entityType: "Project",
      entityId: projectId,
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { totalHits: hits.length, created },
    });

    return NextResponse.json({ totalHits: hits.length, created });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
