import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, string> = {
  MUASAMCONG: "muasamcong.mpi.gov.vn",
  DAUTHAU_ASIA: "dauthau.asia",
  MANUAL: "Nhập tay",
  IMPORT: "Import",
};

export default async function BidRadarPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/bidradar");

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400_000);

  const [recent, closingSoon, byProvince, total] = await Promise.all([
    prisma.tenderOpportunity.findMany({
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
    prisma.tenderOpportunity.findMany({
      where: { closingAt: { gte: now, lte: in7d } },
      orderBy: { closingAt: "asc" },
      take: 20,
    }),
    prisma.tenderOpportunity.groupBy({
      by: ["province"],
      _count: { _all: true },
      orderBy: { _count: { province: "desc" } },
      take: 10,
    }),
    prisma.tenderOpportunity.count(),
  ]);

  const totalBudget = recent.reduce((s, t) => s + Number(t.budgetVnd ?? BigInt(0)), 0);

  return (
    <AecModuleShell
      group="Đấu thầu"
      name="BidRadar"
      subtitle="Săn gói thầu nhà nước — muasamcong.mpi.gov.vn + dauthau.asia. Alert qua email khi có gói phù hợp NACE code."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng gói thầu</div><div className="mt-1 text-2xl font-bold">{total}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đóng thầu trong 7 ngày</div><div className="mt-1 text-2xl font-bold text-amber-700">{closingSoon.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng ngân sách (top 30)</div><div className="mt-1 text-xl font-bold">{formatVnd(BigInt(totalBudget))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Watchlist của bạn</div><div className="mt-1 text-2xl font-bold text-slate-400">—</div><div className="text-[10px] text-slate-400">Coming soon</div></CardBody></Card>
      </div>

      {closingSoon.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-amber-800">⏰ Sắp đóng thầu — {closingSoon.length} gói</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-amber-50 text-xs uppercase text-amber-800">
                <tr><th className="p-2 text-left">Gói thầu</th><th className="p-2 text-left">Bên mời</th><th className="p-2 text-right">Ngân sách</th><th className="p-2 text-left">Đóng thầu</th><th className="p-2 text-left">Nguồn</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closingSoon.map((t) => (
                  <tr key={t.id} className="hover:bg-amber-50/30">
                    <td className="p-2"><div className="font-medium">{t.title}</div><div className="text-[10px] font-mono text-slate-500">{t.sourceRef ?? "—"}</div></td>
                    <td className="p-2 text-xs">{t.invitor ?? "—"}</td>
                    <td className="p-2 text-right text-sm">{t.budgetVnd ? formatVnd(t.budgetVnd) : "—"}</td>
                    <td className="p-2 text-xs text-amber-800">{t.closingAt ? formatDateVn(t.closingAt) : "—"}</td>
                    <td className="p-2 text-xs"><Badge variant="neutral">{sourceLabel[t.source] ?? t.source}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Gói thầu mới nhất ({recent.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {recent.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Chưa có gói thầu nào. Chạy scraper:{" "}
                <code className="rounded bg-slate-100 px-1">POST /api/winwork/tenders/scrape</code>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.slice(0, 20).map((t) => (
                  <li key={t.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{sourceLabel[t.source] ?? t.source}</Badge>
                      {t.bidMethod && <Badge variant="info">{t.bidMethod}</Badge>}
                      {t.province && <span className="text-xs text-slate-500">{t.province}</span>}
                    </div>
                    <div className="mt-1 font-medium text-slate-900">{t.title}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{t.invitor ?? "—"}</span>
                      <span>{t.budgetVnd ? formatVnd(t.budgetVnd) : "—"}</span>
                    </div>
                    {t.closingAt && (
                      <div className="text-[11px] text-slate-500">
                        Đóng thầu: {formatDateVn(t.closingAt)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Theo tỉnh</CardTitle></CardHeader>
          <CardBody>
            {byProvince.length === 0 ? (
              <div className="text-sm text-slate-500">Chưa có dữ liệu.</div>
            ) : (
              <ul className="space-y-1.5">
                {byProvince.map((p) => (
                  <li key={p.province ?? "unknown"} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{p.province ?? "Không xác định"}</span>
                    <Badge variant="neutral">{p._count._all}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
