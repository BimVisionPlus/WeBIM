import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

/**
 * 08 — Atlas Marketplace (vendor discovery + tender broadcast).
 *
 * Public catalog of:
 *   - Supplier vật tư cross-org
 *   - Contractor (thầu phụ) năng lực
 *   - Tender opportunities (broadcast từ BidRadar)
 *
 * Phase 1 (this page): read-only browse + filter
 * Phase 2 (future): RFQ + tender response submission flow
 */

export default async function MarketplacePage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/marketplace");

  const [suppliers, topContractors, hotLeads, byProvince] = await Promise.all([
    prisma.supplier.findMany({
      where: { active: true },
      include: { _count: { select: { items: true, vendorContracts: true } } },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      take: 30,
    }),
    prisma.contractorProfile.findMany({
      where: { blacklisted: false, rating: { not: null } },
      include: { org: { select: { name: true, type: true } }, _count: { select: { performances: true } } },
      orderBy: { rating: "desc" },
      take: 20,
    }),
    prisma.projectLead.findMany({
      where: { status: { in: ["POTENTIAL", "TRACKING"] }, estValueVnd: { not: null } },
      orderBy: { estValueVnd: "desc" },
      take: 20,
    }),
    prisma.projectLead.groupBy({
      by: ["province"],
      where: { status: { in: ["POTENTIAL", "TRACKING"] } },
      _count: { _all: true },
      _sum: { estValueVnd: true },
    }),
  ]);

  return (
    <AecModuleShell group="Marketplace" name="Atlas Marketplace — Vendor discovery + tender broadcast" subtitle="Browse supplier vật tư cross-org · Sổ năng lực thầu phụ · Tender opportunity broadcast từ BidRadar. Phase 2: RFQ + tender response submission.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Nhà cung cấp đang active</div><div className="mt-1 text-2xl font-bold text-blue-700">{suppliers.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Thầu phụ (có rating)</div><div className="mt-1 text-2xl font-bold text-violet-700">{topContractors.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tender đang mở</div><div className="mt-1 text-2xl font-bold text-emerald-700">{hotLeads.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng giá trị tender</div><div className="mt-1 text-xl font-bold text-amber-700">{formatVnd(hotLeads.reduce((s, l) => s + (l.estValueVnd ?? BigInt(0)), BigInt(0)))}</div></CardBody></Card>
      </div>

      {/* Hot tender broadcast */}
      <Card className="mt-6">
        <CardHeader><CardTitle>🔥 Tender opportunity — đang mở cho thầu phụ</CardTitle></CardHeader>
        <CardBody className="p-0">
          {hotLeads.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có tender broadcast nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Dự án / Gói thầu</th><th className="p-2 text-left">Chủ đầu tư</th><th className="p-2 text-left">Địa bàn</th><th className="p-2 text-right">Giá trị</th><th className="p-2 text-left">Đóng đơn</th><th className="p-2 text-left">Trạng thái</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hotLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="p-2"><div className="font-medium">{l.name}</div><div className="text-[10px] text-slate-500">{l.source ?? "—"}</div></td>
                    <td className="p-2 text-xs">{l.clientName ?? "—"}</td>
                    <td className="p-2 text-xs">{l.province ?? "—"}</td>
                    <td className="p-2 text-right font-medium">{l.estValueVnd ? formatVnd(l.estValueVnd) : "—"}</td>
                    <td className="p-2 text-xs">{l.nextActionAt ? formatDateVn(l.nextActionAt) : "—"}</td>
                    <td className="p-2"><Badge variant={l.status === "TRACKING" ? "info" : "neutral"}>{l.status === "TRACKING" ? "Đang theo dõi" : "Tiềm năng"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Province heatmap */}
      <Card className="mt-4">
        <CardHeader><CardTitle>Tender theo địa bàn (top tỉnh)</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-2 text-left">Tỉnh</th><th className="p-2 text-right">Số tender</th><th className="p-2 text-right">Tổng giá trị</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byProvince.sort((a, b) => Number((b._sum.estValueVnd ?? BigInt(0)) - (a._sum.estValueVnd ?? BigInt(0)))).slice(0, 10).map((p) => (
                <tr key={p.province ?? "unknown"} className="hover:bg-slate-50">
                  <td className="p-2 font-medium">{p.province ?? "(không xác định)"}</td>
                  <td className="p-2 text-right">{p._count._all}</td>
                  <td className="p-2 text-right">{formatVnd(p._sum.estValueVnd ?? BigInt(0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Top contractors */}
      <Card className="mt-4">
        <CardHeader><CardTitle>Sổ năng lực thầu phụ — top theo rating</CardTitle></CardHeader>
        <CardBody className="p-0">
          {topContractors.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có hồ sơ năng lực thầu phụ nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Đơn vị</th><th className="p-2 text-left">Hạng</th><th className="p-2 text-left">Phạm vi</th><th className="p-2 text-right">Năm KN</th><th className="p-2 text-right">DA đã làm</th><th className="p-2 text-right">Rating</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topContractors.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-2"><div className="font-medium">{c.legalName}</div><div className="text-[10px] text-slate-500 font-mono">{c.mst ?? "—"}</div></td>
                    <td className="p-2"><Badge variant={c.capabilityClass === "HANG_I" ? "info" : c.capabilityClass === "HANG_II" ? "warning" : "neutral"}>{c.capabilityClass.replace("HANG_", "Hạng ")}</Badge></td>
                    <td className="p-2 text-xs line-clamp-1">{c.capabilityScope.slice(0, 2).join(", ") || "—"}</td>
                    <td className="p-2 text-right text-xs">{c.yearsExperience ?? "—"}</td>
                    <td className="p-2 text-right text-xs">{c.pastProjects}</td>
                    <td className="p-2 text-right text-sm font-bold">{c.rating ? `${Number(c.rating).toFixed(2)} ⭐` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Suppliers grid */}
      <Card className="mt-4">
        <CardHeader><CardTitle>Catalog supplier vật tư ({suppliers.length})</CardTitle></CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.slice(0, 18).map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="mt-0.5 text-[10px] text-slate-500 font-mono">{s.mst ?? "—"}</div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
                  <div>📦 {s._count.items} vật tư</div>
                  <div>📋 {s._count.vendorContracts} HĐ</div>
                  {s.rating && <div className="ml-auto font-bold text-amber-600">{s.rating.toFixed(1)} ⭐</div>}
                </div>
                {s.address && <div className="mt-1 text-[10px] text-slate-400">📍 {s.address}</div>}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
        <CardTitle>Roadmap Phase 2 — RFQ workflow</CardTitle>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>· <strong>RFQ submit</strong>: NT chính phát RFQ → broadcast cho tất cả supplier đáp ứng tiêu chí → supplier báo giá qua cổng riêng</li>
          <li>· <strong>Tender response</strong>: thầu phụ submit hồ sơ năng lực + báo giá → AI tự score + ranking</li>
          <li>· <strong>Auto-matching</strong>: AI gợi ý top 5 supplier cho 1 BoQ line dựa trên lịch sử + rating + địa bàn</li>
          <li>· <strong>Reputation system</strong>: cross-org rating, blacklist sharing có kiểm soát</li>
        </ul>
      </div>
    </AecModuleShell>
  );
}
