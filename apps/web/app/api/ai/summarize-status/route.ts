import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { chat } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

const Body = z.object({ projectId: z.string() });

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.summarize.status" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await requireProject(parsed.data.projectId);

    const updates = await prisma.projectStatusUpdate.findMany({
      where: { projectId: parsed.data.projectId },
      orderBy: { reportedAt: "desc" }, take: 5,
    });
    if (updates.length === 0) return NextResponse.json({ ok: true, summary: "Chưa có cập nhật tình hình nào." });

    const bulk = updates.map((u, i) => `[${i+1}] ${u.title}\n${u.body}${u.pctComplete!=null ? ` (HT ${Math.round(u.pctComplete)}%)` : ""}`).join("\n\n");
    const sys = "Bạn là PM gạch đầu dòng tình hình dự án bằng tiếng Việt. Tối đa 4 bullet, mỗi bullet ≤ 20 từ. Không bịa.";
    const user = `Tóm tắt 5 cập nhật gần nhất:\n\n${bulk}`;

    const res = await chat([{ role: "system", content: sys }, { role: "user", content: user }]);
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason });
    return NextResponse.json({ ok: true, summary: res.data, model: res.model, latencyMs: res.latencyMs, sourceCount: updates.length });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
