import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  DANG_DONG: { vn: "Đang đóng", variant: "success" },
  TAM_DUNG: { vn: "Tạm dừng", variant: "warning" },
  CHO_DANG_KY: { vn: "Chờ đăng ký", variant: "info" },
  DA_NGHI: { vn: "Đã nghỉ", variant: "neutral" },
  KHAC: { vn: "Khác", variant: "neutral" },
};

export default async function BhxhPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/bhxh");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const records = await prisma.socialInsuranceRecord.findMany({
    where: { orgId: { in: orgIds } },
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const dangDong = records.filter((r) => r.status === "DANG_DONG").length;
  const choDangKy = records.filter((r) => r.status === "CHO_DANG_KY").length;
  const totalMonthly = records.filter((r) => r.status === "DANG_DONG").reduce((s, r) => s + Number(r.monthlyBaseVnd ?? 0), 0);

  return (
    <AecModuleShell group="Hành chính" name="Theo dõi BHXH" subtitle="Sổ bảo hiểm xã hội cho người lao động theo Luật BHXH.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng bản ghi</div><div className="mt-1 text-2xl font-bold">{records.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang đóng</div><div className="mt-1 text-2xl font-bold text-emerald-700">{dangDong}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Chờ đăng ký</div><div className="mt-1 text-2xl font-bold text-amber-700">{choDangKy}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Mức đóng/tháng</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalMonthly))}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách NLĐ tham gia BHXH ({records.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {records.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có bản ghi BHXH. Bấm "Thêm bản ghi BHXH" để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Họ tên</th><th className="p-2 text-left">CCCD</th><th className="p-2 text-left">Số sổ BHXH</th><th className="p-2 text-left">Trạng thái</th><th className="p-2 text-right">Mức đóng/tháng</th><th className="p-2 text-left">Bắt đầu</th><th className="p-2 text-left">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const meta = statusLabel[r.status] ?? { vn: r.status, variant: "neutral" as const };
                  return (
                    <tr key={r.id} className="hover:bg-slate-50" data-testid={`row-bhxh-${r.id}`}>
                      <td className="p-2"><div className="font-medium">{r.employeeName}</div><div className="text-[10px] text-slate-500">{r.org.name}</div></td>
                      <td className="p-2 text-xs">{r.employeeIdNo ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{r.bhxhNumber ?? "—"}</td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2 text-right text-xs">{r.monthlyBaseVnd ? formatVnd(r.monthlyBaseVnd) : "—"}</td>
                      <td className="p-2 text-xs">{r.startedAt ? formatDateVn(r.startedAt) : "—"}</td><td className="p-2"><RowActions id={r.id} status={r.status} initial={{ employeeName: r.employeeName, employeeIdNo: r.employeeIdNo, bhxhNumber: r.bhxhNumber, monthlyBaseVnd: r.monthlyBaseVnd ? r.monthlyBaseVnd.toString() : null, startedAt: r.startedAt ? r.startedAt.toISOString().slice(0,10) : null, note: r.note }} /></td>
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
