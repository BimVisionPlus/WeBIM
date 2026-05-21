/**
 * PATCH /api/costpulse/boq/lines/[lineId]
 *
 * Update a single BoQ line. The hot field is `qtyCompleted` (progress
 * tracking — drives EV in the EVM calculation), but operators also need
 * to fix typos in description/unit, correct price after a change order,
 * or re-categorize a line. All field updates are allowed only on the
 * current (isCurrent=true) BoQ — historical versions are immutable so
 * snapshot reports stay reproducible.
 *
 * The page-side EV/CPI/SPI numbers are derived from these rows on every
 * load (no precomputed cache), so a PATCH here is immediately reflected
 * in the dashboard after `router.refresh()`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const PatchBody = z.object({
  description: z.string().min(1).max(500).optional(),
  unit: z.string().min(1).max(20).optional(),
  qty: z.number().min(0).optional(),
  unitPriceVnd: z.number().int().min(0).optional(),
  qtyCompleted: z.number().min(0).optional(),
  category: z.string().max(80).nullable().optional(),
  costCode: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { lineId: string } }) {
  const __rl = await rateLimitGuard(req, { name: "costpulse-line" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const before = await prisma.boQLine.findUnique({
      where: { id: params.lineId },
      include: { boq: true },
    });
    if (!before) return NextResponse.json({ error: "Dòng BoQ không tồn tại" }, { status: 404 });
    if (!before.boq.isCurrent) {
      return NextResponse.json(
        { error: "Không sửa được dòng trong BoQ phiên bản cũ. Chỉ BoQ đang dùng (isCurrent=true) mới sửa được." },
        { status: 409 },
      );
    }
    await requireProject(before.boq.projectId);

    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.description !== undefined) update.description = data.description;
    if (data.unit !== undefined) update.unit = data.unit;
    if (data.category !== undefined) update.category = data.category || null;
    if (data.costCode !== undefined) update.costCode = data.costCode || null;

    // Recompute totalVnd if qty OR price changed (BigInt math).
    let nextQty = data.qty ?? before.qty;
    let nextPrice = data.unitPriceVnd !== undefined ? BigInt(data.unitPriceVnd) : before.unitPriceVnd;
    if (data.qty !== undefined) update.qty = data.qty;
    if (data.unitPriceVnd !== undefined) update.unitPriceVnd = BigInt(data.unitPriceVnd);
    if (data.qty !== undefined || data.unitPriceVnd !== undefined) {
      update.totalVnd = BigInt(Math.round(nextQty * Number(nextPrice)));
    }

    // qtyCompleted can be > qty (overrun) — UI surfaces it, but we don't
    // clamp here; that's a billing/QS conversation, not a data integrity one.
    if (data.qtyCompleted !== undefined) update.qtyCompleted = data.qtyCompleted;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, line: before, noop: true });
    }

    const line = await prisma.boQLine.update({ where: { id: params.lineId }, data: update });

    await audit({
      action: "boq_line.update",
      entityType: "BoQLine",
      entityId: line.id,
      actorId: session.userId,
      projectId: before.boq.projectId,
      ...reqMeta(req),
      before: {
        qty: before.qty,
        qtyCompleted: before.qtyCompleted,
        unitPriceVnd: before.unitPriceVnd.toString(),
      },
      after: { ...update, unitPriceVnd: update.unitPriceVnd?.toString() },
    });

    return NextResponse.json({
      ok: true,
      line: { ...line, unitPriceVnd: line.unitPriceVnd.toString(), totalVnd: line.totalVnd.toString() },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
