// Gợi ý căn cứ pháp lý cho hồ sơ khiếu nại.
// Body: { claimId } — RAG đơn giản: đưa corpus Regulation (LUAT/NGHI_DINH/
// THONG_TU + văn bản gắn với dự án) vào prompt, Qwen chỉ được trích từ đó.
// Lưu AiSuggestion (kind=claim.legal_basis) + AiCitation per căn cứ.
// Engineer-in-loop: căn cứ chỉ vào hồ sơ khi người dùng bấm duyệt.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { claimAi, saveSuggestion } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

const Body = z.object({ claimId: z.string() });

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const __rl = await rateLimitGuard(req, { name: "ai.claims.suggest-basis" });
  if (__rl) return __rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const claim = await prisma.claim.findUnique({
      where: { id: parsed.data.claimId },
      include: { events: { orderBy: { occurredAt: "asc" }, take: 20 } },
    });
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    await requireProject(claim.projectId);

    // Corpus: văn bản pháp quy hiệu lực (luật/NĐ/TT) + mọi văn bản gắn dự án.
    const regulations = await prisma.regulation.findMany({
      where: {
        status: "IN_FORCE",
        OR: [
          { kind: { in: ["LUAT", "NGHI_DINH", "THONG_TU"] } },
          { projectApplications: { some: { projectId: claim.projectId } } },
        ],
      },
      select: { code: true, kind: true, title: true, body: true },
      take: 30,
    });

    const result = await claimAi.suggestLegalBasis({
      claimType: claim.type,
      title: claim.title,
      description: claim.description,
      contractRef: claim.contractRef,
      periodStart: claim.periodStart?.toISOString().slice(0, 10) ?? null,
      periodEnd: claim.periodEnd?.toISOString().slice(0, 10) ?? null,
      eventsSummary: claim.events
        .map((e) => `${e.occurredAt.toISOString().slice(0, 10)} [${e.kind}] ${e.title}`)
        .join("\n"),
      regulations: regulations.map((r) => ({
        code: r.code,
        kind: r.kind,
        title: r.title,
        summary: r.body,
      })),
    });

    const suggestionId = await saveSuggestion({
      kind: "claim.legal_basis",
      entityType: "Claim",
      entityId: claim.id,
      projectId: claim.projectId,
      result,
    });

    // AiCitation: một dòng kiểm chứng được cho mỗi căn cứ AI đề xuất.
    if (result.ok && suggestionId) {
      const regByCode = new Map(
        (await prisma.regulation.findMany({
          where: { code: { in: result.data.bases.map((b) => b.regulationCode) } },
          select: { id: true, code: true },
        })).map((r) => [r.code, r.id]),
      );
      await prisma.aiCitation.createMany({
        data: result.data.bases.map((b) => ({
          suggestionId,
          claim: b.argument,
          sourceType: "regulation",
          sourceId: regByCode.get(b.regulationCode) ?? null,
          sourceQuote: `${b.regulationCode} ${b.articleRef}`,
          confidence: b.confidence,
        })),
      });
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, suggestionId },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, suggestionId, suggestion: result.data, model: result.model });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
