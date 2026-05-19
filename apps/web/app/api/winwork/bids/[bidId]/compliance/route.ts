/**
 * POST /api/winwork/bids/:bidId/compliance — run the rules engine + persist results.
 * GET — return latest results (latest checkedAt per ruleId).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, requireOrgMember, AuthError } from "@atlas/auth";
import { runCompliance, summarize, audit, reqMeta, type BidSnapshot, rateLimitGuard } from "@atlas/lib";

async function snapshot(bidId: string): Promise<BidSnapshot | null> {
  const b = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      org: { select: { id: true, name: true, mst: true } },
      opportunity: true,
      bonds: { where: { status: "ACTIVE" } },
      documents: true,
    },
  });
  if (!b) return null;

  // Naive doc bucket: classify by fileName keyword. Production wires a tag column.
  const docCounts = {
    financialCapacity: 0,
    experience: 0,
    personnel: 0,
    equipment: 0,
    methodology: 0,
    schedule: 0,
  };
  for (const d of b.documents) {
    const f = d.fileName.toLowerCase();
    if (/tài.?chính|bctc|báo.?cáo.?tài.?chính/.test(f)) docCounts.financialCapacity++;
    if (/kinh.?nghiệm|hợp.?đồng.?tương.?tự|experience/.test(f)) docCounts.experience++;
    if (/nhân.?sự|cv|chứng.?chỉ/.test(f)) docCounts.personnel++;
    if (/thiết.?bị|equipment/.test(f)) docCounts.equipment++;
    if (/biện.?pháp|methodology/.test(f)) docCounts.methodology++;
    if (/tiến.?độ|schedule|gantt/.test(f)) docCounts.schedule++;
  }

  return {
    id: b.id,
    state: b.state,
    org: { id: b.org.id, name: b.org.name, mst: b.org.mst },
    opportunity: b.opportunity
      ? {
          budgetVnd: b.opportunity.budgetVnd,
          bidMethod: b.opportunity.bidMethod,
          fundingSource: b.opportunity.fundingSource,
          closingAt: b.opportunity.closingAt,
          category: b.opportunity.category,
          invitorMst: b.opportunity.invitorMst,
        }
      : null,
    proposedValueVnd: b.proposedValueVnd,
    estimatedValueVnd: b.estimatedValueVnd,
    activeBonds: b.bonds.map((bd) => ({
      type: bd.type,
      amountVnd: bd.amountVnd,
      expiresAt: bd.expiresAt,
    })),
    docCounts,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { bidId: string } }) {
  try {
    await requireSession();
    const checks = await prisma.bidComplianceCheck.findMany({
      where: { bidId: params.bidId },
      orderBy: { checkedAt: "desc" },
    });
    // Keep latest per ruleId
    const byRule = new Map<string, (typeof checks)[number]>();
    for (const c of checks) if (!byRule.has(c.ruleId)) byRule.set(c.ruleId, c);
    return NextResponse.json({ checks: Array.from(byRule.values()) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { bidId: string } }) {
  
  const __rl = await rateLimitGuard(req, { name: "winwork.bids.bidId.compliance" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const snap = await snapshot(params.bidId);
    if (!snap) return NextResponse.json({ error: "bid not found" }, { status: 404 });
    if (!session.isSuperAdmin) {
      const bid = await prisma.bid.findUnique({ where: { id: params.bidId }, select: { orgId: true } });
      if (bid) await requireOrgMember(bid.orgId);
    }

    const results = runCompliance(snap);

    // Write fresh rows — keep history (don't delete prior runs)
    await prisma.bidComplianceCheck.createMany({
      data: results.map((r) => ({
        bidId: params.bidId,
        ruleId: r.ruleId,
        ruleVersion: r.ruleVersion,
        ruleTitle: r.ruleTitle,
        ruleRef: r.ruleRef,
        severity: r.severity,
        status: r.status,
        evidence: r.evidence as any,
        note: r.note,
      })),
    });

    await audit({
      action: "bid.compliance.run",
      entityType: "Bid",
      entityId: params.bidId,
      actorId: session.userId,
      ...reqMeta(req),
      after: summarize(results),
    });

    return NextResponse.json({ results, summary: summarize(results) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
