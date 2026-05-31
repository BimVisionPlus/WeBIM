import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  leadId: z.string(),
  projectKey: z.string().regex(/^[A-Z0-9-]+$/, "Mã chỉ chữ in hoa, số, gạch ngang").min(2).max(20),
  ownerOrgId: z.string(),
  contractValueVnd: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "lead.promote" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.ownerOrgId);

    const lead = await prisma.projectLead.findUnique({ where: { id: d.leadId } });
    if (!lead) return NextResponse.json({ error: "Lead không tồn tại" }, { status: 404 });
    if (lead.status !== "WON") return NextResponse.json({ error: "Lead phải có trạng thái 'Đã trúng' để chuyển thành dự án" }, { status: 400 });

    const keyTaken = await prisma.project.findUnique({ where: { key: d.projectKey } });
    if (keyTaken) return NextResponse.json({ error: "Mã dự án đã được dùng" }, { status: 409 });

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          ownerOrgId: d.ownerOrgId,
          key: d.projectKey,
          name: lead.name,
          province: lead.province,
          contractValueVnd: d.contractValueVnd ? BigInt(d.contractValueVnd) : (lead.estValueVnd ?? undefined),
          status: "PLANNING",
          department: "CONG_VIEC",
        },
      });
      await tx.projectStakeholder.create({ data: { projectId: p.id, orgId: d.ownerOrgId, role: "CHU_DAU_TU" } });
      await tx.projectLead.update({ where: { id: lead.id }, data: { status: "ARCHIVED", note: `${lead.note ?? ""}\n→ Đã chuyển thành dự án ${p.key} (${new Date().toISOString().slice(0,10)})`.trim() } });
      return p;
    });

    await audit({
      action: "lead.promote", entityType: "ProjectLead", entityId: lead.id, actorId: session.userId, orgId: d.ownerOrgId,
      projectId: project.id, ...reqMeta(req),
      after: { projectKey: project.key, fromLead: lead.name },
    });
    return NextResponse.json({ project: { id: project.id, key: project.key } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
