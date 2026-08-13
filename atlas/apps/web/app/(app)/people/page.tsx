import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { personStats, rateNote, MIN_SAMPLE } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

function Rate({ value, sample }: { value: number | null; sample: number }) {
  if (value === null) {
    return (
      <span className="text-xs text-[rgb(var(--muted))]" title={`Cần tối thiểu ${MIN_SAMPLE} mẫu`}>
        {rateNote(sample)}
      </span>
    );
  }
  return <span className="font-medium">{value}%</span>;
}

export default async function PeoplePage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/people");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const users = await prisma.user.findMany({
    where: { memberships: { some: { orgId: { in: orgIds } } } },
    select: { id: true, name: true, email: true, memberships: { select: { role: true } } },
    orderBy: { name: "asc" },
  });

  const tasks = await prisma.processTask.findMany({
    where: { run: { template: { orgId: { in: orgIds } } } },
    select: {
      assigneeUserId: true,
      status: true,
      dueAt: true,
      decidedAt: true,
      step: { select: { isGate: true } },
    },
  });

  const projectFilter = { ownerOrgId: { in: orgIds } };
  const issues = await prisma.issue.findMany({
    where: { project: projectFilter },
    select: { assigneeId: true, closedAt: true, dueDate: true },
  });
  const checks = await prisma.qaqcCheck.findMany({
    where: { project: projectFilter },
    select: { inspectorUserId: true, result: true },
  });

  const stats = personStats({
    userIds: users.map((user) => user.id),
    tasks: tasks.map((task) => ({
      assigneeUserId: task.assigneeUserId,
      status: task.status,
      dueAt: task.dueAt,
      decidedAt: task.decidedAt,
      isGate: task.step.isGate,
    })),
    issues,
    checks,
    now: new Date(),
  });

  const byId = new Map(stats.map((row) => [row.userId, row]));
  const totalOverdue = stats.reduce((sum, row) => sum + row.tasksOverdueOpen, 0);
  const totalGatesOpen = stats.reduce((sum, row) => sum + row.gatesOpen, 0);
  const unassigned = tasks.filter(
    (task) => !task.assigneeUserId && task.status !== "DONE",
  ).length;

  return (
    <AecModuleShell
      group="Quản trị"
      name="Nhân sự — tham gia &amp; hoàn thành"
      subtitle="Thống kê từ bước quy trình, issue và nghiệm thu. Đây là số liệu để bắt đầu một cuộc trao đổi, không phải điểm số xếp hạng."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Nhân sự</div><div className="mt-1 text-2xl font-bold">{users.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Bước quá hạn</div><div className={`mt-1 text-2xl font-bold ${totalOverdue > 0 ? "text-rose-700" : ""}`}>{totalOverdue}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Điểm dừng đang mở</div><div className={`mt-1 text-2xl font-bold ${totalGatesOpen > 0 ? "text-amber-700" : ""}`}>{totalGatesOpen}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Bước chưa giao</div><div className="mt-1 text-2xl font-bold">{unassigned}</div></CardBody></Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Theo từng người ({users.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
              <tr>
                <th className="p-2 text-left">Người</th>
                <th className="p-2 text-left">Bước quy trình</th>
                <th className="p-2 text-left">Đúng hạn</th>
                <th className="p-2 text-left">Hoàn thành</th>
                <th className="p-2 text-left">Điểm dừng</th>
                <th className="p-2 text-left">Issue</th>
                <th className="p-2 text-left">Nghiệm thu không đạt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--line))]">
              {users.map((user) => {
                const row = byId.get(user.id)!;
                return (
                  <tr key={user.id} className="align-top hover:bg-[rgb(var(--raised))]" data-testid={`person-${user.id}`}>
                    <td className="p-2 text-xs">
                      <div className="font-medium">{user.name ?? user.email}</div>
                      <div className="text-[11px] text-[rgb(var(--muted))]">
                        {user.memberships[0]?.role ?? "—"}
                      </div>
                    </td>
                    <td className="p-2 text-xs">
                      {row.tasksDone}/{row.tasksAssigned} xong
                      {row.tasksOverdueOpen > 0 && (
                        <div className="text-[11px] text-rose-700">{row.tasksOverdueOpen} quá hạn</div>
                      )}
                    </td>
                    <td className="p-2 text-xs">
                      <Rate value={row.onTimeRate} sample={row.tasksDoneOnTime + row.tasksDoneLate} />
                      <div className="text-[11px] text-[rgb(var(--muted))]">
                        {row.tasksDoneOnTime} đúng · {row.tasksDoneLate} trễ
                      </div>
                    </td>
                    <td className="p-2 text-xs">
                      <Rate value={row.completionRate} sample={row.tasksAssigned} />
                    </td>
                    <td className="p-2 text-xs">
                      {row.gatesOwned === 0 ? "—" : `${row.gatesOwned - row.gatesOpen}/${row.gatesOwned}`}
                      {row.gatesOpen > 0 && <Badge variant="warning">◆ {row.gatesOpen} mở</Badge>}
                    </td>
                    <td className="p-2 text-xs">
                      {row.issuesClosed}/{row.issuesAssigned} đóng
                      {row.issuesOverdueOpen > 0 && (
                        <div className="text-[11px] text-rose-700">{row.issuesOverdueOpen} quá hạn</div>
                      )}
                    </td>
                    <td className="p-2 text-xs">
                      {row.checksDone === 0 ? (
                        <span className="text-[rgb(var(--muted))]">chưa có</span>
                      ) : (
                        <>
                          <Rate value={row.failureRate} sample={row.checksDone} />
                          <div className="text-[11px] text-[rgb(var(--muted))]">
                            {row.checksFailed}/{row.checksDone}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Đọc bảng này thế nào</CardTitle></CardHeader>
        <CardBody className="text-sm text-[rgb(var(--muted))]">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Tỷ lệ chỉ hiện khi có tối thiểu <strong>{MIN_SAMPLE} mẫu</strong>. Dưới mức
              đó bảng ghi “mẫu quá nhỏ” chứ không hiện 0% — 0% trên một việc là
              thông tin về việc đó, không phải về con người.
            </li>
            <li>
              Bước không có hạn thì không thể trễ, nên bị loại khỏi mẫu số “đúng
              hạn” thay vì mặc định tính là đúng hạn.
            </li>
            <li>
              Nghiệm thu còn <em>đang chờ</em> không được tính là đạt.
            </li>
            <li>
              Bảng không xếp hạng và không chấm điểm. Khối lượng, độ khó và bối
              cảnh của từng người khác nhau; con số ở đây để mở đầu một cuộc trao
              đổi, không phải để kết luận.
            </li>
          </ul>
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
