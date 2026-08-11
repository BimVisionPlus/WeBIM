import { DeleteRow } from "./DeleteRow";

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  NT_SIGNED: { vn: "NT đã ký", variant: "info" },
  TVGS_SIGNED: { vn: "TVGS đã ký", variant: "info" },
  CDT_APPROVED: { vn: "CĐT duyệt", variant: "warning" },
  KBNN_SUBMITTED: { vn: "Đã gửi KBNN", variant: "violet" },
  PAID: { vn: "Đã thanh toán", variant: "success" },
  REJECTED: { vn: "Từ chối", variant: "danger" },
};

const typeLabel: Record<string, string> = {
  TAM_UNG: "Tạm ứng",
  GIAI_DOAN: "Giai đoạn",
  HOAN_THANH: "Hoàn thành",
  QUYET_TOAN: "Quyết toán",
};

const fundLabel: Record<string, string> = {
  NGAN_SACH: "Ngân sách",
  DOANH_NGHIEP: "Doanh nghiệp",
  FDI: "FDI",
  HON_HOP: "Hỗn hợp",
};

export default async function PaymentRailOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/paymentrail");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const apps = await prisma.paymentApplication.findMany({
    where: { project: projectFilter },
    include: { project: { select: { key: true, name: true } }, contractorOrg: { select: { name: true } } },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const accessibleProjects = await prisma.project.findMany({
    where: projectFilter,
    select: { id: true, key: true, name: true },
    orderBy: { key: "asc" },
  });

  const totalRequested = apps.reduce((s, a) => s + Number(a.netPayableVnd), 0);
  const paid = apps.filter((a) => a.paidAt);
  const totalPaid = paid.reduce((s, a) => s + Number(a.paidVnd ?? 0n), 0);
  const inKbnn = apps.filter((a) => a.state === "KBNN_SUBMITTED").length;
  const pendingApproval = apps.filter((a) => ["NT_SIGNED", "TVGS_SIGNED"].includes(a.state)).length;

  return (
    <AecModuleShell
      group="Thi công"
      name="PaymentRail — Hồ sơ thanh toán"
      subtitle="NĐ 99/2021 + TT 08/2022. Đề nghị thanh toán: BBNT KL → Bảng tính giá trị → Phiếu giá → KBNN-DVC."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng hồ sơ</div><div className="mt-1 text-2xl font-bold">{apps.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đang chờ duyệt</div><div className="mt-1 text-2xl font-bold text-amber-700">{pendingApproval}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đã gửi KBNN</div><div className="mt-1 text-2xl font-bold text-violet-700">{inKbnn}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đã thanh toán</div><div className="mt-1 text-2xl font-bold text-emerald-700">{formatVnd(BigInt(totalPaid))}</div></CardBody></Card>
      </div>

      <div className="mt-6">
        <CreateForm projects={accessibleProjects} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Danh sách hồ sơ thanh toán ({apps.length})</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {apps.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có hồ sơ thanh toán nào. Sau khi có BBNT khối lượng, tạo PaymentApplication kỳ tương ứng.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Kỳ</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Nguồn</th>
                  <th className="p-2 text-left">Nhà thầu</th>
                  <th className="p-2 text-right">KL kỳ này</th>
                  <th className="p-2 text-right">Thanh toán ròng</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {apps.map((a) => {
                  const meta = stateLabel[a.state] ?? { vn: a.state, variant: "neutral" as const };
                  return (
                    <tr key={a.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-${a.code}`}>
                      <td className="p-2 font-mono text-xs">{a.code}</td>
                      <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{a.project.key}</td>
                      <td className="p-2 text-xs">{a.period}</td>
                      <td className="p-2 text-xs">{typeLabel[a.paymentType] ?? a.paymentType}</td>
                      <td className="p-2 text-xs text-[rgb(var(--muted))]">{fundLabel[a.fundSource] ?? a.fundSource}</td>
                      <td className="p-2 text-xs">{a.contractorOrg?.name ?? "—"}</td>
                      <td className="p-2 text-right text-xs">{formatVnd(a.workDoneVnd)}</td>
                      <td className="p-2 text-right text-xs font-medium text-emerald-700">{formatVnd(a.netPayableVnd)}</td>
                      <td className="p-2" data-testid={`state-${a.code}`}>
                        <Badge variant={meta.variant}>{meta.vn}</Badge>
                        {a.paidAt && <div className="mt-0.5 text-[10px] text-[rgb(var(--muted))]">{formatDateVn(a.paidAt)}</div>}
                      </td>
                      <td className="p-2"><RowActions id={a.id} state={a.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Luồng hồ sơ thanh toán</CardTitle></CardHeader>
          <CardBody>
            <ol className="space-y-2 text-sm text-[rgb(var(--ink-2))]">
              <li>1. <b>NT</b> tạo hồ sơ từ các BBNT KL kỳ tương ứng</li>
              <li>2. <b>TVGS</b> ký xác nhận khối lượng + đơn giá</li>
              <li>3. <b>CĐT</b> duyệt Bảng tính giá trị đề nghị thanh toán</li>
              <li>4. Vốn NS: đẩy DVC-KBNN tự động sinh Phiếu giá</li>
              <li>5. KBNN/CĐT chuyển khoản → cập nhật <code className="text-xs">paidAt</code> + <code className="text-xs">paidVnd</code></li>
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tổng quan tài chính</CardTitle></CardHeader>
          <CardBody>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Tổng đề nghị thanh toán ròng</dt><dd className="font-medium">{formatVnd(BigInt(totalRequested))}</dd></div>
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Đã thanh toán</dt><dd className="font-medium text-emerald-700">{formatVnd(BigInt(totalPaid))}</dd></div>
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Còn lại đang xử lý</dt><dd className="font-medium text-amber-700">{formatVnd(BigInt(totalRequested - totalPaid))}</dd></div>
            </dl>
            <p className="mt-3 text-[11px] text-[rgb(var(--muted))]">
              Theo NĐ 99/2021 Điều 9: thời hạn thanh toán ≤ 7 ngày làm việc kể từ khi nhận đủ hồ sơ hợp lệ.
            </p>
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
