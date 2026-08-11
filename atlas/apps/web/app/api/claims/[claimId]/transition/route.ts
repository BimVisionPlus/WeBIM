import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta } from "@atlas/lib";
import type { ClaimState } from "@atlas/db";

// FSM khiếu nại — bám trình tự NĐ 37/2015 Đ.44-45: lập hồ sơ → gửi văn bản →
// xem xét → thương lượng/hòa giải → giải quyết, hoặc leo thang trọng tài/tòa.
const TRANSITIONS: Record<ClaimState, ClaimState[]> = {
  DRAFT: ["EVIDENCE", "SUBMITTED", "WITHDRAWN"],
  EVIDENCE: ["DRAFT", "SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["NEGOTIATION", "RESOLVED", "REJECTED"],
  NEGOTIATION: ["RESOLVED", "REJECTED", "ESCALATED"],
  REJECTED: ["NEGOTIATION", "ESCALATED", "WITHDRAWN"],
  ESCALATED: ["RESOLVED"],
  RESOLVED: [],
  WITHDRAWN: [],
};

const Body = z.object({
  state: z.enum([
    "DRAFT",
    "EVIDENCE",
    "SUBMITTED",
    "UNDER_REVIEW",
    "NEGOTIATION",
    "RESOLVED",
    "REJECTED",
    "ESCALATED",
    "WITHDRAWN",
  ]),
  note: z.string().max(2_000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const claim = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const next = parsed.data.state;

    if (!TRANSITIONS[claim.state].includes(next)) {
      return NextResponse.json(
        { error: `Không thể chuyển từ ${claim.state} sang ${next}` },
        { status: 422 },
      );
    }

    const now = new Date();
    await prisma.claim.update({
      where: { id: claim.id },
      data: {
        state: next,
        ...(next === "SUBMITTED" && !claim.submittedAt && { submittedAt: now }),
        ...((next === "RESOLVED" || next === "REJECTED" || next === "WITHDRAWN") && {
          resolvedAt: now,
          ...(parsed.data.note && { resolutionNote: parsed.data.note }),
        }),
      },
    });

    await audit({
      action: "claim.transition",
      entityType: "Claim",
      entityId: claim.id,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
      before: { state: claim.state },
      after: { state: next, note: parsed.data.note ?? null },
    });

    return NextResponse.json({ ok: true, state: next });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
