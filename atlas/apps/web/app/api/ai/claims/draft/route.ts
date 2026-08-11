// Soạn nháp văn bản khiếu nại từ timeline + chứng cứ + căn cứ đã duyệt.
// Body: { claimId } → AiSuggestion (kind=claim.draft_statement).
// PATCH { claimId, suggestionId } → chấp nhận nháp: ghi statementMd vào Claim.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { claimAi, saveSuggestion, markAccepted } from "@atlas/ai";
import { rateLimitGuard, formatVnd, audit, reqMeta } from "@atlas/lib";

const Body = z.object({ claimId: z.string() });

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const __rl = await rateLimitGuard(req, { name: "ai.claims.draft" });
  if (__rl) return __rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const claim = await prisma.claim.findUnique({
      where: { id: parsed.data.claimId },
      include: {
        project: { select: { name: true } },
        events: { orderBy: { occurredAt: "asc" } },
        evidence: { orderBy: { capturedAt: "asc" } },
        legalBases: {
          where: { accepted: true },
          include: { regulation: { select: { code: true, title: true } } },
        },
      },
    });
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    await requireProject(claim.projectId);

    if (claim.legalBases.length === 0) {
      return NextResponse.json(
        { error: "Cần ít nhất một căn cứ pháp lý đã duyệt trước khi soạn văn bản" },
        { status: 422 },
      );
    }

    const result = await claimAi.draftClaimStatement({
      projectName: claim.project.name,
      claim: {
        key: claim.key,
        title: claim.title,
        type: claim.type,
        direction: claim.direction,
        counterparty: claim.counterparty,
        contractRef: claim.contractRef,
        amountVnd: claim.amountVnd != null ? formatVnd(claim.amountVnd) : null,
        eotDays: claim.eotDays,
        description: claim.description,
      },
      events: claim.events.map((e) => ({
        occurredAt: e.occurredAt.toISOString().slice(0, 10),
        kind: e.kind,
        title: e.title,
        detail: e.detail,
      })),
      evidence: claim.evidence.map((ev, i) => ({
        idx: i + 1,
        kind: ev.kind,
        title: ev.title,
        capturedAt: ev.capturedAt?.toISOString().slice(0, 10) ?? null,
        note: ev.note,
      })),
      legalBases: claim.legalBases.map((b) => ({
        regulationCode: b.regulation.code,
        regulationTitle: b.regulation.title,
        articleRef: b.articleRef,
        argument: b.argument,
      })),
    });

    const suggestionId = await saveSuggestion({
      kind: "claim.draft_statement",
      entityType: "Claim",
      entityId: claim.id,
      projectId: claim.projectId,
      result,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason, suggestionId }, { status: 502 });
    }
    return NextResponse.json({ ok: true, suggestionId, draft: result.data, model: result.model });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

const AcceptBody = z.object({ claimId: z.string(), suggestionId: z.string() });

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = AcceptBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const claim = await prisma.claim.findUnique({ where: { id: parsed.data.claimId } });
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    await requireProject(claim.projectId);

    const suggestion = await prisma.aiSuggestion.findUnique({ where: { id: parsed.data.suggestionId } });
    if (!suggestion || suggestion.entityId !== claim.id || suggestion.kind !== "claim.draft_statement" || !suggestion.ok) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    const draft = suggestion.output as unknown as claimAi.ClaimStatementDraft;
    await prisma.claim.update({ where: { id: claim.id }, data: { statementMd: draft.statementMd } });
    await markAccepted(suggestion.id);

    await audit({
      action: "claim.statement.accept",
      entityType: "Claim",
      entityId: claim.id,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
      after: { suggestionId: suggestion.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
