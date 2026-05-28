import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { relativeDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet"; vn: string }> = {
  NEW: { variant: "info", vn: "Mới" },
  TRIAGED: { variant: "info", vn: "Đã phân loại" },
  IN_PROGRESS: { variant: "warning", vn: "Đang xử lý" },
  AWAITING_PARTS: { variant: "warning", vn: "Đợi vật tư" },
  RECTIFIED: { variant: "violet", vn: "Đã khắc phục" },
  VERIFIED: { variant: "success", vn: "Đã xác nhận" },
  REJECTED: { variant: "danger", vn: "Từ chối" },
  CLOSED: { variant: "neutral", vn: "Đóng" },
};
const sevVariant: Record<string, "info" | "warning" | "danger" | "neutral"> = {
  LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger",
};

export default async function HandoverOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/handover");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  // Two-step: resolve accessible projects first (HandoverTicket has no `project` relation), then filter tickets by projectId.
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    select: { id: true, key: true, name: true },
  });
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectIds = projects.map((p) => p.id);

  const tickets = await prisma.handoverTicket.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: [{ state: "asc" }, { slaDueAt: "asc" }],
    take: 200,
  });

  const now = Date.now();
  const open = tickets.filter((t) => !["VERIFIED", "REJECTED", "CLOSED"].includes(t.state));
  const overdue = tickets.filter(
    (t) => t.slaDueAt && t.slaDueAt.getTime() < now && !["VERIFIED", "REJECTED", "CLOSED"].includes(t.state),
  );
  const projectsWithTickets = new Set(tickets.map((t) => t.projectId)).size;

  return (
    <AecModuleShell
      group="Bàn giao"
      name="Handover"
      subtitle="Service desk bảo hành cho mọi dự án — NĐ 06/2021: 12T phần phụ · 24T phần chính · 60T hạ tầng."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng ticket</div><div className="mt-1 text-2xl font-bold">{tickets.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang mở</div><div className="mt-1 text-2xl font-bold text-blue-700">{open.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Quá SLA</div><div className="mt-1 text-2xl font-bold text-rose-700">{overdue.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Dự án có ticket</div><div className="mt-1 text-2xl font-bold">{projectsWithTickets}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Tất cả ticket bảo hành ({tickets.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có yêu cầu bảo hành ở các dự án bạn truy cập. Sau bàn giao, cư dân/CĐT gửi yêu cầu
              bảo hành (12/24/60 tháng theo NĐ 06/2021) và sẽ hiển thị tại đây để xử lý theo SLA.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Căn</th>
                  <th className="p-2 text-center">Mức</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => {
                  const slaOver = t.slaDueAt && t.slaDueAt.getTime() < now && !["VERIFIED", "REJECTED", "CLOSED"].includes(t.state);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-xs">{t.ticketNumber}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{projectById.get(t.projectId)?.key ?? ""}</td>
                      <td className="p-2 text-xs">{t.unitCode ?? "—"}</td>
                      <td className="p-2 text-center"><Badge variant={sevVariant[t.severity]}>{t.severity}</Badge></td>
                      <td className="p-2"><div className="font-medium">{t.title}</div><div className="text-[11px] text-slate-500">{t.reporterName}</div></td>
                      <td className="p-2"><Badge variant={stateLabel[t.state]?.variant}>{stateLabel[t.state]?.vn}</Badge></td>
                      <td className="p-2 text-xs">{t.slaDueAt ? <span className={slaOver ? "text-rose-700" : "text-slate-600"}>{relativeDateVn(t.slaDueAt)}</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
