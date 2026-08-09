import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { audit, markupGeometrySchema, reqMeta, rateLimitGuard } from "@atlas/lib";
import { z } from "zod";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("markup"), guestName: z.string().trim().min(2).max(80), kind: z.enum(["PIN", "RECT", "CLOUD", "ARROW", "POLYLINE", "TEXT", "MEASURE"]), geometry: markupGeometrySchema, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ef4444"), label: z.string().max(500).optional() }),
  z.object({ action: z.literal("comment"), guestName: z.string().trim().min(2).max(80), markupId: z.string(), body: z.string().trim().min(1).max(5000) }),
]);

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = await rateLimitGuard(req, { name: "canvas.public", max: 30, windowSec: 60 });
  if (limited) return limited;
  try {
    const share = await prisma.sheetShareLink.findUnique({ where: { token: params.token } });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) return NextResponse.json({ error: "Liên kết không còn hiệu lực" }, { status: 410 });
    if (share.role !== "COMMENT") return NextResponse.json({ error: "Liên kết này chỉ cho phép xem" }, { status: 403 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    if (parsed.data.action === "markup") {
      if (parsed.data.geometry.kind !== parsed.data.kind) return NextResponse.json({ error: "Loại markup không khớp geometry" }, { status: 400 });
      const markup = await prisma.markup.create({ data: { sheetId: share.sheetId, guestName: parsed.data.guestName, kind: parsed.data.kind, geometry: parsed.data.geometry as any, color: parsed.data.color, label: parsed.data.label } });
      await audit({ action: "canvas.guest.markup.create", entityType: "Markup", entityId: markup.id, projectId: share.projectId, ...reqMeta(req), after: { guestName: parsed.data.guestName, shareId: share.id } });
      return NextResponse.json({ ...markup, authorName: parsed.data.guestName, comments: [] }, { status: 201 });
    }

    const belongs = await prisma.markup.findFirst({ where: { id: parsed.data.markupId, sheetId: share.sheetId }, select: { id: true } });
    if (!belongs) return NextResponse.json({ error: "Không tìm thấy markup" }, { status: 404 });
    const comment = await prisma.markupComment.create({ data: { markupId: belongs.id, guestName: parsed.data.guestName, body: parsed.data.body } });
    await audit({ action: "canvas.guest.comment.create", entityType: "MarkupComment", entityId: comment.id, projectId: share.projectId, ...reqMeta(req), after: { guestName: parsed.data.guestName, shareId: share.id } });
    return NextResponse.json({ ...comment, authorName: parsed.data.guestName }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
