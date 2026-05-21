import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  BE_TONG: "Bê tông", THEP: "Thép", XI_MANG: "Xi măng",
  CAT_DA: "Cát đá / cấp phối", DAT_NEN: "Đất nền", COC_NEN: "Thử tải cọc", KHAC: "Khác",
};

const resLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  PENDING: { vn: "Đang thí nghiệm", variant: "info" },
  PASS: { vn: "Đạt", variant: "success" },
  FAIL: { vn: "Không đạt", variant: "danger" },
  CONDITIONAL: { vn: "Đạt có điều kiện", variant: "warning" },
};

export default async function LabReportsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/labreports");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const reports = await prisma.labReport.findMany({
    where: { project: projectFilter },
    include: { project: { select: { key: true } }, materialLot: { select: { lotCode: true, materialName: true } } },
    orderBy: { sampledAt: "desc" },
    take: 100,
  });

  const total = reports.length;
  const pass = reports.filter((r) => r.result === "PASS").length;
  const fail = reports.filter((r) => r.result === "FAIL").length;
  const pending = reports.filter((r) => r.result === "PENDING").length;
  const passRate = total - pending > 0 ? Math.round((pass / (total - pending)) * 100) : 0;

  return (
    <AecModuleShell
      group="Thi công"
      name="LabReports — Thí nghiệm LAS-XD"
      subtitle="Phòng LAS-XD được Bộ XD cấp phép. Mẫu BT/thép/đất/cọc. Auto-compare actual vs TCVN; FAIL → auto-tạo NCR."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng mẫu</div><div className="mt-1 text-2xl font-bold">{total}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang thí nghiệm</div><div className="mt-1 text-2xl font-bold text-blue-700">{pending}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tỷ lệ Đạt</div><div className={`mt-1 text-2xl font-bold ${passRate >= 95 ? "text-emerald-700" : "text-amber-700"}`}>{passRate}%</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Không đạt → NCR</div><div className="mt-1 text-2xl font-bold text-rose-700">{fail}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Kết quả thí nghiệm ({total})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {total === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có báo cáo. Seed: <code>scripts/seed-labreports.ts</code></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã mẫu</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Lấy mẫu</th>
                  <th className="p-2 text-left">Phòng LAS</th>
                  <th className="p-2 text-left">TCVN</th>
                  <th className="p-2 text-left">Kết quả vs spec</th>
                  <th className="p-2 text-left">Lot</th>
                  <th className="p-2 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => {
                  const meta = resLabel[r.result] ?? { vn: r.result, variant: "neutral" as const };
                  const params = r.parameters as Record<string, number> | null;
                  const spec = r.specRequired as Record<string, string> | null;
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 align-top ${r.result === "FAIL" ? "bg-rose-50" : ""}`}>
                      <td className="p-2 font-mono text-xs">{r.sampleCode}</td>
                      <td className="p-2 text-xs">{typeLabel[r.sampleType]}<div className="text-[10px] text-slate-500">{r.testMethod}</div></td>
                      <td className="p-2 text-xs">{formatDateVn(r.sampledAt)}<div className="text-[10px] text-slate-500">{r.sampledBy}</div></td>
                      <td className="p-2 text-xs">{r.labCode}<div className="text-[10px] text-slate-500">{r.labOrgName}</div></td>
                      <td className="p-2 text-[10px] text-slate-500">{r.tcvnRef}</td>
                      <td className="p-2 text-[11px]">
                        {params && Object.entries(params).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-slate-500">{k}:</span> <span className="font-medium">{v}</span>
                            {spec?.[k] && <span className="text-slate-500"> (spec {spec[k]})</span>}
                          </div>
                        ))}
                      </td>
                      <td className="p-2 text-xs">{r.materialLot ? <span className="font-mono">{r.materialLot.lotCode}</span> : "—"}</td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge>{r.ncrId && <div className="text-[10px] text-rose-700 mt-0.5">NCR auto-tạo</div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-3 text-[11px] text-slate-500">
        Pipeline: PDF báo cáo LAS upload → Qwen2.5-VL OCR extract parameters →
        match TCVN spec từ DinhMucDB → so sánh actual vs required → FAIL auto-tạo NCR + email TVGS+CĐT.
      </div>
    </AecModuleShell>
  );
}
