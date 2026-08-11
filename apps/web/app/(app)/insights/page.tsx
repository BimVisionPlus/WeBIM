import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

/**
 * 06 — Atlas Insights (cross-project ML analytics).
 *
 * Phase 1 (this page): live aggregates from existing data — no new schema.
 *   - Win rate dashboard from Bid history
 *   - Profitability heatmap per phòng
 *   - Contractor scorecard from ContractorPerformance
 *   - Project EVM rollup across portfolio
 *
 * Phase 2 (future): ML models that learn from this aggregate data.
 *   - Predict win probability of a new Bid given its profile
 *   - Auto-rate contractors based on aggregated performance
 *   - Detect anomaly in cash flow patterns
 */

const DEPT_LABEL: Record<string, string> = {
  CONG_VIEC: "Công việc",
  DAU_THAU: "Đấu thầu",
  HANH_CHINH: "Hành chính",
  TAI_CHINH_KE_TOAN: "Tài chính - kế toán",
  PHAT_TRIEN_THI_TRUONG: "Phát triển thị trường",
  CONG_VIEC_KHAC: "Công việc khác",
};

const STATUS_LABEL: Record<string, { vn: string; color: string }> = {
  PLANNING: { vn: "Chuẩn bị", color: "bg-[rgb(var(--raised))] text-[rgb(var(--ink-2))]" },
  IN_PROGRESS: { vn: "Đang thi công", color: "bg-amber-100 text-amber-700" },
  HANDOVER: { vn: "Bàn giao", color: "bg-blue-100 text-blue-700" },
  WARRANTY: { vn: "Bảo hành", color: "bg-emerald-100 text-emerald-700" },
  CLOSED: { vn: "Đóng hồ sơ", color: "bg-[rgb(var(--raised))] text-[rgb(var(--muted))]" },
};

export default async function InsightsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/insights");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const [
    bidsByState,
    projectsByStatusByDept,
    topContractors,
    overrunSignals,
    avgCpiData,
  ] = await Promise.all([
    prisma.bid.groupBy({
      by: ["state"],
      _count: { _all: true },
      _sum: { proposedValueVnd: true },
    }).catch(() => []),
    prisma.project.findMany({
      where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] },
      select: { id: true, status: true, department: true, contractValueVnd: true },
    }),
    prisma.contractorProfile.findMany({
      where: { rating: { not: null } },
      include: { org: { select: { name: true } }, _count: { select: { performances: true } } },
      orderBy: { rating: "desc" },
      take: 10,
    }),
    prisma.costOverrunSignal.findMany({
      where: { status: "OPEN" },
      include: { project: { select: { key: true, name: true } } },
      orderBy: { deltaPct: "desc" },
      take: 10,
    }),
    prisma.boQLine.aggregate({
      _sum: { totalVnd: true },
    }),
  ]);

  // Win rate calculation
  const winRate = (() => {
    const won = bidsByState.find((b: any) => b.state === "AWARDED")?._count?._all ?? 0;
    const lost = bidsByState.find((b: any) => b.state === "LOST")?._count?._all ?? 0;
    const total = won + lost;
    return total === 0 ? 0 : Math.round((won / total) * 100);
  })();
  const wonValue = bidsByState.find((b: any) => b.state === "AWARDED")?._sum?.proposedValueVnd ?? BigInt(0);
  const pipelineValue = bidsByState.filter((b: any) => ["DRAFT", "ESTIMATING", "SUBMITTED"].includes(b.state)).reduce((s: bigint, b: any) => s + (b._sum.proposedValueVnd ?? BigInt(0)), BigInt(0));

  // Dept × Status matrix
  const matrix = new Map<string, Map<string, { count: number; value: bigint }>>();
  for (const p of projectsByStatusByDept) {
    const dept = p.department;
    if (!matrix.has(dept)) matrix.set(dept, new Map());
    const inner = matrix.get(dept)!;
    if (!inner.has(p.status)) inner.set(p.status, { count: 0, value: BigInt(0) });
    const cell = inner.get(p.status)!;
    cell.count++;
    cell.value += p.contractValueVnd ?? BigInt(0);
  }

  return (
    <AecModuleShell group="Insights" name="Atlas Insights — Cross-project ML analytics" subtitle="Win rate · Profitability heatmap · Contractor scorecard · Overrun radar. Phase 1 — live aggregates. Phase 2 — predictive ML.">
      {/* Hero */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Win rate</div>
            <div className="mt-1 text-3xl font-bold text-emerald-700">{winRate}<span className="text-base font-normal text-[rgb(var(--muted-2))]">%</span></div>
            <div className="text-[10px] text-[rgb(var(--muted))]">{bidsByState.reduce((s: number, b: any) => s + b._count._all, 0)} bid all-time</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Đã trúng</div>
            <div className="mt-1 text-xl font-bold text-blue-700">{formatVnd(wonValue)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Pipeline đang theo</div>
            <div className="mt-1 text-xl font-bold text-violet-700">{formatVnd(pipelineValue)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Overrun signal mở</div>
            <div className="mt-1 text-3xl font-bold text-rose-700">{overrunSignals.length}</div>
          </CardBody>
        </Card>
      </div>

      {/* Profitability heatmap */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Profitability heatmap — Phòng × Trạng thái dự án</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
              <tr>
                <th className="p-2 text-left">Phòng</th>
                {Object.keys(STATUS_LABEL).map((s) => (
                  <th key={s} className="p-2 text-center"><span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] ${STATUS_LABEL[s]?.color}`}>{STATUS_LABEL[s]?.vn}</span></th>
                ))}
                <th className="p-2 text-right">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--line))]">
              {Object.keys(DEPT_LABEL).map((d) => {
                const inner = matrix.get(d);
                let rowTotal = BigInt(0);
                let rowCount = 0;
                return (
                  <tr key={d} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-medium">{DEPT_LABEL[d]}</td>
                    {Object.keys(STATUS_LABEL).map((s) => {
                      const cell = inner?.get(s);
                      if (cell) { rowTotal += cell.value; rowCount += cell.count; }
                      return (
                        <td key={s} className="p-2 text-center">
                          {cell ? (
                            <div className="text-xs">
                              <div className="font-semibold">{cell.count}</div>
                              <div className="text-[10px] text-[rgb(var(--muted))]">{formatVnd(cell.value)}</div>
                            </div>
                          ) : <span className="text-[rgb(var(--inverse-ink))]">—</span>}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right">
                      <div className="text-sm font-bold">{rowCount}</div>
                      <div className="text-[10px] text-[rgb(var(--muted))]">{formatVnd(rowTotal)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Contractor scorecard */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Top 10 thầu phụ theo rating</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {topContractors.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có đánh giá nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Đơn vị</th><th className="p-2 text-left">Hạng</th><th className="p-2 text-right">Rating</th><th className="p-2 text-right">DA đã làm</th><th className="p-2 text-right">Lần đánh giá</th><th className="p-2 text-left">Trạng thái</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {topContractors.map((c) => (
                  <tr key={c.id} className={`hover:bg-[rgb(var(--raised))] ${c.blacklisted ? "bg-rose-50/30" : ""}`}>
                    <td className="p-2"><div className="font-medium">{c.legalName}</div><div className="text-[10px] text-[rgb(var(--muted))] font-mono">{c.mst ?? "—"}</div></td>
                    <td className="p-2"><Badge variant={c.capabilityClass === "HANG_I" ? "info" : c.capabilityClass === "HANG_II" ? "warning" : "neutral"}>{c.capabilityClass.replace("HANG_", "Hạng ")}</Badge></td>
                    <td className="p-2 text-right text-sm font-bold">{c.rating ? `${Number(c.rating).toFixed(2)} ⭐` : "—"}</td>
                    <td className="p-2 text-right text-xs">{c.pastProjects}</td>
                    <td className="p-2 text-right text-xs">{c._count.performances}</td>
                    <td className="p-2">{c.blacklisted ? <Badge variant="danger">Blacklist</Badge> : <Badge variant="success">OK</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Overrun radar */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Overrun radar — top 10 cảnh báo nghiêm trọng</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {overrunSignals.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Không có signal nào đang mở. Click "Chạy AI forecast" trên <a href="/cost?tab=overrun" className="text-blue-600 underline">/cost</a> để tạo signal mới.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Dự án</th><th className="p-2 text-left">Hạng mục</th><th className="p-2 text-left">Severity</th><th className="p-2 text-right">Forecast EAC</th><th className="p-2 text-right">vs BAC</th><th className="p-2 text-right">Sớm trước</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {overrunSignals.map((s) => (
                  <tr key={s.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2"><div className="font-mono text-xs">{s.project.key}</div><div className="text-[10px] text-[rgb(var(--muted))]">{s.project.name}</div></td>
                    <td className="p-2 text-xs">{s.category ?? "—"}</td>
                    <td className="p-2"><Badge variant={s.severity === "CRITICAL" ? "danger" : s.severity === "ALERT" ? "warning" : "info"}>{s.severity}</Badge></td>
                    <td className="p-2 text-right text-xs">{formatVnd(s.forecastedVnd)}</td>
                    <td className={`p-2 text-right text-xs font-bold ${s.deltaPct > 0 ? "text-rose-700" : "text-emerald-700"}`}>{s.deltaPct > 0 ? "+" : ""}{s.deltaPct.toFixed(1)}%</td>
                    <td className="p-2 text-right text-xs">{s.weeksAhead} tuần</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 rounded-lg border border-violet-200 bg-violet-50/40 p-4 text-xs text-[rgb(var(--ink-2))]">
        <div className="font-medium text-violet-900">Roadmap Phase 2 — Predictive ML</div>
        <ul className="mt-2 space-y-1">
          <li>· <strong>Win probability model</strong>: cho 1 cơ hội mới (giá trị, địa bàn, ngành), trả P(win) % dựa trên Bid history.</li>
          <li>· <strong>Contractor auto-rating</strong>: ML model học từ ContractorPerformance cập nhật rating mỗi tháng.</li>
          <li>· <strong>Cash flow anomaly</strong>: phát hiện bất thường trong AdvanceTransaction + PaymentApplication pattern.</li>
          <li>· <strong>Project clustering</strong>: nhóm dự án tương tự để benchmark KPI cross-project.</li>
        </ul>
      </div>
    </AecModuleShell>
  );
}
