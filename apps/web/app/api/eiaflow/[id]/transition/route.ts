// POST /api/eiaflow/[id]/transition — DRAFT → CONSULTING → AUTHORITY_REVIEW → APPROVED|REJECTED.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["START_CONSULT", "SUBMIT_AUTHORITY", "APPROVE", "REJECT"]),
  decisionRef: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

const NEXT: Record<string, string> = { START_CONSULT: "CONSULTING", SUBMIT_AUTHORITY: "AUTHORITY_REVIEW", APPROVE: "APPROVED", REJECT: "REJECTED" };
const FROM: Record<string, string[]> = { START_CONSULT: ["DRAFT"], SUBMIT_AUTHORITY: ["CONSULTING"], APPROVE: ["AUTHORITY_REVIEW"], REJECT: ["AUTHORITY_REVIEW"] };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "eiaflow.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const app = await prisma.eiaApplication.findUnique({ where: { id: params.id } });
    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(app.projectId);
    const allowed = FROM[parsed.data.action] ?? [];
    if (!allowed.includes(app.state)) return NextResponse.json({ error: `Không thể ${parsed.data.action} từ ${app.state}` }, { status: 422 });
    const now = new Date();
    const update: Record<string, unknown> = { state: NEXT[parsed.data.action] };
    if (parsed.data.action === "START_CONSULT") update.consultStartAt = now;
    if (parsed.data.action === "SUBMIT_AUTHORITY") { update.consultEndAt = now; update.submittedAt = now; }
    if (parsed.data.action === "APPROVE") { update.decisionDate = now; update.decisionRef = parsed.data.decisionRef ?? null; }
    if (parsed.data.action === "REJECT") update.notes = parsed.data.notes ?? "Rejected";
    await prisma.eiaApplication.update({ where: { id: params.id }, data: update });
    await audit({ action: `eiaflow.${parsed.data.action.toLowerCase()}`, entityType: "EiaApplication", entityId: params.id, actorId: session.userId, projectId: app.projectId, ...reqMeta(req), after: { state: NEXT[parsed.data.action] } });
    return NextResponse.json({ ok: true, state: NEXT[parsed.data.action] });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
