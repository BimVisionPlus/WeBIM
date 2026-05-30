import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

const statusMeta: Record<string, { vn: string; variant: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  ACTIVE: { vn: "Đang khoán", variant: "info" },
  COMPLETED: { vn: "Hoàn thành", variant: "success" },
  ON_HOLD: { vn: "Tạm dừng", variant: "warning" },
  CANCELLED: { vn: "Hủy", variant: "neutral" },
};

export default async function ContractorAssignsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/contractorassigns");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projects = await prisma.project.findMany({ where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] }, select: { id: true, key: true }, orderBy: { key: "asc" } });
  const projectIds = projects.map((p) => p.id);

  const assignments = await prisma.contractorAssignment.findMany({
    where: { projectId: { in: projectIds } },
    include: { project: { select: { key: true, name: true } }, contractorOrg: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const active = assignments.filter((a) => a.status === "ACTIVE").length;
  const totalActiveAmount = assignments.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + Number(a.amountVnd), 0);
  const completed = assignments.filter((a) => a.status === "COMPLETED").length;
  const avgPct = assignments.length === 0 ? 0 : Math.round(assignments.reduce((s, a) => s + a.pctComplete, 0) / assignments.length);

  return (
    <AecModuleShell group="Tài chính kế toán" name="Bảng giao khoán cho đơn vị" subtitle="Khoán gọn từng hạng mục cho đội/nhà thầu phụ kèm tiến độ.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng giao khoán</div><div className="mt-1 text-2xl font-bold">{assignments.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang khoán</div><div className="mt-1 text-2xl font-bold text-blue-700">{active}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Giá trị đang khoán</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalActiveAmount))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">TB hoàn thành</div><div className={`mt-1 text-2xl font-bold ${avgPct >= 80 ? "text-emerald-700" : "text-amber-700"}`}>{avgPct}%</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách bảng giao khoán ({assignments.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có bảng giao khoán nào. Bấm "Giao khoán" để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Đơn vị nhận</th><th className="p-2 text-left">Dự án</th><th className="p-2 text-left">Phạm vi</th><th className="p-2 text-right">Giá trị</th><th className="p-2 text-right">% HT</th><th className="p-2 text-left">Trạng thái</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => {
                  const m = statusMeta[a.status] ?? { vn: a.status, variant: "neutral" as const };
                  return (
                    <tr key={a.id} className="hover:bg-slate-50" data-testid={`row-assign-${a.id}`}>
                      <td className="p-2"><div className="font-medium">{a.contractorName}</div><div className="text-[10px] text-slate-500">{a.contractorOrg?.name ?? ""}</div></td>
                      <td className="p-2 font-mono text-xs">{a.project.key}</td>
                      <td className="p-2 text-xs line-clamp-2 max-w-md">{a.scope}</td>
                      <td className="p-2 text-right font-medium">{formatVnd(a.amountVnd)}</td>
                      <td className="p-2 text-right"><div className="inline-flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full ${a.pctComplete >= 80 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${a.pctComplete}%` }} /></div><span className="text-xs">{Math.round(a.pctComplete)}%</span></div></td>
                      <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
      <div className="mt-2 text-[11px] text-slate-500">Mốc bàn giao: {assignments.length === 0 ? "—" : assignments.slice(0,3).map((a) => `${a.contractorName} (${formatDateVn(a.endDate)})`).join(" · ")}</div>
    </AecModuleShell>
  );
}
