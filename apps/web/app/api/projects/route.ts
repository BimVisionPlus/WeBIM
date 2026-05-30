import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  ownerOrgId: z.string(),
  key: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, "Chỉ chữ in hoa, số, dấu gạch ngang"),
  name: z.string().min(2).max(200),
  address: z.string().max(300).optional(),
  province: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  contractValueVnd: z.string().optional(), // BigInt as string from JSON
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  permitNumber: z.string().max(80).optional(),
  permitDate: z.string().optional(),
  warrantyMonths: z.number().int().min(0).max(120).optional(),
  department: z
    .enum(["CONG_VIEC", "DAU_THAU", "HANH_CHINH", "TAI_CHINH_KE_TOAN", "PHAT_TRIEN_THI_TRUONG", "CONG_VIEC_KHAC"])
    .optional(),
  stakeholders: z
    .array(
      z.object({
        orgId: z.string(),
        role: z.enum([
          "CHU_DAU_TU",
          "TU_VAN_GIAM_SAT",
          "TU_VAN_THIET_KE",
          "NHA_THAU_CHINH",
          "NHA_THAU_PHU",
          "NHA_CUNG_CAP",
          "CO_QUAN_NHA_NUOC",
        ]),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "projects" });
  if (__rl) return __rl;
try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const { session } = await requireOrgMember(data.ownerOrgId, ["OWNER", "ADMIN", "PROJECT_MGR"]);

    const keyTaken = await prisma.project.findUnique({ where: { key: data.key } });
    if (keyTaken) return NextResponse.json({ error: "Mã dự án đã được dùng" }, { status: 409 });

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          ownerOrgId: data.ownerOrgId,
          key: data.key,
          name: data.name,
          address: data.address,
          province: data.province,
          district: data.district,
          contractValueVnd: data.contractValueVnd ? BigInt(data.contractValueVnd) : null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          permitNumber: data.permitNumber,
          permitDate: data.permitDate ? new Date(data.permitDate) : null,
          warrantyMonths: data.warrantyMonths ?? 24,
          ...(data.department ? { department: data.department } : {}),
        },
      });
      // owner org is always stakeholder as CHU_DAU_TU if its type is that;
      // else default to its type. Plus extras passed in.
      await tx.projectStakeholder.create({
        data: { projectId: p.id, orgId: data.ownerOrgId, role: "CHU_DAU_TU" },
      });
      if (data.stakeholders?.length) {
        for (const s of data.stakeholders) {
          await tx.projectStakeholder.upsert({
            where: { projectId_orgId_role: { projectId: p.id, orgId: s.orgId, role: s.role } },
            update: {},
            create: { projectId: p.id, orgId: s.orgId, role: s.role },
          });
        }
      }
      return p;
    });

    await audit({
      action: "project.created",
      entityType: "Project",
      entityId: project.id,
      actorId: session.userId,
      orgId: data.ownerOrgId,
      projectId: project.id,
      ...reqMeta(req),
      after: { key: project.key, name: project.name },
    });

    return NextResponse.json({ ok: true, project: { id: project.id, key: project.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function GET() {
  // List projects the caller has access to.
  try {
    const session = await (await import("@atlas/auth")).requireSession();
    const memberships = await prisma.membership.findMany({
      where: { userId: session.userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);
    const rows = await prisma.project.findMany({
      where: {
        OR: [
          { ownerOrgId: { in: orgIds } },
          { stakeholders: { some: { orgId: { in: orgIds } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { issues: true, models: true, drawingSets: true } } },
    });
    // contractValueVnd is BigInt — JSON.stringify chokes on it. Convert to
    // string at the API boundary; the client can BigInt() or parseInt() it.
    const projects = rows.map((p) => ({
      ...p,
      contractValueVnd: p.contractValueVnd === null ? null : p.contractValueVnd.toString(),
    }));
    return NextResponse.json({ projects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
