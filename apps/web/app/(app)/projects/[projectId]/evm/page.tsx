import { prisma } from "@atlas/db";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";
import { requireProject, AuthError } from "@atlas/auth";

export const dynamic = "force-dynamic";

function fmt(n: number) { return formatVnd(BigInt(Math.round(n))); }

export default async function EvmPage({ params }: { params: Promise<{ projectId: string }> }) {
  const p = await params;
  try { await requireProject(p.projectId); } catch (e) {
    if (e instanceof AuthError && e.status === 401) redirect(`/signin?callbackUrl=/projects/${p.projectId}/evm`);
    redirect("/");
  }

  const project = await prisma.project.findUnique({
    where: { id: p.projectId },
    include: {
      scheduleTasks: { select: { pctComplete: true, plannedStart: true, plannedEnd: true } },
      boqs: { where: { isCurrent: true }, select: { contractValueVnd: true, name: true } },
      paymentApps: { select: { cumulativeWorkVnd: true, workDoneVnd: true, state: true, period: true }, orderBy: { period: "desc" } },
    },
  });
  if (!project) redirect("/");

  const budget = Number(project.contractValueVnd ?? project.boqs[0]?.contractValueVnd ?? 0);
  const start = project.startDate?.getTime() ?? Date.now() - 180 * 86400000;
  const end = project.endDate?.getTime() ?? Date.now() + 180 * 86400000;
  const totalSpan = Math.max(end - start, 1);
  const elapsed = Math.min(Math.max(Date.now() - start, 0), totalSpan);
  const elapsedPct = elapsed / totalSpan;

  // EVM inputs
  const PV = budget * elapsedPct;
  const avgComplete = project.scheduleTasks.length === 0 ? 0 : project.scheduleTasks.reduce((s, t) => s + t.pctComplete, 0) / project.scheduleTasks.length / 100;
  const EV = budget * avgComplete;
  const AC = project.paymentApps.length === 0 ? 0 : Math.max(...project.paymentApps.map((pa) => Number(pa.cumulativeWorkVnd ?? 0)));

  const SV = EV - PV;
  const CV = EV - AC;
  const SPI = PV === 0 ? 1 : EV / PV;
  const CPI = AC === 0 ? 1 : EV / AC;

  const health = SPI >= 0.95 && CPI >= 0.95 ? { vn: "Tốt", color: "emerald" } : SPI >= 0.85 && CPI >= 0.85 ? { vn: "Cảnh báo", color: "amber" } : { vn: "Rủi ro cao", color: "rose" };

  // For chart: scale all 3 values to 0..budget
  const maxBar = Math.max(PV, EV, AC, budget) || 1;
  const bar = (n: number) => `${Math.min(100, (n / maxBar) * 100)}%`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>EVM — Quản trị giá trị thu được</CardTitle>
            <Badge variant={health.color === "emerald" ? "success" : health.color === "amber" ? "warning" : "danger"}>{health.vn}</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div><div className="text-xs text-[rgb(var(--muted))]">Ngân sách HĐ</div><div className="mt-1 text-lg font-semibold">{fmt(budget)}</div></div>
            <div><div className="text-xs text-[rgb(var(--muted))]">PV (Planned)</div><div className="mt-1 text-lg font-semibold">{fmt(PV)}</div><div className="text-[10px] text-[rgb(var(--muted))]">{Math.round(elapsedPct * 100)}% thời gian đã trôi</div></div>
            <div><div className="text-xs text-[rgb(var(--muted))]">EV (Earned)</div><div className="mt-1 text-lg font-semibold text-blue-700">{fmt(EV)}</div><div className="text-[10px] text-[rgb(var(--muted))]">TB tasks {Math.round(avgComplete * 100)}%</div></div>
            <div><div className="text-xs text-[rgb(var(--muted))]">AC (Actual)</div><div className="mt-1 text-lg font-semibold">{fmt(AC)}</div><div className="text-[10px] text-[rgb(var(--muted))]">{project.paymentApps.length} kỳ thanh toán</div></div>
          </div>

          <div className="mt-6 space-y-3" data-testid="evm-bars">
            <div>
              <div className="flex justify-between text-xs"><span className="text-[rgb(var(--muted))]">PV</span><span>{fmt(PV)}</span></div>
              <div className="h-3 w-full overflow-hidden rounded bg-[rgb(var(--raised))]"><div className="h-full bg-[rgb(var(--muted-2))]" style={{ width: bar(PV) }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-blue-700 font-medium">EV</span><span>{fmt(EV)}</span></div>
              <div className="h-3 w-full overflow-hidden rounded bg-[rgb(var(--raised))]"><div className="h-full bg-blue-500" style={{ width: bar(EV) }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className="text-[rgb(var(--muted))]">AC</span><span>{fmt(AC)}</span></div>
              <div className="h-3 w-full overflow-hidden rounded bg-[rgb(var(--raised))]"><div className="h-full bg-amber-500" style={{ width: bar(AC) }} /></div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Variance</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>SV — Schedule Variance (EV-PV)</span><span className={`font-semibold ${SV >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{SV >= 0 ? "+" : ""}{fmt(SV)}</span></div>
              <div className="flex justify-between"><span>CV — Cost Variance (EV-AC)</span><span className={`font-semibold ${CV >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{CV >= 0 ? "+" : ""}{fmt(CV)}</span></div>
            </div>
            <div className="mt-4 text-[11px] text-[rgb(var(--muted))]">SV âm = chậm tiến độ. CV âm = vượt chi phí.</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Performance Index</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>SPI = EV/PV</span><span className={`font-semibold ${SPI >= 0.95 ? "text-emerald-700" : "text-rose-700"}`}>{SPI.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>CPI = EV/AC</span><span className={`font-semibold ${CPI >= 0.95 ? "text-emerald-700" : "text-rose-700"}`}>{CPI.toFixed(2)}</span></div>
            </div>
            <div className="mt-4 text-[11px] text-[rgb(var(--muted))]">≥1.00 đúng / vượt kế hoạch · &lt;0.95 cần can thiệp.</div>
          </CardBody>
        </Card>
      </div>

      <div className="text-[11px] text-[rgb(var(--muted))]">
        Phương pháp: PV tính theo % thời gian đã trôi. EV = ngân sách × TB %HT scheduleTask. AC = lũy kế khối lượng đã thực hiện từ kỳ thanh toán mới nhất.
      </div>
    </div>
  );
}
