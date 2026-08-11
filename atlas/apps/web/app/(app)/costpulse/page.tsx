import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

export default async function CostPulseOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/costpulse");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    select: { id: true, key: true, name: true, contractValueVnd: true },
  });
  const projectIds = projects.map((p) => p.id);

  const [boqs, priceIndex, suppliers] = await Promise.all([
    prisma.boQ.findMany({
      where: { projectId: { in: projectIds }, isCurrent: true },
      include: { _count: { select: { lines: true } } },
    }),
    prisma.materialPriceIndex.findMany({
      orderBy: [{ period: "desc" }, { material: "asc" }],
      take: 30,
    }),
    prisma.supplier.findMany({
      where: { active: true },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
      take: 30,
    }),
  ]);

  const totalContract = projects.reduce((s, p) => s + Number(p.contractValueVnd ?? BigInt(0)), 0);
  const totalBoqValue = boqs.reduce((s, b) => s + Number(b.contractValueVnd), 0);

  // Suggested cheapest-supplier-per-category snapshot
  const supplierItems = await prisma.supplierCatalogItem.findMany({
    include: {
      item: { select: { name: true, category: true, unit: true } },
      supplier: { select: { name: true, rating: true } },
    },
    orderBy: { unitPriceVnd: "asc" },
    take: 30,
  });

  return (
    <AecModuleShell
      group="Đấu thầu"
      name="CostPulse"
      subtitle="Dự toán + EVM + RFQ vật tư. Chỉ số giá vật liệu Bộ XD. So sánh giá supplier theo mã hàng."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Dự án</div><div className="mt-1 text-2xl font-bold">{projects.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng giá trị HĐ</div><div className="mt-1 text-2xl font-bold text-[rgb(var(--ink))]">{formatVnd(BigInt(totalContract))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng BoQ đang dùng</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalBoqValue))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Nhà cung cấp active</div><div className="mt-1 text-2xl font-bold">{suppliers.length}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>BoQ đang dùng ({boqs.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {boqs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có bảng khối lượng (BoQ). Tạo BoQ từ mục Đấu thầu (WinWork) hoặc bóc khối lượng từ mục VolumeMeter.</div>
            ) : (
              <ul className="divide-y divide-[rgb(var(--line))]">
                {boqs.map((b) => {
                  const p = projects.find((x) => x.id === b.projectId);
                  return (
                    <li key={b.id} className="p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[rgb(var(--muted))]">{p?.key ?? ""}</span>
                        <Badge variant="info">{b.version}</Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="font-medium text-[rgb(var(--ink))]">{b.name}</div>
                        <div className="text-sm font-semibold">{formatVnd(b.contractValueVnd)}</div>
                      </div>
                      <div className="text-[11px] text-[rgb(var(--muted))]">{b._count.lines} dòng BoQ</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Chỉ số giá vật liệu (Bộ XD) — {priceIndex.length} entries</CardTitle></CardHeader>
          <CardBody className="p-0">
            {priceIndex.length === 0 ? (
              <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa nạp chỉ số giá.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr><th className="p-2 text-left">Vật liệu</th><th className="p-2 text-left">Tỉnh</th><th className="p-2 text-right">Đơn giá</th><th className="p-2 text-left">Kỳ</th></tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {priceIndex.map((m) => (
                    <tr key={m.id} className="hover:bg-[rgb(var(--raised))]">
                      <td className="p-2"><div className="font-medium text-[rgb(var(--ink))]">{m.material}</div><div className="text-[10px] text-[rgb(var(--muted))]">{m.source ?? "—"}</div></td>
                      <td className="p-2 text-xs">{m.province}</td>
                      <td className="p-2 text-right text-sm font-medium">{formatVnd(m.priceVnd)}<span className="text-xs text-[rgb(var(--muted))]"> /{m.unit}</span></td>
                      <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{m.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Giá tốt nhất theo supplier ({supplierItems.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {supplierItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có quan hệ giá supplier × item.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Cấu kiện</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-right">Đơn giá</th><th className="p-2 text-right">Lead-time</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {supplierItems.map((si) => (
                  <tr key={si.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2"><div className="font-medium text-[rgb(var(--ink))]">{si.item.name}</div><div className="text-[10px] text-[rgb(var(--muted))]">{si.item.category}</div></td>
                    <td className="p-2 text-xs">{si.supplier.name}{si.supplier.rating ? <span className="text-[rgb(var(--muted))]"> · ⭐ {si.supplier.rating.toFixed(1)}</span> : null}</td>
                    <td className="p-2 text-right text-sm font-medium">{formatVnd(si.unitPriceVnd)}<span className="text-xs text-[rgb(var(--muted))]"> /{si.item.unit}</span></td>
                    <td className="p-2 text-right text-xs text-[rgb(var(--muted))]">{si.leadTimeDays ? `${si.leadTimeDays} ngày` : "—"}</td>
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
