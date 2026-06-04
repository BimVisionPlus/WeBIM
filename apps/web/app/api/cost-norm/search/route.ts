/**
 * GET /api/cost-norm/search?q=...&province=HCM&period=2026-Q2
 *
 * Searches the định mức (TT 10/2019) catalog. Returns top 20 matches
 * with unitPrice for the requested province/period if available.
 *
 * Auth: requireSession (read-only public for org members).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { rateLimitGuard } from "@atlas/lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "cost.norm.search" }); if (rl) return rl;
  try {
    await requireSession();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const province = url.searchParams.get("province") ?? "HCM";
    const period = url.searchParams.get("period") ?? `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;

    const norms = await prisma.normCode.findMany({
      where: q.length >= 2 ? {
        OR: [
          { code: { contains: q.toUpperCase() } },
          { title: { contains: q, mode: "insensitive" } },
          { chapter: { contains: q, mode: "insensitive" } },
          { group: { contains: q, mode: "insensitive" } },
        ],
      } : {},
      take: 20,
      orderBy: [{ chapter: "asc" }, { code: "asc" }],
    });
    const codeIds = norms.map((n) => n.id);
    const prices = await prisma.normPrice.findMany({
      where: { normId: { in: codeIds }, province, period },
      select: { normId: true, unitPriceVnd: true, vlCostVnd: true, ncCostVnd: true, mCostVnd: true, source: true },
    });
    const priceByNorm = new Map(prices.map((p) => [p.normId, p]));

    const rows = norms.map((n) => {
      const p = priceByNorm.get(n.id);
      return {
        id: n.id, code: n.code, chapter: n.chapter, section: n.section, group: n.group, title: n.title, unit: n.unit, source: n.source,
        unitPriceVnd: p?.unitPriceVnd?.toString() ?? null,
        vlCostVnd: p?.vlCostVnd?.toString() ?? null,
        ncCostVnd: p?.ncCostVnd?.toString() ?? null,
        mCostVnd: p?.mCostVnd?.toString() ?? null,
        priceSource: p?.source ?? null,
      };
    });

    return NextResponse.json({ ok: true, q, province, period, count: rows.length, rows });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
