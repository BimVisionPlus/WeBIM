// POST /api/dinhmuc/[id]/price — Upsert đơn giá tỉnh × kỳ cho 1 mã định mức.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  province: z.string().min(2).max(8),
  period: z.string().regex(/^\d{4}-Q[1-4]$/, "Kỳ phải YYYY-Qx"),
  unitPriceVnd: z.string().regex(/^\d+$/),
  source: z.string().max(120).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "dinhmuc.price" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const norm = await prisma.normCode.findUnique({ where: { id: params.id } });
    if (!norm) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const d = parsed.data;
    await prisma.normPrice.upsert({
      where: { normId_province_period: { normId: norm.id, province: d.province, period: d.period } },
      create: { normId: norm.id, province: d.province, period: d.period, unitPriceVnd: BigInt(d.unitPriceVnd), source: d.source ?? null },
      update: { unitPriceVnd: BigInt(d.unitPriceVnd), source: d.source ?? null },
    });
    await audit({ action: "dinhmuc.price.upsert", entityType: "NormPrice", entityId: norm.id, actorId: session.userId, ...reqMeta(req), after: { province: d.province, period: d.period, price: d.unitPriceVnd } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
