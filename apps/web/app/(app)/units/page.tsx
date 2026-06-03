import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/units");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true, slug: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const units = await prisma.businessUnit.findMany({
    where: { orgId: { in: orgIds } },
    include: {
      org: { select: { name: true } },
      leader: { select: { name: true, email: true } },
      parent: { select: { code: true, name: true } },
      _count: { select: { projects: true, children: true } },
    },
    orderBy: [{ orgId: "asc" }, { active: "desc" }, { code: "asc" }],
  });

  const totalActive = units.filter((u) => u.active).length;
  const totalProjects = units.reduce((s, u) => s + u._count.projects, 0);

  return (
    <AecModuleShell group="Tổ chức" name="Đơn vị" subtitle="Chi nhánh / ban điều hành / tổng đội — đơn vị thực hiện dự án trong công ty.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng đơn vị</div><div className="mt-1 text-2xl font-bold">{units.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang hoạt động</div><div className="mt-1 text-2xl font-bold text-emerald-700">{totalActive}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Dự án trực thuộc</div><div className="mt-1 text-2xl font-bold text-blue-700">{totalProjects}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đơn vị có cấu trúc cha-con</div><div className="mt-1 text-2xl font-bold text-violet-700">{units.filter((u) => u._count.children > 0).length}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} parents={units.map((u) => ({ id: u.id, code: u.code, name: u.name, orgId: u.orgId }))} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách đơn vị ({units.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {units.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có đơn vị nào. Bấm "Thêm đơn vị" để bắt đầu.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Tên đơn vị</th>
                  <th className="p-2 text-left">Tổ chức</th>
                  <th className="p-2 text-left">Trưởng đơn vị</th>
                  <th className="p-2 text-left">Địa bàn</th>
                  <th className="p-2 text-right">Dự án</th>
                  <th className="p-2 text-left">Cấp trên</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 ${!u.active ? "opacity-60" : ""}`} data-testid={`row-unit-${u.id}`}>
                    <td className="p-2 font-mono text-xs">{u.code}</td>
                    <td className="p-2">
                      <div className="font-medium">{u.name}</div>
                      {u.description && <div className="text-[11px] text-slate-500 line-clamp-1">{u.description}</div>}
                    </td>
                    <td className="p-2 text-xs">{u.org.name}</td>
                    <td className="p-2 text-xs">{u.leader?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="p-2 text-xs">{u.province ?? <span className="text-slate-400">—</span>}</td>
                    <td className="p-2 text-right">
                      {u._count.projects > 0 ? (
                        <Link href={`/?bu=${u.id}`} className="font-medium text-blue-700 hover:underline">{u._count.projects}</Link>
                      ) : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="p-2 text-xs">{u.parent ? `${u.parent.code} · ${u.parent.name}` : <span className="text-slate-400">—</span>}</td>
                    <td className="p-2">
                      {u.active ? <Badge variant="success">Đang hoạt động</Badge> : <Badge variant="neutral">Đã ngừng</Badge>}
                    </td>
                    <td className="p-2"><RowActions id={u.id} initial={{ code: u.code, name: u.name, description: u.description, province: u.province, active: u.active }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 text-xs text-slate-500">
        Đơn vị = subdivision trong tổ chức (chi nhánh / ban điều hành / tổng đội). Mỗi dự án thuộc 1 đơn vị thực hiện. Xem nhóm dự án theo đơn vị tại <Link href="/?view=don-vi" className="text-blue-600 underline">Dự án các Đơn vị</Link>.
      </div>
    </AecModuleShell>
  );
}
