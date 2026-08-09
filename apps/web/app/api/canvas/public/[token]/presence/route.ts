import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { CANVAS_PRESENCE_TTL_MS, canvasPresenceColor, rateLimitGuard } from "@atlas/lib";
import { z } from "zod";

const Body = z.object({
  sessionKey: z.string().uuid(),
  guestName: z.string().trim().min(2).max(80),
});

async function validShare(token: string) {
  const share = await prisma.sheetShareLink.findUnique({ where: { token } });
  if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) return null;
  return share;
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

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const share = await validShare(params.token);
  if (!share) return NextResponse.json({ error: "Liên kết không còn hiệu lực" }, { status: 410 });
  return NextResponse.json({ presence: await currentPresence(share.sheetId) });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = await rateLimitGuard(req, { name: "canvas.public.presence", max: 30, windowSec: 60 });
  if (limited) return limited;
  const share = await validShare(params.token);
  if (!share) return NextResponse.json({ error: "Liên kết không còn hiệu lực" }, { status: 410 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const displayName = parsed.data.guestName;
  await prisma.canvasPresence.upsert({
    where: {
      sheetId_sessionKey: { sheetId: share.sheetId, sessionKey: parsed.data.sessionKey },
    },
    create: {
      sheetId: share.sheetId,
      sessionKey: parsed.data.sessionKey,
      displayName,
      color: canvasPresenceColor(displayName),
    },
    update: { displayName, color: canvasPresenceColor(displayName), lastSeenAt: new Date() },
  });
  await prisma.canvasPresence.deleteMany({
    where: { lastSeenAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return NextResponse.json({ presence: await currentPresence(share.sheetId) });
}
