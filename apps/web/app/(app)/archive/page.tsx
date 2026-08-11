import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn, formatVnd } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { RestoreAction } from "./RestoreAction";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/archive");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const accessFilter = { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] };

  const [closedProjects, inactiveTerritories, inactiveItems, inactiveSuppliers, terminatedWorkers, archivedLeads] = await Promise.all([
    prisma.project.findMany({ where: { AND: [accessFilter, { status: "CLOSED" }] }, select: { id: true, key: true, name: true, department: true, endDate: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.marketTerritory.findMany({ where: { orgId: { in: orgIds }, active: false }, include: { org: { select: { name: true } }, _count: { select: { leads: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.catalogItem.findMany({ where: { active: false }, include: { _count: { select: { suppliers: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.supplier.findMany({ where: { active: false }, include: { _count: { select: { items: true } } }, orderBy: { name: "asc" }, take: 50 }),
    prisma.siteWorker.findMany({ where: { orgId: { in: orgIds }, state: "TERMINATED" }, include: { org: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.projectLead.findMany({ where: { orgId: { in: orgIds }, status: "ARCHIVED" }, include: { org: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const total = closedProjects.length + inactiveTerritories.length + inactiveItems.length + inactiveSuppliers.length + terminatedWorkers.length + archivedLeads.length;

  return (
    <AecModuleShell group="Hành chính" name="Lưu trữ & khôi phục" subtitle="Bản ghi đã xoá mềm (soft-delete) — dự án đã đóng, địa bàn vô hiệu, NCC vô hiệu, NLĐ đã nghỉ, lead lưu trữ. Bấm 'Khôi phục' để dùng lại.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Dự án đã đóng</div><div className="mt-1 text-2xl font-bold text-rose-700">{closedProjects.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Địa bàn ngưng</div><div className="mt-1 text-2xl font-bold text-amber-700">{inactiveTerritories.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Cấu kiện vô hiệu</div><div className="mt-1 text-2xl font-bold text-amber-700">{inactiveItems.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">NCC vô hiệu</div><div className="mt-1 text-2xl font-bold text-amber-700">{inactiveSuppliers.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">NLĐ đã nghỉ</div><div className="mt-1 text-2xl font-bold text-[rgb(var(--ink-2))]">{terminatedWorkers.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Lead lưu trữ</div><div className="mt-1 text-2xl font-bold text-[rgb(var(--ink-2))]">{archivedLeads.length}</div></CardBody></Card>
      </div>

      {total === 0 && (
        <Card className="mt-6"><CardBody>
          <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Không có bản ghi nào trong lưu trữ. Bản ghi xoá mềm sẽ xuất hiện ở đây để khôi phục.</div>
        </CardBody></Card>
      )}

      {closedProjects.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Dự án đã đóng ({closedProjects.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Mã</th><th className="p-2 text-left">Tên</th><th className="p-2 text-left">Phòng</th><th className="p-2 text-left">Kết thúc</th><th className="p-2 text-left">Khôi phục</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {closedProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-mono text-xs">{p.key}</td>
                    <td className="p-2 text-xs"><div className="font-medium">{p.name}</div></td>
                    <td className="p-2 text-xs">{p.department}</td>
                    <td className="p-2 text-xs">{p.endDate ? formatDateVn(p.endDate) : "—"}</td>
                    <td className="p-2"><RestoreAction url={`/api/projects/${p.id}`} payload={{ status: "IN_PROGRESS" }} label="dự án" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {inactiveTerritories.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Địa bàn vô hiệu ({inactiveTerritories.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]"><tr><th className="p-2 text-left">Tên</th><th className="p-2 text-left">Tỉnh</th><th className="p-2 text-right">Leads</th><th className="p-2 text-left">Khôi phục</th></tr></thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {inactiveTerritories.map((t) => (
                  <tr key={t.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 text-xs"><div className="font-medium">{t.name}</div><div className="text-[10px] text-[rgb(var(--muted))]">{t.org.name}</div></td>
                    <td className="p-2 text-xs">{t.province ?? "—"}</td>
                    <td className="p-2 text-right text-xs">{t._count.leads}</td>
                    <td className="p-2"><RestoreAction url={`/api/territories/${t.id}`} payload={{ active: true }} label="địa bàn" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {inactiveItems.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Cấu kiện vô hiệu ({inactiveItems.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]"><tr><th className="p-2 text-left">Mã</th><th className="p-2 text-left">Tên</th><th className="p-2 text-left">Đơn vị</th><th className="p-2 text-right">Giá gốc</th><th className="p-2 text-left">Khôi phục</th></tr></thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {inactiveItems.map((i) => (
                  <tr key={i.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-mono text-xs">{i.code}</td>
                    <td className="p-2 text-xs">{i.name}</td>
                    <td className="p-2 text-xs">{i.unit}</td>
                    <td className="p-2 text-right text-xs">{i.baselineUnitPriceVnd ? formatVnd(i.baselineUnitPriceVnd) : "—"}</td>
                    <td className="p-2"><RestoreAction url={`/api/catalog/items/${i.id}`} payload={{ active: true }} label="cấu kiện" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {inactiveSuppliers.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Nhà cung cấp vô hiệu ({inactiveSuppliers.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]"><tr><th className="p-2 text-left">Tên</th><th className="p-2 text-left">MST</th><th className="p-2 text-right">Mặt hàng</th><th className="p-2 text-left">Khôi phục</th></tr></thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {inactiveSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 text-xs font-medium">{s.name}</td>
                    <td className="p-2 text-xs">{s.mst ?? "—"}</td>
                    <td className="p-2 text-right text-xs">{s._count.items}</td>
                    <td className="p-2"><RestoreAction url={`/api/catalog/suppliers/${s.id}`} payload={{ active: true }} label="nhà cung cấp" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {terminatedWorkers.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>NLĐ đã nghỉ ({terminatedWorkers.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]"><tr><th className="p-2 text-left">Mã</th><th className="p-2 text-left">Họ tên</th><th className="p-2 text-left">Nghề</th><th className="p-2 text-left">Khôi phục</th></tr></thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {terminatedWorkers.map((w) => (
                  <tr key={w.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-mono text-xs">{w.workerCode}</td>
                    <td className="p-2 text-xs">{w.fullName}</td>
                    <td className="p-2 text-xs">{w.trade}</td>
                    <td className="p-2"><RestoreAction url={`/api/workforce/${w.id}/manage`} payload={{ state: "ACTIVE" }} label="NLĐ" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {archivedLeads.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Lead lưu trữ ({archivedLeads.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]"><tr><th className="p-2 text-left">Tên</th><th className="p-2 text-left">Khách hàng</th><th className="p-2 text-left">Khôi phục</th></tr></thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {archivedLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 text-xs"><div className="font-medium">{l.name}</div><div className="text-[10px] text-[rgb(var(--muted))]">{l.org.name}</div></td>
                    <td className="p-2 text-xs">{l.clientName ?? "—"}</td>
                    <td className="p-2"><RestoreAction url={`/api/leads/${l.id}`} payload={{ status: "TRACKING" }} label="lead" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </AecModuleShell>
  );
}
