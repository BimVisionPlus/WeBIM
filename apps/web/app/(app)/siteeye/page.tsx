import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const sevVariant: Record<string, "info" | "warning" | "danger" | "neutral"> = {
  NEAR_MISS: "neutral", MINOR: "info", MAJOR: "warning", CRITICAL: "danger",
};
const categoryLabel: Record<string, string> = {
  AN_TOAN_LAO_DONG: "ATLĐ",
  CHAY_NO: "Cháy nổ",
  SUP_DO: "Sụp đổ",
  ROI_NGA: "Rơi/ngã",
  DIEN_GIAT: "Điện",
  HOA_CHAT: "Hóa chất",
  GIAO_THONG: "Giao thông",
  KHAC: "Khác",
};
const visionLabel: Record<string, string> = {
  PPE_VIOLATION: "Vi phạm PPE",
  WORKER_COUNT: "Đếm người",
  INTRUSION: "Xâm nhập",
  FIRE_SMOKE: "Khói/lửa",
  CRANE_SWING: "Cẩu đung đưa",
};

export default async function SiteEyeOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/siteeye");

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

  const [incidents, visionEvents, cameras] = await Promise.all([
    prisma.incidentReport.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { occurredAt: "desc" },
      take: 50,
    }),
    prisma.visionEvent.findMany({
      where: { projectId: { in: projectIds }, acknowledged: false },
      orderBy: { ts: "desc" },
      take: 50,
    }),
    prisma.siteCamera.findMany({ where: { projectId: { in: projectIds }, active: true } }),
  ]);
  const openIncidents = incidents.filter((i) => !i.closedAt);
  const fatalCount = incidents.filter((i) => i.severity === "CRITICAL").length;

  return (
    <AecModuleShell
      group="Thi công"
      name="SiteEye"
      subtitle="Giám sát công trường AI — PPE detection (Qwen2.5-VL), incident log Luật ATVSLĐ 84/2015."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Camera đang hoạt động</div><div className="mt-1 text-2xl font-bold">{cameras.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Cảnh báo CV chưa ack</div><div className="mt-1 text-2xl font-bold text-amber-700">{visionEvents.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Sự cố mở</div><div className="mt-1 text-2xl font-bold text-rose-700">{openIncidents.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tai nạn nghiêm trọng (mọi thời điểm)</div><div className="mt-1 text-2xl font-bold text-rose-900">{fatalCount}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sự cố ATVSLĐ — Luật 84/2015 ({incidents.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {incidents.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Chưa ghi nhận sự cố ATVSLĐ nào. Khi có tai nạn/sự cố trên công trường, ghi nhận tại đây để lập biên bản theo Luật ATVSLĐ 84/2015.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {incidents.slice(0, 20).map((i) => (
                  <li key={i.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={sevVariant[i.severity]}>{i.severity}</Badge>
                      <Badge variant="neutral">{categoryLabel[i.category] ?? i.category}</Badge>
                      <span className="font-mono text-xs text-slate-500">{projectById.get(i.projectId)?.key ?? ""}</span>
                      {i.closedAt && <Badge variant="success">Đã đóng</Badge>}
                    </div>
                    <div className="mt-1 text-slate-900">{i.description.slice(0, 140)}{i.description.length > 140 ? "…" : ""}</div>
                    <div className="mt-1"><RowActions id={i.id} severity={i.severity} closedAt={i.closedAt} /></div><div className="text-[11px] text-slate-500">
                      {formatDateVn(i.occurredAt)} · {i.location ?? "—"}
                      {i.injured > 0 && <> · {i.injured} người bị thương</>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cảnh báo computer vision ({visionEvents.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {visionEvents.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Không có cảnh báo chưa xử lý.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visionEvents.slice(0, 20).map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">{visionLabel[v.kind] ?? v.kind}</Badge>
                        <span className="font-mono text-xs text-slate-500">{projectById.get(v.projectId)?.key ?? ""}</span>
                      </div>
                      <div className="mt-0.5 text-slate-900">{v.label}</div>
                      <div className="text-[11px] text-slate-500">{formatDateVn(v.ts)} · confidence {(v.confidence * 100).toFixed(0)}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
