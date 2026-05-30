import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { OrgSwitcher } from "@/components/org-switcher";

export const dynamic = "force-dynamic";

// Tab keys + Vietnamese labels (tab 1 = overview, 2-7 = department filters)
const TABS: { key: string; label: string; dept: string | null }[] = [
  { key: "TONG_THE", label: "Tổng thể toàn công ty", dept: null },
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

  const allProjects = await prisma.project.findMany({
    where: accessFilter,
    include: {
      stakeholders: { include: { org: { select: { name: true } } } },
      scheduleTasks: { select: { pctComplete: true } },
      _count: { select: { issues: true, models: true, drawingSets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <a href="https://aecplatform.vn" className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-white hover:opacity-90" title="AEC Platform — về trang chủ">
              V
            </a>
            <div className="flex flex-col leading-tight">
              <a href="https://aecplatform.vn" className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900">
                AEC Platform
              </a>
              <span className="text-base font-semibold text-slate-900">Viwase Quản lý công việc</span>
            </div>
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">v1 · LIVE</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <OrgSwitcher orgs={orgs} activeSlug={activeOrg.slug} />
            <Link href="/" className="hover:text-slate-900">Dự án</Link>
            <Link href="/winwork" className="hover:text-slate-900">WinWork</Link>
            <Link href="/catalog" className="hover:text-slate-900">Catalog</Link>
            <Link href="/portfolio" className="hover:text-slate-900">Portfolio</Link>
            <Link href="/trust" className="hover:text-slate-900">Trust</Link>
            <Link href="/pricing" className="hover:text-slate-900">Giá</Link>
            <Link href="/settings/team" className="hover:text-slate-900">Tổ chức</Link>
            <Link href="/api/auth/signout" className="hover:text-slate-900">Đăng xuất ({session.name})</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <nav className="flex flex-wrap gap-1 border-b border-slate-200" data-testid="dept-tabs">
          {TABS.map((t) => {
            const isActive = t.key === activeTabKey;
            const n = counts[t.key] ?? 0;
            const qs = new URLSearchParams();
            qs.set("tab", t.key);
            if (q) qs.set("q", q);
            if (statusFilter) qs.set("status", statusFilter);
            return (
              <Link
                key={t.key}
                href={`/?${qs.toString()}`}
                data-testid={`tab-${t.key}`}
                className={`relative -mb-px px-3 py-2 text-sm font-medium ${isActive ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
              >
                {t.label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{n}</span>
              </Link>
            );
          })}
        </nav>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Danh sách dự án</CardTitle>
              <form className="flex items-center gap-2" method="get" data-testid="project-filters">
                <input type="hidden" name="tab" value={activeTabKey} />
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input name="q" defaultValue={q} placeholder="Tìm dự án..." className="rounded border border-slate-300 py-1.5 pl-7 pr-3 text-sm" />
                </div>
                <select name="status" defaultValue={statusFilter} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">Tất cả trạng thái</option>
                  <option value="Đúng tiến độ">Đúng tiến độ</option>
                  <option value="Cảnh báo">Cảnh báo</option>
                  <option value="Chậm">Chậm</option>
                </select>
                <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">Lọc</button>
                <Link
                  href={`/onboarding/project?orgId=${orgIds[0]}`}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  + Dự án mới
                </Link>
              </form>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {visible.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {activeTab.dept ? `Phòng "${activeTab.label}" chưa có dự án nào.` : "Chưa có dự án nào phù hợp bộ lọc."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Dự án</th>
                    <th className="p-3 text-left">Nhân sự</th>
                    <th className="p-3 text-left">Tiến độ</th>
                    <th className="p-3 text-left">Trạng thái</th>
                    <th className="p-3 text-left">Deadline</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => {
                    const extras = Math.max(0, p.stakeholders.length - 1);
                    const firstName = p.stakeholders[0]?.org.name ?? "—";
                    const deptLabel = TABS.find((t) => t.dept === p.department)?.label ?? "—";
                    return (
                      <tr key={p.id} className="hover:bg-slate-50" data-testid={`row-project-${p.id}`}>
                        <td className="p-3">
                          <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-blue-700">{p.name}</Link>
                          <div className="text-[11px] font-mono text-slate-500">{p.key} · {deptLabel}</div>
                        </td>
                        <td className="p-3 text-xs text-slate-700">
                          {firstName}
                          {extras > 0 && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">+{extras}</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                              <div className={`h-full ${healthBar[p.health]}`} style={{ width: `${p.progress}%` }} />
                            </div>
                            <span className="text-xs font-medium text-slate-700">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${healthBadge[p.health]}`} data-testid={`status-${p.id}`}>
                            {p.health}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-slate-700">{p.endDate ? formatDateVn(p.endDate) : "—"}</td>
                        <td className="p-3 text-right">
                          <Link href={`/projects/${p.id}`} className="text-xs text-blue-600 hover:underline" title="Xem dự án">✎</Link>
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
              <span className="text-[11px] text-slate-500">theo tất cả dự án truy cập được</span>
            </div>
          </CardHeader>
          <CardBody>
            {distTotal === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Chưa có dữ liệu.</div>
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
