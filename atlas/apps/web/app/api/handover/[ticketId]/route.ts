/**
 * PATCH /api/handover/[ticketId]
 *
 * Move a handover ticket through its lifecycle + edit metadata.
 *
 * State machine (mirrors HandoverTicket.state enum):
 *   NEW → TRIAGED → IN_PROGRESS ⇄ AWAITING_PARTS → RECTIFIED → VERIFIED → CLOSED
 *                                                              ↘ REJECTED ↗
 *
 * Side effects of specific state moves:
 *   - → RECTIFIED   stamps `rectifiedAt` (NĐ 06/2021 mốc tính SLA bảo hành)
 *   - → VERIFIED    stamps `verifiedAt` (CĐT/cư dân xác nhận đã sửa)
 *   - → CLOSED      ticket is final; no further PATCH allowed (use a new ticket)
 *
 * Auth: any signed-in user with project access can edit. Org-level RBAC
 * (e.g. only assigned org can move to RECTIFIED) lives upstream — this
 * route enforces project access only, matching the existing handover
 * routes' permission model.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const States = z.enum([
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "AWAITING_PARTS",
  "RECTIFIED",
  "VERIFIED",
  "REJECTED",
  "CLOSED",
]);

const PatchBody = z.object({
  state: States.optional(),
  assigneeOrgId: z.string().nullable().optional(),
  customerSatisfactionScore: z.number().int().min(1).max(5).nullable().optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { ticketId: string } }) {
  const __rl = await rateLimitGuard(req, { name: "handover" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const before = await prisma.handoverTicket.findUnique({ where: { id: params.ticketId } });
    if (!before) return NextResponse.json({ error: "Ticket bảo hành không tồn tại" }, { status: 404 });
    await requireProject(before.projectId);

    if (before.state === "CLOSED") {
      return NextResponse.json(
        { error: "Ticket đã CLOSED — mở ticket mới để xử lý phát sinh tiếp." },
        { status: 409 },
      );
    }

    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.state !== undefined) {
      update.state = data.state;
      if (data.state === "RECTIFIED" && !before.rectifiedAt) update.rectifiedAt = new Date();
      if (data.state === "VERIFIED" && !before.verifiedAt) update.verifiedAt = new Date();
    }
    if (data.assigneeOrgId !== undefined) update.assigneeOrgId = data.assigneeOrgId || null;
    if (data.customerSatisfactionScore !== undefined)
      update.customerSatisfactionScore = data.customerSatisfactionScore;
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description || null;
    if (data.severity !== undefined) update.severity = data.severity;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, ticket: before, noop: true });
    }

    const ticket = await prisma.handoverTicket.update({
      where: { id: params.ticketId },
      data: update,
    });

    await audit({
      action: "handover.update",
      entityType: "HandoverTicket",
      entityId: ticket.id,
      actorId: session.userId,
      projectId: ticket.projectId,
      ...reqMeta(req),
      before: { state: before.state, severity: before.severity, title: before.title },
      after: update,
    });

    return NextResponse.json({ ok: true, ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
