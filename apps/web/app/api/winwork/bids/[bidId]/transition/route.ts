/**
 * POST /api/winwork/bids/:bidId/transition — guarded FSM step.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, actorOrgRolesForProject, requireOrgMember, AuthError } from "@atlas/auth";
import { bidWorkflow, canTransition, type BidState } from "@atlas/workflows";
import { audit, reqMeta, runCompliance, isComplianceClean, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  to: z.enum([
    "DRAFT",
    "ESTIMATING",
    "READY",
    "SUBMITTED",
    "OPENED",
    "AWARDED",
    "LOST",
    "CANCELLED",
    "WITHDRAWN",
    "CLOSED",
  ]),
  reason: z.string().max(500).optional(),
  outcomeNote: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { bidId: string } }) {
  
  const __rl = await rateLimitGuard(req, { name: "winwork.bids.bidId.transition" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const bid = await prisma.bid.findUnique({
      where: { id: params.bidId },
      include: {
        org: { select: { id: true, name: true, mst: true } },
        opportunity: true,
        bonds: { where: { status: "ACTIVE" } },
        documents: true,
      },
    });
    if (!bid) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!session.isSuperAdmin) {
      await requireOrgMember(bid.orgId);
    }

    // Roles — pull from project if linked, else from membership on the bidding org
    const orgRoles = bid.projectId
      ? await actorOrgRolesForProject(session.userId, bid.projectId)
      : (await prisma.membership.findMany({ where: { userId: session.userId, orgId: bid.orgId } })).map(
          () => "NHA_THAU_CHINH" as const,
        );

    // Pre-compute compliance for guard on READY → SUBMITTED
    let complianceClean = true;
    if (parsed.data.to === "SUBMITTED") {
      const docCounts = {
        financialCapacity: 0,
        experience: 0,
        personnel: 0,
        equipment: 0,
        methodology: 0,
        schedule: 0,
      };
      for (const d of bid.documents) {
        const f = d.fileName.toLowerCase();
        if (/tài.?chính|bctc/.test(f)) docCounts.financialCapacity++;
        if (/kinh.?nghiệm|hợp.?đồng.?tương.?tự/.test(f)) docCounts.experience++;
        if (/nhân.?sự|chứng.?chỉ/.test(f)) docCounts.personnel++;
        if (/thiết.?bị/.test(f)) docCounts.equipment++;
        if (/biện.?pháp/.test(f)) docCounts.methodology++;
        if (/tiến.?độ/.test(f)) docCounts.schedule++;
      }
      const results = runCompliance({
        id: bid.id,
        state: bid.state,
        org: bid.org,
        opportunity: bid.opportunity
          ? {
              budgetVnd: bid.opportunity.budgetVnd,
              bidMethod: bid.opportunity.bidMethod,
              fundingSource: bid.opportunity.fundingSource,
              closingAt: bid.opportunity.closingAt,
              category: bid.opportunity.category,
              invitorMst: bid.opportunity.invitorMst,
            }
          : null,
        proposedValueVnd: bid.proposedValueVnd,
        estimatedValueVnd: bid.estimatedValueVnd,
        activeBonds: bid.bonds.map((b) => ({ type: b.type, amountVnd: b.amountVnd, expiresAt: b.expiresAt })),
        docCounts,
      });
      complianceClean = isComplianceClean(results);
    }

    const guardPayload: any = {
      proposedValueVnd: bid.proposedValueVnd !== null ? Number(bid.proposedValueVnd) : null,
      complianceClean,
    };

    const check = canTransition(
      bidWorkflow,
      bid.state as BidState,
      parsed.data.to,
      { userId: session.userId, orgRoles, isAdmin: session.isSuperAdmin },
      guardPayload,
    );
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });

    const outcomeMap: Record<string, "AWARDED" | "LOST" | "CANCELLED" | "WITHDRAWN" | null> = {
      AWARDED: "AWARDED",
      LOST: "LOST",
      CANCELLED: "CANCELLED",
      WITHDRAWN: "WITHDRAWN",
    };

    const updated = await prisma.bid.update({
      where: { id: bid.id },
      data: {
        state: parsed.data.to,
        outcome: outcomeMap[parsed.data.to] ?? bid.outcome,
        outcomeNote: parsed.data.outcomeNote ?? bid.outcomeNote,
        submittedAt: parsed.data.to === "SUBMITTED" ? new Date() : bid.submittedAt,
        decisionAt: ["AWARDED", "LOST", "CANCELLED"].includes(parsed.data.to)
          ? new Date()
          : bid.decisionAt,
      },
    });

    await audit({
      action: "bid.transition",
      entityType: "Bid",
      entityId: bid.id,
      actorId: session.userId,
      orgId: bid.orgId,
      ...reqMeta(req),
      before: { state: bid.state },
      after: { state: updated.state, action: check.transition.action },
    });

    return NextResponse.json({
      bid: {
        ...updated,
        estimatedValueVnd: updated.estimatedValueVnd?.toString() ?? null,
        proposedValueVnd: updated.proposedValueVnd?.toString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
