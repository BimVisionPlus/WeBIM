import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { OrgSwitcher } from "@/components/org-switcher";
import { NotificationsBell } from "@/components/notifications-bell";
import { DepartmentSelect } from "./DepartmentSelect";
import { ProjectRowActions } from "./ProjectRowActions";
import { RiskBanner } from "@/components/risk-banner";
import { AuditHistoryLink } from "@/components/audit-history-link";
import { DigestButton } from "@/components/digest-button";

export const dynamic = "force-dynamic";

// Tab keys + Vietnamese labels. `dept` filters by department. `viewMode='by-unit'`
// switches the table to group-by-BusinessUnit rendering. `href` makes the tab a
// hard link (e.g. /units management page) rather than a tab filter.
type TabDef = { key: string; label: string; dept: string | null; viewMode?: "flat" | "by-unit"; href?: string };
const TABS: TabDef[] = [
  { key: "TONG_THE", label: "Dự án (Công ty)", dept: null, viewMode: "flat" },
  { key: "BY_UNIT", label: "Dự án các Đơn vị", dept: null, viewMode: "by-unit" },
  { key: "MANAGE_UNITS", label: "Đơn vị", dept: null, href: "/units" },
  { key: "CONG_VIEC", label: "Công việc", dept: "CONG_VIEC" },
  { key: "DAU_THAU", label: "Đấu thầu", dept: "DAU_THAU" },
  { key: "HANH_CHINH", label: "Hành chính", dept: "HANH_CHINH" },
  { key: "TAI_CHINH_KE_TOAN", label: "Tài chính kế toán", dept: "TAI_CHINH_KE_TOAN" },
  { key: "PHAT_TRIEN_THI_TRUONG", label: "Phát triển thị trường", dept: "PHAT_TRIEN_THI_TRUONG" },
  { key: "CONG_VIEC_KHAC", label: "Công việc khác", dept: "CONG_VIEC_KHAC" },
];

type ScheduleHealth = "Đúng tiến độ" | "Cảnh báo" | "Chậm";

function healthOf(progress: number, endDate: Date | null): ScheduleHealth {
  if (!endDate) return progress >= 90 ? "Đúng tiến độ" : "Cảnh báo";
  const now = Date.now();
  const daysToEnd = (endDate.getTime() - now) / 86400000;
  if (daysToEnd < 0 && progress < 100) return "Chậm";
  const totalDays = 180;
  const expectedProgress = Math.max(0, Math.min(100, ((totalDays - daysToEnd) / totalDays) * 100));
  if (daysToEnd < 30 && progress < expectedProgress - 10) return "Cảnh báo";
  if (progress < expectedProgress - 20) return "Cảnh báo";
  return "Đúng tiến độ";
}

const healthBadge: Record<ScheduleHealth, string> = {
  "Đúng tiến độ": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Cảnh báo": "bg-amber-50 text-amber-700 ring-amber-200",
  "Chậm": "bg-rose-50 text-rose-700 ring-rose-200",
};
const healthBar: Record<ScheduleHealth, string> = {
  "Đúng tiến độ": "bg-emerald-500",
  "Cảnh báo": "bg-amber-500",
  "Chậm": "bg-rose-500",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });
  if (memberships.length === 0) redirect("/onboarding/org");

  const orgs = memberships.map((m) => m.org);
  const activeSlug = (await cookies()).get("atlas_active_org")?.value ?? orgs[0]!.slug;
  const activeOrg = orgs.find((o) => o.slug === activeSlug) ?? orgs[0]!;
  const orgIds = activeOrg ? [activeOrg.id] : memberships.map((m) => m.orgId);

  const sp = await searchParams;
  const activeTabKey = sp.tab && TABS.some((t) => t.key === sp.tab) ? sp.tab : "TONG_THE";
  const activeTab = TABS.find((t) => t.key === activeTabKey)!;
  const q = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();

  const accessFilter = {
    OR: [
      { ownerOrgId: { in: orgIds } },
      { stakeholders: { some: { orgId: { in: orgIds } } } },
    ],
  };

  const [allProjects, allUnits] = await Promise.all([
    prisma.project.findMany({
      where: accessFilter,
      include: {
        stakeholders: { include: { org: { select: { name: true } } } },
        scheduleTasks: { select: { pctComplete: true } },
        businessUnit: { select: { id: true, code: true, name: true, province: true } },
        _count: { select: { issues: true, models: true, drawingSets: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.businessUnit.findMany({
      where: { orgId: { in: orgIds }, active: true },
      select: { id: true, code: true, name: true, province: true, leader: { select: { name: true } }, _count: { select: { projects: true } } },
      orderBy: [{ code: "asc" }],
    }),
  ]);

  if (allProjects.length === 0) {
    redirect(`/onboarding/project?orgId=${orgIds[0]}`);
  }

  const enriched = allProjects.map((p) => {
    const tasks = p.scheduleTasks;
    const progress = tasks.length === 0 ? 0 : Math.round(tasks.reduce((s, t) => s + t.pctComplete, 0) / tasks.length);
    const health = healthOf(progress, p.endDate);
    return { ...p, progress, health };
  });

  const counts: Record<string, number> = { TONG_THE: enriched.length };
  for (const t of TABS) if (t.dept) counts[t.key] = enriched.filter((p) => p.department === t.dept).length;

  let visible = enriched;
  if (activeTab.dept) visible = visible.filter((p) => p.department === activeTab.dept);
  if (q) {
    const ql = q.toLowerCase();
    visible = visible.filter((p) => p.name.toLowerCase().includes(ql) || p.key.toLowerCase().includes(ql));
  }
  if (statusFilter) visible = visible.filter((p) => p.health === statusFilter);

  const dist = {
    "Đúng tiến độ": enriched.filter((p) => p.health === "Đúng tiến độ").length,
    "Cảnh báo": enriched.filter((p) => p.health === "Cảnh báo").length,
    "Chậm": enriched.filter((p) => p.health === "Chậm").length,
  };
  const distTotal = dist["Đúng tiến độ"] + dist["Cảnh báo"] + dist["Chậm"];

  // ─── Dept-tab content (Hành chính / TC-KT / PTTT) ────────────────────────────
  // Each tab gets its own widget grid above the project table.
  let deptWidgets: React.ReactNode = null;
  if (activeTab.key === "HANH_CHINH") {
    const [agencyDocs, internalDocs, bhxh, dispatches] = await Promise.all([
      prisma.agencyDocument.findMany({ where: { OR: [{ projectId: null }, { project: accessFilter }] }, orderBy: { docDate: "desc" }, take: 3 }),
      prisma.internalDocument.findMany({ where: { orgId: { in: orgIds } }, orderBy: { issuedAt: "desc" }, take: 3 }),
      prisma.socialInsuranceRecord.findMany({ where: { orgId: { in: orgIds } }, orderBy: { createdAt: "desc" }, take: 3 }),
      prisma.vehicleDispatch.findMany({ where: { orgId: { in: orgIds } }, orderBy: { startAt: "desc" }, take: 3 }),
    ]);
    const [agencyCount, internalCount, bhxhCount, dispatchCount] = await Promise.all([
      prisma.agencyDocument.count({ where: { OR: [{ projectId: null }, { project: accessFilter }] } }),
      prisma.internalDocument.count({ where: { orgId: { in: orgIds } } }),
      prisma.socialInsuranceRecord.count({ where: { orgId: { in: orgIds } } }),
      prisma.vehicleDispatch.count({ where: { orgId: { in: orgIds } } }),
    ]);
    deptWidgets = (
      <>
      <div className="mt-4 flex justify-end"><DigestButton dept="HANH_CHINH" label="Hành chính" /></div>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid="dept-widgets-hanh-chinh">
        <DeptCard title="Công văn đến/đi" count={agencyCount} href="/stakeholders" items={agencyDocs.map((d) => ({ key: d.id, primary: d.docNo, secondary: d.subject }))} />
        <DeptCard title="Văn bản nội bộ" count={internalCount} href="/internaldocs" items={internalDocs.map((d) => ({ key: d.id, primary: d.docNo, secondary: d.title }))} />
        <DeptCard title="Theo dõi BHXH" count={bhxhCount} href="/bhxh" items={bhxh.map((r) => ({ key: r.id, primary: r.employeeName, secondary: r.status }))} />
        <DeptCard title="Điều phối xe" count={dispatchCount} href="/vehicledispatch" items={dispatches.map((d) => ({ key: d.id, primary: d.vehiclePlate, secondary: d.purpose }))} />
      </div>
      </>
    );
  } else if (activeTab.key === "TAI_CHINH_KE_TOAN") {
    const [advances, assignments] = await Promise.all([
      prisma.advanceTransaction.findMany({ where: { orgId: { in: orgIds } }, orderBy: { txnDate: "desc" }, take: 3 }),
      prisma.contractorAssignment.findMany({ where: { project: accessFilter }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);
    const [advanceCount, assignmentCount] = await Promise.all([
      prisma.advanceTransaction.count({ where: { orgId: { in: orgIds } } }),
      prisma.contractorAssignment.count({ where: { project: accessFilter } }),
    ]);
    deptWidgets = (
      <>
      <div className="mt-4 flex justify-end"><DigestButton dept="TAI_CHINH_KE_TOAN" label="TC-KT" /></div>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="dept-widgets-tckt">
        <DeptCard title="Tạm ứng / Thanh toán / Hoàn ứng" count={advanceCount} href="/advances" items={advances.map((t) => ({ key: t.id, primary: t.payeeName, secondary: `${t.type} · ${t.amountVnd.toString().slice(0,-6)}M` }))} />
        <DeptCard title="Bảng giao khoán cho đơn vị" count={assignmentCount} href="/contractorassigns" items={assignments.map((a) => ({ key: a.id, primary: a.contractorName, secondary: `${a.pctComplete}% hoàn thành` }))} />
      </div>
      </>
    );
  } else if (activeTab.key === "PHAT_TRIEN_THI_TRUONG") {
    const [territories, leads] = await Promise.all([
      prisma.marketTerritory.findMany({ where: { orgId: { in: orgIds } }, include: { _count: { select: { leads: true } } }, orderBy: { createdAt: "desc" }, take: 3 }),
      prisma.projectLead.findMany({ where: { orgId: { in: orgIds }, status: { in: ["TRACKING", "POTENTIAL"] } }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);
    const [territoryCount, leadCount] = await Promise.all([
      prisma.marketTerritory.count({ where: { orgId: { in: orgIds } } }),
      prisma.projectLead.count({ where: { orgId: { in: orgIds }, status: { in: ["TRACKING", "POTENTIAL"] } } }),
    ]);
    deptWidgets = (
      <>
      <div className="mt-4 flex justify-end"><DigestButton dept="PHAT_TRIEN_THI_TRUONG" label="PTTT" /></div>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="dept-widgets-pttt">
        <DeptCard title="Địa bàn" count={territoryCount} href="/territories" items={territories.map((t) => ({ key: t.id, primary: t.name, secondary: `${t._count.leads} cơ hội · ${t.province ?? "—"}` }))} />
        <DeptCard title="Dự án đang theo & tiềm năng" count={leadCount} href="/leads" items={leads.map((l) => ({ key: l.id, primary: l.name, secondary: `${l.status} · ${l.province ?? "—"}` }))} />
      </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--raised))]">
      <header className="border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <a href="https://aecplatform.vn" className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-[rgb(var(--inverse-ink))] hover:opacity-90" title="AEC Platform — về trang chủ">
              V
            </a>
            <div className="flex flex-col leading-tight">
              <a href="https://aecplatform.vn" className="text-[10px] uppercase tracking-wider text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]">
                AEC Platform
              </a>
              <span className="text-base font-semibold text-[rgb(var(--ink))]">Atlas</span>
            </div>
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">v1 · LIVE</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-[rgb(var(--muted))]">
            <NotificationsBell />
            <OrgSwitcher orgs={orgs} activeSlug={activeOrg.slug} />
            <Link href="/demo" className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-[rgb(var(--inverse-ink))] hover:bg-blue-700">★ Demo</Link>
            <Link href="/" className="hover:text-[rgb(var(--ink))]">Dự án</Link>
            <Link href="/units" className="hover:text-[rgb(var(--ink))]">Đơn vị</Link>
            <Link href="/winwork" className="hover:text-[rgb(var(--ink))]">WinWork</Link>
            <Link href="/catalog" className="hover:text-[rgb(var(--ink))]">Catalog</Link>
            <Link href="/portfolio" className="hover:text-[rgb(var(--ink))]">Portfolio</Link>
            <Link href="/trust" className="hover:text-[rgb(var(--ink))]">Trust</Link>
            <Link href="/pricing" className="hover:text-[rgb(var(--ink))]">Giá</Link>
            <Link href="/audit" className="hover:text-[rgb(var(--ink))]" title="Sổ kiểm toán — mọi thao tác">Audit</Link>
            <Link href="/archive" className="hover:text-[rgb(var(--ink))]" title="Lưu trữ — khôi phục bản ghi đã xoá">Archive</Link>
            <Link href="/settings/team" className="hover:text-[rgb(var(--ink))]">Tổ chức</Link>
            <Link href="/api/auth/signout" className="hover:text-[rgb(var(--ink))]">Đăng xuất ({session.name})</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <RiskBanner orgIds={orgIds} accessFilter={accessFilter} />

        <nav className="flex flex-wrap gap-1 border-b border-[rgb(var(--line))]" data-testid="dept-tabs">
          {TABS.map((t) => {
            const isActive = t.key === activeTabKey;
            let badgeNum: number | null = null;
            if (t.key === "TONG_THE" || t.key === "BY_UNIT") badgeNum = enriched.length;
            else if (t.key === "MANAGE_UNITS") badgeNum = allUnits.length;
            else badgeNum = counts[t.key] ?? 0;
            const qs = new URLSearchParams();
            qs.set("tab", t.key);
            if (q) qs.set("q", q);
            if (statusFilter) qs.set("status", statusFilter);
            const href = t.href ?? `/?${qs.toString()}`;
            return (
              <Link
                key={t.key}
                href={href}
                data-testid={`tab-${t.key}`}
                className={`relative -mb-px px-3 py-2 text-sm font-medium ${isActive ? "border-b-2 border-blue-600 text-blue-700" : "text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]"}`}
              >
                {t.label}
                {badgeNum != null && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-blue-100 text-blue-700" : "bg-[rgb(var(--raised))] text-[rgb(var(--muted))]"}`}>{badgeNum}</span>}
              </Link>
            );
          })}
        </nav>

        {deptWidgets}

        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Danh sách dự án</CardTitle>
              <form className="flex items-center gap-2" method="get" data-testid="project-filters">
                <input type="hidden" name="tab" value={activeTabKey} />
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-2))]">🔍</span>
                  <input name="q" defaultValue={q} placeholder="Tìm dự án..." className="rounded border border-[rgb(var(--line-2))] py-1.5 pl-7 pr-3 text-sm" />
                </div>
                <select name="status" defaultValue={statusFilter} className="rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm">
                  <option value="">Tất cả trạng thái</option>
                  <option value="Đúng tiến độ">Đúng tiến độ</option>
                  <option value="Cảnh báo">Cảnh báo</option>
                  <option value="Chậm">Chậm</option>
                </select>
                <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]">Lọc</button>
                <Link
                  href={`/onboarding/project?orgId=${orgIds[0]}`}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-emerald-700"
                >
                  + Dự án mới
                </Link>
              </form>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {visible.length === 0 ? (
              <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
                {activeTab.dept ? `Phòng "${activeTab.label}" chưa có dự án nào.` : "Chưa có dự án nào phù hợp bộ lọc."}
              </div>
            ) : activeTab.viewMode === "by-unit" ? (
              <div className="divide-y divide-[rgb(var(--line))]">
                {(() => {
                  const groups = new Map<string, { unit: { id: string | null; code: string; name: string; province: string | null }; projects: typeof visible }>();
                  for (const p of visible) {
                    const bu = p.businessUnit;
                    const key = bu?.id ?? "_none";
                    if (!groups.has(key)) {
                      groups.set(key, {
                        unit: bu ? { id: bu.id, code: bu.code, name: bu.name, province: bu.province } : { id: null, code: "—", name: "(Chưa gán đơn vị)", province: null },
                        projects: [],
                      });
                    }
                    groups.get(key)!.projects.push(p);
                  }
                  const sorted = Array.from(groups.values()).sort((a, b) => (a.unit.id ? 0 : 1) - (b.unit.id ? 0 : 1) || a.unit.code.localeCompare(b.unit.code));
                  return sorted.map((g) => (
                    <details key={g.unit.id ?? "_none"} open className="group">
                      <summary className="flex cursor-pointer items-center gap-3 bg-[rgb(var(--raised))] px-4 py-2 text-xs font-medium text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--raised))]">
                        <span className="font-mono text-[rgb(var(--muted))]">{g.unit.code}</span>
                        <span className="text-[rgb(var(--ink))]">{g.unit.name}</span>
                        {g.unit.province && <span className="text-[rgb(var(--muted))]">· {g.unit.province}</span>}
                        <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{g.projects.length} dự án</span>
                      </summary>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-[rgb(var(--line))]">
                          {g.projects.map((p) => {
                            const extras = Math.max(0, p.stakeholders.length - 1);
                            const firstName = p.stakeholders[0]?.org.name ?? "—";
                            return (
                              <tr key={p.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-project-${p.id}`}>
                                <td className="p-3">
                                  <Link href={`/projects/${p.id}`} className="font-medium text-[rgb(var(--ink))] hover:text-blue-700">{p.name}</Link>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-[rgb(var(--muted))]">
                                    <span>{p.key}</span>
                                    <DepartmentSelect projectId={p.id} value={p.department} />
                                  </div>
                                </td>
                                <td className="p-3 text-xs text-[rgb(var(--ink-2))]">
                                  {firstName}
                                  {extras > 0 && <span className="ml-1 rounded-full bg-[rgb(var(--raised))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--muted))]">+{extras}</span>}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-32 overflow-hidden rounded-full bg-[rgb(var(--line))]">
                                      <div className={`h-full ${healthBar[p.health]}`} style={{ width: `${p.progress}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-[rgb(var(--ink-2))]">{p.progress}%</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${healthBadge[p.health]}`}>{p.health}</span>
                                </td>
                                <td className="p-3 text-xs text-[rgb(var(--ink-2))]">{p.endDate ? formatDateVn(p.endDate) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </details>
                  ));
                })()}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr>
                    <th className="p-3 text-left">Dự án</th>
                    <th className="p-3 text-left">Đơn vị</th>
                    <th className="p-3 text-left">Nhân sự</th>
                    <th className="p-3 text-left">Tiến độ</th>
                    <th className="p-3 text-left">Trạng thái</th>
                    <th className="p-3 text-left">Deadline</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {visible.map((p) => {
                    const extras = Math.max(0, p.stakeholders.length - 1);
                    const firstName = p.stakeholders[0]?.org.name ?? "—";
                    return (
                      <tr key={p.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-project-${p.id}`}>
                        <td className="p-3">
                          <Link href={`/projects/${p.id}`} className="font-medium text-[rgb(var(--ink))] hover:text-blue-700">{p.name}</Link>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-[rgb(var(--muted))]">
                            <span>{p.key}</span>
                            <DepartmentSelect projectId={p.id} value={p.department} />
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {p.businessUnit ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                              <span className="font-mono">{p.businessUnit.code}</span>
                              <span className="text-blue-900">{p.businessUnit.name}</span>
                            </span>
                          ) : <span className="text-[rgb(var(--muted-2))]">—</span>}
                        </td>
                        <td className="p-3 text-xs text-[rgb(var(--ink-2))]">
                          {firstName}
                          {extras > 0 && <span className="ml-1 rounded-full bg-[rgb(var(--raised))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--muted))]">+{extras}</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-[rgb(var(--line))]">
                              <div className={`h-full ${healthBar[p.health]}`} style={{ width: `${p.progress}%` }} />
                            </div>
                            <span className="text-xs font-medium text-[rgb(var(--ink-2))]">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${healthBadge[p.health]}`} data-testid={`status-${p.id}`}>
                            {p.health}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-[rgb(var(--ink-2))]">{p.endDate ? formatDateVn(p.endDate) : "—"}</td>
                        <td className="p-3 text-right">
                          <span className="inline-flex items-center gap-2">
                            <AuditHistoryLink entityId={p.id} entityType="Project" />
                            <ProjectRowActions id={p.id} initial={{ name: p.name, province: p.province, endDate: p.endDate ? p.endDate.toISOString().slice(0,10) : null, status: p.status }} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Phân bố trạng thái</CardTitle>
              <span className="text-[11px] text-[rgb(var(--muted))]">theo tất cả dự án truy cập được</span>
            </div>
          </CardHeader>
          <CardBody>
            {distTotal === 0 ? (
              <div className="p-4 text-center text-sm text-[rgb(var(--muted))]">Chưa có dữ liệu.</div>
            ) : (
              <div className="flex flex-wrap items-center gap-8">
                <Donut total={distTotal} parts={[
                  { label: "Đúng tiến độ", value: dist["Đúng tiến độ"], color: "#10b981" },
                  { label: "Cảnh báo", value: dist["Cảnh báo"], color: "#f59e0b" },
                  { label: "Chậm", value: dist["Chậm"], color: "#f43f5e" },
                ]} />
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" /> Đúng tiến độ — <strong>{dist["Đúng tiến độ"]}</strong> dự án</li>
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-500" /> Cảnh báo — <strong>{dist["Cảnh báo"]}</strong> dự án</li>
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-rose-500" /> Chậm — <strong>{dist["Chậm"]}</strong> dự án</li>
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

function Donut({ total, parts }: { total: number; parts: { label: string; value: number; color: string }[] }) {
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" data-testid="status-donut">
      <g transform="translate(90 90) rotate(-90)">
        <circle r={R} fill="none" stroke="#e2e8f0" strokeWidth="22" />
        {parts.map((p) => {
          const frac = p.value / total;
          const dash = frac * C;
          const seg = (
            <circle
              key={p.label}
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth="22"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return seg;
        })}
      </g>
      <text x="90" y="92" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">{total}</text>
      <text x="90" y="110" textAnchor="middle" fontSize="10" fill="#64748b">dự án</text>
    </svg>
  );
}

function DeptCard({ title, count, href, items }: { title: string; count: number; href: string; items: { key: string; primary: string; secondary?: string | null }[] }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-sm">
      <div className="flex items-center justify-between border-b border-[rgb(var(--line))] px-3 py-2">
        <div className="text-sm font-semibold text-[rgb(var(--ink))]">{title}</div>
        <span className="rounded-full bg-[rgb(var(--raised))] px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--muted))]">{count}</span>
      </div>
      <div className="divide-y divide-[rgb(var(--line))]">
        {items.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[rgb(var(--muted-2))]">Chưa có dữ liệu.</div>
        ) : (
          items.map((it) => (
            <div key={it.key} className="px-3 py-2 text-xs">
              <div className="font-medium text-[rgb(var(--ink))] line-clamp-1">{it.primary}</div>
              {it.secondary && <div className="text-[11px] text-[rgb(var(--muted))] line-clamp-1">{it.secondary}</div>}
            </div>
          ))
        )}
      </div>
      <a href={href} className="block border-t border-[rgb(var(--line))] px-3 py-2 text-right text-[11px] font-medium text-blue-600 hover:text-blue-700">Xem chi tiết →</a>
    </div>
  );
}
