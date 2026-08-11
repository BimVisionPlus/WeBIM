/**
 * POST /api/siteeye/vision — run PPE detection on an uploaded frame.
 *  Body: { projectId, cameraId?, imageBase64, context? }
 *  Persists a VisionEvent for each violation found.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { aiConfig, siteEyeAi, saveSuggestion } from "@atlas/ai";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  cameraId: z.string().optional(),
  imageBase64: z.string().min(100),
  context: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "siteeye.vision" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    if (!aiConfig().enabled) {
      return NextResponse.json({ error: "AI stack disabled (ai:up to start)" }, { status: 503 });
    }

    const result = await siteEyeAi.detectPpeViolations({
      imageBase64: d.imageBase64,
      context: d.context,
    });

    await saveSuggestion({
      kind: "siteeye.ppe",
      entityType: "Project",
      entityId: d.projectId,
      projectId: d.projectId,
      result,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason, error: result.error });
    }

    // Persist one VisionEvent per violation
    let created = 0;
    for (const v of result.data.violations) {
      await prisma.visionEvent.create({
        data: {
          projectId: d.projectId,
          cameraId: d.cameraId,
          kind: "PPE_VIOLATION",
          confidence: v.confidence,
          bbox: [],
          label: v.label,
          payload: { note: v.note, workersDetected: result.data.workersDetected } as any,
        },
      });
      created++;
    }

    await audit({
      action: "siteeye.vision.run",
      entityType: "Project",
      entityId: d.projectId,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { violations: created, workers: result.data.workersDetected, risk: result.data.overallRisk },
    });

    return NextResponse.json({ ok: true, finding: result.data, created });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
