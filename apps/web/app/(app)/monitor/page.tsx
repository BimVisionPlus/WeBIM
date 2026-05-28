import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, MeasureAction } from "./Actions";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  SETTLEMENT: "Lún (mm)", TILT: "Nghiêng (°)", PIEZOMETER: "Áp lực nước (m)",
  STRAIN: "Biến dạng (µε)", CRACK: "Khe nứt (mm)", VIBRATION: "Rung (mm/s)",
  TEMPERATURE: "Nhiệt độ BT (°C)",
};

const levelLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  NORMAL: { vn: "Bình thường", variant: "success" },
  WARN: { vn: "Cảnh báo", variant: "warning" },
  ALERT: { vn: "Nguy hiểm", variant: "danger" },
};

export default async function MonitorWatchPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/monitor");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const points = await prisma.monitorPoint.findMany({
    where: { project: projectFilter, active: true },
    include: {
      project: { select: { key: true } },
      measurements: { orderBy: { measuredAt: "desc" }, take: 1 },
    },
    orderBy: [{ monitorType: "asc" }, { pointCode: "asc" }],
    take: 100,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  const recentAlerts = await prisma.monitorMeasurement.findMany({
    where: { alertLevel: { in: ["WARN", "ALERT"] }, point: { project: projectFilter } },
    include: { point: { select: { pointCode: true, monitorType: true, unit: true, project: { select: { key: true } } } } },
    orderBy: { measuredAt: "desc" },
    take: 20,
  });

  const totalPoints = points.length;
  const inAlert = points.filter((p) => p.measurements[0]?.alertLevel === "ALERT").length;
  const inWarn = points.filter((p) => p.measurements[0]?.alertLevel === "WARN").length;
  const byType = new Map<string, number>();
  points.forEach((p) => byType.set(p.monitorType, (byType.get(p.monitorType) ?? 0) + 1));

  return (
    <AecModuleShell
      group="Thi công"
      name="MonitorWatch — Quan trắc kết cấu"
      subtitle="Quan trắc lún/nghiêng/áp lực nước/biến dạng/khe nứt/rung. Total station + inclinometer + piezometer. Vượt ngưỡng → auto-NCR + email."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Điểm quan trắc</div><div className="mt-1 text-2xl font-bold">{totalPoints}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">🔴 Nguy hiểm</div><div className="mt-1 text-2xl font-bold text-rose-700">{inAlert}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">🟡 Cảnh báo</div><div className="mt-1 text-2xl font-bold text-amber-700">{inWarn}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Loại quan trắc</div><div className="mt-1 text-2xl font-bold">{byType.size}</div></CardBody></Card>
      </div>

      {recentAlerts.length > 0 && (
        <Card className="mt-6 border-l-4 border-l-rose-500">
          <CardHeader><CardTitle>🚨 Cảnh báo gần đây ({recentAlerts.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Thời điểm</th><th className="p-2 text-left">Điểm</th><th className="p-2 text-left">Loại</th><th className="p-2 text-right">Giá trị</th><th className="p-2 text-left">Mức</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAlerts.map((m) => {
                  const lm = levelLabel[m.alertLevel] ?? { vn: m.alertLevel, variant: "neutral" as const };
                  return (
                    <tr key={m.id} className={`hover:bg-slate-50 ${m.alertLevel === "ALERT" ? "bg-rose-50" : "bg-amber-50"}`}>
                      <td className="p-2 text-xs">{formatDateVn(m.measuredAt)} {m.measuredAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-2 font-mono text-xs">{m.point.pointCode}<div className="text-[10px] text-slate-500">{m.point.project.key}</div></td>
                      <td className="p-2 text-xs">{typeLabel[m.point.monitorType]}</td>
                      <td className="p-2 text-right text-xs font-medium">{Number(m.value).toFixed(2)} {m.point.unit}</td>
                      <td className="p-2"><Badge variant={lm.variant}>{lm.vn}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Điểm quan trắc ({totalPoints})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {totalPoints === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có điểm quan trắc. Bấm “Thêm điểm quan trắc” để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã điểm</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Mô tả</th>
                  <th className="p-2 text-right">Giá trị hiện tại</th>
                  <th className="p-2 text-right">Ngưỡng cảnh báo</th>
                  <th className="p-2 text-left">Mức</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {points.map((p) => {
                  const last = p.measurements[0];
                  const level = last?.alertLevel ?? "NORMAL";
                  const lm = levelLabel[level] ?? { vn: level, variant: "neutral" as const };
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 ${level === "ALERT" ? "bg-rose-50" : level === "WARN" ? "bg-amber-50" : ""}`} data-testid={`point-${p.pointCode}`}>
                      <td className="p-2 font-mono text-xs">{p.pointCode}</td>
                      <td className="p-2 text-xs">{typeLabel[p.monitorType]}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{p.project.key}</td>
                      <td className="p-2 text-xs">{p.description ?? "—"}</td>
                      <td className="p-2 text-right text-xs font-medium">{last ? `${Number(last.value).toFixed(2)} ${p.unit}` : "—"}{last && <div className="text-[10px] text-slate-500">{formatDateVn(last.measuredAt)}</div>}</td>
                      <td className="p-2 text-right text-xs text-slate-500">{p.thresholdWarn ? `W ${Number(p.thresholdWarn).toFixed(1)} / A ${Number(p.thresholdAlert).toFixed(1)} ${p.unit}` : "—"}</td>
                      <td className="p-2" data-testid={`level-${p.pointCode}`}><Badge variant={lm.variant}>{lm.vn}</Badge></td>
                      <td className="p-2"><MeasureAction id={p.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-3 text-[11px] text-slate-500">
        Pipeline: thiết bị Leica/Trimble/Topcon ghi data CSV/binary → worker parse + chuyển vào MonitorMeasurement.
        Vượt ngưỡng W → email TVGS; vượt A → auto-NCR + push CĐT + tạm dừng thi công vùng liên quan.
      </div>
    </AecModuleShell>
  );
}
