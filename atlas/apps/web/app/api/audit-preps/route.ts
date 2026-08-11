/**
 * POST /api/audit-preps — create new audit prep workflow.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  kind: z.enum(["PC07_PCCC", "SO_XAY_DUNG", "CDT_NGHIEM_THU", "HOAN_CONG_QLNN", "TVGS_NGHIEM_THU", "KHAC"]),
  title: z.string().min(2).max(300),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().optional(),
  inspectorOrg: z.string().max(200).optional(),
  inspectorName: z.string().max(200).optional(),
  items: z.array(z.object({
    code: z.string(), title: z.string(), required: z.boolean().default(true), regulationCode: z.string().optional(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "auditprep.create" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireProject(d.projectId);
    const prep = await prisma.auditPrep.create({
      data: {
        projectId: d.projectId, kind: d.kind, title: d.title, description: d.description,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        inspectorOrg: d.inspectorOrg, inspectorName: d.inspectorName,
        state: "DRAFT",
        items: d.items?.length ? {
          create: d.items.map((it, i) => ({
            seq: i + 1, code: it.code, title: it.title, required: it.required, regulationCode: it.regulationCode ?? null,
            state: "PENDING",
          })),
        } : undefined,
      },
      include: { items: true },
    });
    await audit({ action: "auditprep.create", entityType: "AuditPrep", entityId: prep.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { kind: prep.kind, itemCount: prep.items.length } });
    return NextResponse.json({ prep });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
