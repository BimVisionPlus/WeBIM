import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const catLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "violet" }> = {
  QUYET_DINH: { vn: "Quyết định", variant: "violet" },
  THONG_BAO: { vn: "Thông báo", variant: "info" },
  QUY_CHE: { vn: "Quy chế", variant: "warning" },
  QUY_TRINH: { vn: "Quy trình", variant: "warning" },
  BIEN_BAN: { vn: "Biên bản", variant: "neutral" },
  KHAC: { vn: "Khác", variant: "neutral" },
};

export default async function InternalDocsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/internaldocs");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const docs = await prisma.internalDocument.findMany({
    where: { orgId: { in: orgIds } },
    include: { org: { select: { name: true } }, author: { select: { name: true } } },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return (
    <AecModuleShell group="Hành chính" name="Văn bản nội bộ" subtitle="Quyết định, thông báo, quy chế, quy trình của công ty.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng văn bản</div><div className="mt-1 text-2xl font-bold">{docs.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Quyết định</div><div className="mt-1 text-2xl font-bold text-violet-700">{docs.filter((d) => d.category === "QUYET_DINH").length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Thông báo</div><div className="mt-1 text-2xl font-bold text-blue-700">{docs.filter((d) => d.category === "THONG_BAO").length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">30 ngày qua</div><div className="mt-1 text-2xl font-bold">{docs.filter((d) => d.issuedAt.getTime() > Date.now() - 30 * 86400000).length}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách văn bản ({docs.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {docs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có văn bản nội bộ nào. Bấm "Thêm văn bản nội bộ" để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Số</th><th className="p-2 text-left">Loại</th><th className="p-2 text-left">Tiêu đề</th><th className="p-2 text-left">Ban hành</th><th className="p-2 text-left">Người soạn</th><th className="p-2 text-left">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map((d) => {
                  const m = catLabel[d.category] ?? { vn: d.category, variant: "neutral" as const };
                  return (
                    <tr key={d.id} className="hover:bg-slate-50" data-testid={`row-doc-${d.id}`}>
                      <td className="p-2 font-mono text-xs">{d.docNo}</td>
                      <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td>
                      <td className="p-2"><div className="font-medium">{d.title}</div>{d.body && <div className="text-[11px] text-slate-500 line-clamp-1">{d.body}</div>}</td>
                      <td className="p-2 text-xs">{formatDateVn(d.issuedAt)}</td>
                      <td className="p-2 text-xs">{d.author?.name ?? "—"}</td><td className="p-2"><RowActions id={d.id} initial={{ title: d.title, category: d.category, issuedAt: d.issuedAt.toISOString().slice(0,10), body: d.body }} /></td>
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
