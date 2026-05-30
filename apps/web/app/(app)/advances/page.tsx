import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

const typeMeta: Record<string, { vn: string; variant: "info" | "warning" | "success" | "neutral" }> = {
  TAM_UNG: { vn: "Tạm ứng", variant: "warning" },
  THANH_TOAN: { vn: "Thanh toán", variant: "info" },
  HOAN_UNG: { vn: "Hoàn ứng", variant: "success" },
};
const statusMeta: Record<string, { vn: string; variant: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  PENDING: { vn: "Chờ duyệt", variant: "warning" },
  APPROVED: { vn: "Đã duyệt", variant: "info" },
  SETTLED: { vn: "Đã quyết toán", variant: "success" },
  CANCELLED: { vn: "Hủy", variant: "neutral" },
};

export default async function AdvancesPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/advances");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);
  const projects = await prisma.project.findMany({ where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] }, select: { id: true, key: true }, orderBy: { key: "asc" } });

  const txns = await prisma.advanceTransaction.findMany({
    where: { orgId: { in: orgIds } },
    include: { org: { select: { name: true } }, project: { select: { key: true } } },
    orderBy: { txnDate: "desc" },
    take: 200,
  });

  const tamUngOpen = txns.filter((t) => t.type === "TAM_UNG" && t.status !== "SETTLED" && t.status !== "CANCELLED");
  const totalTamUngOpen = tamUngOpen.reduce((s, t) => s + Number(t.amountVnd), 0);
  const totalThanhToan = txns.filter((t) => t.type === "THANH_TOAN" && t.status === "APPROVED").reduce((s, t) => s + Number(t.amountVnd), 0);
  const totalHoanUng = txns.filter((t) => t.type === "HOAN_UNG").reduce((s, t) => s + Number(t.amountVnd), 0);

  return (
    <AecModuleShell group="Tài chính kế toán" name="Tạm ứng & thanh toán" subtitle="Sổ tạm ứng, thanh toán, hoàn ứng theo dự án và đơn vị nhận.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng giao dịch</div><div className="mt-1 text-2xl font-bold">{txns.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tạm ứng chưa hoàn</div><div className="mt-1 text-2xl font-bold text-amber-700">{formatVnd(BigInt(totalTamUngOpen))}</div><div className="text-[10px] text-slate-500">{tamUngOpen.length} giao dịch</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã thanh toán</div><div className="mt-1 text-2xl font-bold text-blue-700">{formatVnd(BigInt(totalThanhToan))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã hoàn ứng</div><div className="mt-1 text-2xl font-bold text-emerald-700">{formatVnd(BigInt(totalHoanUng))}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} projects={projects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Sổ giao dịch ({txns.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {txns.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có giao dịch nào. Bấm "Tạm ứng / Thanh toán" để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Ngày</th><th className="p-2 text-left">Số phiếu</th><th className="p-2 text-left">Loại</th><th className="p-2 text-left">Người/ĐV nhận</th><th className="p-2 text-right">Số tiền</th><th className="p-2 text-left">Trạng thái</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txns.map((t) => {
                  const tm = typeMeta[t.type] ?? { vn: t.type, variant: "neutral" as const };
                  const sm = statusMeta[t.status] ?? { vn: t.status, variant: "neutral" as const };
                  return (
                    <tr key={t.id} className="hover:bg-slate-50" data-testid={`row-advance-${t.id}`}>
                      <td className="p-2 text-xs">{formatDateVn(t.txnDate)}</td>
                      <td className="p-2 font-mono text-xs">{t.txnNo ?? "—"}{t.project && <div className="text-[10px] text-slate-500">{t.project.key}</div>}</td>
                      <td className="p-2"><Badge variant={tm.variant}>{tm.vn}</Badge></td>
                      <td className="p-2"><div className="font-medium">{t.payeeName}</div><div className="text-[11px] text-slate-500 line-clamp-1">{t.purpose}</div></td>
                      <td className="p-2 text-right font-medium">{formatVnd(t.amountVnd)}</td>
                      <td className="p-2"><Badge variant={sm.variant}>{sm.vn}</Badge></td>
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
