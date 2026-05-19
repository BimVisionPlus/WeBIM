import { rateLimitGuard } from "@atlas/lib";
// Vision assessment for an NCR photo.
// Body: { issueId, imageBase64 } — base64 (no data: prefix), <4MB.
// Calls Qwen2.5-VL via Ollama and stores AiSuggestion.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { ncrAi, saveSuggestion } from "@atlas/ai";

const Body = z.object({
  issueId: z.string(),
  imageBase64: z.string().min(100).max(6_000_000),  // ~4.5MB base64
  contextNote: z.string().max(400).optional(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ai.ncr.assess" });
  if (__rl) return __rl;
try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const issue = await prisma.issue.findUnique({
      where: { id: parsed.data.issueId },
      include: { ncr: true },
    });
    if (!issue || !issue.ncr) {
      return NextResponse.json({ error: "NCR not found" }, { status: 404 });
    }
    await requireProject(issue.projectId);

    const context = [
      issue.locationZone && `Vị trí: ${issue.locationZone}`,
      issue.ncr.qcvnRef && `Quy chuẩn áp dụng: ${issue.ncr.qcvnRef}`,
      `Tiêu đề NCR: ${issue.title}`,
      parsed.data.contextNote,
    ].filter(Boolean).join("\n");

    const result = await ncrAi.assessNcrPhoto({
      imageBase64: parsed.data.imageBase64,
      context,
    });

    const suggestionId = await saveSuggestion({
      kind: "ncr.assess_photo",
      entityType: "Issue",
      entityId: issue.id,
      projectId: issue.projectId,
      result,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error, suggestionId },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      suggestionId,
      assessment: result.data,
      model: result.model,
      latencyMs: result.latencyMs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
