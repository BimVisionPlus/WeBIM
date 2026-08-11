/**
 * GET  /api/crews/assignments?projectId=...&from=...&to=...  — look-ahead window
 * POST /api/crews/assignments                                  — create assignment
 * PATCH /api/crews/assignments                                  — update state / hours
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const CreateBody = z.object({
  projectId: z.string(),
  crewId: z.string(),
  workDate: z.string(),
  shift: z.enum(["DAY", "NIGHT"]).default("DAY"),
  title: z.string().min(2).max(300),
  description: z.string().max(2000).optional(),
  zone: z.string().max(120).optional(),
  hoursPlanned: z.coerce.number().min(0).max(24).optional(),
  issueId: z.string().optional(),
});

const PatchBody = z.object({
  id: z.string(),
  state: z.enum(["PLANNED", "IN_PROGRESS", "BLOCKED", "DONE", "REVIEWED"]).optional(),
  blockedReason: z.string().max(500).optional(),
  hoursActual: z.coerce.number().min(0).max(24).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(Date.now() - 7 * 86_400_000);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date(Date.now() + 14 * 86_400_000);

    const assignments = await prisma.crewAssignment.findMany({
      where: { projectId, workDate: { gte: from, lte: to } },
      include: { crew: { select: { name: true, trade: true } } },
      orderBy: [{ workDate: "asc" }, { shift: "asc" }],
    });
    return NextResponse.json({ assignments });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "crews.assignments.create" });
  if (rl) return rl;
  try {
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireProject(d.projectId);

    const a = await prisma.crewAssignment.create({
      data: {
        projectId: d.projectId,
        crewId: d.crewId,
        workDate: new Date(d.workDate),
        shift: d.shift,
        title: d.title,
        description: d.description,
        zone: d.zone,
        hoursPlanned: d.hoursPlanned,
        issueId: d.issueId,
      },
    });

    await audit({
      action: "crew.assignment.create",
      entityType: "CrewAssignment",
      entityId: a.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { title: a.title, workDate: a.workDate, shift: a.shift },
    });
    return NextResponse.json({ assignment: a });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "crews.assignments.patch" });
  if (rl) return rl;
  try {
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const existing = await prisma.crewAssignment.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { session } = await requireProject(existing.projectId);

    const updated = await prisma.crewAssignment.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.state ? { state: parsed.data.state } : {}),
        ...(parsed.data.blockedReason !== undefined ? { blockedReason: parsed.data.blockedReason } : {}),
        ...(parsed.data.hoursActual !== undefined ? { hoursActual: parsed.data.hoursActual } : {}),
      },
    });

    await audit({
      action: "crew.assignment.update",
      entityType: "CrewAssignment",
      entityId: updated.id,
      actorId: session.userId,
      projectId: existing.projectId,
      ...reqMeta(req),
      before: { state: existing.state },
      after: { state: updated.state },
    });
    return NextResponse.json({ assignment: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
