/**
 * GET  /api/siteeye/incidents?projectId=...   — list incidents
 * POST /api/siteeye/incidents                  — file a new incident (1-tap)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  occurredAt: z.string(),
  category: z.enum([
    "AN_TOAN_LAO_DONG",
    "CHAY_NO",
    "SUP_DO",
    "ROI_NGA",
    "DIEN_GIAT",
    "HOA_CHAT",
    "MOI_TRUONG",
    "KHAC",
  ]),
  severity: z.enum(["NEAR_MISS", "MINOR", "MAJOR", "CRITICAL"]),
  description: z.string().min(5).max(5000),
  location: z.string().max(200).optional(),
  injured: z.coerce.number().int().min(0).default(0),
  rootCause: z.string().optional(),
  immediateAction: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const incidents = await prisma.incidentReport.findMany({
      where: { projectId },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: { photos: { select: { id: true, fileUrl: true, fileName: true } } },
    });
    return NextResponse.json({ incidents });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "siteeye.incidents" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    const inc = await prisma.incidentReport.create({
      data: {
        projectId: d.projectId,
        reporterId: session.userId,
        occurredAt: new Date(d.occurredAt),
        category: d.category,
        severity: d.severity,
        description: d.description,
        location: d.location,
        injured: d.injured,
        rootCause: d.rootCause,
        immediateAction: d.immediateAction,
      },
    });

    await audit({
      action: "incident.create",
      entityType: "IncidentReport",
      entityId: inc.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { category: inc.category, severity: inc.severity },
    });

    return NextResponse.json({ incident: inc });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
