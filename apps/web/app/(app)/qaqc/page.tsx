import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, ResultActions } from "./Actions";

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  MONG_COC: "Móng cọc",
  DAT: "Đất / nền",
  BE_TONG: "Bê tông",
  COT_THEP: "Cốt thép",
  KHOI_XAY: "Khối xây",
  HOAN_THIEN: "Hoàn thiện",
  MEP_CAP_THOAT: "MEP cấp thoát",
  MEP_DIEN: "MEP điện",
  MEP_DHKK: "MEP ĐHKK",
  MEP_PCCC: "MEP PCCC",
  KET_CAU_THEP: "Kết cấu thép",
  KHAC: "Khác",
};

const resultLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  PENDING: { vn: "Chờ", variant: "info" },
  PASS: { vn: "Đạt", variant: "success" },
  FAIL: { vn: "Không đạt", variant: "danger" },
  WAIVED: { vn: "Miễn", variant: "neutral" },
  REWORK: { vn: "Làm lại", variant: "warning" },
};

export default async function QaqcPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/qaqc");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const [templates, checks, accessibleProjects] = await Promise.all([
    prisma.itpTemplate.findMany({
      include: { _count: { select: { items: true, qaqcChecks: true } } },
      orderBy: { code: "asc" },
      take: 50,
    }),
    prisma.qaqcCheck.findMany({
      where: { project: projectFilter },
      include: { project: { select: { key: true } }, template: { select: { code: true, title: true, category: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } }),
  ]);
  const itpOpts = templates.map((t) => ({ id: t.id, code: t.code, title: t.title }));

  const total = checks.length;
  const pass = checks.filter((c) => c.result === "PASS").length;
  const fail = checks.filter((c) => c.result === "FAIL").length;
  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;

  return (
    <AecModuleShell
      group="Thi công"
      name="QAQC — Inspection Test Plan"
      subtitle="TT 26/2016 + TCVN per kết cấu. ITP library + BBNT công việc A1/A2/A3 auto-sinh. Fail → tự tạo NCR trong Site."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">ITP templates</div><div className="mt-1 text-2xl font-bold">{templates.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng check</div><div className="mt-1 text-2xl font-bold">{total}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tỷ lệ Đạt</div><div className={`mt-1 text-2xl font-bold ${passRate >= 95 ? "text-emerald-700" : "text-amber-700"}`}>{passRate}%</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Không đạt → NCR</div><div className="mt-1 text-2xl font-bold text-rose-700">{fail}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Thư viện ITP ({templates.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {templates.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có ITP nào. Bấm “Lên lịch check ITP” để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Mã ITP</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-left">TCVN</th>
                  <th className="p-2 text-right">Điểm kiểm tra</th>
                  <th className="p-2 text-right">Đã thực thi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-mono text-xs">{t.code}</td>
                    <td className="p-2 text-xs">{categoryLabel[t.category]}</td>
                    <td className="p-2 text-xs"><div className="font-medium">{t.title}</div>{t.description && <div className="text-[10px] text-[rgb(var(--muted))] line-clamp-1">{t.description}</div>}</td>
                    <td className="p-2 text-[10px] text-[rgb(var(--muted))]">{t.tcvnRefs.slice(0, 3).join(" · ")}</td>
                    <td className="p-2 text-right text-xs">{t._count.items}</td>
                    <td className="p-2 text-right text-xs">{t._count.qaqcChecks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6"><CreateForm projects={accessibleProjects} itps={itpOpts} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Check gần đây ({checks.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {checks.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có check nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Ngày</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Vị trí</th>
                  <th className="p-2 text-left">ITP</th>
                  <th className="p-2 text-left">Kết quả</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {checks.map((c) => {
                  const meta = resultLabel[c.result] ?? { vn: c.result, variant: "neutral" as const };
                  return (
                    <tr key={c.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-check-${c.id}`}>
                      <td className="p-2 text-xs">{c.conductedAt ? formatDateVn(c.conductedAt) : "—"}</td>
                      <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{c.project.key}</td>
                      <td className="p-2 text-xs">{c.location}</td>
                      <td className="p-2 text-xs"><span className="font-mono">{c.template?.code ?? "—"}</span><div className="text-[10px] text-[rgb(var(--muted))]">{c.template?.title}</div></td>
                      <td className="p-2" data-testid={`result-${c.id}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><ResultActions id={c.id} result={c.result} /></td>
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
