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

const typeLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  BAO_LANH_DU_THAU: { vn: "BL Dự thầu", variant: "neutral" },
  BAO_LANH_THUC_HIEN: { vn: "BL Thực hiện HĐ", variant: "info" },
  BAO_LANH_TAM_UNG: { vn: "BL Tạm ứng", variant: "warning" },
  BAO_LANH_BAO_HANH: { vn: "BL Bảo hành", variant: "violet" },
};

const statusLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  ACTIVE: { vn: "Đang hiệu lực", variant: "success" },
  EXPIRED: { vn: "Hết hạn", variant: "neutral" },
  RELEASED: { vn: "Đã giải phóng", variant: "info" },
  CALLED: { vn: "Đã bồi thường", variant: "danger" },
};

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function BondVaultPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/bondvault");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const bonds = await prisma.contractBond.findMany({
    where: { project: projectFilter },
    include: { project: { select: { key: true, name: true } }, contractorOrg: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
    take: 200,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  const now = new Date();
  const totalActive = bonds.filter((b) => b.status === "ACTIVE").length;
  const expiring30 = bonds.filter((b) => b.status === "ACTIVE" && daysBetween(now, b.expiresAt) <= 30 && daysBetween(now, b.expiresAt) > 0).length;
  const overdue = bonds.filter((b) => b.status === "ACTIVE" && b.expiresAt < now).length;
  const totalExposureActive = bonds.filter((b) => b.status === "ACTIVE").reduce((s, b) => s + Number(b.amountVnd), 0);

  return (
    <AecModuleShell
      group="Pháp lý"
      name="BondVault — Bảo lãnh hợp đồng"
      subtitle="Bảo lãnh THHĐ + Tạm ứng + Bảo hành. Sync API BIDV/VCB/Techcom, auto-alert T-30 hết hạn, auto-release theo NĐ 06/2021."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đang hiệu lực</div><div className="mt-1 text-2xl font-bold text-emerald-700">{totalActive}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Sắp hết hạn (≤30d)</div><div className="mt-1 text-2xl font-bold text-amber-700">{expiring30}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Quá hạn cần xử lý</div><div className="mt-1 text-2xl font-bold text-rose-700">{overdue}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng giá trị hiệu lực</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalExposureActive))}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Sổ bảo lãnh ({bonds.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {bonds.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có bảo lãnh nào. Thêm bảo lãnh THHĐ sau khi ký HĐ, BLBH sau bàn giao.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Số BL</th>
                  <th className="p-2 text-left">Ngân hàng</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Bên BL</th>
                  <th className="p-2 text-right">Giá trị</th>
                  <th className="p-2 text-left">Hiệu lực → Hết hạn</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {bonds.map((b) => {
                  const tmeta = typeLabel[b.type] ?? { vn: b.type, variant: "neutral" as const };
                  const smeta = statusLabel[b.status] ?? { vn: b.status, variant: "neutral" as const };
                  const daysLeft = daysBetween(now, b.expiresAt);
                  const expSoon = b.status === "ACTIVE" && daysLeft <= 30 && daysLeft > 0;
                  return (
                    <tr key={b.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-${b.bondNumber}`}>
                      <td className="p-2 font-mono text-xs">{b.bondNumber}</td>
                      <td className="p-2 text-xs">{b.issuerBank}</td>
                      <td className="p-2"><Badge variant={tmeta.variant}>{tmeta.vn}</Badge></td>
                      <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{b.project.key}</td>
                      <td className="p-2 text-xs">{b.contractorOrg?.name ?? "—"}</td>
                      <td className="p-2 text-right text-xs font-medium">{formatVnd(b.amountVnd)}{b.pctOfContract ? <div className="text-[10px] text-[rgb(var(--muted))]">{b.pctOfContract.toString()}% HĐ</div> : null}</td>
                      <td className="p-2 text-xs">
                        {formatDateVn(b.effectiveFrom)} → {formatDateVn(b.expiresAt)}
                        {b.status === "ACTIVE" && <div className={`text-[10px] ${daysLeft < 0 ? "text-rose-700" : expSoon ? "text-amber-700" : "text-[rgb(var(--muted))]"}`}>{daysLeft < 0 ? `Quá ${-daysLeft}d` : `Còn ${daysLeft}d`}</div>}
                      </td>
                      <td className="p-2" data-testid={`status-${b.bondNumber}`}><Badge variant={smeta.variant}>{smeta.vn}</Badge></td>
                      <td className="p-2"><RowActions id={b.id} status={b.status} /></td>
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
          <CardHeader><CardTitle>Lịch giải phóng BLBH (NĐ 06/2021)</CardTitle></CardHeader>
          <CardBody className="text-sm text-[rgb(var(--ink-2))]">
            <ul className="space-y-1.5">
              <li>• <b>12 tháng</b> — Phần phụ (hoàn thiện, lan can, sơn…)</li>
              <li>• <b>24 tháng</b> — Phần chính (kết cấu, mái, MEP)</li>
              <li>• <b>60 tháng</b> — Hạ tầng kỹ thuật (cầu, đường, cấp thoát)</li>
            </ul>
            <p className="mt-3 text-[11px] text-[rgb(var(--muted))]">Worker chạy daily sweep: bond ACTIVE có expiresAt &lt; today → tạo audit + email CĐT để release.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bank API integrations</CardTitle></CardHeader>
          <CardBody className="text-sm text-[rgb(var(--ink-2))]">
            <ul className="space-y-1.5">
              <li>• <b>BIDV</b> — Open Banking sandbox; verify bond by số BL</li>
              <li>• <b>Vietcombank</b> — Internet Banking Corporate API</li>
              <li>• <b>Techcombank</b> — Business Express Banking</li>
              <li>• <b>MB Bank</b> — MB Smart Connect API</li>
            </ul>
            <p className="mt-3 text-[11px] text-[rgb(var(--muted))]">Cron 03:00 hằng đêm — pull status từng bank, cập nhật <code>bankApiStatus</code>.</p>
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
