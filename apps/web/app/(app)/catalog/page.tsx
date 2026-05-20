import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  BE_TONG: "Bê tông",
  COT_THEP: "Cốt thép",
  GACH_DA: "Gạch · đá",
  XI_MANG_VOI: "Xi măng · vôi",
  SON_PHU: "Sơn · phụ gia",
  ME_HVAC: "M&E · HVAC",
  ME_DIEN: "M&E · Điện",
  ME_NUOC: "M&E · Nước",
  PCCC: "PCCC",
  CUA_KINH: "Cửa · kính · nhôm",
  THIET_BI_THI_CONG: "Thiết bị thi công",
  KHAC: "Khác",
};

export default async function CatalogPage() {
  const [items, suppliers] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { active: true, projectId: null },
      include: { _count: { select: { suppliers: true } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 200,
    }),
    prisma.supplier.findMany({
      where: { active: true },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  // Group items by category
  const byCategory: Record<string, typeof items> = {};
  for (const i of items) {
    if (!byCategory[i.category]) byCategory[i.category] = [];
    byCategory[i.category]!.push(i);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Catalog — Cấu kiện · vật tư · nhà cung cấp</h2>
        <p className="mt-1 text-sm text-slate-500">
          Thư viện cấu kiện chuẩn hóa cho công ty. Link với Submittal (vật liệu thi công) + BoQ (giá đơn vị).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Cấu kiện</div>
            <div className="mt-1 text-2xl font-bold">{items.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Nhà cung cấp</div>
            <div className="mt-1 text-2xl font-bold">{suppliers.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Danh mục</div>
            <div className="mt-1 text-2xl font-bold">{Object.keys(byCategory).length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Quan hệ giá (item × supplier)</div>
            <div className="mt-1 text-2xl font-bold">{items.reduce((s, i) => s + i._count.suppliers, 0)}</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Cấu kiện ({items.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Chưa có cấu kiện. POST <code className="rounded bg-slate-100 px-1">/api/catalog/items</code> để thêm.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {Object.entries(byCategory).map(([cat, list]) => (
                  <div key={cat} className="px-4 py-3">
                    <div className="mb-2">
                      <Badge variant="violet">{categoryLabel[cat] ?? cat}</Badge>
                      <span className="ml-2 text-xs text-slate-500">{list!.length} cấu kiện</span>
                    </div>
                    <div className="space-y-1">
                      {list!.map((i) => (
                        <div key={i.id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] text-slate-500">{i.code}</span>
                            <span className="text-slate-900">{i.name}</span>
                            <span className="text-[11px] text-slate-500">/ {i.unit}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            {i.baselineUnitPriceVnd && (
                              <span className="font-medium text-slate-700">{formatVnd(i.baselineUnitPriceVnd)}</span>
                            )}
                            <Badge variant="neutral">{i._count.suppliers} NCC</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Nhà cung cấp</CardTitle></CardHeader>
          <CardBody className="p-0">
            {suppliers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Chưa có nhà cung cấp.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <div key={s.id} className="p-3 text-sm">
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <div className="text-[11px] text-slate-500">
                      MST: {s.mst ?? "—"} · {s._count.items} cấu kiện
                      {s.rating !== null && <> · ⭐ {s.rating?.toFixed(1)}</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
