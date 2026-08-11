import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

export default async function PulseOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/pulse");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    select: { id: true, key: true, name: true, contractValueVnd: true, ownerOrg: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const projectIds = projects.map((p) => p.id);

  // Cross-cutting aggregations — the "pulse" is whatever needs human attention NOW.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const now = new Date();

  const [
    openIssues, overdueIssues, todayLogs, handoverOverdue,
    incidentsOpen, clashesOpen, dossierMissing, changeOrdersAwaitingCdt,
  ] = await Promise.all([
    prisma.issue.count({ where: { projectId: { in: projectIds }, closedAt: null } }),
    prisma.issue.count({ where: { projectId: { in: projectIds }, closedAt: null, dueDate: { lt: now } } }),
    prisma.dailyLog.count({ where: { projectId: { in: projectIds }, date: { gte: today } } }),
    prisma.handoverTicket.count({ where: { projectId: { in: projectIds }, slaDueAt: { lt: now }, state: { notIn: ["VERIFIED", "REJECTED", "CLOSED"] } } }),
    prisma.incidentReport.count({ where: { projectId: { in: projectIds }, closedAt: null } }),
    prisma.clash.count({ where: { projectId: { in: projectIds }, status: "OPEN" } }),
    prisma.qualityDossierItem.count({ where: { projectId: { in: projectIds }, status: "MISSING" } }),
    prisma.issue.count({ where: { projectId: { in: projectIds }, type: "CHANGE_ORDER", state: "CDT_REVIEW" } }),
  ]);

  // Per-project heatmap (severity = composite)
  const perProject = await Promise.all(projects.slice(0, 8).map(async (p) => {
    const [open, overdue, incidents, clashes, hOver] = await Promise.all([
      prisma.issue.count({ where: { projectId: p.id, closedAt: null } }),
      prisma.issue.count({ where: { projectId: p.id, closedAt: null, dueDate: { lt: now } } }),
      prisma.incidentReport.count({ where: { projectId: p.id, closedAt: null } }),
      prisma.clash.count({ where: { projectId: p.id, status: "OPEN" } }),
      prisma.handoverTicket.count({ where: { projectId: p.id, slaDueAt: { lt: now }, state: { notIn: ["VERIFIED", "REJECTED", "CLOSED"] } } }),
    ]);
    const score = overdue * 4 + incidents * 6 + clashes * 1 + hOver * 5; // simple composite
    return { p, open, overdue, incidents, clashes, hOver, score };
  }));
  perProject.sort((a, b) => b.score - a.score);

  return (
    <AecModuleShell
      group="Thi công"
      name="Pulse"
      subtitle="Dashboard điều hành đa dự án — heatmap rủi ro, escalation matrix khi NCR/safety/handover quá hạn."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Issue mở</div><div className="mt-1 text-2xl font-bold">{openIssues}</div><div className="text-[10px] text-rose-700">{overdueIssues} quá hạn</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Nhật ký hôm nay</div><div className="mt-1 text-2xl font-bold text-blue-700">{todayLogs}/{projects.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Sự cố ATVSLĐ mở</div><div className="mt-1 text-2xl font-bold text-rose-700">{incidentsOpen}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Clash BIM mở</div><div className="mt-1 text-2xl font-bold text-amber-700">{clashesOpen}</div></CardBody></Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Handover quá SLA</div><div className="mt-1 text-2xl font-bold text-rose-700">{handoverOverdue}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Hồ sơ chất lượng thiếu</div><div className="mt-1 text-2xl font-bold text-amber-700">{dossierMissing}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">CO chờ CĐT duyệt</div><div className="mt-1 text-2xl font-bold text-violet-700">{changeOrdersAwaitingCdt}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Dự án theo dõi</div><div className="mt-1 text-2xl font-bold">{projects.length}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Heatmap dự án (top {perProject.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {perProject.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Không có dự án nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-right">Open</th>
                  <th className="p-2 text-right">Overdue</th>
                  <th className="p-2 text-right">ATVSLĐ</th>
                  <th className="p-2 text-right">Clash</th>
                  <th className="p-2 text-right">Handover SLA</th>
                  <th className="p-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {perProject.map((r) => {
                  const color = r.score >= 20 ? "bg-rose-50 border-l-4 border-rose-400" : r.score >= 10 ? "bg-amber-50 border-l-4 border-amber-400" : "";
                  return (
                    <tr key={r.p.id} className={`hover:bg-[rgb(var(--raised))] ${color}`}>
                      <td className="p-2"><div className="font-mono text-xs text-[rgb(var(--muted))]">{r.p.key}</div><div className="text-xs font-medium text-[rgb(var(--ink))]">{r.p.name}</div></td>
                      <td className="p-2 text-right text-sm">{r.open}</td>
                      <td className="p-2 text-right text-sm text-rose-700">{r.overdue}</td>
                      <td className="p-2 text-right text-sm text-rose-700">{r.incidents}</td>
                      <td className="p-2 text-right text-sm">{r.clashes}</td>
                      <td className="p-2 text-right text-sm text-rose-700">{r.hOver}</td>
                      <td className="p-2 text-right text-sm font-semibold">{r.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 text-xs text-[rgb(var(--muted))]">
        Score composite = overdue×4 + ATVSLĐ×6 + clash×1 + handover quá SLA×5. Càng cao càng cần can thiệp.
      </div>
    </AecModuleShell>
  );
}
