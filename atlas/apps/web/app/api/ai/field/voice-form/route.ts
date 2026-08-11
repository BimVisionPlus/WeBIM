/**
 * POST /api/ai/field/voice-form
 *
 * multipart/form-data with:
 *   - file: audio blob (webm/m4a/mp3)
 *   - transcript (optional): if already transcribed externally
 *
 * Returns: { ok, transcript, form: { intent, fields... } }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSession, AuthError } from "@atlas/auth";
import { dailyLogAi, fieldVoiceAi } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.field.voice" }); if (rl) return rl;
  try {
    await requireSession();
    const form = await req.formData();
    let transcript = (form.get("transcript") as string | null) ?? "";

    if (!transcript) {
      const file = form.get("file");
      if (!(file instanceof Blob)) return NextResponse.json({ error: "file (audio) bắt buộc khi không có transcript" }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "Audio quá lớn (>25MB)" }, { status: 413 });
      const stt = await dailyLogAi.transcribeVoiceNote(file);
      if (!stt.ok) return NextResponse.json({ ok: false, reason: stt.reason, error: stt.error ?? "STT failed" }, { status: 502 });
      transcript = stt.data;
    }

    const r = await fieldVoiceAi.structureFieldVoice(transcript);
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 500 });

    return NextResponse.json({ ok: true, ...r.data });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
