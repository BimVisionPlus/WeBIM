/**
 * POST /api/ai/extract-doc — Image (PDF page / scanned văn bản) → extracted
 * { docNo, title, issuedAt, category } via Groq vision.
 *
 * Body: multipart/form-data with `image` blob.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@atlas/auth";
import { describeImage } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;

const Extracted = z.object({
  docNo: z.string().nullable(),
  title: z.string().nullable(),
  issuedAt: z.string().nullable(), // ISO date or YYYY-MM-DD
  category: z.enum(["QUYET_DINH", "THONG_BAO", "QUY_CHE", "QUY_TRINH", "BIEN_BAN", "KHAC"]).nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.extract.doc" }); if (rl) return rl;
  try {
    await requireSession();
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "image required" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "image > 10MB" }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const b64 = buf.toString("base64");

    const sys = "Bạn trích xuất metadata từ ảnh quét văn bản công ty Việt Nam. Trả về JSON với 4 trường: docNo, title, issuedAt (YYYY-MM-DD), category (QUYET_DINH/THONG_BAO/QUY_CHE/QUY_TRINH/BIEN_BAN/KHAC). Nếu không nhận diện được trường nào, set null.";
    const prompt = "Đây là ảnh văn bản nội bộ công ty (quyết định, thông báo, quy chế…). Trích xuất: số văn bản (docNo), tiêu đề chính (title), ngày ban hành (issuedAt theo YYYY-MM-DD), và loại (category). Trả về 1 JSON object duy nhất.";

    const res = await describeImage({
      imageBase64: b64, prompt, systemPrompt: sys,
      parse: (raw) => {
        const r = Extracted.safeParse(raw);
        return r.success ? r.data : null;
      },
    });
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason, error: res.error }, { status: 502 });
    return NextResponse.json({ ok: true, extracted: res.data, model: res.model, latencyMs: res.latencyMs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "internal" }, { status: err.status ?? 500 });
  }
}
