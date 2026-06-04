import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { NormSearchPanel } from "./NormSearchPanel";
import { OverrunForecastPanel } from "./OverrunForecastPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

const sevMeta: Record<string, { vn: string; variant: "info" | "warning" | "danger" | "neutral" | "success" }> = {
  WATCH: { vn: "Cảnh báo", variant: "warning" },
  ALERT: { vn: "Báo động", variant: "danger" },
  CRITICAL: { vn: "Nghiêm trọng", variant: "danger" },
  ON_TRACK: { vn: "OK", variant: "success" },
};

export default async function CostPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/cost");
  const sp = await searchParams;
  const tab = (sp.tab ?? "all") as "all" | "norm" | "estimate" | "overrun";

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const [normCount, priceCount, signals, openSignals, projects, recentSignalsByProject] = await Promise.all([
    prisma.normCode.count(),
    prisma.normPrice.count(),
    prisma.costOverrunSignal.findMany({
      where: { project: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] } },
      include: { project: { select: { key: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.costOverrunSignal.count({
      where: { status: "OPEN", project: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] } },
    }),
    prisma.project.findMany({
      where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] },
      select: { id: true, key: true, name: true, boqs: { where: { isCurrent: true }, select: { contractValueVnd: true }, take: 1 } },
      orderBy: { key: "asc" },
    }),
    prisma.costOverrunSignal.findMany({
      where: { project: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] } },
      select: { projectId: true, severity: true },
    }),
  ]);

  const sigByProject = new Map<string, { critical: number; alert: number; watch: number }>();
  for (const s of recentSignalsByProject) {
    const cur = sigByProject.get(s.projectId) ?? { critical: 0, alert: 0, watch: 0 };
    if (s.severity === "CRITICAL") cur.critical++;
    else if (s.severity === "ALERT") cur.alert++;
    else if (s.severity === "WATCH") cur.watch++;
    sigByProject.set(s.projectId, cur);
  }

  const totalBac = projects.reduce((s, p) => s + Number(p.boqs[0]?.contractValueVnd ?? 0), 0);

  return (
    <AecModuleShell group="Cost" name="Atlas Cost — Định mức · EVM · ML cảnh báo overrun" subtitle="Tra cứu định mức TT 10/2019, lập dự toán tự động, dự báo cost overrun 2-4 tuần trước theo CPI/SPI + ML.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Mã định mức</div><div className="mt-1 text-2xl font-bold text-blue-700">{normCount}</div><div className="text-[10px] text-slate-500">TT 10/2019 + bổ sung</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đơn giá đã cập nhật</div><div className="mt-1 text-2xl font-bold text-violet-700">{priceCount}</div><div className="text-[10px] text-slate-500">theo tỉnh × kỳ</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng BAC theo dõi</div><div className="mt-1 text-xl font-bold text-emerald-700">{formatVnd(BigInt(totalBac))}</div><div className="text-[10px] text-slate-500">{projects.length} dự án</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Cảnh báo overrun đang mở</div><div className="mt-1 text-2xl font-bold text-rose-700">{openSignals}</div></CardBody></Card>
      </div>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {[
          { key: "all", label: "Tổng quan" },
          { key: "norm", label: "Tra cứu định mức" },
          { key: "estimate", label: "Lập dự toán" },
          { key: "overrun", label: "Cảnh báo overrun", count: signals.length },
        ].map((t) => {
          const isActive = t.key === tab;
          return (
            <Link key={t.key} href={`/cost?tab=${t.key}`} className={`relative -mb-px px-3 py-2 text-sm font-medium ${isActive ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600 hover:text-slate-900"}`}>
              {t.label}{typeof t.count === "number" && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{t.count}</span>}
            </Link>
          );
        })}
      </nav>

      {(tab === "all" || tab === "norm" || tab === "estimate") && (
        <div className="mt-4">
          <NormSearchPanel showEstimate={tab !== "norm"} />
        </div>
      )}

      {(tab === "all" || tab === "overrun") && (
        <>
          <Card className="mt-4">
            <CardHeader><CardTitle>Forecast cost overrun cho dự án</CardTitle></CardHeader>
            <CardBody>
              <OverrunForecastPanel
                projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, bacVnd: p.boqs[0]?.contractValueVnd?.toString() ?? null }))}
              />
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardHeader><CardTitle>Lịch sử cảnh báo overrun ({signals.length})</CardTitle></CardHeader>
            <CardBody className="p-0">
              {signals.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">Chưa có cảnh báo overrun nào. Chạy "Forecast" để bắt đầu.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="p-2 text-left">Ngày</th><th className="p-2 text-left">Dự án</th><th className="p-2 text-left">Mức độ</th><th className="p-2 text-left">Hạng mục</th><th className="p-2 text-right">Baseline (BAC)</th><th className="p-2 text-right">Forecast (EAC)</th><th className="p-2 text-right">Δ%</th><th className="p-2 text-left">Trạng thái</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {signals.map((s) => {
                      const m = sevMeta[s.severity] ?? { vn: s.severity, variant: "neutral" as const };
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-2 text-xs">{formatDateVn(s.createdAt)}</td>
                          <td className="p-2"><div className="font-mono text-xs">{s.project.key}</div><div className="text-[11px] text-slate-500">{s.project.name}</div></td>
                          <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td>
                          <td className="p-2 text-xs">{s.category ?? "—"}</td>
                          <td className="p-2 text-right text-xs">{formatVnd(s.baselineVnd)}</td>
                          <td className="p-2 text-right text-xs">{formatVnd(s.forecastedVnd)}</td>
                          <td className={`p-2 text-right text-xs font-medium ${s.deltaPct > 0 ? "text-rose-700" : "text-emerald-700"}`}>{s.deltaPct > 0 ? "+" : ""}{s.deltaPct.toFixed(1)}%</td>
                          <td className="p-2"><Badge variant={s.status === "OPEN" ? "warning" : "neutral"}>{s.status}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </AecModuleShell>
  );
}
