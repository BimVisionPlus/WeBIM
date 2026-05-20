/**
 * GET  /api/crews?projectId=...           — list crews for a project
 * POST /api/crews                          — register a new crew
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  name: z.string().min(2).max(120),
  trade: z.string().min(2).max(80),
  foremanName: z.string().max(120).optional(),
  headcount: z.coerce.number().int().min(0).max(500).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const crews = await prisma.crew.findMany({
      where: { projectId },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ crews });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "crews.create" });
  if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireProject(d.projectId);

    const crew = await prisma.crew.create({
      data: {
        projectId: d.projectId,
        name: d.name,
        trade: d.trade,
        foremanName: d.foremanName,
        headcount: d.headcount,
      },
    });

    await audit({
      action: "crew.create",
      entityType: "Crew",
      entityId: crew.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { name: crew.name, trade: crew.trade },
    });
    return NextResponse.json({ crew });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
