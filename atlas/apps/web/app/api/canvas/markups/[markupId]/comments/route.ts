import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import { z } from "zod";

const Body = z.object({ body: z.string().trim().min(1).max(5000) });

export async function POST(req: NextRequest, { params }: { params: { markupId: string } }) {
  const limited = await rateLimitGuard(req, { name: "canvas.comment" });
  if (limited) return limited;
  try {
    const markup = await prisma.markup.findUnique({ where: { id: params.markupId }, include: { sheet: { include: { drawingSet: true } } } });
    if (!markup) return NextResponse.json({ error: "Không tìm thấy markup" }, { status: 404 });
    const { session } = await requireProject(markup.sheet.drawingSet.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const comment = await prisma.markupComment.create({ data: { markupId: markup.id, authorId: session.userId, body: parsed.data.body } });
    const author = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    await audit({ action: "canvas.comment.create", entityType: "MarkupComment", entityId: comment.id, actorId: session.userId, projectId: markup.sheet.drawingSet.projectId, ...reqMeta(req), after: { markupId: markup.id } });
    return NextResponse.json({ ...comment, authorName: author?.name ?? "Thành viên" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}
