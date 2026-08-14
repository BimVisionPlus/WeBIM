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
import { audit, notifyUsers, orgManagerIds, reqMeta, rateLimitGuard } from "@atlas/lib";

/**
 * Thứ tự giai đoạn — chỉ chiều TIẾN mới bị cưỡng chế qua điểm dừng. Lùi
 * giai đoạn (phát hiện làm sai, mở lại hồ sơ) là việc sửa chữa, chặn nó
 * bằng gate của giai đoạn sau là khoá luôn đường quay đầu.
 */
const STAGE_ORDER = ["PLANNING", "IN_PROGRESS", "HANDOVER", "WARRANTY", "CLOSED"] as const;
const STAGE_LABEL: Record<string, string> = {
  PLANNING: "Chuẩn bị",
  IN_PROGRESS: "Đang thi công",
  HANDOVER: "Bàn giao",
  WARRANTY: "Bảo hành",
  CLOSED: "Đã đóng hồ sơ",
};

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
  businessUnitId: z.string().optional().nullable(),
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

    // ── Cưỡng chế chuyển giai đoạn (A3) ─────────────────────────────────
    // Tiến giai đoạn đòi mọi run STAGE_GATE của dự án đã đóng. Đây là chốt
    // PHÍA MÁY CHỦ: một stage gate mà UI ẩn nút là trang trí, còn API vẫn
    // nhận PATCH thì ai gọi thẳng API cũng đi vòng được.
    const movingForward =
      d.status !== undefined &&
      STAGE_ORDER.indexOf(d.status) > STAGE_ORDER.indexOf(before.status as (typeof STAGE_ORDER)[number]);
    if (movingForward) {
      const openGateRuns = await prisma.processRun.findMany({
        where: {
          projectId: params.id,
          status: { not: "DONE" },
          template: { kind: "STAGE_GATE" },
        },
        include: {
          template: { select: { name: true, isoCode: true } },
          tasks: {
            where: { status: { not: "DONE" } },
            include: { step: { select: { title: true, seq: true } } },
            orderBy: { step: { seq: "asc" } },
          },
        },
      });
      if (openGateRuns.length > 0) {
        const unmet = openGateRuns.flatMap((run) =>
          run.tasks.map((task) => ({
            run: `${run.template.isoCode ?? ""} ${run.name}`.trim(),
            step: `${task.step.seq}. ${task.step.title}`,
            assigneeUserId: task.assigneeUserId,
          })),
        );
        // Người đang giữ bước chưa đạt cần biết cả dự án chờ mình.
        await notifyUsers(
          unmet.map((item) => item.assigneeUserId),
          {
            kind: "STAGE_BLOCKED",
            title: `${before.name}: chuyển giai đoạn đang chờ bước của bạn`,
            body: `Dự án không thể chuyển sang "${STAGE_LABEL[d.status!] ?? d.status}" khi tiêu chí chuyển giai đoạn chưa đạt.`,
            link: "/processes",
            projectId: params.id,
            actorId: session.userId,
          },
        );
        await audit({
          action: "project.stage.blocked", entityType: "Project", entityId: params.id,
          actorId: session.userId, projectId: params.id, ...reqMeta(req),
          before: { status: before.status }, after: { wanted: d.status, unmet: unmet.length },
        });
        return NextResponse.json(
          {
            error:
              `Chưa thể chuyển sang "${STAGE_LABEL[d.status!] ?? d.status}" — còn ` +
              `${unmet.length} bước tiêu chí chuyển giai đoạn chưa đạt: ` +
              unmet.slice(0, 3).map((item) => item.step).join("; ") +
              (unmet.length > 3 ? "…" : "") +
              ". Hoàn tất trong mục Quy trình rồi thử lại.",
            unmet,
          },
          { status: 409 },
        );
      }
    }

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

    if (d.status !== undefined && d.status !== before.status) {
      const managers = await orgManagerIds(updated.ownerOrgId);
      await notifyUsers(managers, {
        kind: "STAGE_CHANGED",
        title: `${updated.name}: ${STAGE_LABEL[before.status] ?? before.status} → ${STAGE_LABEL[updated.status] ?? updated.status}`,
        link: "/",
        projectId: params.id,
        actorId: session.userId,
      });
    }

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
