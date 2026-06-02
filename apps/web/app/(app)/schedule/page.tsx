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
  IN_PROGRESS: { vn: "Đang thi công", variant: "warning" },
  ON_HOLD: { vn: "Tạm dừng", variant: "danger" },
  DONE: { vn: "Hoàn thành", variant: "success" },
  CANCELLED: { vn: "Hủy", variant: "neutral" },
};

export default async function ScheduleOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/schedule");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    select: { id: true, key: true, name: true },
  });
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectIds = projects.map((p) => p.id);

  const tasks = await prisma.scheduleTask.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: [{ plannedStart: "asc" }],
    take: 200,
  });

  const now = new Date();
  const inProgress = tasks.filter((t) => t.state === "IN_PROGRESS").length;
  const overdue = tasks.filter((t) => t.state !== "DONE" && t.state !== "CANCELLED" && t.plannedEnd < now).length;
  const criticalPath = tasks.filter((t) => t.isCritical).length;
  const avgProgress = tasks.length === 0 ? 0 : Math.round(tasks.reduce((s, t) => s + t.pctComplete, 0) / tasks.length);

  return (
    <AecModuleShell
      group="Thi công"
      name="Tiến độ dự án"
      subtitle="Gantt + đường găng (CPM). AI rủi ro chậm tiến độ từ daily log + weather forecast."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng task</div><div className="mt-1 text-2xl font-bold">{tasks.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang thi công</div><div className="mt-1 text-2xl font-bold text-amber-700">{inProgress}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Quá hạn</div><div className="mt-1 text-2xl font-bold text-rose-700">{overdue}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đường găng</div><div className="mt-1 text-2xl font-bold text-violet-700">{criticalPath}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Lịch thi công ({tasks.length}) — tiến độ trung bình {avgProgress}%</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có công việc nào trong lịch thi công. Bấm “Thêm công việc (task)” ở trên để lập tiến độ.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">WBS</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Task</th>
                  <th className="p-2 text-left">Bắt đầu</th>
                  <th className="p-2 text-left">Kết thúc</th>
                  <th className="p-2 text-right">Tiến độ</th>
                  <th className="p-2 text-left">Trạng thái</th><th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => {
                  const meta = stateLabel[t.state] ?? { vn: t.state, variant: "neutral" as const };
                  const slipping = t.state !== "DONE" && t.state !== "CANCELLED" && t.plannedEnd < now;
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50 ${slipping ? "bg-rose-50/40" : ""} ${t.isCritical ? "border-l-2 border-violet-400" : ""}`}>
                      <td className="p-2 font-mono text-xs">{t.code}{t.isCritical && <Badge variant="violet" className="ml-1">CP</Badge>}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{projectById.get(t.projectId)?.key ?? ""}</td>
                      <td className="p-2">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-[11px] text-slate-500">{t.discipline ?? ""} {t.zone ? `· ${t.zone}` : ""}</div>
                      </td>
                      <td className="p-2 text-xs text-slate-600">{formatDateVn(t.plannedStart)}</td>
                      <td className={`p-2 text-xs ${slipping ? "text-rose-700 font-medium" : "text-slate-600"}`}>{formatDateVn(t.plannedEnd)}</td>
                      <td className="p-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-slate-200 overflow-hidden">
                            <div className={`h-full ${slipping ? "bg-rose-500" : t.state === "DONE" ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${t.pctComplete}%` }} />
                          </div>
                          <span className="text-xs font-medium">{Math.round(t.pctComplete)}%</span>
                        </div>
                      </td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td><td className="p-2"><RowActions id={t.id} state={t.state} pctComplete={t.pctComplete} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 text-xs text-slate-500">
        CP = Critical Path. Task trên đường găng quyết định tổng thời gian dự án — chậm 1 ngày = dự án chậm 1 ngày.
      </div>
    </AecModuleShell>
  );
}
