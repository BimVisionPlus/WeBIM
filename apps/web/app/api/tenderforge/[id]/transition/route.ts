// POST /api/tenderforge/[id]/transition — DRAFT → REVIEWING → READY → SUBMITTED → AWARDED|LOST.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["REVIEW", "READY", "SUBMIT", "AWARDED", "LOST", "CANCEL"]),
  submissionRef: z.string().max(64).optional(),
});

const NEXT: Record<string, string> = { REVIEW: "REVIEWING", READY: "READY", SUBMIT: "SUBMITTED", AWARDED: "AWARDED", LOST: "LOST", CANCEL: "CANCELLED" };
const FROM: Record<string, string[]> = {
  REVIEW: ["DRAFT"], READY: ["REVIEWING"], SUBMIT: ["READY"],
  AWARDED: ["SUBMITTED"], LOST: ["SUBMITTED"], CANCEL: ["DRAFT", "REVIEWING", "READY"],
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "tenderforge.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const pkg = await prisma.tenderPackage.findUnique({ where: { id: params.id } });
    if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const membership = await prisma.membership.findFirst({ where: { userId: session.userId, orgId: pkg.orgId } });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const allowed = FROM[parsed.data.action] ?? [];
    if (!allowed.includes(pkg.state)) return NextResponse.json({ error: `Không thể ${parsed.data.action} từ ${pkg.state}` }, { status: 422 });
    const now = new Date();
    const update: Record<string, unknown> = { state: NEXT[parsed.data.action] };
    if (parsed.data.action === "SUBMIT") { update.submittedAt = now; if (parsed.data.submissionRef) update.submissionRef = parsed.data.submissionRef; }
    if (parsed.data.action === "AWARDED") update.awardedAt = now;
    await prisma.tenderPackage.update({ where: { id: params.id }, data: update });
    await audit({ action: `tenderforge.${parsed.data.action.toLowerCase()}`, entityType: "TenderPackage", entityId: params.id, actorId: session.userId, ...reqMeta(req), after: { state: NEXT[parsed.data.action] } });
    return NextResponse.json({ ok: true, state: NEXT[parsed.data.action] });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
