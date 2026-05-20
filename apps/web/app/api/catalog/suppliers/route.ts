/**
 * GET  /api/catalog/suppliers      — list suppliers
 * POST /api/catalog/suppliers      — register supplier
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(200),
  mst: z.string().max(20).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const suppliers = await prisma.supplier.findMany({
      where: {
        active: true,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
      take: 200,
    });
    return NextResponse.json({ suppliers });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "catalog.suppliers.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const supplier = await prisma.supplier.create({ data: parsed.data });
    await audit({
      action: "supplier.create",
      entityType: "Supplier",
      entityId: supplier.id,
      actorId: session.userId,
      ...reqMeta(req),
      after: { name: supplier.name, mst: supplier.mst },
    });
    return NextResponse.json({ supplier });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
