import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

const permitTypeLabel: Record<string, string> = {
  GPXD_MOI: "GPXD mới",
  GPXD_DIEU_CHINH: "Điều chỉnh",
  GPXD_SUA_CHUA: "Sửa chữa, cải tạo",
  GPXD_TAM: "Tạm",
  THONG_BAO_KHOI_CONG: "Thông báo khởi công",
  GPXD_HA_TANG: "GPXD hạ tầng",
};

const stateMeta: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  SUBMITTED: { vn: "Đã nộp", variant: "info" },
  REVIEWING: { vn: "Sở XD thẩm tra", variant: "warning" },
  APPROVED: { vn: "Đã cấp phép", variant: "success" },
  REJECTED: { vn: "Từ chối", variant: "danger" },
  WITHDRAWN: { vn: "Rút hồ sơ", variant: "neutral" },
};

export default async function PermitFlowOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/permitflow");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    select: { id: true, key: true, name: true, permitNumber: true, permitDate: true },
  });
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectIds = projects.map((p) => p.id);

  const applications = await prisma.permitApplication.findMany({
    where: { projectId: { in: projectIds } },
    include: { _count: { select: { checklist: true } }, checklist: { where: { attached: true }, select: { id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const inFlight = applications.filter((a) => ["SUBMITTED", "REVIEWING"].includes(a.state)).length;
  const approved = applications.filter((a) => a.state === "APPROVED").length;
  const hasGpxd = projects.filter((p) => p.permitNumber).length;

  // Pre-populated NĐ 15/2021 Phụ lục I sample checklist when there are no applications yet — gives the page something to render
  const samplePhuLuc1 = [
    { code: "PL-I.A.1", title: "Đơn đề nghị cấp giấy phép xây dựng (Mẫu 01)" },
    { code: "PL-I.A.2", title: "Bản sao Giấy CN quyền sử dụng đất" },
    { code: "PL-I.A.3", title: "Bản vẽ tổng mặt bằng" },
    { code: "PL-I.A.4", title: "Bản vẽ kiến trúc — mặt đứng, mặt cắt" },
    { code: "PL-I.A.5", title: "Bản vẽ kết cấu — móng + khung chịu lực" },
    { code: "PL-I.A.6", title: "Bản vẽ M&E (điện · nước · HVAC · PCCC)" },
    { code: "PL-I.A.7", title: "Văn bản thẩm duyệt PCCC (NĐ 136/2020)" },
    { code: "PL-I.A.8", title: "Báo cáo đánh giá tác động môi trường (nếu thuộc danh mục)" },
  ];

  return (
    <AecModuleShell
      group="Pháp lý"
      name="PermitFlow"
      subtitle="Xin Giấy phép xây dựng theo NĐ 15/2021 Phụ lục I — tự sinh checklist + đơn từ profile dự án."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Hồ sơ đang xử lý</div><div className="mt-1 text-2xl font-bold text-amber-700">{inFlight}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã cấp GPXD</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Dự án có GPXD lưu</div><div className="mt-1 text-2xl font-bold">{hasGpxd}/{projects.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Cơ quan cấp</div><div className="mt-1 text-sm font-semibold leading-tight">Sở XD tỉnh/TP<br/>Bộ XD (cấp 1)</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={projects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Hồ sơ xin phép ({applications.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có hồ sơ xin phép nào trong các dự án bạn truy cập. Bấm “Tạo hồ sơ xin GPXD” ở trên để bắt đầu (NĐ 15/2021).
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã hồ sơ</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Đơn vị nộp</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-right">Tiến độ checklist</th>
                  <th className="p-2 text-left">Ngày quyết định</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((a) => {
                  const meta = stateMeta[a.state] ?? { vn: a.state, variant: "neutral" as const };
                  const attached = a.checklist.length;
                  const pct = a._count.checklist === 0 ? 0 : Math.round((attached / a._count.checklist) * 100);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-xs">{a.applicationCode ?? "—"}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{projectById.get(a.projectId)?.key ?? ""}</td>
                      <td className="p-2"><Badge variant="neutral">{permitTypeLabel[a.permitType] ?? a.permitType}</Badge></td>
                      <td className="p-2 text-xs">{a.applicant}</td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2 text-right text-xs">{attached}/{a._count.checklist} ({pct}%)</td>
                      <td className="p-2 text-xs text-slate-500">{a.decisionAt ? formatDateVn(a.decisionAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Checklist mẫu — NĐ 15/2021 Phụ lục I</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-slate-500">
            Đây là danh mục hồ sơ bắt buộc khi xin GPXD công trình dân dụng cấp III/IV. PermitFlow sẽ tự sinh checklist riêng cho từng hồ sơ, kiểm tra evidence đính kèm trước khi nộp lên Sở XD.
          </p>
          <ul className="divide-y divide-slate-100">
            {samplePhuLuc1.map((item) => (
              <li key={item.code} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-slate-500">{item.code}</span>
                  <span className="text-slate-900">{item.title}</span>
                </div>
                <Badge variant="neutral">Bắt buộc</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
