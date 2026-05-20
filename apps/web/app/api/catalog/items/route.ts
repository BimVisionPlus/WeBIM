/**
 * GET  /api/catalog/items?q=...&category=...  — search items
 * POST /api/catalog/items                       — create item
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string().optional(), // null = global catalog
  code: z.string().min(1).max(60),
  name: z.string().min(2).max(200),
  category: z.enum([
    "BE_TONG", "COT_THEP", "GACH_DA", "XI_MANG_VOI", "SON_PHU",
    "ME_HVAC", "ME_DIEN", "ME_NUOC", "PCCC", "CUA_KINH",
    "THIET_BI_THI_CONG", "KHAC",
  ]),
  unit: z.string().min(1).max(20),
  spec: z.string().max(2000).optional(),
  baselineUnitPriceVnd: z.coerce.bigint().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const category = url.searchParams.get("category") ?? undefined;
    const projectId = url.searchParams.get("projectId");

    const items = await prisma.catalogItem.findMany({
      where: {
        active: true,
        ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : { projectId: null }),
        ...(category ? { category: category as any } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { suppliers: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 300,
    });
    return NextResponse.json({
      items: items.map((i) => ({
        ...i,
        baselineUnitPriceVnd: i.baselineUnitPriceVnd?.toString() ?? null,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "catalog.items.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const item = await prisma.catalogItem.create({
      data: {
        projectId: d.projectId,
        code: d.code,
        name: d.name,
        category: d.category,
        unit: d.unit,
        spec: d.spec,
        baselineUnitPriceVnd: d.baselineUnitPriceVnd,
      },
    });

    await audit({
      action: "catalog.item.create",
      entityType: "CatalogItem",
      entityId: item.id,
      actorId: session.userId,
      projectId: d.projectId ?? null,
      ...reqMeta(req),
      after: { code: item.code, category: item.category },
    });

    return NextResponse.json({
      item: { ...item, baselineUnitPriceVnd: item.baselineUnitPriceVnd?.toString() ?? null },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
