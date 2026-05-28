import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const stageLabel: Record<string, string> = {
  THAM_DUYET_THIET_KE: "Thẩm duyệt thiết kế PCCC",
  NGHIEM_THU_PCCC: "Nghiệm thu PCCC",
  CAP_GIAY_DU_DIEU_KIEN: "Cấp Giấy chứng nhận đủ điều kiện",
};

const stateMeta: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  SUBMITTED: { vn: "Đã nộp", variant: "info" },
  REVIEWING: { vn: "Cảnh sát PCCC thẩm tra", variant: "warning" },
  APPROVED: { vn: "Đã phê duyệt", variant: "success" },
  REJECTED: { vn: "Từ chối", variant: "danger" },
  WITHDRAWN: { vn: "Rút hồ sơ", variant: "neutral" },
};

export default async function PcccOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/pccc");

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

  const apps = await prisma.pcccApplication.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const inFlight = apps.filter((a) => ["SUBMITTED", "REVIEWING"].includes(a.state)).length;
  const approved = apps.filter((a) => a.state === "APPROVED").length;

  // Sample checklist for QCVN 06:2022/BXD + NĐ 136/2020 — what auditors actually check
  const pcccDossierItems = [
    { code: "PC-1", title: "Bản vẽ thiết kế PCCC — mặt bằng + mặt đứng (hệ thống báo cháy + sprinkler + thoát nạn)" },
    { code: "PC-2", title: "Bản tính toán hệ thống cấp nước chữa cháy (Q yêu cầu, áp lực vòi)" },
    { code: "PC-3", title: "Thuyết minh giải pháp PCCC + đường thoát nạn" },
    { code: "PC-4", title: "Báo cáo kết quả thí nghiệm vật liệu chống cháy (cửa chống cháy, sơn chống cháy)" },
    { code: "PC-5", title: "Hợp đồng cung cấp + lắp đặt thiết bị PCCC với đơn vị có chứng chỉ" },
    { code: "PC-6", title: "Biên bản nghiệm thu lắp đặt từng hạng mục — sprinkler, máy bơm, tủ điều khiển" },
    { code: "PC-7", title: "Biên bản nghiệm thu vận hành thử — phun nước, báo cháy, thoát nạn" },
    { code: "PC-8", title: "Hồ sơ pháp lý đơn vị thi công PCCC (chứng chỉ đủ điều kiện)" },
  ];

  return (
    <AecModuleShell
      group="Pháp lý"
      name="PCCC"
      subtitle="Thẩm duyệt + nghiệm thu PCCC — NĐ 136/2020 · QCVN 06:2022/BXD · TCVN 5738. Tự sinh hồ sơ cho C06."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Hồ sơ đang xử lý</div><div className="mt-1 text-2xl font-bold text-amber-700">{inFlight}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã duyệt</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng hồ sơ</div><div className="mt-1 text-2xl font-bold">{apps.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Cơ quan thẩm duyệt</div><div className="mt-1 text-sm font-semibold leading-tight">PC07 Công an<br/>Cục C06 (cấp 1)</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Hồ sơ PCCC ({apps.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {apps.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có hồ sơ PCCC nào. Tạo qua{" "}
              tạo hồ sơ thẩm duyệt PCCC theo NĐ 136/2020.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã hồ sơ</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Giai đoạn</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Nộp</th>
                  <th className="p-2 text-left">Quyết định</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apps.map((a) => {
                  const meta = stateMeta[a.state] ?? { vn: a.state, variant: "neutral" as const };
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-xs">{a.applicationCode ?? "—"}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{projectById.get(a.projectId)?.key ?? ""}</td>
                      <td className="p-2"><Badge variant="violet">{stageLabel[a.stage] ?? a.stage}</Badge></td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2 text-xs text-slate-500">{a.submittedAt ? formatDateVn(a.submittedAt) : "—"}</td>
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
        <CardHeader><CardTitle>Checklist hồ sơ thẩm duyệt PCCC — NĐ 136/2020</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-slate-500">
            Mục bắt buộc khi thẩm duyệt thiết kế PCCC cho công trình thuộc Phụ lục V NĐ 136/2020 (chung cư ≥ 5 tầng / cao ốc / nhà xưởng có nguy cơ cháy). Phải nộp trước khi xin GPXD.
          </p>
          <ul className="divide-y divide-slate-100">
            {pcccDossierItems.map((item) => (
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
