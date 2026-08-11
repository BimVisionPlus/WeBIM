import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVndShort, computeEvm, severityFromEvm, relativeDateVn } from "@atlas/lib";

export default async function PortfolioPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    include: {
      ownerOrg: true,
      _count: {
        select: {
          issues: true,
          ncrs: true,
          rfis: true,
          drawingSets: true,
          models: true,
          overrunSignals: true,
        },
      },
      boqs: { where: { isCurrent: true }, include: { lines: true } },
      payments: { where: { state: { in: ["APPROVED", "PAID"] } } },
      bids: { where: { outcome: "AWARDED" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute risk per project (5 dimensions): cost, schedule, safety, quality, compliance
  type Risk = "low" | "med" | "high";
  type ProjectRisk = {
    id: string;
    name: string;
    key: string;
    status: string;
    cost: Risk;
    schedule: Risk;
    safety: Risk;
    quality: Risk;
    compliance: Risk;
    cpi: number | null;
    profitVnd: bigint | null;
  };

  const rows: ProjectRisk[] = [];
  for (const p of projects) {
    // Cost: from EVM
    let cpi: number | null = null;
    let cost: Risk = "low";
    if (p.boqs[0] && p.boqs[0].lines.length > 0) {
      const evm = computeEvm({
        lines: p.boqs[0].lines.map((l) => ({
          qty: l.qty,
          qtyCompleted: l.qtyCompleted,
          unitPriceVnd: l.unitPriceVnd,
        })),
        actualCostVnd: p.payments.reduce((s, x) => s + x.workDoneVnd, 0n),
      });
      cpi = evm.cpi;
      const sev = severityFromEvm(evm);
      cost = sev === "CRITICAL" ? "high" : sev === "ALERT" ? "med" : "low";
    }

    // Schedule: simple delta of planned vs elapsed
    let schedule: Risk = "low";
    if (p.startDate && p.endDate) {
      const total = p.endDate.getTime() - p.startDate.getTime();
      const elapsed = Date.now() - p.startDate.getTime();
      if (elapsed > total && p.status === "IN_PROGRESS") schedule = "high";
      else if (elapsed > 0.85 * total && p.status === "IN_PROGRESS") schedule = "med";
    }

    // Safety: # of MAJOR/CRITICAL incidents in last 90 days
    const incCount = await prisma.incidentReport.count({
      where: {
        projectId: p.id,
        severity: { in: ["MAJOR", "CRITICAL"] },
        occurredAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
      },
    });
    const safety: Risk = incCount >= 2 ? "high" : incCount === 1 ? "med" : "low";

    // Quality: # of open CRITICAL NCRs
    const critNcr = await prisma.nCR.count({ where: { projectId: p.id, severity: "CRITICAL" } });
    const quality: Risk = critNcr >= 2 ? "high" : critNcr === 1 ? "med" : "low";

    // Compliance: % accepted dossier items
    const dossier = await prisma.qualityDossierItem.findMany({ where: { projectId: p.id } });
    const completionPct = dossier.length === 0 ? 0 : (dossier.filter((d) => d.status === "ACCEPTED").length / dossier.length);
    const compliance: Risk = completionPct < 0.4 ? "high" : completionPct < 0.7 ? "med" : "low";

    // Profitability — contract value minus EAC (or actual)
    let profitVnd: bigint | null = null;
    if (p.contractValueVnd && p.boqs[0]) {
      const evm = computeEvm({
        lines: p.boqs[0].lines.map((l) => ({ qty: l.qty, qtyCompleted: l.qtyCompleted, unitPriceVnd: l.unitPriceVnd })),
        actualCostVnd: p.payments.reduce((s, x) => s + x.workDoneVnd, 0n),
      });
      profitVnd = p.contractValueVnd - evm.eac;
    }

    rows.push({
      id: p.id,
      name: p.name,
      key: p.key,
      status: p.status,
      cost,
      schedule,
      safety,
      quality,
      compliance,
      cpi,
      profitVnd,
    });
  }

  const totalProfit = rows.reduce((s, r) => s + (r.profitVnd ?? 0n), 0n);
  const totalContract = projects.reduce((s, p) => s + (p.contractValueVnd ?? 0n), 0n);
  const inProgress = projects.filter((p) => p.status === "IN_PROGRESS").length;
  const highRiskCount = rows.filter((r) => [r.cost, r.schedule, r.safety, r.quality, r.compliance].includes("high")).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Tổng dự án</div>
            <div className="mt-1 text-2xl font-bold">{projects.length}</div>
            <div className="text-[11px] text-[rgb(var(--muted))]">{inProgress} đang thi công</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Tổng giá trị HĐ</div>
            <div className="mt-1 text-2xl font-bold">{formatVndShort(totalContract)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Lãi dự phóng</div>
            <div className={`mt-1 text-2xl font-bold ${totalProfit >= 0n ? "text-emerald-700" : "text-rose-700"}`}>
              {formatVndShort(totalProfit)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Dự án có rủi ro cao</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{highRiskCount}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk heatmap (5 chiều: cost · schedule · safety · quality · compliance)</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có dự án nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-3 text-left">Dự án</th>
                  <th className="p-3 text-left">Trạng thái</th>
                  <th className="p-3 text-center">Cost</th>
                  <th className="p-3 text-center">Schedule</th>
                  <th className="p-3 text-center">Safety</th>
                  <th className="p-3 text-center">Quality</th>
                  <th className="p-3 text-center">Compliance</th>
                  <th className="p-3 text-right">CPI</th>
                  <th className="p-3 text-right">Lãi dự phóng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-3">
                      <Link href={`/projects/${r.id}`} className="text-blue-700 hover:underline">
                        <div className="font-mono text-xs text-[rgb(var(--muted))]">{r.key}</div>
                        <div className="font-medium text-[rgb(var(--ink))]">{r.name}</div>
                      </Link>
                    </td>
                    <td className="p-3"><Badge variant="neutral">{r.status}</Badge></td>
                    <RiskCell risk={r.cost} />
                    <RiskCell risk={r.schedule} />
                    <RiskCell risk={r.safety} />
                    <RiskCell risk={r.quality} />
                    <RiskCell risk={r.compliance} />
                    <td className="p-3 text-right font-mono">{r.cpi !== null ? r.cpi.toFixed(2) : "—"}</td>
                    <td className={`p-3 text-right font-medium ${r.profitVnd === null ? "" : r.profitVnd >= 0n ? "text-emerald-700" : "text-rose-700"}`}>
                      {r.profitVnd !== null ? formatVndShort(r.profitVnd) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function RiskCell({ risk }: { risk: "low" | "med" | "high" }) {
  const cls =
    risk === "high"
      ? "bg-rose-100 text-rose-800"
      : risk === "med"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";
  return (
    <td className="p-3 text-center">
      <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>{risk.toUpperCase()}</span>
    </td>
  );
}
