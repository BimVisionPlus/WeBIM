import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta } from "@atlas/lib";

const Body = z.object({
  kind: z.enum([
    "DAILY_LOG",
    "RFI",
    "CHANGE_ORDER",
    "SUPERVISE_ENTRY",
    "ACCEPTANCE",
    "WEATHER",
    "CORRESPONDENCE",
    "PHOTO",
    "CONTRACT",
    "INVOICE",
    "OTHER",
  ]),
  title: z.string().min(2).max(300),
  note: z.string().max(2_000).optional(),
  refTable: z.string().max(40).optional(),
  refId: z.string().max(40).optional(),
  capturedAt: z.string().optional(), // ISO date
});

export async function POST(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const claim = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    if (d.refTable && d.refId) {
      const dup = await prisma.claimEvidence.findFirst({
        where: { claimId: claim.id, refTable: d.refTable, refId: d.refId },
      });
      if (dup) return NextResponse.json({ error: "Chứng cứ này đã được gắn vào hồ sơ" }, { status: 409 });
    }

    const evidence = await prisma.claimEvidence.create({
      data: {
        claimId: claim.id,
        kind: d.kind,
        title: d.title,
        note: d.note,
        refTable: d.refTable,
        refId: d.refId,
        capturedAt: d.capturedAt ? new Date(d.capturedAt) : undefined,
        addedById: session.userId,
      },
    });

    await audit({
      action: "claim.evidence.add",
      entityType: "ClaimEvidence",
      entityId: evidence.id,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
      after: { claimKey: claim.key, kind: d.kind, title: d.title },
    });

    return NextResponse.json({ ok: true, evidence: { id: evidence.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const evidenceId = searchParams.get("evidenceId");
    if (!evidenceId) return NextResponse.json({ error: "evidenceId required" }, { status: 400 });

    const claim = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    await prisma.claimEvidence.delete({ where: { id: evidenceId, claimId: claim.id } });

    await audit({
      action: "claim.evidence.delete",
      entityType: "ClaimEvidence",
      entityId: evidenceId,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
