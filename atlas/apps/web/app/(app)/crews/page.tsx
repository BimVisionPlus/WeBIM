import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  PLANNED: { vn: "Kế hoạch", variant: "neutral" },
  IN_PROGRESS: { vn: "Đang làm", variant: "info" },
  BLOCKED: { vn: "Bị chặn", variant: "danger" },
  DONE: { vn: "Xong", variant: "success" },
  REVIEWED: { vn: "Đã xác nhận", variant: "violet" },
};

const shiftLabel: Record<string, string> = { DAY: "Ngày", NIGHT: "Đêm", FULL: "Cả ngày" };

export default async function CrewsOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/crews");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const projects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true } });
  const projectIds = projects.map((p) => p.id);
  const keyOf = (id: string) => projects.find((p) => p.id === id)?.key ?? "—";

  const [crews, assignments] = await Promise.all([
    prisma.crew.findMany({
      where: { projectId: { in: projectIds } },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 100,
    }),
    prisma.crewAssignment.findMany({
      where: { projectId: { in: projectIds } },
      include: { crew: { select: { name: true, trade: true } } },
      orderBy: { workDate: "desc" },
      take: 60,
    }),
  ]);

  const activeCrews = crews.filter((c) => c.active).length;
  const totalHeadcount = crews.filter((c) => c.active).reduce((s, c) => s + c.headcount, 0);
  const blocked = assignments.filter((a) => a.state === "BLOCKED").length;
  const inProgress = assignments.filter((a) => a.state === "IN_PROGRESS").length;

  // Group assignments by state for a simple kanban-ish view
  const cols: Array<{ state: string; items: typeof assignments }> = [
    { state: "PLANNED", items: assignments.filter((a) => a.state === "PLANNED") },
    { state: "IN_PROGRESS", items: assignments.filter((a) => a.state === "IN_PROGRESS") },
    { state: "BLOCKED", items: assignments.filter((a) => a.state === "BLOCKED") },
    { state: "DONE", items: assignments.filter((a) => ["DONE", "REVIEWED"].includes(a.state)) },
  ];

  return (
    <AecModuleShell
      group="Thi công"
      name="Crews — Tổ đội & look-ahead"
      subtitle="Phân công tổ đội theo ca/ngày, kế hoạch 1-2 tuần (look-ahead). Tổ bị chặn (đợi vật tư/bản vẽ/nghiệm thu) được đánh dấu để xử lý nhanh."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổ đội đang hoạt động</div><div className="mt-1 text-2xl font-bold text-emerald-700">{activeCrews}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng quân số</div><div className="mt-1 text-2xl font-bold">{totalHeadcount}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đang thi công</div><div className="mt-1 text-2xl font-bold text-blue-700">{inProgress}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Bị chặn cần xử lý</div><div className="mt-1 text-2xl font-bold text-rose-700">{blocked}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Tổ đội ({crews.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {crews.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có tổ đội nào. Đăng ký tổ đội (tổ thép, tổ MEP, tổ hoàn thiện…) cho dự án để bắt đầu phân công look-ahead.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Tổ</th>
                  <th className="p-2 text-left">Nghề</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Tổ trưởng</th>
                  <th className="p-2 text-right">Quân số</th>
                  <th className="p-2 text-right">Phân công</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {crews.map((c) => (
                  <tr key={c.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-medium text-xs">{c.name}</td>
                    <td className="p-2 text-xs">{c.trade}</td>
                    <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{keyOf(c.projectId)}</td>
                    <td className="p-2 text-xs">{c.foremanName ?? "—"}</td>
                    <td className="p-2 text-right text-xs">{c.headcount}</td>
                    <td className="p-2 text-right text-xs">{c._count.assignments}</td>
                    <td className="p-2">{c.active ? <Badge variant="success">Hoạt động</Badge> : <Badge variant="neutral">Tạm nghỉ</Badge>}</td>
                    <td className="p-2"><RowActions id={c.id} hasAssignments={c._count.assignments > 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Bảng look-ahead ({assignments.length} phân công gần đây)</CardTitle></CardHeader>
        <CardBody>
          {assignments.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có phân công nào. Lập kế hoạch ca/ngày cho từng tổ tại đây.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {cols.map((col) => {
                const meta = stateLabel[col.state] ?? { vn: col.state, variant: "neutral" as const };
                return (
                  <div key={col.state} className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--raised))]/50">
                    <div className="flex items-center justify-between border-b border-[rgb(var(--line))] px-3 py-2">
                      <Badge variant={meta.variant}>{meta.vn}</Badge>
                      <span className="text-xs text-[rgb(var(--muted))]">{col.items.length}</span>
                    </div>
                    <div className="space-y-2 p-2">
                      {col.items.slice(0, 12).map((a) => (
                        <div key={a.id} className="rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2 text-xs">
                          <div className="font-medium line-clamp-2">{a.title}</div>
                          <div className="mt-1 text-[10px] text-[rgb(var(--muted))]">{a.crew.name} · {a.crew.trade}</div>
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-[rgb(var(--muted-2))]">
                            <span>{a.zone ?? ""}</span>
                            <span>{formatDateVn(a.workDate)} · {shiftLabel[a.shift] ?? a.shift}</span>
                          </div>
                          {a.state === "BLOCKED" && a.blockedReason && (
                            <div className="mt-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">⚠ {a.blockedReason}</div>
                          )}
                        </div>
                      ))}
                      {col.items.length === 0 && <div className="px-1 py-2 text-[11px] text-[rgb(var(--muted-2))]">—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-3 text-[11px] text-[rgb(var(--muted))]">
        Tổ bị chặn (BLOCKED) thường do đợi vật tư · bản vẽ phê duyệt · nghiệm thu công việc trước. Liên kết với Daily Log + NCR để truy nguyên.
      </div>
    </AecModuleShell>
  );
}
