import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn, formatVndShort } from "@atlas/lib";
import { redirect } from "next/navigation";
import { requireProject, AuthError } from "@atlas/auth";
import { StatusUpdateForm, ContractScopeEditor, SummarizeButton, StatusUpdateRowActions } from "./Actions";

export const dynamic = "force-dynamic";

const stakeholderRoleLabel: Record<string, string> = {
  CHU_DAU_TU: "Chủ đầu tư",
  TU_VAN_GIAM_SAT: "Tư vấn giám sát",
  TU_VAN_THIET_KE: "Tư vấn thiết kế",
  NHA_THAU_CHINH: "Nhà thầu chính",
  NHA_THAU_PHU: "Nhà thầu phụ",
  NHA_CUNG_CAP: "Nhà cung cấp",
  CO_QUAN_NHA_NUOC: "Cơ quan QLNN",
};

export default async function TinhHinhPage({ params }: { params: Promise<{ projectId: string }> }) {
  const p = await params;
  try { await requireProject(p.projectId); } catch (e) {
    if (e instanceof AuthError && e.status === 401) redirect(`/signin?callbackUrl=/projects/${p.projectId}/tinh-hinh`);
    redirect("/");
  }

  const [project, updates] = await Promise.all([
    prisma.project.findUnique({
      where: { id: p.projectId },
      include: {
        stakeholders: { include: { org: { select: { id: true, name: true, type: true } } } },
        scheduleTasks: { select: { pctComplete: true } },
      },
    }),
    prisma.projectStatusUpdate.findMany({
      where: { projectId: p.projectId },
      include: { author: { select: { name: true } } },
      orderBy: { reportedAt: "desc" },
      take: 50,
    }),
  ]);
  if (!project) redirect("/");

  const progress = project.scheduleTasks.length === 0
    ? 0
    : Math.round(project.scheduleTasks.reduce((s, t) => s + t.pctComplete, 0) / project.scheduleTasks.length);
  const latestUpdate = updates[0];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      <Card>
        <CardHeader><CardTitle>Tên dự án</CardTitle></CardHeader>
        <CardBody>
          <div className="text-lg font-semibold text-[rgb(var(--ink))]">{project.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[rgb(var(--muted))]">
            <span className="font-mono">{project.key}</span>
            <span>Tỉnh: {project.province ?? "—"}</span>
            <span>Giá trị HĐ: {formatVndShort(project.contractValueVnd)}</span>
            <span>Bắt đầu: {project.startDate ? formatDateVn(project.startDate) : "—"}</span>
            <span>Kết thúc dự kiến: {project.endDate ? formatDateVn(project.endDate) : "—"}</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Nội dung công việc theo Hợp đồng</CardTitle></CardHeader>
        <CardBody>
          <ContractScopeEditor projectId={project.id} initial={project.contractScope} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Các đơn vị thực hiện ({project.stakeholders.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {project.stakeholders.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có đơn vị tham gia.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Đơn vị</th><th className="p-2 text-left">Vai trò</th><th className="p-2 text-left">Loại</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {project.stakeholders.map((s) => (
                  <tr key={s.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-medium">{s.org.name}</td>
                    <td className="p-2"><Badge variant="info">{stakeholderRoleLabel[s.role] ?? s.role}</Badge></td>
                    <td className="p-2 text-xs text-[rgb(var(--muted))]">{s.org.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tình hình thực hiện</CardTitle>
            <div className="flex items-center gap-4 text-xs text-[rgb(var(--muted))]">
              <span>Tiến độ TB: <strong className="text-[rgb(var(--ink))]">{progress}%</strong></span>
              <StatusUpdateForm projectId={project.id} />
            </div>
          </div>
          {updates.length >= 2 && <div className="mt-3"><SummarizeButton projectId={project.id} /></div>}
        </CardHeader>
        <CardBody className="p-0">
          {updates.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có cập nhật tình hình nào. Bấm "+ Cập nhật tình hình" để bắt đầu ghi nhận.</div>
          ) : (
            <ul className="divide-y divide-[rgb(var(--line))]">
              {updates.map((u) => (
                <li key={u.id} className="p-4" data-testid={`row-update-${u.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[rgb(var(--ink))]">{u.title}</div>
                    <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                      {u.pctComplete !== null && <Badge variant="info">{Math.round(u.pctComplete)}%</Badge>}
                      <span>{formatDateVn(u.reportedAt)}</span>
                    </div>
                  </div>
                  <div className="mt-1 whitespace-pre-line text-sm text-[rgb(var(--ink-2))]">{u.body}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[rgb(var(--muted))]"><span>— {u.author?.name ?? "Hệ thống"}</span><StatusUpdateRowActions projectId={project.id} updateId={u.id} /></div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {latestUpdate && (
        <div className="text-[11px] text-[rgb(var(--muted))]">Cập nhật gần nhất: {formatDateVn(latestUpdate.reportedAt)} — "{latestUpdate.title}"</div>
      )}
    </div>
  );
}
