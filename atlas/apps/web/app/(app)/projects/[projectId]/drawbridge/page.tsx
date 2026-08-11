import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { ClashDetectButton } from "@/components/drawbridge-clash-detect";
import { relativeDateVn } from "@atlas/lib";

export const dynamic = "force-dynamic";

export default async function DrawBridgePage({ params }: { params: { projectId: string } }) {
  const [models, elements, clashes, links] = await Promise.all([
    prisma.model.findMany({
      where: { projectId: params.projectId },
      include: { _count: { select: { elements: true } } },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.modelElement.groupBy({
      by: ["category"],
      where: { model: { projectId: params.projectId } },
      _count: true,
    }),
    prisma.clash.findMany({
      where: { projectId: params.projectId },
      include: {
        elementA: { select: { name: true, category: true, discipline: true } },
        elementB: { select: { name: true, category: true, discipline: true } },
      },
      orderBy: [{ status: "asc" }, { severity: "desc" }],
      take: 50,
    }),
    prisma.issueElementLink.findMany({
      where: { issue: { projectId: params.projectId } },
      include: {
        issue: { select: { key: true, title: true, type: true, state: true } },
        element: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const elementTotal = elements.reduce((s, e) => s + (e._count as number), 0);
  const openClashes = clashes.filter((c) => c.status === "OPEN" || c.status === "TRIAGED");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">DrawBridge — BIM Intelligence</h2>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Quản lý cấu kiện BIM, clash detection cross-discipline, link cấu kiện ↔ task.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Mô hình BIM</div>
            <div className="mt-1 text-2xl font-bold">{models.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Cấu kiện</div>
            <div className="mt-1 text-2xl font-bold">{elementTotal}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Clash mở</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{openClashes.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Link cấu kiện ↔ Issue</div>
            <div className="mt-1 text-2xl font-bold">{links.length}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Clash detection</CardTitle>
            <ClashDetectButton projectId={params.projectId} disabled={elementTotal === 0} />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {clashes.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
              {elementTotal === 0
                ? "Chưa có cấu kiện. Import IFC/RVT trong tab Models trước, hoặc đẩy elements qua API."
                : "Chưa chạy detection. Bấm \"↻ Chạy clash\"."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Cấu kiện A</th>
                  <th className="p-2 text-left">Cấu kiện B</th>
                  <th className="p-2 text-center">Severity</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Phát hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {clashes.map((c) => (
                  <tr key={c.id}>
                    <td className="p-2">
                      <div className="text-sm">{c.elementA.name}</div>
                      <div className="text-[11px] text-[rgb(var(--muted))]">{c.elementA.discipline} · {c.elementA.category}</div>
                    </td>
                    <td className="p-2">
                      <div className="text-sm">{c.elementB.name}</div>
                      <div className="text-[11px] text-[rgb(var(--muted))]">{c.elementB.discipline} · {c.elementB.category}</div>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={c.severity > 60 ? "danger" : c.severity > 30 ? "warning" : "neutral"}>
                        {c.severity}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge
                        variant={
                          c.status === "OPEN"
                            ? "danger"
                            : c.status === "TRIAGED"
                              ? "warning"
                              : c.status === "RESOLVED"
                                ? "success"
                                : "neutral"
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-[rgb(var(--muted))]">{relativeDateVn(c.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link cấu kiện ↔ Issue</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {links.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có link. Mở 1 RFI/NCR và đính cột/dầm/sàn để truy ngược nguyên nhân.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Issue</th>
                  <th className="p-2 text-left">Cấu kiện</th>
                  <th className="p-2 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {links.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 font-mono text-xs">{l.issue.key} <Badge variant="neutral">{l.issue.type}</Badge></td>
                    <td className="p-2">{l.element.name} <span className="text-[11px] text-[rgb(var(--muted))]">({l.element.category})</span></td>
                    <td className="p-2 text-xs text-[rgb(var(--muted))]">{l.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
