import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { audit, reqMeta } from "@atlas/lib";
import { z } from "zod";

const Body = z.object({ status: z.enum(["OPEN", "RESOLVED"]) });

export async function PATCH(req: NextRequest, { params }: { params: { markupId: string } }) {
  try {
    const existing = await prisma.markup.findUnique({ where: { id: params.markupId }, include: { sheet: { include: { drawingSet: true } } } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy markup" }, { status: 404 });
    const { session } = await requireProject(existing.sheet.drawingSet.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const resolved = parsed.data.status === "RESOLVED";
    const markup = await prisma.markup.update({ where: { id: existing.id }, data: { status: parsed.data.status, resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? session.userId : null } });
    await audit({ action: resolved ? "canvas.markup.resolve" : "canvas.markup.reopen", entityType: "Markup", entityId: markup.id, actorId: session.userId, projectId: existing.sheet.drawingSet.projectId, ...reqMeta(req) });
    return NextResponse.json(markup);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}
