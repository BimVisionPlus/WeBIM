// POST /api/labreports — Create LabReport (state=PENDING).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  sampleCode: z.string().min(3).max(64),
  sampleType: z.enum(["BE_TONG", "THEP", "XI_MANG", "CAT_DA", "DAT_NEN", "COC_NEN", "KHAC"]),
  testMethod: z.string().min(2).max(200),
  tcvnRef: z.string().min(2).max(120),
  labCode: z.string().min(2).max(40),
  labOrgName: z.string().max(200).optional(),
  sampledBy: z.string().max(120).optional(),
  materialLotId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "labreports.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const report = await prisma.labReport.create({
      data: {
        projectId: d.projectId, sampleCode: d.sampleCode, sampleType: d.sampleType,
        testMethod: d.testMethod, tcvnRef: d.tcvnRef, labCode: d.labCode,
        labOrgName: d.labOrgName ?? null, sampledBy: d.sampledBy ?? null,
        materialLotId: d.materialLotId ?? null,
        sampledAt: new Date(), parameters: {}, result: "PENDING",
      },
    });
    await audit({ action: "labreports.create", entityType: "LabReport", entityId: report.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { sampleCode: d.sampleCode } });
    return NextResponse.json({ ok: true, id: report.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
