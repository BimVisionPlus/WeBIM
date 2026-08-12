import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { StartRun, TaskRow } from "./Actions";

export const dynamic = "force-dynamic";

const DEPT_LABEL: Record<string, string> = {
  CONG_VIEC: "Công việc / dự án",
  DAU_THAU: "Đấu thầu",
  HANH_CHINH: "Hành chính",
  TAI_CHINH_KE_TOAN: "Tài chính — kế toán",
  PHAT_TRIEN_THI_TRUONG: "Phát triển thị trường",
  CONG_VIEC_KHAC: "Khác",
};

const STATUS_LABEL: Record<string, { vn: string; variant: "neutral" | "info" | "success" | "danger" }> = {
  PENDING: { vn: "Chưa bắt đầu", variant: "neutral" },
  IN_PROGRESS: { vn: "Đang làm", variant: "info" },
  DONE: { vn: "Xong", variant: "success" },
  BLOCKED: { vn: "Tắc", variant: "danger" },
};

export default async function ProcessesPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/processes");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const templates = await prisma.processTemplate.findMany({
    where: { orgId: { in: orgIds }, isActive: true },
    include: { steps: { orderBy: { seq: "asc" } }, _count: { select: { runs: true } } },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  const runs = await prisma.processRun.findMany({
    where: { template: { orgId: { in: orgIds } } },
    include: {
      template: { select: { name: true, isoCode: true, kind: true } },
      tasks: { include: { step: true }, orderBy: { step: { seq: "asc" } } },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  const projects = await prisma.project.findMany({
    where: { ownerOrgId: { in: orgIds } },
    select: { id: true, key: true, name: true },
    orderBy: { key: "asc" },
  });

  const users = await prisma.user.findMany({
    where: { memberships: { some: { orgId: { in: orgIds } } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const byDept = new Map<string, typeof templates>();
  for (const template of templates) {
    const list = byDept.get(template.department) ?? [];
    list.push(template);
    byDept.set(template.department, list);
  }

  const openRuns = runs.filter((run) => run.status !== "DONE").length;
  const openGates = runs.flatMap((run) =>
    run.tasks.filter((task) => task.step.isGate && task.status !== "DONE"),
  ).length;
  const unassigned = runs.flatMap((run) =>
    run.tasks.filter((task) => !task.assigneeUserId && task.status !== "DONE"),
  ).length;

  return (
    <AecModuleShell
      group="Quản trị"
      name="Quy trình — phối hợp &amp; chuyển giai đoạn"
      subtitle="Quy trình ISO theo phòng ban, và bộ tiêu chí chuyển giai đoạn. Áp vào dự án là sinh việc: có người phụ trách, hạn và tiến độ trên từng bước."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Quy trình</div><div className="mt-1 text-2xl font-bold">{templates.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đang chạy</div><div className="mt-1 text-2xl font-bold text-blue-700">{openRuns}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Điểm dừng chưa đạt</div><div className={`mt-1 text-2xl font-bold ${openGates > 0 ? "text-amber-700" : ""}`}>{openGates}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Bước chưa giao</div><div className={`mt-1 text-2xl font-bold ${unassigned > 0 ? "text-rose-700" : ""}`}>{unassigned}</div></CardBody></Card>
      </div>

      {[...byDept.entries()].map(([dept, list]) => (
        <Card className="mt-4" key={dept}>
          <CardHeader><CardTitle>{DEPT_LABEL[dept] ?? dept}</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Mã ISO</th>
                  <th className="p-2 text-left">Tên quy trình</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Các bước</th>
                  <th className="p-2 text-left">Áp dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {list.map((template) => (
                  <tr key={template.id} className="align-top hover:bg-[rgb(var(--raised))]" data-testid={`template-${template.isoCode}`}>
                    <td className="p-2 font-mono text-xs">{template.isoCode ?? "—"}</td>
                    <td className="p-2 text-xs">
                      <div className="font-medium">{template.name}</div>
                      {template.description && (
                        <div className="text-[11px] text-[rgb(var(--muted))]">{template.description}</div>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge variant={template.kind === "STAGE_GATE" ? "warning" : "info"}>
                        {template.kind === "STAGE_GATE" ? "Chuyển giai đoạn" : "Phối hợp"}
                      </Badge>
                    </td>
                    <td className="p-2 text-[11px]">
                      <ol className="list-decimal pl-4">
                        {template.steps.map((step) => (
                          <li key={step.id} className="mb-0.5">
                            <span className="font-medium">{step.title}</span>
                            {step.isGate && <span className="ml-1 text-amber-700">◆ điểm dừng</span>}
                            <span className="text-[rgb(var(--muted))]"> · {step.slaDays} ngày</span>
                            {step.criteria && (
                              <div className="text-[rgb(var(--muted))]">Tiêu chí: {step.criteria}</div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </td>
                    <td className="p-2"><StartRun templateId={template.id} projects={projects} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}

      <Card className="mt-6">
        <CardHeader><CardTitle>Đang chạy ({runs.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {runs.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
              Chưa áp dụng quy trình nào. Bấm “Áp dụng” ở bảng trên.
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--line))]">
              {runs.map((run) => {
                const done = run.tasks.filter((task) => task.status === "DONE").length;
                const gateOpen = run.tasks.some((task) => task.step.isGate && task.status !== "DONE");
                return (
                  <div key={run.id} className="p-3" data-testid={`run-${run.id}`}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{run.template.isoCode}</span>
                      <span className="text-sm font-medium">{run.name}</span>
                      <Badge variant={run.status === "DONE" ? "success" : "info"}>
                        {run.status === "DONE" ? "Đã đóng" : "Đang chạy"}
                      </Badge>
                      <span className="text-xs text-[rgb(var(--muted))]">
                        {done}/{run.tasks.length} bước · mở {formatDateVn(run.startedAt)}
                      </span>
                      {gateOpen && (
                        <span className="text-xs text-amber-700">◆ còn điểm dừng chưa đạt</span>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-[rgb(var(--line))]">
                        {run.tasks.map((task) => {
                          const meta =
                            STATUS_LABEL[task.status] ??
                            { vn: task.status, variant: "neutral" as const };
                          const overdue =
                            task.status !== "DONE" && task.dueAt && task.dueAt < new Date();
                          return (
                            <tr key={task.id} className="align-top">
                              <td className="p-2 text-xs w-8 text-[rgb(var(--muted))]">{task.step.seq}</td>
                              <td className="p-2 text-xs">
                                <div className="font-medium">
                                  {task.step.title}
                                  {task.step.isGate && <span className="ml-1 text-amber-700">◆</span>}
                                </div>
                                {task.step.criteria && (
                                  <div className="text-[11px] text-[rgb(var(--muted))]">{task.step.criteria}</div>
                                )}
                              </td>
                              <td className="p-2 text-xs whitespace-nowrap">
                                {task.dueAt ? formatDateVn(task.dueAt) : "—"}
                                {overdue && <div className="text-[11px] text-rose-700">quá hạn</div>}
                              </td>
                              <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                              <td className="p-2">
                                <TaskRow
                                  taskId={task.id}
                                  assigneeUserId={task.assigneeUserId}
                                  progress={task.progress}
                                  status={task.status}
                                  users={users}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
