import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, DecideActions } from "./Actions";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, { vn: string; icon: string }> = {
  PAYMENT: { vn: "Thanh toán", icon: "💸" },
  CHANGEORDER: { vn: "Lệnh thay đổi", icon: "🔁" },
  METHOD: { vn: "Biện pháp TC", icon: "📋" },
  QAQC: { vn: "QAQC", icon: "✓" },
  ACCEPTANCE: { vn: "Nghiệm thu", icon: "📝" },
  MATERIAL: { vn: "Vật liệu", icon: "📦" },
  PERMIT: { vn: "Giấy phép", icon: "📋" },
  TENDER: { vn: "Đấu thầu", icon: "📄" },
  OTHER: { vn: "Khác", icon: "📌" },
};

const priorityLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  LOW: { vn: "Thấp", variant: "neutral" },
  NORMAL: { vn: "Thường", variant: "info" },
  HIGH: { vn: "Cao", variant: "warning" },
  URGENT: { vn: "Khẩn", variant: "danger" },
};

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  PENDING: { vn: "Chờ duyệt", variant: "warning" },
  IN_REVIEW: { vn: "Đang xem", variant: "info" },
  APPROVED: { vn: "Đã duyệt", variant: "success" },
  REJECTED: { vn: "Từ chối", variant: "danger" },
  WITHDRAWN: { vn: "Rút", variant: "neutral" },
};

export default async function ClientPortalPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/portal");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { org: { select: { type: true } } },
  });
  const cdtOrgs = memberships.filter((m) => m.org.type === "CHU_DAU_TU").map((m) => m.orgId);
  const allOrgs = memberships.map((m) => m.orgId);

  // CĐT sees only their projects; everyone else sees their org's projects
  const projectFilter = cdtOrgs.length > 0
    ? { ownerOrgId: { in: cdtOrgs } }
    : { OR: [{ ownerOrgId: { in: allOrgs } }, { stakeholders: { some: { orgId: { in: allOrgs } } } }] };

  const projects = await prisma.project.findMany({
    where: projectFilter,
    include: {
      _count: { select: { acceptances: true, dailyLogs: true, paymentApps: true } },
    },
    take: 10,
  });

  const requests = await prisma.approvalRequest.findMany({
    where: { project: projectFilter },
    include: { project: { select: { key: true, name: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  const pending = requests.filter((r) => r.state === "PENDING" || r.state === "IN_REVIEW").length;
  const urgent = requests.filter((r) => (r.state === "PENDING" || r.state === "IN_REVIEW") && r.priority === "URGENT").length;
  const approved7d = requests.filter((r) => r.state === "APPROVED" && r.decidedAt && (Date.now() - r.decidedAt.getTime()) < 7 * 86400000).length;
  const totalPaymentApproval = requests.filter((r) => r.source === "PAYMENT" && r.state === "PENDING").reduce((s, r) => s + Number(r.amountVnd ?? 0n), 0);

  return (
    <AecModuleShell
      group="Bàn giao"
      name="ClientPortal — Cổng CĐT"
      subtitle="Mobile-first cho CĐT không kỹ thuật. Hàng đợi duyệt 1-tap từ PaymentRail/ChangeOrder/QAQC/MethodStatement/Material/Acceptance."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang chờ duyệt</div><div className="mt-1 text-2xl font-bold text-amber-700">{pending}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Khẩn cần xử lý</div><div className="mt-1 text-2xl font-bold text-rose-700">{urgent}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã duyệt 7 ngày qua</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved7d}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng giá trị chờ duyệt</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalPaymentApproval))}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Dự án của CĐT ({projects.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {projects.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">CĐT chưa có DA nào liên quan.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Tỉnh / Trạng thái</th>
                  <th className="p-2 text-right">BBNT</th>
                  <th className="p-2 text-right">Nhật ký</th>
                  <th className="p-2 text-right">Hồ sơ TT</th>
                  <th className="p-2 text-right">Giá trị HĐ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2 text-xs"><div className="font-medium">{p.name}</div><div className="text-[10px] font-mono text-slate-500">{p.key}</div></td>
                    <td className="p-2 text-xs">{p.province}<div className="text-[10px] text-slate-500">{p.status}</div></td>
                    <td className="p-2 text-right text-xs">{p._count.acceptances}</td>
                    <td className="p-2 text-right text-xs">{p._count.dailyLogs}</td>
                    <td className="p-2 text-right text-xs">{p._count.paymentApps}</td>
                    <td className="p-2 text-right text-xs font-medium">{p.contractValueVnd ? formatVnd(p.contractValueVnd) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Hàng đợi duyệt ({pending} chờ / {requests.length} tổng)</CardTitle></CardHeader>
        <CardBody className="p-0">
          {requests.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có yêu cầu duyệt nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Nguồn</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-right">Giá trị</th>
                  <th className="p-2 text-left">Ưu tiên</th>
                  <th className="p-2 text-left">Hạn</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const sm = sourceLabel[r.source] ?? { vn: r.source, icon: "📌" };
                  const pm = priorityLabel[r.priority] ?? { vn: r.priority, variant: "neutral" as const };
                  const stm = stateLabel[r.state] ?? { vn: r.state, variant: "neutral" as const };
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 ${r.priority === "URGENT" && r.state === "PENDING" ? "bg-rose-50" : ""}`} data-testid={`req-${r.id}`}>
                      <td className="p-2 text-xs">{sm.icon} {sm.vn}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{r.project.key}</td>
                      <td className="p-2 text-xs"><div className="font-medium">{r.title}</div><div className="text-[10px] text-slate-500 line-clamp-1">{r.summary}</div></td>
                      <td className="p-2 text-right text-xs">{r.amountVnd ? formatVnd(r.amountVnd) : "—"}</td>
                      <td className="p-2"><Badge variant={pm.variant}>{pm.vn}</Badge></td>
                      <td className="p-2 text-xs">{r.dueAt ? formatDateVn(r.dueAt) : "—"}</td>
                      <td className="p-2" data-testid={`state-${r.id}`}><Badge variant={stm.variant}>{stm.vn}</Badge></td>
                      <td className="p-2"><DecideActions id={r.id} state={r.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-3 text-[11px] text-slate-500">
        Mobile-first PWA — push notification mỗi yêu cầu khẩn. 1-tap APPROVE/REJECT từ điện thoại
        (chữ ký số VNPT-CA qua Smart Authentication API). Kết nối Site Status (Statuspage) cho overview real-time.
      </div>
    </AecModuleShell>
  );
}
