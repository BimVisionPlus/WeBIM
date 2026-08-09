import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { CANVAS_PRESENCE_TTL_MS, canvasPresenceColor, rateLimitGuard } from "@atlas/lib";
import { z } from "zod";

const Body = z.object({ sessionKey: z.string().uuid() });

async function authorizedSheet(sheetId: string) {
  const sheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    include: { drawingSet: { select: { projectId: true } } },
  });
  if (!sheet) return null;
  const { session } = await requireProject(sheet.drawingSet.projectId);
  return { sheet, session };
}

async function currentPresence(sheetId: string) {
  return prisma.canvasPresence.findMany({
    where: {
      sheetId,
      lastSeenAt: { gte: new Date(Date.now() - CANVAS_PRESENCE_TTL_MS) },
    },
    select: { sessionKey: true, displayName: true, color: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });
}

export async function GET(_req: NextRequest, { params }: { params: { sheetId: string } }) {
  try {
    const authorized = await authorizedSheet(params.sheetId);
    if (!authorized) return NextResponse.json({ error: "Không tìm thấy bản vẽ" }, { status: 404 });
    return NextResponse.json({ presence: await currentPresence(params.sheetId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { sheetId: string } }) {
  const limited = await rateLimitGuard(req, { name: "canvas.presence", max: 30, windowSec: 60 });
  if (limited) return limited;
  try {
    const authorized = await authorizedSheet(params.sheetId);
    if (!authorized) return NextResponse.json({ error: "Không tìm thấy bản vẽ" }, { status: 404 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { id: authorized.session.userId },
      select: { name: true },
    });
    const displayName = user?.name ?? "Thành viên";
    await prisma.canvasPresence.upsert({
      where: {
        sheetId_sessionKey: { sheetId: params.sheetId, sessionKey: parsed.data.sessionKey },
      },
      create: {
        sheetId: params.sheetId,
        sessionKey: parsed.data.sessionKey,
        userId: authorized.session.userId,
        displayName,
        color: canvasPresenceColor(authorized.session.userId),
      },
      update: { displayName, lastSeenAt: new Date() },
    });
    await prisma.canvasPresence.deleteMany({
      where: { lastSeenAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return NextResponse.json({ presence: await currentPresence(params.sheetId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }
}
