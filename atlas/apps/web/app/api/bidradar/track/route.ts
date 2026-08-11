import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  opportunityId: z.string(),
  orgId: z.string(),
  territoryId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "bidradar.track" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);

    const opp = await prisma.tenderOpportunity.findUnique({ where: { id: d.opportunityId } });
    if (!opp) return NextResponse.json({ error: "Cơ hội không tồn tại" }, { status: 404 });

    const lead = await prisma.projectLead.create({
      data: {
        orgId: d.orgId,
        territoryId: d.territoryId,
        name: opp.title,
        clientName: opp.invitor,
        province: opp.province,
        estValueVnd: opp.budgetVnd,
        source: opp.source,
        status: "TRACKING",
        nextActionAt: opp.closingAt ?? undefined,
        note: opp.sourceUrl ? `Nguồn: ${opp.sourceUrl}` : undefined,
      },
    });

    await audit({
      action: "bidradar.track", entityType: "ProjectLead", entityId: lead.id, actorId: session.userId, orgId: d.orgId,
      ...reqMeta(req), after: { leadName: lead.name, source: opp.source },
    });
    return NextResponse.json({ lead: { id: lead.id, name: lead.name } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
