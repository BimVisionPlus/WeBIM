/**
 * GET  /api/winwork/bonds          — list active bonds for an org (or expiring soon)
 * POST /api/winwork/bonds          — register a new bond on a bid
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  bidId: z.string(),
  type: z.enum(["BAO_LANH_DU_THAU", "BAO_LANH_THUC_HIEN", "BAO_LANH_TAM_UNG", "BAO_LANH_BAO_HANH"]),
  issuerBank: z.string().min(2).max(120),
  bondNumber: z.string().min(1).max(80),
  amountVnd: z.coerce.bigint(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  feeVnd: z.coerce.bigint().optional(),
  fileUrl: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const expiringDays = Number(url.searchParams.get("expiring") ?? "0");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    if (!session.isSuperAdmin) {
      await requireOrgMember(orgId);
    }

    const where: any = { bid: { orgId } };
    if (expiringDays > 0) {
      where.status = "ACTIVE";
      where.expiresAt = { lte: new Date(Date.now() + expiringDays * 86_400_000) };
    }

    const bonds = await prisma.bidBond.findMany({
      where,
      include: { bid: { select: { id: true, key: true, title: true, state: true } } },
      orderBy: { expiresAt: "asc" },
      take: 200,
    });

    return NextResponse.json({
      bonds: bonds.map((b) => ({
        ...b,
        amountVnd: b.amountVnd.toString(),
        feeVnd: b.feeVnd?.toString() ?? null,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "winwork.bonds" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const bid = await prisma.bid.findUnique({ where: { id: d.bidId }, select: { id: true, orgId: true } });
    if (!bid) return NextResponse.json({ error: "bid not found" }, { status: 404 });
    if (!session.isSuperAdmin) {
      await requireOrgMember(bid.orgId);
    }

    const issuedAt = new Date(d.issuedAt);
    const expiresAt = new Date(d.expiresAt);
    if (expiresAt <= issuedAt) {
      return NextResponse.json({ error: "expiresAt must be after issuedAt" }, { status: 400 });
    }

    const bond = await prisma.bidBond.create({
      data: {
        bidId: d.bidId,
        type: d.type,
        issuerBank: d.issuerBank,
        bondNumber: d.bondNumber,
        amountVnd: d.amountVnd,
        issuedAt,
        expiresAt,
        feeVnd: d.feeVnd,
        fileUrl: d.fileUrl,
      },
    });

    await audit({
      action: "bond.create",
      entityType: "BidBond",
      entityId: bond.id,
      actorId: session.userId,
      orgId: bid.orgId,
      ...reqMeta(req),
      after: { type: bond.type, amountVnd: bond.amountVnd.toString(), expiresAt: bond.expiresAt },
    });

    return NextResponse.json({
      bond: {
        ...bond,
        amountVnd: bond.amountVnd.toString(),
        feeVnd: bond.feeVnd?.toString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
