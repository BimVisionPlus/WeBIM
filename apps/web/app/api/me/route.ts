import { NextResponse } from "next/server";
import { getSession } from "@atlas/auth";
import { prisma } from "@atlas/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const memberships = await prisma.membership.findMany({
    where: { userId: s.userId },
    include: { org: { select: { id: true, name: true, slug: true, type: true } } },
  });
  return NextResponse.json({
    user: { id: s.userId, email: s.email, name: s.name, isSuperAdmin: s.isSuperAdmin },
    memberships: memberships.map((m) => ({ role: m.role, org: m.org })),
  });
}
