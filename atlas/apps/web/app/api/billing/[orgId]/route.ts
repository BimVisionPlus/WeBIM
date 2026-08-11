/**
 * GET /api/billing/:orgId — return the org's current plan + AI credit + recent
 * AI cost telemetry. Read-only; upgrade flow happens via /pricing → payment
 * provider redirect (or manual bank transfer for now).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { planFeatures, aiActionPriceVnd, rateLimitGuard } from "@atlas/lib";

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const __rl = await rateLimitGuard(req, { name: "billing.org" });
  if (__rl) return __rl;
  try {
    await requireOrgMember(params.orgId);

    const [sub, plans, recent] = await Promise.all([
      prisma.subscription.findUnique({ where: { orgId: params.orgId } }),
      prisma.plan.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
      prisma.aiCostEvent.findMany({
        where: { projectId: null },
        orderBy: { occurredAt: "desc" },
        take: 30,
      }),
    ]);

    const plan = sub ? plans.find((p) => p.id === sub.planId) : plans.find((p) => p.code === "free");
    const planCode = plan?.code ?? "free";

    // 30-day AI cost rollup
    const since = new Date(Date.now() - 30 * 86_400_000);
    const events = await prisma.aiCostEvent.findMany({
      where: { occurredAt: { gte: since } },
    });
    const totalCostVnd = events.reduce((s, e) => s + e.costVnd, 0n);
    const byFeature: Record<string, { count: number; vnd: string }> = {};
    for (const e of events) {
      const b = byFeature[e.feature] ?? { count: 0, vnd: "0" };
      b.count += 1;
      b.vnd = (BigInt(b.vnd) + e.costVnd).toString();
      byFeature[e.feature] = b;
    }

    return NextResponse.json({
      plan: plan ? { code: plan.code, name: plan.name } : null,
      subscription: sub
        ? {
            status: sub.status,
            renewsAt: sub.renewsAt,
            aiCreditVnd: sub.aiCreditVnd.toString(),
            paymentMethod: sub.paymentMethod,
          }
        : null,
      features: planFeatures(planCode),
      aiActionPriceVnd: aiActionPriceVnd(planCode).toString(),
      recent: recent.map((e) => ({
        ...e,
        costVnd: e.costVnd.toString(),
      })),
      ai30d: {
        totalVnd: totalCostVnd.toString(),
        events: events.length,
        byFeature,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
