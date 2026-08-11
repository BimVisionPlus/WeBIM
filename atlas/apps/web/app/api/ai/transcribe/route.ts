import { rateLimitGuard } from "@atlas/lib";
// Audio → text. Used by Daily Log mic button.
// Accepts multipart/form-data with `file` (audio blob) + optional `language`.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@atlas/auth";
import { dailyLogAi } from "@atlas/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — ~25 min of compressed webm

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ai.transcribe" });
  if (__rl) return __rl;
try {
    await requireSession();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "file (audio blob) is required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "audio too large (>25MB)" }, { status: 413 });
    }
    const wantStructured = form.get("structured") === "true";

    const stt = await dailyLogAi.transcribeVoiceNote(file);
    if (!stt.ok) {
      return NextResponse.json({ ok: false, reason: stt.reason, error: stt.error }, { status: 502 });
    }

    if (!wantStructured) {
      return NextResponse.json({ ok: true, text: stt.data, model: stt.model, latencyMs: stt.latencyMs });
    }

    const structured = await dailyLogAi.structureDailyLog(stt.data);
    return NextResponse.json({
      ok: true,
      text: stt.data,
      sttModel: stt.model,
      sttLatencyMs: stt.latencyMs,
      structured: structured.ok ? structured.data : null,
      structuredError: structured.ok ? null : structured.reason,
      llmModel: structured.ok ? structured.model : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
