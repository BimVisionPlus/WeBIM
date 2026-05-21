/**
 * PATCH / DELETE /api/crews/[crewId]
 *
 * Edit one crew's metadata (name, trade, foreman, headcount) or
 * soft-delete by setting `active=false` (the list view already filters
 * on `active: true`, so flipping the flag is equivalent to hiding it
 * without breaking historical assignments that reference this crew).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const PatchBody = z.object({
  name: z.string().min(2).max(80).optional(),
  trade: z.string().min(1).max(80).optional(),
  foremanName: z.string().max(120).nullable().optional(),
  headcount: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { crewId: string } }) {
  const __rl = await rateLimitGuard(req, { name: "crews" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const before = await prisma.crew.findUnique({ where: { id: params.crewId } });
    if (!before) return NextResponse.json({ error: "Tổ đội không tồn tại" }, { status: 404 });
    await requireProject(before.projectId);

    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.trade !== undefined) update.trade = data.trade;
    if (data.foremanName !== undefined) update.foremanName = data.foremanName || null;
    if (data.headcount !== undefined) update.headcount = data.headcount;
    if (data.active !== undefined) update.active = data.active;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, crew: before, noop: true });
    }

    const crew = await prisma.crew.update({ where: { id: params.crewId }, data: update });

    await audit({
      action: "crew.update",
      entityType: "Crew",
      entityId: crew.id,
      actorId: session.userId,
      projectId: crew.projectId,
      ...reqMeta(req),
      before: {
        name: before.name,
        trade: before.trade,
        headcount: before.headcount,
        active: before.active,
      },
      after: update,
    });

    return NextResponse.json({ ok: true, crew });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { crewId: string } }) {
  // Soft-delete: flip `active=false` instead of removing the row, so that
  // historical CrewAssignments retain their FK reference for audit.
  try {
    const session = await requireSession();
    const before = await prisma.crew.findUnique({ where: { id: params.crewId } });
    if (!before) return NextResponse.json({ error: "Tổ đội không tồn tại" }, { status: 404 });
    await requireProject(before.projectId);
    const crew = await prisma.crew.update({ where: { id: params.crewId }, data: { active: false } });
    await audit({
      action: "crew.deactivate",
      entityType: "Crew",
      entityId: crew.id,
      actorId: session.userId,
      projectId: crew.projectId,
      ...reqMeta(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
