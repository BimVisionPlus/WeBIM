// DinhMucDB API — tra cứu (GET) + thêm mã định mức nội bộ (POST).
// Consumers: CostPulse (BoQ pricing), VolumeMeter (mã trên TakeoffLine), TenderForge (auto-suggest giá).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { getSession, requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export const dynamic = "force-dynamic";

const CreateBody = z.object({
  code: z.string().min(3).max(32),
  chapter: z.string().min(2).max(120),
  section: z.string().min(2).max(120),
  group: z.string().max(120).optional(),
  title: z.string().min(2).max(500),
  unit: z.string().min(1).max(20),
  source: z.enum(["TT_10_2019", "TT_11_2019", "TT_12_2021", "PROVINCIAL", "CUSTOM"]).default("CUSTOM"),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "dinhmuc.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const exists = await prisma.normCode.findUnique({ where: { code: d.code } });
    if (exists) return NextResponse.json({ error: `Mã ${d.code} đã tồn tại` }, { status: 409 });
    const norm = await prisma.normCode.create({ data: { ...d, group: d.group ?? null, notes: d.notes ?? null } });
    await audit({ action: "dinhmuc.create", entityType: "NormCode", entityId: norm.id, actorId: session.userId, ...reqMeta(req), after: { code: d.code } });
    return NextResponse.json({ ok: true, id: norm.id, code: norm.code });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code")?.trim();
  const q = sp.get("q")?.trim();
  const chapter = sp.get("chapter")?.trim();
  const province = sp.get("province")?.trim() ?? "HCM";
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);

  if (code) {
    const norm = await prisma.normCode.findUnique({
      where: { code },
      include: { resources: true, prices: { where: { province }, orderBy: { period: "desc" }, take: 4 } },
    });
    if (!norm) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serialize(norm));
  }

  const where: Record<string, unknown> = {};
  if (chapter) where.chapter = { startsWith: chapter };
  if (q) where.OR = [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }];

  const norms = await prisma.normCode.findMany({
    where,
    include: { prices: { where: { province }, orderBy: { period: "desc" }, take: 1 } },
    orderBy: { code: "asc" },
    take: limit,
  });
  return NextResponse.json(norms.map(serialize));
}

function serialize(n: { id: string; code: string; title: string; unit: string; chapter: string; section: string; source: string; resources?: Array<{ resourceType: string; description: string; unit: string; quantity: unknown }>; prices?: Array<{ province: string; period: string; unitPriceVnd: bigint }> }) {
  return {
    ...n,
    resources: n.resources?.map((r) => ({ ...r, quantity: r.quantity?.toString?.() ?? r.quantity })),
    prices: n.prices?.map((p) => ({ ...p, unitPriceVnd: p.unitPriceVnd.toString() })),
  };
}
