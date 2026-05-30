import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

export default async function TerritoriesPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/territories");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const territories = await prisma.marketTerritory.findMany({
    where: { orgId: { in: orgIds } },
    include: { org: { select: { name: true } }, owner: { select: { name: true } }, _count: { select: { leads: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AecModuleShell group="Phát triển thị trường" name="Địa bàn" subtitle="Phân vùng phát triển thị trường theo địa lý + người phụ trách.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng địa bàn</div><div className="mt-1 text-2xl font-bold">{territories.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang hoạt động</div><div className="mt-1 text-2xl font-bold text-emerald-700">{territories.filter((t) => t.active).length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Có chủ địa bàn</div><div className="mt-1 text-2xl font-bold">{territories.filter((t) => t.ownerUserId).length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng leads</div><div className="mt-1 text-2xl font-bold text-blue-700">{territories.reduce((s, t) => s + t._count.leads, 0)}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách địa bàn ({territories.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {territories.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có địa bàn nào. Bấm "Thêm địa bàn" để bắt đầu phân vùng.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Tên địa bàn</th><th className="p-2 text-left">Tỉnh</th><th className="p-2 text-left">Phạm vi</th><th className="p-2 text-left">Chủ địa bàn</th><th className="p-2 text-right">Leads</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {territories.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50" data-testid={`row-territory-${t.id}`}>
                    <td className="p-2"><div className="font-medium">{t.name}</div><div className="text-[10px] text-slate-500">{t.org.name}</div></td>
                    <td className="p-2 text-xs">{t.province ?? "—"}</td>
                    <td className="p-2 text-xs line-clamp-2 max-w-md">{t.scope ?? "—"}</td>
                    <td className="p-2 text-xs">{t.owner?.name ?? <span className="text-slate-400">Chưa phân</span>}</td>
                    <td className="p-2 text-right text-xs">{t._count.leads}</td>
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
