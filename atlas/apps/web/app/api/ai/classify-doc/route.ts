import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@atlas/auth";
import { chat } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

const Body = z.object({ title: z.string().min(3).max(300) });

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.classify.doc" }); if (rl) return rl;
  try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const cats = ["QUYET_DINH","THONG_BAO","QUY_CHE","QUY_TRINH","BIEN_BAN","KHAC"];
    const sys = "Phân loại văn bản nội bộ công ty Việt Nam theo tiêu đề. Trả về DUY NHẤT 1 từ trong danh sách: " + cats.join(", ");
    const res = await chat([{ role: "system", content: sys }, { role: "user", content: parsed.data.title }], { temperature: 0 });
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason });
    const guess = res.data.trim().toUpperCase().replace(/[^A-Z_]/g, "");
    const valid = cats.includes(guess) ? guess : "KHAC";
    return NextResponse.json({ ok: true, category: valid, raw: res.data, model: res.model });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
