import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import Link from "next/link";
import { DossierSeedButton } from "@/components/codeguard-dossier-seed";
import { DossierStatusToggle } from "@/components/codeguard-dossier-toggle";

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  KHAO_SAT: "Khảo sát",
  THIET_KE: "Thiết kế",
  THI_CONG: "Thi công",
  NGHIEM_THU: "Nghiệm thu",
  HOAN_CONG: "Hoàn công",
};

const statusVariant: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  MISSING: "danger",
  DRAFT: "neutral",
  SUBMITTED: "info",
  ACCEPTED: "success",
  REJECTED: "warning",
};

export default async function CodeGuardPage({ params }: { params: { projectId: string } }) {
  const [project, items, applicable] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.qualityDossierItem.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ category: "asc" }, { itemCode: "asc" }],
    }),
    prisma.projectRegulation.findMany({
      where: { projectId: params.projectId },
      include: { regulation: { include: { _count: { select: { rules: true } } } } },
    }),
  ]);

  // Group dossier items by category
  const byCat: Record<string, typeof items> = {};
  for (const i of items) {
    if (!byCat[i.category]) byCat[i.category] = [];
    byCat[i.category]!.push(i);
  }

  const total = items.length;
  const accepted = items.filter((i) => i.status === "ACCEPTED").length;
  const missing = items.filter((i) => i.status === "MISSING").length;
  const completionPct = total > 0 ? Math.round((accepted / total) * 100) : 0;

  // Pull a sampling of applicable regulations
  const regs = await prisma.regulation.findMany({
    where: { status: "IN_FORCE" },
    include: { _count: { select: { rules: true } } },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
    take: 12,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">CodeGuard — TCVN/QCVN & Hồ sơ chất lượng</h2>
        <p className="mt-1 text-sm text-slate-500">
          Thư viện tiêu chuẩn áp dụng cho {project?.name} + checklist hồ sơ NĐ 15/2021 + biên bản nghiệm thu NĐ 06/2021.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Hồ sơ hoàn thiện</div>
            <div className="mt-1 text-2xl font-bold">{completionPct}%</div>
            <div className="text-[11px] text-slate-500">{accepted}/{total} mục</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Mục còn thiếu</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{missing}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Tiêu chuẩn áp dụng</div>
            <div className="mt-1 text-2xl font-bold">{applicable.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Thư viện hiệu lực</div>
            <div className="mt-1 text-2xl font-bold">{regs.length}+</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Hồ sơ chất lượng (NĐ 15/2021 Phụ lục I)</CardTitle>
            {items.length === 0 && <DossierSeedButton projectId={params.projectId} />}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa khởi tạo checklist hồ sơ. Bấm "Khởi tạo theo NĐ 15/2021" để sinh template chuẩn.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {Object.entries(byCat).map(([cat, list]) => (
                <div key={cat} className="px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="violet">{categoryLabel[cat] ?? cat}</Badge>
                    <span className="text-xs text-slate-500">
                      {list!.filter((i) => i.status === "ACCEPTED").length}/{list!.length} hoàn thiện
                    </span>
                  </div>
                  <div className="space-y-1">
                    {list!.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] text-slate-500">{it.itemCode}</span>
                          <span className="text-slate-900">{it.itemTitle}</span>
                          {it.required && <Badge variant="neutral">Bắt buộc</Badge>}
                        </div>
                        <DossierStatusToggle
                          projectId={params.projectId}
                          itemCode={it.itemCode}
                          status={it.status}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Thư viện TCVN / QCVN / NĐ</CardTitle>
            <Link href="/codeguard" className="text-xs text-blue-600 hover:underline">Mở thư viện đầy đủ →</Link>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {regs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Thư viện trống. Chạy <code className="rounded bg-slate-100 px-1">pnpm db:seed</code> để load baseline.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Mã</th>
                  <th className="p-3 text-left">Loại</th>
                  <th className="p-3 text-left">Tên tiêu chuẩn</th>
                  <th className="p-3 text-left">Cơ quan ban hành</th>
                  <th className="p-3 text-center">Quy tắc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{r.code}</td>
                    <td className="p-3"><Badge variant="neutral">{r.kind}</Badge></td>
                    <td className="p-3 text-slate-900">{r.title}</td>
                    <td className="p-3 text-slate-700">{r.issuedBy ?? "—"}</td>
                    <td className="p-3 text-center">{r._count.rules}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
