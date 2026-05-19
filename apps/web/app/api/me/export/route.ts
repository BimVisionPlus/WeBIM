/**
 * VN data-protection (NĐ 13/2023) — user data export.
 * Returns JSON with all PII and content authored by the caller.
 */

import { NextResponse } from "next/server";
import { requireSession } from "@atlas/auth";
import { prisma } from "@atlas/db";
import { audit, reqMeta } from "@atlas/lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const [user, memberships, issues, dailyLogs, comments, signoffs, auditLog] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.membership.findMany({ where: { userId: session.userId }, include: { org: true } }),
    prisma.issue.findMany({
      where: { OR: [{ reporterId: session.userId }, { assigneeId: session.userId }] },
      take: 5000,
    }),
    prisma.dailyLog.findMany({ where: { authorId: session.userId }, take: 5000 }),
    prisma.comment.findMany({ where: { authorId: session.userId }, take: 5000 }),
    prisma.signoff.findMany({ where: { userId: session.userId }, take: 5000 }),
    prisma.auditEvent.findMany({ where: { actorId: session.userId }, take: 10000, orderBy: { createdAt: "desc" } }),
  ]);

  await audit({ action: "me.data_exported", entityType: "User", actorId: session.userId, ...reqMeta(req as Request) });

  const payload = {
    exportedAt: new Date().toISOString(),
    user: user ? { ...user, passwordHash: undefined } : null,
    memberships,
    issues,
    dailyLogs,
    comments,
    signoffs,
    auditLog,
  };

  // BigInt → string for JSON safety
  const json = JSON.stringify(payload, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atlas-aec-data-${session.userId}.json"`,
    },
  });
}
