import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { ClashScan } from "./ClashScan";

export const dynamic = "force-dynamic";

const disciplineLabel: Record<string, string> = {
  KIEN_TRUC: "Kiến trúc",
  KET_CAU: "Kết cấu",
  CO_DIEN_M: "M&E HVAC",
  CO_DIEN_E: "M&E Điện",
  CO_DIEN_P: "M&E Nước",
  PCCC: "PCCC",
  CANH_QUAN: "Cảnh quan",
  HA_TANG: "Hạ tầng",
  NOI_THAT: "Nội thất",
};

const clashStatusVariant: Record<string, "info" | "warning" | "danger" | "success" | "neutral"> = {
  OPEN: "danger", IN_REVIEW: "warning", RESOLVED: "success", IGNORED: "neutral",
};

export default async function DrawBridgeOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/drawbridge");

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

  const [drawingSets, models, clashes, elementCount] = await Promise.all([
    prisma.drawingSet.findMany({
      where: { projectId: { in: projectIds } },
      include: { _count: { select: { sheets: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.model.findMany({
      where: { projectId: { in: projectIds } },
      include: { _count: { select: { elements: true } } },
      orderBy: { uploadedAt: "desc" },
      take: 30,
    }),
    prisma.clash.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ status: "asc" }, { severity: "desc" }],
      take: 50,
    }),
    prisma.modelElement.count({ where: { model: { projectId: { in: projectIds } } } }),
  ]);

  const openClashes = clashes.filter((c) => c.status === "OPEN").length;
  const currentSets = drawingSets.filter((d) => d.isCurrent).length;
  const apsReady = models.filter((m) => m.apsTranslationStatus === "SUCCESS").length;

  return (
    <AecModuleShell
      group="Thiết kế"
      name="Drawbridge"
      subtitle="Q&A bản vẽ. Versioning R0/R1/IFC. BIM element registry + clash detection cross-discipline (AABB)."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Bộ bản vẽ</div><div className="mt-1 text-2xl font-bold">{drawingSets.length}</div><div className="text-[10px] text-slate-500">{currentSets} đang dùng (IFC)</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Mô hình BIM</div><div className="mt-1 text-2xl font-bold">{models.length}</div><div className="text-[10px] text-slate-500">{apsReady} sẵn sàng xem 3D</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Phần tử BIM</div><div className="mt-1 text-2xl font-bold">{elementCount.toLocaleString("vi-VN")}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Clash đang mở</div><div className="mt-1 text-2xl font-bold text-rose-700">{openClashes}</div></CardBody></Card>
      </div>

      <div className="mt-6"><ClashScan projects={projects} /></div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bộ bản vẽ ({drawingSets.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {drawingSets.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Chưa tải lên bản vẽ.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {drawingSets.map((d) => (
                  <li key={d.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{projectById.get(d.projectId)?.key ?? ""}</span>
                      <Badge variant="neutral">{disciplineLabel[d.discipline] ?? d.discipline}</Badge>
                      <Badge variant={d.revision === "IFC" ? "success" : "info"}>{d.revision}</Badge>
                      {d.isCurrent && <Badge variant="violet">Đang dùng</Badge>}
                    </div>
                    <div className="mt-1 font-medium text-slate-900">{d.name}</div>
                    <div className="text-[11px] text-slate-500">{d._count.sheets} sheet · phát hành {d.issuedDate ? formatDateVn(d.issuedDate) : "—"}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Clash gần nhất ({clashes.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {clashes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Chưa phát hiện xung đột (clash) nào. Tải mô hình BIM lên mục Models rồi bấm
                “Kiểm tra xung đột” để hệ thống tự dò va chạm giữa các bộ môn (kết cấu · MEP · kiến trúc).
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {clashes.slice(0, 20).map((c) => (
                  <li key={c.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={clashStatusVariant[c.status]}>{c.status}</Badge>
                      <Badge variant={c.category === "HARD" ? "danger" : "warning"}>{c.category}</Badge>
                      <span className="font-mono text-xs text-slate-500">{projectById.get(c.projectId)?.key ?? ""}</span>
                      <span className="text-xs text-slate-500">severity {c.severity}</span>
                    </div>
                    <div className="mt-1 text-slate-900 line-clamp-1">{c.description ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{formatDateVn(c.detectedAt)}</div>
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
