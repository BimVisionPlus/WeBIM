import { DeleteRow } from "./DeleteRow";

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, DossierActions } from "./Actions";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  ASSEMBLING: { vn: "Đang tập hợp", variant: "info" },
  NT_REVIEW: { vn: "NT rà soát", variant: "info" },
  TVGS_REVIEW: { vn: "TVGS rà soát", variant: "warning" },
  CDT_REVIEW: { vn: "CĐT rà soát", variant: "warning" },
  COMPILED: { vn: "Đã đóng cuốn", variant: "violet" },
  SUBMITTED_QLNN: { vn: "Đã gửi QLNN", variant: "violet" },
  ACCEPTED: { vn: "QLNN chấp thuận", variant: "success" },
};

export default async function HoanCongPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/hoancong");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const dossiers = await prisma.hoanCongDossier.findMany({
    where: { project: projectFilter },
    include: {
      project: { select: { key: true, name: true } },
      sections: { include: { _count: { select: { items: true } } }, orderBy: { seq: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  return (
    <AecModuleShell
      group="Bàn giao"
      name="HoanCong — Hồ sơ hoàn công"
      subtitle="NĐ 06/2021 Phụ lục VIIIb — 13 nhóm tài liệu. Auto-assembly + đánh số chuỗi + ký số + đóng cuốn PDF/A → gửi Sở XD."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng dự án</div><div className="mt-1 text-2xl font-bold">{dossiers.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã đóng cuốn</div><div className="mt-1 text-2xl font-bold text-violet-700">{dossiers.filter((d) => ["COMPILED", "SUBMITTED_QLNN", "ACCEPTED"].includes(d.state)).length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">QLNN chấp thuận</div><div className="mt-1 text-2xl font-bold text-emerald-700">{dossiers.filter((d) => d.state === "ACCEPTED").length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang xử lý</div><div className="mt-1 text-2xl font-bold text-amber-700">{dossiers.filter((d) => !["COMPILED", "SUBMITTED_QLNN", "ACCEPTED"].includes(d.state)).length}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      {dossiers.length === 0 ? (
        <Card className="mt-4"><CardBody><div className="p-8 text-center text-sm text-slate-500">
          Chưa có hồ sơ hoàn công nào. Khi DA gần hoàn thành, tạo HoanCongDossier để khởi tạo 13 nhóm theo VIIIb.
        </div></CardBody></Card>
      ) : (
        dossiers.map((d) => {
          const meta = stateLabel[d.state] ?? { vn: d.state, variant: "neutral" as const };
          const totalItems = d.sections.reduce((s, sec) => s + sec.itemCount, 0);
          const signedItems = d.sections.reduce((s, sec) => s + sec.signedCount, 0);
          const progress = totalItems > 0 ? Math.round((signedItems / totalItems) * 100) : 0;
          return (
            <Card key={d.id} className="mt-6" data-testid={`dossier-${d.code}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>{d.code} — {d.project.name}</CardTitle>
                    <div className="text-xs text-slate-500">{d.title}</div>
                  </div>
                  <div data-testid={`state-${d.code}`}><Badge variant={meta.variant}>{meta.vn}</Badge></div>
                </div>
                <DossierActions id={d.id} state={d.state} />
              </CardHeader>
              <CardBody>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Tiến độ tài liệu đã ký</span>
                    <span className="font-medium">{signedItems}/{totalItems} ({progress}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                  {d.pdfaUrl && <div className="mt-2 text-[11px] text-emerald-700">📄 Đã đóng cuốn PDF/A {formatDateVn(d.pdfaCompiledAt)} · {d.pdfaSha256?.slice(0, 12)}…</div>}
                </div>
                <div className="overflow-hidden rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Nhóm</th>
                        <th className="p-2 text-right">Tài liệu</th>
                        <th className="p-2 text-right">Đã ký</th>
                        <th className="p-2 text-left">Tiến độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.sections.map((sec) => {
                        const pct = sec.itemCount > 0 ? Math.round((sec.signedCount / sec.itemCount) * 100) : 0;
                        return (
                          <tr key={sec.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-xs">{sec.code}</td>
                            <td className="p-2"><div className="font-medium text-xs">{sec.title}</div></td>
                            <td className="p-2 text-right text-xs">{sec.itemCount}</td>
                            <td className="p-2 text-right text-xs">{sec.signedCount}</td>
                            <td className="p-2">
                              <div className="h-1.5 w-32 rounded-full bg-slate-200">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          );
        })
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>OSS pipeline đóng cuốn</CardTitle></CardHeader>
        <CardBody>
          <ol className="space-y-1.5 text-sm text-slate-700">
            <li>1. <code>HoanCong</code> worker quét tất cả tài liệu trong 13 nhóm</li>
            <li>2. Validate ký số (cert chain VNPT-CA/Viettel-CA) bằng <code>libxmlsec1</code></li>
            <li>3. Concat PDFs theo thứ tự VIIIb + chèn bìa + mục lục bằng <code>PyMuPDF / pdfcpu</code></li>
            <li>4. Chuyển sang PDF/A-2b bằng <code>Ghostscript</code> (ISO 19005-2)</li>
            <li>5. SHA-256 + ký số toàn cuốn (CĐT cuối cùng) bằng <code>node-forge</code></li>
            <li>6. Upload S3 (MinIO) + tạo audit event → email Sở XD</li>
          </ol>
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
