import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, RowActions } from "./Actions";

export const dynamic = "force-dynamic";

const catLabel: Record<string, string> = {
  COC: "Cọc", DAO_DAT: "Đào đất / nền", BE_TONG_KHOI: "BT khối lớn",
  KET_CAU: "Kết cấu BTCT", KET_CAU_THEP: "Kết cấu thép",
  MEP: "MEP", HOAN_THIEN: "Hoàn thiện",
  CAU_GIANG_GIO: "Cẩu / giàn giáo", HAN_CO_DIEN: "Hàn / nguy cơ cháy", KHAC: "Khác",
};

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  NT_SUBMITTED: { vn: "NT trình", variant: "info" },
  TVGS_REVIEW: { vn: "TVGS rà soát", variant: "warning" },
  CDT_REVIEW: { vn: "CĐT rà soát", variant: "warning" },
  APPROVED: { vn: "Đã duyệt", variant: "success" },
  REJECTED: { vn: "Trả về", variant: "danger" },
  EXECUTING: { vn: "Đang thi công", variant: "violet" },
  CLOSED: { vn: "Đóng", variant: "neutral" },
};

export default async function MethodStatementsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/methods");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const [templates, statements, accessibleProjects] = await Promise.all([
    prisma.methodStatement.findMany({ where: { isTemplate: true }, orderBy: { code: "asc" }, take: 30 }),
    prisma.methodStatement.findMany({
      where: { isTemplate: false, project: projectFilter },
      include: { project: { select: { key: true } } },
      orderBy: { updatedAt: "desc" },
      take: 60,
    }),
    prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } }),
  ]);
  const templateOpts = templates.map((t) => ({ id: t.id, code: t.code, category: t.category }));

  const approved = statements.filter((s) => s.state === "APPROVED" || s.state === "EXECUTING" || s.state === "CLOSED").length;
  const pending = statements.filter((s) => ["NT_SUBMITTED", "TVGS_REVIEW", "CDT_REVIEW"].includes(s.state)).length;

  return (
    <AecModuleShell
      group="Thi công"
      name="MethodStatement — Biện pháp thi công"
      subtitle="Library BPTC theo hạng mục (cọc/đất/BT khối/MEP/hoàn thiện). Approval workflow NT→TVGS→CĐT, ký số chuỗi. Output VIIIb.4."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Template library</div><div className="mt-1 text-2xl font-bold">{templates.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">BPTC dự án</div><div className="mt-1 text-2xl font-bold">{statements.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã duyệt / đang TC</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Chờ duyệt</div><div className="mt-1 text-2xl font-bold text-amber-700">{pending}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>BPTC library ({templates.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {templates.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có biện pháp thi công mẫu. Bấm “Tạo BPTC” để thêm mới.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-left">TCVN tham chiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{t.code}</td>
                    <td className="p-2 text-xs">{catLabel[t.category]}</td>
                    <td className="p-2 text-xs"><div className="font-medium">{t.title}</div><div className="text-[10px] text-slate-500 line-clamp-1">{t.scope}</div></td>
                    <td className="p-2 text-[10px] text-slate-500">{t.tcvnRefs.slice(0, 3).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6"><CreateForm projects={accessibleProjects} templates={templateOpts} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>BPTC dự án ({statements.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {statements.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có BPTC nào. Tạo từ template.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-left">TVGS / CĐT</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map((s) => {
                  const meta = stateLabel[s.state] ?? { vn: s.state, variant: "neutral" as const };
                  return (
                    <tr key={s.id} className="hover:bg-slate-50" data-testid={`bptc-${s.code}`}>
                      <td className="p-2 font-mono text-xs">{s.code}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{s.project?.key ?? "—"}</td>
                      <td className="p-2 text-xs"><div className="font-medium">{s.title}</div><div className="text-[10px] text-slate-500">{catLabel[s.category]}</div></td>
                      <td className="p-2 text-[10px] text-slate-500">{s.tvgsApprovedAt ? `TVGS ${formatDateVn(s.tvgsApprovedAt)}` : "—"}<div>{s.cdtApprovedAt ? `CĐT ${formatDateVn(s.cdtApprovedAt)}` : ""}</div></td>
                      <td className="p-2" data-testid={`state-${s.code}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><RowActions id={s.id} state={s.state} /></td>
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
