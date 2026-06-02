import { RowActions } from "./RowActions";

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  ESTIMATING: { vn: "Đang định giá", variant: "info" },
  SUBMITTED: { vn: "Đã trình", variant: "info" },
  CDT_REVIEW: { vn: "CĐT xem xét", variant: "warning" },
  APPROVED: { vn: "Đã duyệt", variant: "success" },
  REJECTED: { vn: "Từ chối", variant: "danger" },
  IMPLEMENTED: { vn: "Đã thi công", variant: "violet" },
  CLOSED: { vn: "Đóng", variant: "neutral" },
};

export default async function ChangeOrderOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/changeorder");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [
      { ownerOrgId: { in: orgIds } },
      { stakeholders: { some: { orgId: { in: orgIds } } } },
    ],
  };

  const cos = await prisma.changeOrder.findMany({
    where: { Project: projectFilter },
    include: { issue: { include: { project: { select: { key: true } } } } },
    take: 200,
  });

  const projects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true }, orderBy: { key: "asc" } });

  // Totals
  const totalDelta = cos.reduce((s, co) => s + Number(co.costDeltaVnd), 0);
  const approved = cos.filter((co) => co.approvedAt);
  const approvedDelta = approved.reduce((s, co) => s + Number(co.costDeltaVnd), 0);
  const totalScheduleDays = cos.reduce((s, co) => s + (co.scheduleDeltaDays ?? 0), 0);

  return (
    <AecModuleShell
      group="Thi công"
      name="Lệnh thay đổi"
      subtitle="Change Order — workflow CĐT → TVTK → nhà thầu. Phát sinh khối lượng tự cộng vào EVM."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng lệnh</div><div className="mt-1 text-2xl font-bold">{cos.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã duyệt</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Δ chi phí (mọi lệnh)</div><div className={`mt-1 text-2xl font-bold ${totalDelta >= 0 ? "text-rose-700" : "text-emerald-700"}`}>{totalDelta >= 0 ? "+" : ""}{formatVnd(BigInt(totalDelta))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Δ tiến độ tổng</div><div className={`mt-1 text-2xl font-bold ${totalScheduleDays >= 0 ? "text-rose-700" : "text-emerald-700"}`}>{totalScheduleDays >= 0 ? "+" : ""}{totalScheduleDays} ngày</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách lệnh thay đổi ({cos.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {cos.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có lệnh thay đổi. Tạo Issue dạng CHANGE_ORDER trong dự án.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-right">Δ chi phí</th>
                  <th className="p-2 text-right">Δ tiến độ</th>
                  <th className="p-2 text-left">Phê duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cos.map((co) => {
                  const meta = stateLabel[co.issue.state] ?? { vn: co.issue.state, variant: "neutral" as const };
                  return (
                    <tr key={co.issueId} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-xs">{co.issue.key}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{co.issue.project.key}</td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><div className="font-medium">{co.issue.title}</div><div className="text-[11px] text-slate-500 line-clamp-1">{co.reason}</div></td>
                      <td className={`p-2 text-right text-xs font-medium ${Number(co.costDeltaVnd) >= 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(co.costDeltaVnd) >= 0 ? "+" : ""}{formatVnd(co.costDeltaVnd)}</td>
                      <td className={`p-2 text-right text-xs ${co.scheduleDeltaDays >= 0 ? "text-rose-700" : "text-emerald-700"}`}>{co.scheduleDeltaDays >= 0 ? "+" : ""}{co.scheduleDeltaDays}</td>
                      <td className="p-2 text-xs text-slate-500">{co.approvedAt ? formatDateVn(co.approvedAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {approved.length > 0 && (
        <div className="mt-4 text-xs text-slate-500">
          Tổng phát sinh đã duyệt: <span className="font-medium text-slate-700">{formatVnd(BigInt(approvedDelta))}</span>
        </div>
      )}
    </AecModuleShell>
  );
}
