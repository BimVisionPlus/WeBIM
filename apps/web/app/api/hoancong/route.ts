// POST /api/hoancong — Create HoanCongDossier + auto-create 13 sections theo VIIIb.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ projectId: z.string(), code: z.string().min(3).max(64), title: z.string().min(2).max(200) });

const SECTIONS = [
  { seq: 1, code: "VIIIb.1", title: "Quyết định phê duyệt dự án + Giấy phép xây dựng" },
  { seq: 2, code: "VIIIb.2", title: "Hồ sơ khảo sát xây dựng" },
  { seq: 3, code: "VIIIb.3", title: "Hồ sơ thiết kế: TKCS/TKKT/TKBVTC + thẩm tra" },
  { seq: 4, code: "VIIIb.4", title: "Biện pháp thi công + biện pháp an toàn" },
  { seq: 5, code: "VIIIb.5", title: "Hồ sơ chất lượng vật liệu" },
  { seq: 6, code: "VIIIb.6", title: "Nhật ký thi công + nhật ký giám sát" },
  { seq: 7, code: "VIIIb.7", title: "BBNT công việc xây dựng A1/A2/A3" },
  { seq: 8, code: "VIIIb.8", title: "BBNT giai đoạn + hoàn thành hạng mục" },
  { seq: 9, code: "VIIIb.9", title: "Bản vẽ hoàn công (as-built)" },
  { seq: 10, code: "VIIIb.10", title: "Hồ sơ kết cấu chịu lực + thí nghiệm" },
  { seq: 11, code: "VIIIb.11", title: "Hệ thống MEP + PCCC" },
  { seq: 12, code: "VIIIb.12", title: "Hồ sơ vận hành + bảo trì" },
  { seq: 13, code: "VIIIb.13", title: "BBNT hoàn thành + quyết toán hợp đồng" },
];

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "hoancong.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const dossier = await prisma.hoanCongDossier.upsert({
      where: { projectId: d.projectId },
      create: { projectId: d.projectId, code: d.code, title: d.title, state: "DRAFT", sections: { create: SECTIONS } },
      update: { code: d.code, title: d.title },
    });
    await audit({ action: "hoancong.create", entityType: "HoanCongDossier", entityId: dossier.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { code: d.code } });
    return NextResponse.json({ ok: true, id: dossier.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
