import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import { bidWorkflow } from "@atlas/workflows";

const Body = z.object({
  orgId: z.string(),
  opportunityId: z.string().optional(),
  title: z.string().min(2).max(300),
  estimatedValueVnd: z.coerce.bigint().optional(),
  proposedValueVnd: z.coerce.bigint().optional(),
  marginPct: z.number().min(-50).max(200).optional(),
  contingencyPct: z.number().min(0).max(50).optional(),
});

async function nextBidKey(orgSlug: string): Promise<string> {
  // BID-<orgSlugUpper>-NNN — naive sequence based on existing count
  const count = await prisma.bid.count({ where: { orgId: { not: "" } } });
  return `BID-${orgSlug.toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    if (!session.isSuperAdmin) {
      await requireOrgMember(orgId);
    }

    const bids = await prisma.bid.findMany({
      where: { orgId },
      include: {
        opportunity: { select: { title: true, budgetVnd: true, closingAt: true, source: true } },
        owner: { select: { id: true, name: true } },
        bonds: { select: { id: true, type: true, status: true, expiresAt: true, amountVnd: true } },
        _count: { select: { complianceChecks: true, documents: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      bids: bids.map((b) => ({
        ...b,
        estimatedValueVnd: b.estimatedValueVnd?.toString() ?? null,
        proposedValueVnd: b.proposedValueVnd?.toString() ?? null,
        opportunity: b.opportunity
          ? {
              ...b.opportunity,
              budgetVnd: b.opportunity.budgetVnd?.toString() ?? null,
            }
          : null,
        bonds: b.bonds.map((bd) => ({ ...bd, amountVnd: bd.amountVnd.toString() })),
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "winwork.bids" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const org = await prisma.organization.findUnique({ where: { id: d.orgId } });
    if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });
    if (!session.isSuperAdmin) {
      await requireOrgMember(org.id);
    }

    const key = await nextBidKey(org.slug);
    const bid = await prisma.bid.create({
      data: {
        key,
        orgId: org.id,
        opportunityId: d.opportunityId,
        title: d.title,
        state: bidWorkflow.initial,
        ownerUserId: session.userId,
        estimatedValueVnd: d.estimatedValueVnd,
        proposedValueVnd: d.proposedValueVnd,
        marginPct: d.marginPct,
        contingencyPct: d.contingencyPct,
      },
    });

    await audit({
      action: "bid.create",
      entityType: "Bid",
      entityId: bid.id,
      actorId: session.userId,
      orgId: org.id,
      ...reqMeta(req),
      after: { key: bid.key, title: bid.title },
    });

    return NextResponse.json({
      bid: {
        ...bid,
        estimatedValueVnd: bid.estimatedValueVnd?.toString() ?? null,
        proposedValueVnd: bid.proposedValueVnd?.toString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
