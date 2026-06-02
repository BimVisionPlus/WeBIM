import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  projectId: z.string().optional(),
  type: z.enum(["TAM_UNG","THANH_TOAN","HOAN_UNG"]),
  txnNo: z.string().max(80).optional(),
  payeeName: z.string().min(2).max(200),
  amountVnd: z.coerce.bigint(),
  purpose: z.string().min(2).max(500),
  txnDate: z.string().optional(),
  parentTxnId: z.string().optional(),
  status: z.enum(["PENDING","APPROVED","SETTLED","CANCELLED"]).default("PENDING"),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "advances.create" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const tx = await prisma.advanceTransaction.create({
      data: {
        orgId: d.orgId, projectId: d.projectId,
        type: d.type, txnNo: d.txnNo, payeeName: d.payeeName,
        amountVnd: d.amountVnd, purpose: d.purpose,
        txnDate: d.txnDate ? new Date(d.txnDate) : new Date(),
        parentTxnId: d.parentTxnId, status: d.status, note: d.note,
      },
    });
    await audit({ action: "advance.create", entityType: "AdvanceTransaction", entityId: tx.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { type: tx.type, amount: tx.amountVnd.toString() } });
    return NextResponse.json({ txn: { ...tx, amountVnd: tx.amountVnd.toString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
