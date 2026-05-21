import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./Actions";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = { TVTK: "Tư vấn thiết kế", TVGS: "Tư vấn giám sát", TVQLDA: "QLDA", TVTM: "Thẩm tra", TVDT: "Đấu thầu", KHAC: "Khác" };

export default async function ConsultantOpsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/consult");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const [contracts, timesheets, myOrgs, myProjects] = await Promise.all([
    prisma.consultantContract.findMany({
      where: { orgId: { in: orgIds } },
      include: { org: { select: { name: true } }, clientOrg: { select: { name: true } }, project: { select: { key: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.consultantTimesheet.findMany({
      where: { orgId: { in: orgIds } },
      include: { project: { select: { key: true } } },
      orderBy: { workDate: "desc" },
      take: 50,
    }),
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] }, select: { id: true, key: true, name: true } }),
  ]);

  const totalContract = contracts.reduce((s, c) => s + Number(c.totalValueVnd), 0);
  const totalInvoiced = contracts.reduce((s, c) => s + Number(c.invoicedVnd), 0);
  const totalPaid = contracts.reduce((s, c) => s + Number(c.paidVnd), 0);
  const totalHoursMonth = timesheets.filter((t) => (Date.now() - t.workDate.getTime()) < 30 * 86400000).reduce((s, t) => s + Number(t.hours), 0);

  return (
    <AecModuleShell
      group="Đấu thầu"
      name="ConsultantOps — Vận hành tư vấn"
      subtitle="Time tracking + charge-out rate + multi-project billing theo % hoàn thành. Dành cho TVTK/TVGS/TVQLDA."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng HĐ tư vấn</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalContract))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã xuất HĐĐT</div><div className="mt-1 text-2xl font-bold text-violet-700">{formatVnd(BigInt(totalInvoiced))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã thu tiền</div><div className="mt-1 text-2xl font-bold text-emerald-700">{formatVnd(BigInt(totalPaid))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Giờ công 30 ngày</div><div className="mt-1 text-2xl font-bold">{totalHoursMonth.toFixed(1)}h</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Hợp đồng tư vấn ({contracts.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {contracts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có hợp đồng nào. Seed: <code>scripts/seed-consult.ts</code></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Số HĐ</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">CĐT / Dự án</th>
                  <th className="p-2 text-right">Giá trị HĐ</th>
                  <th className="p-2 text-right">% Hoàn thành</th>
                  <th className="p-2 text-right">Đã invoice</th>
                  <th className="p-2 text-right">Đã thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{c.contractNo}</td>
                    <td className="p-2 text-xs">{typeLabel[c.contractType]}</td>
                    <td className="p-2 text-xs"><div className="font-medium">{c.clientOrg?.name ?? "—"}</div><div className="text-[10px] text-slate-500">{c.project?.key ?? ""}</div></td>
                    <td className="p-2 text-right text-xs font-medium">{formatVnd(c.totalValueVnd)}</td>
                    <td className="p-2 text-right text-xs">{c.percentComplete.toString()}%</td>
                    <td className="p-2 text-right text-xs">{formatVnd(c.invoicedVnd)}</td>
                    <td className="p-2 text-right text-xs text-emerald-700">{formatVnd(c.paidVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6"><CreateForm orgs={myOrgs} projects={myProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Timesheet gần đây ({timesheets.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {timesheets.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có timesheet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Ngày</th>
                  <th className="p-2 text-left">Người</th>
                  <th className="p-2 text-left">Vai trò</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Công việc</th>
                  <th className="p-2 text-right">Giờ</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timesheets.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50 ${!t.billable ? "text-slate-500" : ""}`}>
                    <td className="p-2 text-xs">{formatDateVn(t.workDate)}</td>
                    <td className="p-2 text-xs">{t.workerName}</td>
                    <td className="p-2 text-xs">{t.role}</td>
                    <td className="p-2 text-xs font-mono">{t.project?.key ?? "—"}</td>
                    <td className="p-2 text-[11px] line-clamp-1">{t.description}</td>
                    <td className="p-2 text-right text-xs">{Number(t.hours).toFixed(1)}</td>
                    <td className="p-2 text-right text-xs">{t.rateVndPerHour ? formatVnd(t.rateVndPerHour) : "—"}</td>
                    <td className="p-2 text-right text-xs font-medium">{t.amountVnd ? formatVnd(t.amountVnd) : "—"}{t.invoiced && <Badge variant="success">HĐĐT</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
