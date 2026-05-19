import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateTimeVn, relativeDateVn } from "@atlas/lib";
import { IncidentCreateButton } from "@/components/siteeye-incident-create";
import { WeatherRefreshButton } from "@/components/siteeye-weather-refresh";

export const dynamic = "force-dynamic";

const severityVariant: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  NEAR_MISS: "neutral",
  MINOR: "info",
  MAJOR: "warning",
  CRITICAL: "danger",
};

const catLabel: Record<string, string> = {
  AN_TOAN_LAO_DONG: "Tai nạn LĐ",
  CHAY_NO: "Cháy nổ",
  SUP_DO: "Sụp đổ",
  ROI_NGA: "Rơi/Ngã",
  DIEN_GIAT: "Điện giật",
  HOA_CHAT: "Hoá chất",
  MOI_TRUONG: "Môi trường",
  KHAC: "Khác",
};

export default async function SiteEyePage({ params }: { params: { projectId: string } }) {
  const [project, incidents, ppeEvents, weather, cameras] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.incidentReport.findMany({
      where: { projectId: params.projectId },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    prisma.visionEvent.findMany({
      where: { projectId: params.projectId, kind: "PPE_VIOLATION" },
      orderBy: { ts: "desc" },
      take: 20,
    }),
    prisma.weatherSnapshot.findFirst({
      where: { projectId: params.projectId },
      orderBy: { ts: "desc" },
    }),
    prisma.siteCamera.findMany({ where: { projectId: params.projectId, active: true } }),
  ]);

  const ppeCount = await prisma.visionEvent.count({
    where: { projectId: params.projectId, kind: "PPE_VIOLATION", acknowledged: false },
  });
  const criticalIncidents = incidents.filter((i) => i.severity === "CRITICAL" || i.severity === "MAJOR").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">SiteEye — Computer Vision + Safety</h2>
        <p className="mt-1 text-sm text-slate-500">
          Phát hiện vi phạm PPE từ camera, sự cố ATLĐ (Luật ATVSLĐ 84/2015), cảnh báo thời tiết.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Vi phạm PPE chưa xử lý</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{ppeCount}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Sự cố ATLĐ (lớn/nghiêm trọng)</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{criticalIncidents}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Camera đang hoạt động</div>
            <div className="mt-1 text-2xl font-bold">{cameras.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Thời tiết hiện tại</div>
            <div className="mt-1 text-2xl font-bold">
              {weather?.tempC !== null && weather?.tempC !== undefined ? `${Math.round(weather.tempC)}°C` : "—"}
            </div>
            <div className="text-[11px] text-slate-500">{weather?.condition ?? "Chưa cập nhật"}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Thời tiết & cảnh báo công tác</CardTitle>
            <WeatherRefreshButton projectId={params.projectId} address={project?.address ?? ""} />
          </div>
        </CardHeader>
        <CardBody>
          {weather ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
              <Stat label="Nhiệt độ" value={weather.tempC !== null ? `${weather.tempC}°C` : "—"} />
              <Stat label="Độ ẩm" value={weather.humidity !== null ? `${weather.humidity}%` : "—"} />
              <Stat label="Mưa" value={weather.rainMmHr !== null ? `${weather.rainMmHr} mm/h` : "—"} />
              <Stat label="Gió" value={weather.windKph !== null ? `${weather.windKph} kph` : "—"} />
              <div className="col-span-2 md:col-span-4 mt-2 text-xs text-slate-500">
                Cập nhật: {formatDateTimeVn(weather.ts)} · Nguồn: {weather.source ?? "—"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              Chưa có dữ liệu thời tiết. Bấm "↻ Cập nhật" để pull từ open-meteo.
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sự cố ATLĐ ({incidents.length})</CardTitle>
            <IncidentCreateButton projectId={params.projectId} />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {incidents.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có sự cố — chúc mừng! Mọi sự cố ATLĐ phải báo cáo theo Luật ATVSLĐ 84/2015 Điều 39.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Thời điểm</th>
                  <th className="p-3 text-left">Loại</th>
                  <th className="p-3 text-left">Mức độ</th>
                  <th className="p-3 text-left">Vị trí</th>
                  <th className="p-3 text-center">Thương vong</th>
                  <th className="p-3 text-left">Mô tả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="p-3 text-xs">
                      <div>{formatDateTimeVn(i.occurredAt)}</div>
                      <div className="text-slate-500">{relativeDateVn(i.occurredAt)}</div>
                    </td>
                    <td className="p-3">{catLabel[i.category] ?? i.category}</td>
                    <td className="p-3"><Badge variant={severityVariant[i.severity]}>{i.severity}</Badge></td>
                    <td className="p-3 text-slate-700">{i.location ?? "—"}</td>
                    <td className="p-3 text-center">{i.injured}</td>
                    <td className="p-3 text-slate-700 max-w-md truncate">{i.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vi phạm PPE gần đây</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {ppeEvents.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Chưa có vi phạm. Camera có thể gửi frame qua <code>POST /api/siteeye/vision</code>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Thời điểm</th>
                  <th className="p-3 text-left">Vi phạm</th>
                  <th className="p-3 text-center">Độ tin cậy</th>
                  <th className="p-3 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ppeEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="p-3 text-xs">{formatDateTimeVn(e.ts)}</td>
                    <td className="p-3">{e.label}</td>
                    <td className="p-3 text-center">{(e.confidence * 100).toFixed(0)}%</td>
                    <td className="p-3">
                      <Badge variant={e.acknowledged ? "success" : "danger"}>
                        {e.acknowledged ? "Đã xử lý" : "Chưa xử lý"}
                      </Badge>
                    </td>
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
