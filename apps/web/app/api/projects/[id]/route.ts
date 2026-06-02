/**
 * PATCH /api/projects/:id — update mutable project fields.
 * DELETE /api/projects/:id — soft-delete (Project.status = CLOSED) to preserve
 *   all child records (issues, RFI, BoQ, ScheduleTask, ...) and audit trail.
 *   Hard delete only via direct DB access.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  name: z.string().min(2).max(200).optional(),
  province: z.string().max(80).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  contractValueVnd: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  permitNumber: z.string().max(80).optional().nullable(),
  permitDate: z.string().optional().nullable(),
  warrantyMonths: z.coerce.number().int().min(0).max(120).optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "HANDOVER", "WARRANTY", "CLOSED"]).optional(),
  department: z.enum(["CONG_VIEC", "DAU_THAU", "HANH_CHINH", "TAI_CHINH_KE_TOAN", "PHAT_TRIEN_THI_TRUONG", "CONG_VIEC_KHAC"]).optional(),
  contractScope: z.string().max(20000).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "projects.patch" });
  if (rl) return rl;
  try {
    const params = await ctx.params;
    const { session } = await requireProject(params.id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    if (Object.keys(d).length === 0) return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });

    const before = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, status: true, department: true, contractValueVnd: true },
    });
    if (!before) return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...d,
        contractValueVnd: d.contractValueVnd ? BigInt(d.contractValueVnd) : (d.contractValueVnd === null ? null : undefined),
        startDate: d.startDate ? new Date(d.startDate) : (d.startDate === null ? null : undefined),
        endDate: d.endDate ? new Date(d.endDate) : (d.endDate === null ? null : undefined),
        permitDate: d.permitDate ? new Date(d.permitDate) : (d.permitDate === null ? null : undefined),
      },
    });

    await audit({
      action: "project.update", entityType: "Project", entityId: params.id,
      actorId: session.userId, projectId: params.id, ...reqMeta(req),
      before: { name: before.name, status: before.status, department: before.department },
      after: { name: updated.name, status: updated.status, department: updated.department },
    });

    return NextResponse.json({ project: { ...updated, contractValueVnd: updated.contractValueVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "projects.delete" });
  if (rl) return rl;
  try {
    const params = await ctx.params;
    const { session } = await requireProject(params.id);
    const before = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, status: true, name: true } });
    if (!before) return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    // Soft delete: mark status=CLOSED. Hard delete via DB if truly needed.
    const updated = await prisma.project.update({ where: { id: params.id }, data: { status: "CLOSED" }, select: { id: true, status: true } });
    await audit({
      action: "project.soft.delete", entityType: "Project", entityId: params.id,
      actorId: session.userId, projectId: params.id, ...reqMeta(req),
      before: { status: before.status, name: before.name },
      after: { status: updated.status, soft: true },
    });
    return NextResponse.json({ ok: true, soft: true, status: updated.status });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
