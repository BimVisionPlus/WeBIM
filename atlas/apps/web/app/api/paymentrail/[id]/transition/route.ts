// POST /api/paymentrail/[id]/transition — Move PaymentApplication through workflow.
// States: DRAFT → NT_SIGNED → TVGS_SIGNED → CDT_APPROVED → KBNN_SUBMITTED → PAID
// Plus REJECTED (terminal from any non-PAID state).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["NT_SIGN", "TVGS_SIGN", "CDT_APPROVE", "KBNN_SUBMIT", "MARK_PAID", "REJECT"]),
  rejectionNote: z.string().max(2000).optional(),
  kbnnTxId: z.string().max(64).optional(),
  paidVnd: z.string().regex(/^\d+$/).optional(),
});

const NEXT_STATE: Record<string, string> = {
  NT_SIGN: "NT_SIGNED",
  TVGS_SIGN: "TVGS_SIGNED",
  CDT_APPROVE: "CDT_APPROVED",
  KBNN_SUBMIT: "KBNN_SUBMITTED",
  MARK_PAID: "PAID",
  REJECT: "REJECTED",
};

const REQUIRED_FROM: Record<string, string[]> = {
  NT_SIGN: ["DRAFT"],
  TVGS_SIGN: ["NT_SIGNED"],
  CDT_APPROVE: ["TVGS_SIGNED"],
  KBNN_SUBMIT: ["CDT_APPROVED"],
  MARK_PAID: ["KBNN_SUBMITTED", "CDT_APPROVED"], // CDT_APPROVED allowed for non-budget funds
  REJECT: ["DRAFT", "NT_SIGNED", "TVGS_SIGNED", "CDT_APPROVED", "KBNN_SUBMITTED"],
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "paymentrail.transition" });
  if (rl) return rl;

  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { action, rejectionNote, kbnnTxId, paidVnd } = parsed.data;

    const app = await prisma.paymentApplication.findUnique({ where: { id: params.id } });
    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(app.projectId);

    const allowedFrom = REQUIRED_FROM[action] ?? [];
    if (!allowedFrom.includes(app.state)) {
      return NextResponse.json({ error: `Không thể ${action} từ trạng thái ${app.state}` }, { status: 422 });
    }
    if (action === "REJECT" && !rejectionNote) {
      return NextResponse.json({ error: "Phải nhập rejectionNote khi REJECT" }, { status: 400 });
    }

    const nextState = NEXT_STATE[action];
    const now = new Date();
    const update: Record<string, unknown> = { state: nextState };
    if (action === "NT_SIGN") update.ntSignedAt = now;
    if (action === "TVGS_SIGN") update.tvgsSignedAt = now;
    if (action === "CDT_APPROVE") update.cdtApprovedAt = now;
    if (action === "KBNN_SUBMIT") {
      update.kbnnSubmittedAt = now;
      if (kbnnTxId) update.kbnnTxId = kbnnTxId;
      update.kbnnStatus = "PENDING";
    }
    if (action === "MARK_PAID") {
      update.paidAt = now;
      update.paidVnd = paidVnd ? BigInt(paidVnd) : app.netPayableVnd;
      update.kbnnStatus = "PAID";
    }
    if (action === "REJECT") update.rejectionNote = rejectionNote;

    await prisma.paymentApplication.update({ where: { id: params.id }, data: update });
    await audit({
      action: `paymentrail.${action.toLowerCase()}`,
      entityType: "PaymentApplication",
      entityId: params.id,
      actorId: session.userId,
      projectId: app.projectId,
      ...reqMeta(req),
      before: { state: app.state },
      after: { state: nextState },
    });

    return NextResponse.json({ ok: true, state: nextState });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
