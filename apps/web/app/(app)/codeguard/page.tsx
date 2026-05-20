import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const dossierLabel: Record<string, string> = {
  KHAO_SAT: "Khảo sát",
  THIET_KE: "Thiết kế",
  THI_CONG: "Thi công",
  NGHIEM_THU: "Nghiệm thu",
  HOAN_CONG: "Hoàn công",
};
const statusLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  MISSING: { vn: "Thiếu", variant: "danger" },
  DRAFT: { vn: "Nháp", variant: "warning" },
  SUBMITTED: { vn: "Đã trình", variant: "info" },
  REVIEWED: { vn: "Đã xem", variant: "info" },
  ACCEPTED: { vn: "Đạt", variant: "success" },
  REJECTED: { vn: "Không đạt", variant: "danger" },
};
const sevVariant: Record<string, "info" | "warning" | "danger" | "neutral"> = {
  INFO: "neutral", WARNING: "warning", BLOCKING: "danger",
};

export default async function CodeGuardOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/codeguard");

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

  const [regulations, dossierItems, findings, rules] = await Promise.all([
    prisma.regulation.findMany({
      where: { status: "IN_FORCE" },
      orderBy: { code: "asc" },
      take: 30,
    }),
    prisma.qualityDossierItem.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ projectId: "asc" }, { itemCode: "asc" }],
      take: 200,
    }),
    prisma.codeRuleFinding.findMany({
      where: { projectId: { in: projectIds } },
      include: { rule: { select: { code: true, title: true, severity: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.codeRule.findMany({ where: { isActive: true }, take: 1000 }),
  ]);

  const missingDossier = dossierItems.filter((d) => d.status === "MISSING").length;
  const acceptedDossier = dossierItems.filter((d) => d.status === "ACCEPTED").length;
  const blockingFindings = findings.filter((f) => f.rule.severity === "BLOCKING").length;

  return (
    <AecModuleShell
      group="Thiết kế"
      name="CodeGuard"
      subtitle="Đối chiếu QCVN/TCVN. Hồ sơ chất lượng NĐ 15/2021 Phụ lục I. Machine-checkable code rules."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tiêu chuẩn / Quy chuẩn còn hiệu lực</div><div className="mt-1 text-2xl font-bold">{regulations.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Rules tự động</div><div className="mt-1 text-2xl font-bold">{rules.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Hồ sơ thiếu (mọi DA)</div><div className="mt-1 text-2xl font-bold text-rose-700">{missingDossier}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Vi phạm BLOCKING</div><div className="mt-1 text-2xl font-bold text-rose-700">{blockingFindings}</div></CardBody></Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Hồ sơ chất lượng — NĐ 15/2021 ({dossierItems.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {dossierItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Chưa khởi tạo dossier cho dự án nào.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dossierItems.slice(0, 40).map((d) => {
                  const meta = statusLabel[d.status] ?? { vn: d.status, variant: "neutral" as const };
                  return (
                    <li key={d.id} className="p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{projectById.get(d.projectId)?.key ?? ""}</span>
                        <Badge variant="neutral">{dossierLabel[d.category] ?? d.category}</Badge>
                        <span className="font-mono text-xs text-slate-700">{d.itemCode}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="font-medium text-slate-900">{d.itemTitle}</div>
                        <Badge variant={meta.variant}>{meta.vn}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vi phạm rule gần nhất ({findings.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {findings.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Chưa có vi phạm nào được phát hiện.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {findings.slice(0, 20).map((f) => (
                  <li key={f.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={sevVariant[f.rule.severity]}>{f.rule.severity}</Badge>
                      <span className="font-mono text-xs text-slate-500">{projectById.get(f.projectId)?.key ?? ""}</span>
                      <span className="font-mono text-xs text-slate-700">{f.rule.code}</span>
                    </div>
                    <div className="mt-1 text-slate-900">{f.rule.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {f.entityType}#{f.entityId.slice(0, 8)} · {formatDateVn(f.createdAt)} · {f.status}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Thư viện TCVN/QCVN ({regulations.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-2 text-left">Mã</th><th className="p-2 text-left">Tên</th><th className="p-2 text-left">Hiệu lực</th><th className="p-2 text-left">Cơ quan</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regulations.slice(0, 30).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs"><Badge variant="violet">{r.kind}</Badge> {r.code}</td>
                  <td className="p-2 text-slate-900">{r.title}</td>
                  <td className="p-2 text-xs text-slate-500">{r.effectiveAt ? formatDateVn(r.effectiveAt) : "—"}</td>
                  <td className="p-2 text-xs text-slate-500">{r.issuedBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
