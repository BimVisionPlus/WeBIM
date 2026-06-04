/**
 * POST /api/cost-norm/estimate
 *
 * Body: { code: string, qty: number, province?: string, period?: string }
 *
 * Returns total estimate using NormPrice for province/period;
 * breakdown VL/NC/M; resource breakdown (top 10 norm resources × qty).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  code: z.string(),
  qty: z.number().positive(),
  province: z.string().optional(),
  period: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "cost.norm.estimate" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { code, qty } = parsed.data;
    const province = parsed.data.province ?? "HCM";
    const period = parsed.data.period ?? `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;

    const norm = await prisma.normCode.findUnique({ where: { code }, include: { resources: true } });
    if (!norm) return NextResponse.json({ error: `Không tìm thấy mã định mức ${code}` }, { status: 404 });

    const price = await prisma.normPrice.findUnique({ where: { normId_province_period: { normId: norm.id, province, period } } });
    const unitPrice = price ? Number(price.unitPriceVnd) : 0;
    const vlUnit = price?.vlCostVnd ? Number(price.vlCostVnd) : 0;
    const ncUnit = price?.ncCostVnd ? Number(price.ncCostVnd) : 0;
    const mUnit = price?.mCostVnd ? Number(price.mCostVnd) : 0;

    return NextResponse.json({
      ok: true,
      code: norm.code, title: norm.title, unit: norm.unit, qty, province, period,
      hasPrice: !!price,
      unitPriceVnd: unitPrice,
      totalVnd: unitPrice * qty,
      breakdown: {
        vatLieuVnd: vlUnit * qty,
        nhanCongVnd: ncUnit * qty,
        mayThiCongVnd: mUnit * qty,
      },
      resources: norm.resources.slice(0, 10).map((r) => ({
        type: r.resourceType, description: r.description, unit: r.unit,
        quantityPerNorm: Number(r.quantity),
        totalQuantity: Number(r.quantity) * qty,
      })),
      priceSource: price?.source ?? null,
    });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
