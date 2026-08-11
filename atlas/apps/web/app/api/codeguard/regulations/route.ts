import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? undefined;
    const q = url.searchParams.get("q")?.trim() ?? "";

    const regs = await prisma.regulation.findMany({
      where: {
        ...(kind ? { kind: kind as any } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
                { tags: { has: q } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { rules: true } } },
      orderBy: [{ kind: "asc" }, { code: "asc" }],
      take: 500,
    });

    return NextResponse.json({ regulations: regs });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
