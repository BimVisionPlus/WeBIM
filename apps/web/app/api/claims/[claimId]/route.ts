import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta } from "@atlas/lib";

const Patch = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  counterparty: z.string().max(200).nullable().optional(),
  contractRef: z.string().max(200).nullable().optional(),
  amountVnd: z.string().regex(/^\d+$/).nullable().optional(),
  eotDays: z.number().int().min(0).max(3650).nullable().optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  noticeDeadlineAt: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  statementMd: z.string().max(50_000).nullable().optional(),
  resolutionNote: z.string().max(10_000).nullable().optional(),
});

async function loadClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      events: { orderBy: { occurredAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      evidence: { orderBy: { capturedAt: "asc" } },
      legalBases: { include: { regulation: { select: { code: true, title: true, kind: true, url: true } } } },
      attachments: true,
    },
  });
  return claim;
}

export async function GET(_req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const claim = await loadClaim(params.claimId);
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);
    return NextResponse.json({
      claim: { ...claim, amountVnd: claim.amountVnd?.toString() ?? null },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const existing = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(existing.projectId);

    const parsed = Patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const claim = await prisma.claim.update({
      where: { id: params.claimId },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.counterparty !== undefined && { counterparty: d.counterparty }),
        ...(d.contractRef !== undefined && { contractRef: d.contractRef }),
        ...(d.amountVnd !== undefined && { amountVnd: d.amountVnd ? BigInt(d.amountVnd) : null }),
        ...(d.eotDays !== undefined && { eotDays: d.eotDays }),
        ...(d.periodStart !== undefined && { periodStart: d.periodStart ? new Date(d.periodStart) : null }),
        ...(d.periodEnd !== undefined && { periodEnd: d.periodEnd ? new Date(d.periodEnd) : null }),
        ...(d.noticeDeadlineAt !== undefined && {
          noticeDeadlineAt: d.noticeDeadlineAt ? new Date(d.noticeDeadlineAt) : null,
        }),
        ...(d.assigneeId !== undefined && { assigneeId: d.assigneeId }),
        ...(d.statementMd !== undefined && { statementMd: d.statementMd }),
        ...(d.resolutionNote !== undefined && { resolutionNote: d.resolutionNote }),
      },
    });

    await audit({
      action: "claim.update",
      entityType: "Claim",
      entityId: claim.id,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
      after: { patched: Object.keys(d) },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
