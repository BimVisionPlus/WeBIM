import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { CrewCreateButton, CrewRowEdit } from "@/components/crew-edit";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { variant: "neutral" | "info" | "warning" | "success" | "danger"; vn: string }> = {
  PLANNED: { variant: "neutral", vn: "Lên kế hoạch" },
  IN_PROGRESS: { variant: "info", vn: "Đang làm" },
  BLOCKED: { variant: "warning", vn: "Đợi" },
  DONE: { variant: "success", vn: "Xong ca" },
  REVIEWED: { variant: "success", vn: "TVGS xác nhận" },
};

export default async function CrewsPage({ params }: { params: { projectId: string } }) {
  const [crews, assignments] = await Promise.all([
    prisma.crew.findMany({
      where: { projectId: params.projectId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.crewAssignment.findMany({
      where: {
        projectId: params.projectId,
        workDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0) - 1 * 86_400_000),
          lte: new Date(new Date().setHours(0, 0, 0, 0) + 13 * 86_400_000),
        },
      },
      include: { crew: { select: { name: true, trade: true } } },
      orderBy: [{ workDate: "asc" }, { shift: "asc" }],
    }),
  ]);

  // Group assignments by date
  const byDate = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const k = a.workDate.toISOString().slice(0, 10);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(a);
  }
  const dates = [...byDate.keys()].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Crews — Look-ahead 2 tuần</h2>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Phân công tổ đội theo ca/ngày. Kanban-style: kéo card sang trạng thái mới (UI sắp tới).
          </p>
        </div>
        <CrewCreateButton projectId={params.projectId} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Tổ đội</div>
            <div className="mt-1 text-2xl font-bold">{crews.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Việc trong 2 tuần</div>
            <div className="mt-1 text-2xl font-bold">{assignments.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Đang làm hôm nay</div>
            <div className="mt-1 text-2xl font-bold text-blue-700">
              {assignments.filter((a) => a.state === "IN_PROGRESS").length}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Đang đợi (BLOCKED)</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">
              {assignments.filter((a) => a.state === "BLOCKED").length}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Tổ đội ({crews.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {crews.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có tổ đội. Đăng ký tổ qua <code className="rounded bg-[rgb(var(--raised))] px-1">POST /api/crews</code>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-3 text-left">Tổ</th>
                  <th className="p-3 text-left">Trade</th>
                  <th className="p-3 text-left">Tổ trưởng</th>
                  <th className="p-3 text-center">Quân số</th>
                  <th className="p-3 text-center">Việc 2 tuần</th>
                  <th className="p-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {crews.map((c) => (
                  <tr key={c.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-3 align-top font-medium">{c.name}</td>
                    <td className="p-3 align-top"><Badge variant="neutral">{c.trade}</Badge></td>
                    <td className="p-3 align-top text-[rgb(var(--ink-2))]">{c.foremanName ?? "—"}</td>
                    <td className="p-3 align-top text-center">{c.headcount}</td>
                    <td className="p-3 align-top text-center">{assignments.filter((a) => a.crewId === c.id).length}</td>
                    <td className="p-3 align-top text-right">
                      <CrewRowEdit
                        crew={{
                          id: c.id,
                          name: c.name,
                          trade: c.trade,
                          foremanName: c.foremanName,
                          headcount: c.headcount,
                          active: c.active,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Look-ahead — {dates.length} ngày</CardTitle></CardHeader>
        <CardBody className="p-0">
          {dates.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có công việc nào trong 2 tuần. Tạo qua <code className="rounded bg-[rgb(var(--raised))] px-1">POST /api/crews/assignments</code>.
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--line))]">
              {dates.map((dateKey) => {
                const dayAssignments = byDate.get(dateKey)!;
                return (
                  <div key={dateKey} className="p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="font-mono text-sm font-semibold">{formatDateVn(new Date(dateKey))}</div>
                      <span className="text-xs text-[rgb(var(--muted))]">{dayAssignments.length} công việc</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {dayAssignments.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 text-xs hover:border-blue-300"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant={stateLabel[a.state]?.variant ?? "neutral"}>
                              {stateLabel[a.state]?.vn ?? a.state}
                            </Badge>
                            <Badge variant="neutral">{a.shift === "DAY" ? "Ca ngày" : "Ca đêm"}</Badge>
                          </div>
                          <div className="mt-2 font-medium text-[rgb(var(--ink))]">{a.title}</div>
                          <div className="mt-1 text-[11px] text-[rgb(var(--muted))]">
                            {a.crew.name} ({a.crew.trade}) {a.zone ? `· ${a.zone}` : ""}
                          </div>
                          {a.blockedReason && (
                            <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                              Đợi: {a.blockedReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
