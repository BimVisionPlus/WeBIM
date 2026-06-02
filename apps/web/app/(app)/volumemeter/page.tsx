import { DeleteRow } from "./DeleteRow";

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  NT_SUBMITTED: { vn: "NT đã nộp", variant: "info" },
  TVGS_VERIFIED: { vn: "TVGS xác nhận", variant: "info" },
  CDT_APPROVED: { vn: "CĐT duyệt", variant: "success" },
  REJECTED: { vn: "Trả về", variant: "danger" },
};

const sourceLabel: Record<string, string> = {
  MANUAL: "Thủ công",
  IFC_AUTO: "IFC tự động",
  HYBRID: "IFC + thủ công",
  IMPORTED: "Import Excel",
};

export default async function VolumeMeterOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/volumemeter");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const sheets = await prisma.takeoffSheet.findMany({
    where: { project: projectFilter },
    include: {
      project: { select: { key: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  const totalSheets = sheets.length;
  const approved = sheets.filter((s) => s.state === "CDT_APPROVED").length;
  const totalValue = sheets.reduce((s, sh) => s + Number(sh.totalValue), 0);
  const autoTakeoff = sheets.filter((s) => s.source === "IFC_AUTO" || s.source === "HYBRID").length;

  return (
    <AecModuleShell
      group="Thi công"
      name="VolumeMeter — Bóc khối lượng"
      subtitle="TT 13/2021/TT-BXD. Auto-takeoff từ IFC/Revit qua Forge + IfcOpenShell. So sánh dự toán ↔ thi công ↔ hoàn công."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng phiếu QTO</div><div className="mt-1 text-2xl font-bold">{totalSheets}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã duyệt</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Auto từ IFC</div><div className="mt-1 text-2xl font-bold text-violet-700">{autoTakeoff}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng giá trị</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalValue))}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Phiếu bóc khối lượng ({totalSheets})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {totalSheets === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có phiếu QTO. Bóc thủ công hoặc upload IFC để auto-takeoff.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Hạng mục</th>
                  <th className="p-2 text-left">Nguồn</th>
                  <th className="p-2 text-right">Dòng</th>
                  <th className="p-2 text-right">Giá trị</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheets.map((s) => {
                  const meta = stateLabel[s.state] ?? { vn: s.state, variant: "neutral" as const };
                  return (
                    <tr key={s.id} className="hover:bg-slate-50" data-testid={`row-${s.code}`}>
                      <td className="p-2 font-mono text-xs">{s.code}</td>
                      <td className="p-2 text-xs font-mono text-slate-600">{s.project.key}</td>
                      <td className="p-2"><div className="font-medium">{s.title}</div><div className="text-[11px] text-slate-500">{s.scope}</div></td>
                      <td className="p-2 text-xs">{sourceLabel[s.source]}</td>
                      <td className="p-2 text-right text-xs">{s._count.lines}</td>
                      <td className="p-2 text-right text-xs font-medium">{formatVnd(s.totalValue)}</td>
                      <td className="p-2" data-testid={`state-${s.code}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><RowActions id={s.id} state={s.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Auto-takeoff OSS pipeline</CardTitle></CardHeader>
          <CardBody>
            <ol className="space-y-1.5 text-sm text-slate-700">
              <li>1. Upload IFC/RVT → Forge translate (đã có ở Models)</li>
              <li>2. Worker chạy <code className="text-xs">IfcOpenShell</code> bóc Q-properties</li>
              <li>3. Map IfcWall/IfcSlab/IfcBeam → mã định mức AB.xxxxx (DinhMucDB)</li>
              <li>4. Sinh TakeoffSheet draft → TVGS xác nhận</li>
              <li>5. Output đẩy vào PaymentRail (workDoneVnd) + changeorder (KL phát sinh)</li>
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>3-cột so sánh KL</CardTitle></CardHeader>
          <CardBody className="text-sm text-slate-700">
            <ul className="space-y-1.5">
              <li><b>Dự toán (BoQ)</b> — từ hồ sơ thiết kế kỹ thuật</li>
              <li><b>Thi công thực tế</b> — đo trên công trường, có TVGS xác nhận</li>
              <li><b>Hoàn công (as-built)</b> — sau bàn giao, chốt số liệu cuối</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              Sai số &gt; 5% → tự động cảnh báo Cost Overrun Signal trong CostPulse. Tăng KL → tạo Change Order.
            </p>
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
