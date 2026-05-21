import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  TT_10_2019: { vn: "TT 10/2019", variant: "info" },
  TT_11_2019: { vn: "TT 11/2019 (máy)", variant: "info" },
  TT_12_2021: { vn: "TT 12/2021", variant: "info" },
  PROVINCIAL: { vn: "Tỉnh điều chỉnh", variant: "warning" },
  CUSTOM: { vn: "Nội bộ", variant: "neutral" },
};

const resourceTypeLabel: Record<string, string> = { VL: "Vật liệu", NC: "Nhân công", M: "Máy" };

export default async function DinhMucPage({ searchParams }: { searchParams: Promise<{ q?: string; chapter?: string; province?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/dinhmuc");

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const chapter = params.chapter?.trim() ?? "";
  const province = params.province?.trim() ?? "HCM";

  const where: { code?: { contains: string; mode: "insensitive" }; chapter?: { startsWith: string }; OR?: Array<{ code?: { contains: string; mode: "insensitive" }; title?: { contains: string; mode: "insensitive" } }> } = {};
  if (chapter) where.chapter = { startsWith: chapter };
  if (q) where.OR = [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }];

  const norms = await prisma.normCode.findMany({
    where,
    include: {
      resources: { orderBy: [{ resourceType: "asc" }] },
      prices: { where: province ? { province } : {}, orderBy: { period: "desc" }, take: 1 },
    },
    orderBy: { code: "asc" },
    take: 100,
  });

  const totalNorms = await prisma.normCode.count();
  const totalResources = await prisma.normResource.count();
  const totalPrices = await prisma.normPrice.count();
  const chapters = await prisma.normCode.groupBy({ by: ["chapter"], _count: true });

  return (
    <AecModuleShell
      group="Đấu thầu"
      name="DinhMucDB — Định mức dự toán"
      subtitle="TT 10/2019 (XD) + TT 11/2019 (máy) + TT 12/2021. Knowledge-as-data: VL-NC-M hao phí, đơn giá tỉnh × quý."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Mã định mức</div><div className="mt-1 text-2xl font-bold">{totalNorms.toLocaleString("vi-VN")}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Hao phí VL-NC-M</div><div className="mt-1 text-2xl font-bold">{totalResources.toLocaleString("vi-VN")}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đơn giá tỉnh × kỳ</div><div className="mt-1 text-2xl font-bold">{totalPrices.toLocaleString("vi-VN")}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Chương</div><div className="mt-1 text-2xl font-bold">{chapters.length}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="grow min-w-[220px]">
              <label className="text-xs text-slate-600">Tìm mã / mô tả</label>
              <input name="q" defaultValue={q} placeholder="AB.13211 hoặc 'bê tông'" className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-600">Chương</label>
              <select name="chapter" defaultValue={chapter} className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm">
                <option value="">Tất cả</option>
                {chapters.map((c) => <option key={c.chapter} value={c.chapter.split(" ")[0]}>{c.chapter} ({c._count})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600">Tỉnh đơn giá</label>
              <select name="province" defaultValue={province} className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm">
                <option value="HCM">HCM</option><option value="HN">Hà Nội</option><option value="DN">Đà Nẵng</option><option value="BD">Bình Dương</option>
              </select>
            </div>
            <button className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Tra cứu</button>
          </form>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Kết quả ({norms.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {norms.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có định mức nào khớp. Thử bỏ filter hoặc seed thêm bằng <code>scripts/seed-dinhmuc.ts</code>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-left">Đơn vị</th>
                  <th className="p-2 text-left">Hao phí</th>
                  <th className="p-2 text-right">Đơn giá {province}</th>
                  <th className="p-2 text-left">Nguồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {norms.map((n) => {
                  const meta = sourceLabel[n.source] ?? { vn: n.source, variant: "neutral" as const };
                  const price = n.prices[0];
                  return (
                    <tr key={n.id} className="hover:bg-slate-50 align-top">
                      <td className="p-2 font-mono text-xs">{n.code}</td>
                      <td className="p-2"><div className="font-medium line-clamp-2">{n.title}</div><div className="text-[10px] text-slate-500">{n.section}</div></td>
                      <td className="p-2 text-xs">{n.unit}</td>
                      <td className="p-2 text-[11px] text-slate-700">
                        {n.resources.slice(0, 3).map((r) => (
                          <div key={r.id}>
                            <span className="inline-block w-7 text-slate-500">{resourceTypeLabel[r.resourceType]}</span>{" "}
                            {Number(r.quantity).toLocaleString("vi-VN")} {r.unit}
                          </div>
                        ))}
                        {n.resources.length > 3 && <div className="text-slate-400">+{n.resources.length - 3} mục</div>}
                      </td>
                      <td className="p-2 text-right text-xs font-medium">{price ? formatVnd(price.unitPriceVnd) : <span className="text-slate-400">—</span>}</td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <p className="mt-4 text-[11px] text-slate-500">
        DinhMucDB feed: <code>CostPulse</code> (BoQ pricing), <code>VolumeMeter</code> (mã định mức trên TakeoffLine),
        <code>TenderForge</code> (giá dự thầu auto-suggest). API: <code>GET /api/dinhmuc?code=AB.13211&amp;province=HCM</code>.
      </p>
    </AecModuleShell>
  );
}
