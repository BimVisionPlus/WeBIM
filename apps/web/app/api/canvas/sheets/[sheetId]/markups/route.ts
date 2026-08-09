import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { audit, markupGeometrySchema, reqMeta, rateLimitGuard } from "@atlas/lib";
import { z } from "zod";

const Body = z.object({
  kind: z.enum(["PIN", "RECT", "CLOUD", "ARROW", "POLYLINE", "TEXT", "MEASURE"]),
  geometry: markupGeometrySchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ef4444"),
  label: z.string().max(500).optional(),
  pageNumber: z.number().int().positive().default(1),
});

export async function POST(req: NextRequest, { params }: { params: { sheetId: string } }) {
  const limited = await rateLimitGuard(req, { name: "canvas.markup" });
  if (limited) return limited;
  try {
    const sheet = await prisma.sheet.findUnique({
      where: { id: params.sheetId },
      include: { drawingSet: { select: { projectId: true } } },
    });
    if (!sheet) return NextResponse.json({ error: "Không tìm thấy bản vẽ" }, { status: 404 });
    const { session } = await requireProject(sheet.drawingSet.projectId);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.geometry.kind !== parsed.data.kind) {
      return NextResponse.json({ error: "Loại markup không khớp geometry" }, { status: 400 });
    }
    const markup = await prisma.markup.create({
      data: { ...parsed.data, geometry: parsed.data.geometry as any, sheetId: sheet.id, authorId: session.userId },
    });
    const author = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    await audit({ action: "canvas.markup.create", entityType: "Markup", entityId: markup.id, actorId: session.userId, projectId: sheet.drawingSet.projectId, ...reqMeta(req), after: { kind: markup.kind, sheetId: sheet.id } });
    return NextResponse.json({ ...markup, authorName: author?.name ?? "Thành viên", comments: [] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}
