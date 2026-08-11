// POST /api/bondvault/[id]/transition — ACTIVE → RELEASED / EXPIRED / CALLED.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["RELEASE", "MARK_EXPIRED", "CALL", "SYNC_BANK"]),
  note: z.string().max(2000).optional(),
  claimedAmountVnd: z.string().regex(/^\d+$/).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "bondvault.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const bond = await prisma.contractBond.findUnique({ where: { id: params.id } });
    if (!bond) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(bond.projectId);
    const { action, note, claimedAmountVnd } = parsed.data;
    if (bond.status !== "ACTIVE" && action !== "SYNC_BANK") {
      return NextResponse.json({ error: `Bond đã ${bond.status}, không thể ${action}` }, { status: 422 });
    }
    const now = new Date();
    const update: Record<string, unknown> = {};
    if (action === "RELEASE") { update.status = "RELEASED"; update.releasedAt = now; update.releasedNote = note ?? null; }
    if (action === "MARK_EXPIRED") { update.status = "EXPIRED"; }
    if (action === "CALL") {
      update.status = "CALLED";
      update.claimedAt = now;
      if (claimedAmountVnd) update.claimedAmountVnd = BigInt(claimedAmountVnd);
    }
    if (action === "SYNC_BANK") { update.bankApiSyncedAt = now; update.bankApiStatus = bond.status === "ACTIVE" ? "ACTIVE" : "VOIDED"; }
    await prisma.contractBond.update({ where: { id: params.id }, data: update });
    await audit({ action: `bondvault.${action.toLowerCase()}`, entityType: "ContractBond", entityId: params.id, actorId: session.userId, projectId: bond.projectId, ...reqMeta(req), before: { status: bond.status }, after: update });
    return NextResponse.json({ ok: true, status: update.status ?? bond.status });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
