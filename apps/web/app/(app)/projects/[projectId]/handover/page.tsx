import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn, relativeDateVn } from "@atlas/lib";

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  THAM_DOT: "Thấm dột",
  NUT_TUONG: "Nứt tường/trần",
  DIEN_GIAT: "Điện",
  CAP_THOAT_NUOC: "Cấp/thoát nước",
  HVAC: "HVAC",
  SON_HOAN_THIEN: "Sơn/hoàn thiện",
  CUA_KHOA: "Cửa/khóa",
  AN_NINH: "An ninh",
  KHAC: "Khác",
};
const stateLabel: Record<string, { variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet"; vn: string }> = {
  NEW: { variant: "info", vn: "Mới" },
  TRIAGED: { variant: "info", vn: "Đã phân loại" },
  IN_PROGRESS: { variant: "warning", vn: "Đang xử lý" },
  AWAITING_PARTS: { variant: "warning", vn: "Đợi vật tư" },
  RECTIFIED: { variant: "violet", vn: "Đã khắc phục" },
  VERIFIED: { variant: "success", vn: "Đã xác nhận" },
  REJECTED: { variant: "danger", vn: "Từ chối" },
  CLOSED: { variant: "neutral", vn: "Đóng" },
};
const sevVariant: Record<string, "info" | "warning" | "danger" | "neutral"> = {
  LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger",
};
const warrantyLabel: Record<string, string> = {
  PHAN_PHU: "12T phần phụ",
  PHAN_CHINH: "24T phần chính",
  HA_TANG: "60T hạ tầng",
};

export default async function HandoverPage({ params }: { params: { projectId: string } }) {
  const [project, tickets] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.handoverTicket.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ state: "asc" }, { slaDueAt: "asc" }],
      take: 200,
    }),
  ]);

  const now = Date.now();
  const overdue = tickets.filter(
    (t) => t.slaDueAt && t.slaDueAt.getTime() < now && !["VERIFIED", "REJECTED", "CLOSED"].includes(t.state),
  );
  const open = tickets.filter((t) => !["VERIFIED", "REJECTED", "CLOSED"].includes(t.state));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Handover — Bảo hành & sửa chữa hậu bàn giao</h2>
        <p className="mt-1 text-sm text-slate-500">
          Service desk theo NĐ 06/2021: bảo hành 12 tháng phần phụ · 24 tháng phần chính · 60 tháng hạ tầng. SLA tính theo mức độ.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Tổng ticket</div>
            <div className="mt-1 text-2xl font-bold">{tickets.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Đang mở</div>
            <div className="mt-1 text-2xl font-bold text-blue-700">{open.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Quá SLA</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{overdue.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Tỉ lệ xác nhận</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">
              {tickets.length === 0
                ? "—"
                : Math.round((tickets.filter((t) => t.state === "VERIFIED").length / tickets.length) * 100) + "%"}
            </div>
          </CardBody>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-rose-800">⚠ {overdue.length} ticket QUÁ SLA</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-rose-100 p-0">
            {overdue.slice(0, 5).map((t) => (
              <div key={t.id} className="p-3 text-sm">
                <div className="font-mono text-xs text-slate-500">{t.ticketNumber}</div>
                <div className="mt-0.5 font-medium">{t.title}</div>
                <div className="text-[11px] text-rose-700">Quá hạn: {relativeDateVn(t.slaDueAt!)}</div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tất cả ticket ({tickets.length})</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có yêu cầu bảo hành. Cư dân/CĐT báo lỗi qua{" "}
              <code className="rounded bg-slate-100 px-1">POST /api/handover</code>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Căn</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-center">Mức</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">SLA</th>
                  <th className="p-2 text-left">Bảo hành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => {
                  const slaOverdue = t.slaDueAt && t.slaDueAt.getTime() < now && !["VERIFIED", "REJECTED", "CLOSED"].includes(t.state);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-xs">{t.ticketNumber}</td>
                      <td className="p-2 text-xs">{t.unitCode ?? "—"}</td>
                      <td className="p-2 text-xs"><Badge variant="neutral">{categoryLabel[t.category]}</Badge></td>
                      <td className="p-2 text-center"><Badge variant={sevVariant[t.severity]}>{t.severity}</Badge></td>
                      <td className="p-2">
                        <div className="font-medium">{t.title}</div>
                        <div className="text-[11px] text-slate-500">Báo: {t.reporterName}{t.reporterPhone ? ` · ${t.reporterPhone}` : ""}</div>
                      </td>
                      <td className="p-2"><Badge variant={stateLabel[t.state]?.variant}>{stateLabel[t.state]?.vn}</Badge></td>
                      <td className="p-2 text-xs">
                        {t.slaDueAt ? (
                          <span className={slaOverdue ? "text-rose-700" : "text-slate-600"}>
                            {relativeDateVn(t.slaDueAt)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-[11px] text-slate-500">{warrantyLabel[t.warrantyType]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
