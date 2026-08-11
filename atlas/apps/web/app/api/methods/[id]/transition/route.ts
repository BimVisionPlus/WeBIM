// POST /api/methods/[id]/transition — DRAFT → NT_SUBMITTED → TVGS_REVIEW → CDT_REVIEW → APPROVED → EXECUTING → CLOSED.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["NT_SUBMIT", "TVGS_REVIEW", "CDT_REVIEW", "TVGS_APPROVE", "CDT_APPROVE", "REJECT", "START_EXEC", "CLOSE"]),
  rejectionNote: z.string().max(2000).optional(),
});

const NEXT: Record<string, string> = {
  NT_SUBMIT: "NT_SUBMITTED", TVGS_REVIEW: "TVGS_REVIEW", CDT_REVIEW: "CDT_REVIEW",
  TVGS_APPROVE: "CDT_REVIEW", CDT_APPROVE: "APPROVED", REJECT: "REJECTED",
  START_EXEC: "EXECUTING", CLOSE: "CLOSED",
};
const FROM: Record<string, string[]> = {
  NT_SUBMIT: ["DRAFT"], TVGS_REVIEW: ["NT_SUBMITTED"], CDT_REVIEW: ["TVGS_REVIEW"],
  TVGS_APPROVE: ["TVGS_REVIEW"], CDT_APPROVE: ["CDT_REVIEW"], REJECT: ["NT_SUBMITTED", "TVGS_REVIEW", "CDT_REVIEW"],
  START_EXEC: ["APPROVED"], CLOSE: ["EXECUTING"],
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "methods.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const ms = await prisma.methodStatement.findUnique({ where: { id: params.id } });
    if (!ms) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!ms.projectId) return NextResponse.json({ error: "Template, no transitions" }, { status: 422 });
    await requireProject(ms.projectId);
    const allowed = FROM[parsed.data.action] ?? [];
    if (!allowed.includes(ms.state)) return NextResponse.json({ error: `Không thể ${parsed.data.action} từ ${ms.state}` }, { status: 422 });
    const now = new Date();
    const update: Record<string, unknown> = { state: NEXT[parsed.data.action] };
    if (parsed.data.action === "NT_SUBMIT") update.ntSubmittedAt = now;
    if (parsed.data.action === "TVGS_APPROVE") update.tvgsApprovedAt = now;
    if (parsed.data.action === "CDT_APPROVE") update.cdtApprovedAt = now;
    if (parsed.data.action === "REJECT") update.rejectionNote = parsed.data.rejectionNote ?? null;
    await prisma.methodStatement.update({ where: { id: params.id }, data: update });
    await audit({ action: `methods.${parsed.data.action.toLowerCase()}`, entityType: "MethodStatement", entityId: params.id, actorId: session.userId, projectId: ms.projectId, ...reqMeta(req), after: { state: NEXT[parsed.data.action] } });
    return NextResponse.json({ ok: true, state: NEXT[parsed.data.action] });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
