import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const statusMeta: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  SCHEDULED: { vn: "Đã đặt lịch", variant: "info" },
  IN_USE: { vn: "Đang sử dụng", variant: "warning" },
  RETURNED: { vn: "Đã trả", variant: "success" },
  CANCELLED: { vn: "Hủy", variant: "neutral" },
};

export default async function VehicleDispatchPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/vehicledispatch");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const dispatches = await prisma.vehicleDispatch.findMany({
    where: { orgId: { in: orgIds } },
    include: { org: { select: { name: true } } },
    orderBy: { startAt: "desc" },
    take: 200,
  });

  const inUse = dispatches.filter((d) => d.status === "IN_USE").length;
  const scheduled = dispatches.filter((d) => d.status === "SCHEDULED").length;

  return (
    <AecModuleShell group="Hành chính" name="Điều phối xe" subtitle="Sổ lệnh điều xe công ty: lịch sử dụng, tài xế, mục đích.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng lệnh</div><div className="mt-1 text-2xl font-bold">{dispatches.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang sử dụng</div><div className="mt-1 text-2xl font-bold text-amber-700">{inUse}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã đặt lịch</div><div className="mt-1 text-2xl font-bold text-blue-700">{scheduled}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã trả 7 ngày</div><div className="mt-1 text-2xl font-bold text-emerald-700">{dispatches.filter((d) => d.status === "RETURNED" && d.startAt.getTime() > Date.now() - 7 * 86400000).length}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Lệnh điều xe ({dispatches.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {dispatches.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có lệnh điều xe. Bấm "Điều xe" để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Biển số</th><th className="p-2 text-left">Tài xế</th><th className="p-2 text-left">Mục đích</th><th className="p-2 text-left">Bắt đầu</th><th className="p-2 text-left">Trạng thái</th><th className="p-2 text-left">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.map((d) => {
                  const m = statusMeta[d.status] ?? { vn: d.status, variant: "neutral" as const };
                  return (
                    <tr key={d.id} className="hover:bg-slate-50" data-testid={`row-dispatch-${d.id}`}>
                      <td className="p-2 font-mono text-sm">{d.vehiclePlate}</td>
                      <td className="p-2 text-xs">{d.driverName}</td>
                      <td className="p-2"><div className="font-medium">{d.purpose}</div><div className="text-[10px] text-slate-500">{d.org.name}</div></td>
                      <td className="p-2 text-xs">{formatDateVn(d.startAt)}<div className="text-[10px] text-slate-500">{d.startAt.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</div></td>
                      <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td><td className="p-2"><RowActions id={d.id} status={d.status} /></td>
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
