/**
 * GET  /api/notifications — thông báo của tôi, mới nhất trước, kèm số chưa đọc.
 * PATCH /api/notifications — đánh dấu đã đọc: {ids: [...]} hoặc {all: true}.
 *
 * Chỉ của CHÍNH người gọi — không có tham số userId nào để đọc hộ người khác.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { rateLimitGuard } from "@atlas/lib";

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "notifications.list" });
  if (limited) return limited;
  try {
    const session = await requireSession();
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
    ]);
    return NextResponse.json({ items, unread });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

const Body = z.object({
  ids: z.array(z.string()).max(100).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "notifications.read" });
  if (limited) return limited;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success || (!parsed.data.ids?.length && !parsed.data.all)) {
      return NextResponse.json({ error: "Cần ids hoặc all" }, { status: 400 });
    }
    await prisma.notification.updateMany({
      where: {
        userId: session.userId,
        readAt: null,
        ...(parsed.data.all ? {} : { id: { in: parsed.data.ids } }),
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
