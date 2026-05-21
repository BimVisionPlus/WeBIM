// POST /api/volumemeter/[id]/transition — TakeoffSheet workflow.
// State machine: DRAFT → NT_SUBMITTED → TVGS_VERIFIED → CDT_APPROVED (or REJECTED).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["NT_SUBMIT", "TVGS_VERIFY", "CDT_APPROVE", "REJECT"]),
  rejectionNote: z.string().max(2000).optional(),
});

const NEXT: Record<string, string> = { NT_SUBMIT: "NT_SUBMITTED", TVGS_VERIFY: "TVGS_VERIFIED", CDT_APPROVE: "CDT_APPROVED", REJECT: "REJECTED" };
const FROM: Record<string, string[]> = { NT_SUBMIT: ["DRAFT"], TVGS_VERIFY: ["NT_SUBMITTED"], CDT_APPROVE: ["TVGS_VERIFIED"], REJECT: ["DRAFT", "NT_SUBMITTED", "TVGS_VERIFIED"] };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "volumemeter.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const sheet = await prisma.takeoffSheet.findUnique({ where: { id: params.id } });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(sheet.projectId);
    const allowed = FROM[parsed.data.action] ?? [];
    if (!allowed.includes(sheet.state)) return NextResponse.json({ error: `Không thể ${parsed.data.action} từ ${sheet.state}` }, { status: 422 });
    const now = new Date();
    const update: Record<string, unknown> = { state: NEXT[parsed.data.action] };
    if (parsed.data.action === "NT_SUBMIT") update.ntSubmittedAt = now;
    if (parsed.data.action === "TVGS_VERIFY") update.tvgsVerifiedAt = now;
    if (parsed.data.action === "CDT_APPROVE") update.cdtApprovedAt = now;
    if (parsed.data.action === "REJECT") update.notes = parsed.data.rejectionNote ?? "Trả về";
    await prisma.takeoffSheet.update({ where: { id: params.id }, data: update });
    await audit({ action: `volumemeter.${parsed.data.action.toLowerCase()}`, entityType: "TakeoffSheet", entityId: params.id, actorId: session.userId, projectId: sheet.projectId, ...reqMeta(req), before: { state: sheet.state }, after: { state: NEXT[parsed.data.action] } });
    return NextResponse.json({ ok: true, state: NEXT[parsed.data.action] });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
