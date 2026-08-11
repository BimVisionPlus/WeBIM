import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { ComplianceCheckPanel } from "./ComplianceCheckPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

const kindLabel: Record<string, { vn: string; variant: "info" | "warning" | "danger" | "neutral" | "success" | "violet" }> = {
  PC07_PCCC: { vn: "PC07 PCCC", variant: "danger" },
  SO_XAY_DUNG: { vn: "Sở Xây dựng", variant: "info" },
  CDT_NGHIEM_THU: { vn: "CĐT nghiệm thu", variant: "violet" },
  HOAN_CONG_QLNN: { vn: "Hoàn công QLNN", variant: "success" },
  TVGS_NGHIEM_THU: { vn: "TVGS nghiệm thu", variant: "warning" },
  KHAC: { vn: "Khác", variant: "neutral" },
};

const stateMeta: Record<string, { vn: string; variant: "info" | "warning" | "danger" | "neutral" | "success" }> = {
  DRAFT: { vn: "Soạn", variant: "neutral" },
  IN_PROGRESS: { vn: "Đang chuẩn bị", variant: "warning" },
  READY: { vn: "Sẵn sàng", variant: "info" },
  INSPECTING: { vn: "Đang kiểm", variant: "warning" },
  PASSED: { vn: "Đạt", variant: "success" },
  FAILED: { vn: "Không đạt", variant: "danger" },
  CLOSED: { vn: "Đã đóng", variant: "neutral" },
};

const itemStateMeta: Record<string, { vn: string; variant: "info" | "warning" | "danger" | "neutral" | "success" }> = {
  PENDING: { vn: "Chờ", variant: "neutral" },
  IN_PROGRESS: { vn: "Đang xử lý", variant: "warning" },
  READY: { vn: "Sẵn sàng", variant: "success" },
  NOT_APPLICABLE: { vn: "N/A", variant: "neutral" },
  FAILED: { vn: "Lỗi", variant: "danger" },
};

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/compliance");
  const sp = await searchParams;
  const tab = (sp.tab ?? "all") as "all" | "standards" | "audit" | "ai";

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const [standards, preps, openPrepCount, passedPrepCount, projects] = await Promise.all([
    prisma.regulation.findMany({
      where: { status: "IN_FORCE", kind: { in: ["TCVN", "QCVN"] } },
      include: { _count: { select: { rules: true } } },
      orderBy: { code: "asc" },
      take: 30,
    }),
    prisma.auditPrep.findMany({
      where: { project: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] } },
      include: { project: { select: { key: true, name: true } }, _count: { select: { items: true } }, items: { select: { state: true } } },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.auditPrep.count({ where: { state: { in: ["DRAFT", "IN_PROGRESS", "READY", "INSPECTING"] }, project: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] } } }),
    prisma.auditPrep.count({ where: { state: "PASSED", project: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] } } }),
    prisma.project.findMany({
      where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] },
      select: { id: true, key: true, name: true },
      orderBy: { key: "asc" },
    }),
  ]);

  // Compute readiness % per prep
  const prepRows = preps.map((p) => {
    const total = p._count.items;
    const ready = p.items.filter((i) => i.state === "READY" || i.state === "NOT_APPLICABLE").length;
    return { ...p, readyPct: total === 0 ? 0 : Math.round((ready / total) * 100) };
  });

  return (
    <AecModuleShell group="Compliance" name="Atlas Compliance — TCVN/QCVN · Audit prep · Hồ sơ hoàn công" subtitle="Engine tuân thủ TCVN 5574/2737, QCVN 06 PCCC, QCVN 04 chung cư; chuẩn bị thẩm tra PC07 + Sở XD; tự sinh hồ sơ hoàn công bằng AI.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tiêu chuẩn áp dụng</div><div className="mt-1 text-2xl font-bold text-blue-700">{standards.length}</div><div className="text-[10px] text-[rgb(var(--muted))]">TCVN + QCVN</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Audit prep đang mở</div><div className="mt-1 text-2xl font-bold text-amber-700">{openPrepCount}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Audit đã đạt</div><div className="mt-1 text-2xl font-bold text-emerald-700">{passedPrepCount}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng điều khoản</div><div className="mt-1 text-2xl font-bold text-violet-700">{standards.reduce((s, x) => s + x._count.rules, 0)}</div></CardBody></Card>
      </div>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-[rgb(var(--line))]">
        {[
          { key: "all", label: "Tổng quan" },
          { key: "standards", label: "Tiêu chuẩn TCVN/QCVN", count: standards.length },
          { key: "audit", label: "Audit prep", count: preps.length },
          { key: "ai", label: "AI compliance check" },
        ].map((t) => {
          const isActive = t.key === tab;
          return (
            <Link key={t.key} href={`/compliance?tab=${t.key}`} className={`relative -mb-px px-3 py-2 text-sm font-medium ${isActive ? "border-b-2 border-blue-600 text-blue-700" : "text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]"}`}>
              {t.label}{typeof t.count === "number" && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-blue-100 text-blue-700" : "bg-[rgb(var(--raised))] text-[rgb(var(--muted))]"}`}>{t.count}</span>}
            </Link>
          );
        })}
      </nav>

      {(tab === "all" || tab === "standards") && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Tiêu chuẩn TCVN/QCVN áp dụng</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Mã</th><th className="p-2 text-left">Loại</th><th className="p-2 text-left">Tiêu đề</th><th className="p-2 text-left">Cơ quan ban hành</th><th className="p-2 text-right">Điều khoản</th><th className="p-2 text-left">Tags</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {standards.map((s) => (
                  <tr key={s.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-mono text-xs font-medium">{s.code}</td>
                    <td className="p-2"><Badge variant={s.kind === "QCVN" ? "danger" : "info"}>{s.kind}</Badge></td>
                    <td className="p-2 text-xs">{s.title}</td>
                    <td className="p-2 text-xs text-[rgb(var(--muted))]">{s.issuedBy ?? "—"}</td>
                    <td className="p-2 text-right text-xs">{s._count.rules}</td>
                    <td className="p-2"><div className="flex flex-wrap gap-1">{s.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-[rgb(var(--raised))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--ink-2))]">{t}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {(tab === "all" || tab === "audit") && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Audit prep — chuẩn bị thẩm tra ({prepRows.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {prepRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có audit prep nào. Bấm "Tạo prep mới" trong project.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr><th className="p-2 text-left">Lịch</th><th className="p-2 text-left">Dự án</th><th className="p-2 text-left">Loại</th><th className="p-2 text-left">Tiêu đề</th><th className="p-2 text-left">Đoàn kiểm</th><th className="p-2 text-right">Mức sẵn sàng</th><th className="p-2 text-left">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {prepRows.map((p) => {
                    const km = kindLabel[p.kind] ?? { vn: p.kind, variant: "neutral" as const };
                    const sm = stateMeta[p.state] ?? { vn: p.state, variant: "neutral" as const };
                    return (
                      <tr key={p.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-prep-${p.id}`}>
                        <td className="p-2 text-xs">{p.scheduledAt ? formatDateVn(p.scheduledAt) : "—"}</td>
                        <td className="p-2"><div className="font-mono text-xs">{p.project.key}</div><div className="text-[10px] text-[rgb(var(--muted))]">{p.project.name}</div></td>
                        <td className="p-2"><Badge variant={km.variant}>{km.vn}</Badge></td>
                        <td className="p-2 text-xs"><div className="font-medium">{p.title}</div></td>
                        <td className="p-2 text-xs text-[rgb(var(--muted))]">{p.inspectorOrg ?? "—"}</td>
                        <td className="p-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-[rgb(var(--line))] overflow-hidden"><div className={`h-full ${p.readyPct >= 80 ? "bg-emerald-500" : p.readyPct >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${p.readyPct}%` }} /></div>
                            <span className="text-xs font-medium">{p.readyPct}%</span>
                          </div>
                          <div className="text-[10px] text-[rgb(var(--muted))]">{p._count.items} items</div>
                        </td>
                        <td className="p-2"><Badge variant={sm.variant}>{sm.vn}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {(tab === "all" || tab === "ai") && (
        <Card className="mt-4">
          <CardHeader><CardTitle>AI Compliance Check</CardTitle></CardHeader>
          <CardBody>
            <ComplianceCheckPanel projects={projects} />
          </CardBody>
        </Card>
      )}
    </AecModuleShell>
  );
}
