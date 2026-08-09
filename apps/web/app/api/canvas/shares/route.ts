import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import { z } from "zod";

const Body = z.object({ sheetId: z.string(), role: z.enum(["VIEW", "COMMENT"]).default("COMMENT"), label: z.string().max(200).optional(), expiresAt: z.string().datetime().optional() });

export async function POST(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "canvas.share" });
  if (limited) return limited;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const sheet = await prisma.sheet.findUnique({ where: { id: parsed.data.sheetId }, include: { drawingSet: true } });
    if (!sheet) return NextResponse.json({ error: "Không tìm thấy bản vẽ" }, { status: 404 });
    const { session } = await requireProject(sheet.drawingSet.projectId);
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const share = await prisma.sheetShareLink.create({ data: { token, sheetId: sheet.id, projectId: sheet.drawingSet.projectId, role: parsed.data.role, label: parsed.data.label, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null, createdById: session.userId } });
    await audit({ action: "canvas.share.create", entityType: "SheetShareLink", entityId: share.id, actorId: session.userId, projectId: share.projectId, ...reqMeta(req), after: { sheetId: sheet.id, role: share.role, expiresAt: share.expiresAt } });
    return NextResponse.json({ url: `/c/${token}`, role: share.role, expiresAt: share.expiresAt }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}
