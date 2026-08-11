// POST /api/portal/[id]/decide — CĐT decision on an ApprovalRequest.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "portal.decide" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const r = await prisma.approvalRequest.findUnique({ where: { id: params.id } });
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!["PENDING", "IN_REVIEW"].includes(r.state)) return NextResponse.json({ error: `Đã ${r.state}` }, { status: 422 });
    await requireProject(r.projectId);
    await prisma.approvalRequest.update({
      where: { id: params.id },
      data: {
        state: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decision: parsed.data.decision,
        decisionNote: parsed.data.note ?? null,
        decidedAt: new Date(),
        decidedByUserId: session.userId,
      },
    });
    await audit({ action: `portal.${parsed.data.decision.toLowerCase()}`, entityType: "ApprovalRequest", entityId: params.id, actorId: session.userId, projectId: r.projectId, ...reqMeta(req), after: { decision: parsed.data.decision } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
