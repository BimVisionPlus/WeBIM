// POST /api/registry — Upsert ContractorProfile for an Organization.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  legalName: z.string().min(2).max(300),
  mst: z.string().max(20).optional(),
  capabilityClass: z.enum(["HANG_I", "HANG_II", "HANG_III", "CHUA_PHAN_HANG"]),
  capabilityNo: z.string().max(64).optional(),
  capabilityScope: z.array(z.string()).default([]),
  charteredEng: z.number().int().min(0).default(0),
  totalStaff: z.number().int().min(0).default(0),
  yearsExperience: z.number().int().min(0).max(200).optional(),
  pastProjects: z.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "registry.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const profile = await prisma.contractorProfile.upsert({
      where: { orgId: d.orgId },
      create: { ...d },
      update: { capabilityClass: d.capabilityClass, capabilityScope: d.capabilityScope, charteredEng: d.charteredEng, totalStaff: d.totalStaff, pastProjects: d.pastProjects, yearsExperience: d.yearsExperience },
    });
    await audit({ action: "registry.upsert", entityType: "ContractorProfile", entityId: profile.id, actorId: session.userId, ...reqMeta(req), after: { orgId: d.orgId, class: d.capabilityClass } });
    return NextResponse.json({ ok: true, id: profile.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
