import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

export default async function PunchListOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/punchlist");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [
      { ownerOrgId: { in: orgIds } },
      { stakeholders: { some: { orgId: { in: orgIds } } } },
    ],
  };

  const punchItems = await prisma.punchItem.findMany({
    where: { Project: projectFilter },
    include: {
      issue: { include: { project: { select: { key: true, name: true } }, assignee: { select: { name: true } } } },
    },
    take: 200,
  });

  const accepted = punchItems.filter((p) => p.acceptedAt).length;
  const withAfter = punchItems.filter((p) => p.photoAfterUrl).length;
  const tradeCounts = new Map<string, number>();
  for (const p of punchItems) tradeCounts.set(p.trade, (tradeCounts.get(p.trade) ?? 0) + 1);
  const completionPct = punchItems.length === 0 ? 0 : Math.round((accepted / punchItems.length) * 100);

  return (
    <AecModuleShell
      group="Bàn giao"
      name="Punch list"
      subtitle="Snag list — đánh dấu khiếm khuyết theo vị trí trên bản vẽ/3D, đóng từng item kèm ảnh after."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng punch item</div><div className="mt-1 text-2xl font-bold">{punchItems.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã nghiệm thu</div><div className="mt-1 text-2xl font-bold text-emerald-700">{accepted}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Có ảnh after</div><div className="mt-1 text-2xl font-bold text-blue-700">{withAfter}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tỉ lệ hoàn thành</div><div className="mt-1 text-2xl font-bold">{completionPct}%</div></CardBody></Card>
      </div>

      {tradeCounts.size > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Phân loại theo công đoạn</CardTitle></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {[...tradeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <Badge key={t} variant="neutral">{t}: {n}</Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Danh sách ({punchItems.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {punchItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có punch item. Tạo Issue dạng PUNCH trong dự án để xuất hiện ở đây.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Khu vực</th>
                  <th className="p-2 text-left">Công đoạn</th>
                  <th className="p-2 text-left">Mô tả</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {punchItems.slice(0, 100).map((p) => (
                  <tr key={p.issueId} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{p.issue.key}</td>
                    <td className="p-2 text-xs font-mono text-slate-600">{p.issue.project.key}</td>
                    <td className="p-2 text-xs">{p.zone}</td>
                    <td className="p-2 text-xs"><Badge variant="neutral">{p.trade}</Badge></td>
                    <td className="p-2"><div className="font-medium">{p.issue.title}</div><div className="text-[11px] text-slate-500">{p.issue.assignee?.name ?? "Chưa giao"}</div></td>
                    <td className="p-2 text-xs">
                      {p.acceptedAt
                        ? <Badge variant="success">Đã nghiệm thu</Badge>
                        : p.photoAfterUrl
                          ? <Badge variant="violet">Đợi nghiệm thu</Badge>
                          : <Badge variant="warning">Đang xử lý</Badge>}
                    </td>
                    <td className="p-2 text-xs text-slate-500">{p.issue.dueDate ? formatDateVn(p.issue.dueDate) : "—"}</td>
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
