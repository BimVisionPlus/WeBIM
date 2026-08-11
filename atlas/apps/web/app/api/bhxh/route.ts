import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  projectId: z.string().optional(),
  employeeName: z.string().min(2).max(120),
  employeeIdNo: z.string().max(20).optional(),
  bhxhNumber: z.string().max(20).optional(),
  status: z.enum(["DANG_DONG","TAM_DUNG","CHO_DANG_KY","DA_NGHI","KHAC"]).default("CHO_DANG_KY"),
  monthlyBaseVnd: z.coerce.bigint().optional(),
  startedAt: z.string().optional(),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "bhxh.create" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const rec = await prisma.socialInsuranceRecord.create({
      data: {
        orgId: d.orgId,
        projectId: d.projectId,
        employeeName: d.employeeName,
        employeeIdNo: d.employeeIdNo,
        bhxhNumber: d.bhxhNumber,
        status: d.status,
        monthlyBaseVnd: d.monthlyBaseVnd,
        startedAt: d.startedAt ? new Date(d.startedAt) : undefined,
        note: d.note,
      },
    });
    await audit({ action: "bhxh.create", entityType: "SocialInsuranceRecord", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { name: rec.employeeName, status: rec.status } });
    return NextResponse.json({ record: { ...rec, monthlyBaseVnd: rec.monthlyBaseVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
