import { DeleteRow } from "./DeleteRow";

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, RowActions } from "./Actions";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  CONSULTING: { vn: "Tham vấn cộng đồng", variant: "info" },
  AUTHORITY_REVIEW: { vn: "Cơ quan thẩm định", variant: "warning" },
  APPROVED: { vn: "Đã phê duyệt", variant: "success" },
  REJECTED: { vn: "Từ chối", variant: "danger" },
};

const typeLabel: Record<string, string> = {
  DTM: "ĐTM (nhóm I, II)",
  DKDT: "Đăng ký KH BVMT (nhóm III, IV)",
  GPMT: "Giấy phép môi trường",
  BAO_CAO_DK: "Báo cáo định kỳ",
};

const measureLabel: Record<string, string> = {
  BUI: "Bụi", ON: "Ồn", KHI_THAI: "Khí thải", NUOC_THAI: "Nước thải", NUOC_NGAM: "Nước ngầm", DAT: "Đất", RUNG_DONG: "Rung",
};

export default async function EiaFlowPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/eiaflow");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const [apps, measurements, accessibleProjects] = await Promise.all([
    prisma.eiaApplication.findMany({
      where: { project: projectFilter },
      include: { project: { select: { key: true } }, consultantOrg: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.envMeasurement.findMany({
      where: { project: projectFilter },
      include: { project: { select: { key: true } } },
      orderBy: { sampleDate: "desc" },
      take: 30,
    }),
    prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } }),
  ]);

  const approved = apps.filter((a) => a.state === "APPROVED").length;
  const exceeded = measurements.filter((m) => m.exceeded).length;
  const byType = new Map<string, number>();
  measurements.forEach((m) => byType.set(m.measureType, (byType.get(m.measureType) ?? 0) + 1));

  return (
    <AecModuleShell
      group="Pháp lý"
      name="EIAFlow — ĐTM + quan trắc môi trường"
      subtitle="NĐ 08/2022 + TT 02/2022. Hồ sơ ĐTM/ĐKĐT/GPMT, tham vấn cộng đồng, quan trắc bụi/ồn/nước định kỳ. Cảnh báo vượt QCVN."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Hồ sơ ĐTM</div><div className="mt-1 text-2xl font-bold">{apps.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đã phê duyệt</div><div className="mt-1 text-2xl font-bold text-emerald-700">{approved}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Quan trắc gần đây</div><div className="mt-1 text-2xl font-bold">{measurements.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Vượt ngưỡng QCVN</div><div className="mt-1 text-2xl font-bold text-rose-700">{exceeded}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Hồ sơ ĐTM / GPMT ({apps.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {apps.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có hồ sơ ĐTM nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">Cơ quan</th>
                  <th className="p-2 text-left">Tư vấn</th>
                  <th className="p-2 text-left">Tham vấn</th>
                  <th className="p-2 text-left">QĐ phê duyệt</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {apps.map((a) => {
                  const meta = stateLabel[a.state] ?? { vn: a.state, variant: "neutral" as const };
                  return (
                    <tr key={a.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-${a.code}`}>
                      <td className="p-2 font-mono text-xs">{a.code}</td>
                      <td className="p-2 text-xs">{typeLabel[a.type]}</td>
                      <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{a.project.key}</td>
                      <td className="p-2 text-xs">{a.authority}</td>
                      <td className="p-2 text-xs">{a.consultantOrg?.name ?? "—"}</td>
                      <td className="p-2 text-xs">{a.consultStartAt ? `${formatDateVn(a.consultStartAt)} → ${formatDateVn(a.consultEndAt)}` : "—"}</td>
                      <td className="p-2 text-xs">{a.decisionRef}<div className="text-[10px] text-[rgb(var(--muted))]">{a.decisionDate ? formatDateVn(a.decisionDate) : ""}</div></td>
                      <td className="p-2" data-testid={`state-${a.code}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><RowActions id={a.id} state={a.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quan trắc môi trường gần đây ({measurements.length})</CardTitle>
            <div className="text-xs text-[rgb(var(--muted))]">{Array.from(byType.entries()).map(([k, v]) => `${measureLabel[k]}: ${v}`).join(" · ")}</div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {measurements.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có kết quả quan trắc.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Ngày</th>
                  <th className="p-2 text-left">Mã mẫu</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Vị trí</th>
                  <th className="p-2 text-left">Chỉ tiêu</th>
                  <th className="p-2 text-right">Giá trị</th>
                  <th className="p-2 text-right">Ngưỡng</th>
                  <th className="p-2 text-left">QCVN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {measurements.map((m) => (
                  <tr key={m.id} className={`hover:bg-[rgb(var(--raised))] ${m.exceeded ? "bg-rose-50" : ""}`}>
                    <td className="p-2 text-xs">{formatDateVn(m.sampleDate)}</td>
                    <td className="p-2 font-mono text-xs">{m.sampleCode}</td>
                    <td className="p-2 text-xs">{measureLabel[m.measureType]}</td>
                    <td className="p-2 text-xs">{m.location}</td>
                    <td className="p-2 text-xs">{m.parameter}</td>
                    <td className={`p-2 text-right text-xs ${m.exceeded ? "font-bold text-rose-700" : ""}`}>{Number(m.value).toLocaleString("vi-VN")} {m.unit}</td>
                    <td className="p-2 text-right text-xs text-[rgb(var(--muted))]">{m.qcvnLimit ? `${Number(m.qcvnLimit).toLocaleString("vi-VN")} ${m.unit}` : "—"}</td>
                    <td className="p-2 text-[10px] text-[rgb(var(--muted))]">{m.qcvnRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
