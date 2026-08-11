import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta } from "@atlas/lib";

const Body = z.object({
  regulationCode: z.string().min(2).max(60), // resolve sang regulationId
  articleRef: z.string().min(2).max(80),
  argument: z.string().min(10).max(5_000),
  source: z.enum(["USER", "AI"]).default("USER"),
  aiConfidence: z.number().min(0).max(1).optional(),
  suggestionId: z.string().optional(),
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

    const regulation = await prisma.regulation.findUnique({ where: { code: d.regulationCode } });
    if (!regulation) {
      return NextResponse.json(
        { error: `Văn bản ${d.regulationCode} chưa có trong thư viện pháp lý` },
        { status: 422 },
      );
    }

    const basis = await prisma.claimLegalBasis.upsert({
      where: {
        claimId_regulationId_articleRef: {
          claimId: claim.id,
          regulationId: regulation.id,
          articleRef: d.articleRef,
        },
      },
      update: { argument: d.argument, accepted: true },
      create: {
        claimId: claim.id,
        regulationId: regulation.id,
        articleRef: d.articleRef,
        argument: d.argument,
        source: d.source,
        aiConfidence: d.aiConfidence,
        suggestionId: d.suggestionId,
        accepted: true, // người dùng chủ động thêm/duyệt → accepted
      },
    });

    await audit({
      action: "claim.legal_basis.add",
      entityType: "ClaimLegalBasis",
      entityId: basis.id,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
      after: { claimKey: claim.key, regulation: d.regulationCode, articleRef: d.articleRef, source: d.source },
    });

    return NextResponse.json({ ok: true, basis: { id: basis.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const basisId = searchParams.get("basisId");
    if (!basisId) return NextResponse.json({ error: "basisId required" }, { status: 400 });

    const claim = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    await prisma.claimLegalBasis.delete({ where: { id: basisId, claimId: claim.id } });

    await audit({
      action: "claim.legal_basis.delete",
      entityType: "ClaimLegalBasis",
      entityId: basisId,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
