// DinhMucDB read-only API — tra cứu mã định mức + đơn giá tỉnh.
// Consumers: CostPulse (BoQ pricing), VolumeMeter (mã trên TakeoffLine), TenderForge (auto-suggest giá).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";

export const dynamic = "force-dynamic";

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
