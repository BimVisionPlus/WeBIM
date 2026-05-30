import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  contractorName: z.string().min(2).max(200),
  contractorOrgId: z.string().optional(),
  scope: z.string().min(2).max(5000),
  amountVnd: z.coerce.bigint(),
  startDate: z.string(),
  endDate: z.string(),
  pctComplete: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(["ACTIVE","COMPLETED","ON_HOLD","CANCELLED"]).default("ACTIVE"),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "contractorassigns.create" }); if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const rec = await prisma.contractorAssignment.create({
      data: {
        projectId: d.projectId,
        contractorName: d.contractorName,
        contractorOrgId: d.contractorOrgId,
        scope: d.scope,
        amountVnd: d.amountVnd,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        pctComplete: d.pctComplete,
        status: d.status,
      },
    });
    await audit({ action: "contractor.assign.create", entityType: "ContractorAssignment", entityId: rec.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { contractor: rec.contractorName, amount: rec.amountVnd.toString() } });
    return NextResponse.json({ assignment: { ...rec, amountVnd: rec.amountVnd.toString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
