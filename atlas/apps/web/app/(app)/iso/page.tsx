import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn, auditRegister } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  SO_TAY: "Sổ tay",
  CHINH_SACH: "Chính sách",
  QUY_TRINH: "Quy trình",
  HUONG_DAN: "Hướng dẫn",
  BIEU_MAU: "Biểu mẫu",
};

const DEPT_LABEL: Record<string, string> = {
  CONG_VIEC: "Công việc / dự án",
  DAU_THAU: "Đấu thầu",
  HANH_CHINH: "Hành chính",
  TAI_CHINH_KE_TOAN: "Tài chính — kế toán",
  PHAT_TRIEN_THI_TRUONG: "Phát triển thị trường",
  CONG_VIEC_KHAC: "Chung",
};

const STATUS: Record<string, { vn: string; variant: "neutral" | "info" | "success" | "warning" }> = {
  DRAFT: { vn: "Dự thảo", variant: "info" },
  EFFECTIVE: { vn: "Hiệu lực", variant: "success" },
  SUPERSEDED: { vn: "Đã thay thế", variant: "neutral" },
  WITHDRAWN: { vn: "Thu hồi", variant: "warning" },
};

export default async function IsoPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/iso");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const documents = await prisma.isoDocument.findMany({
    where: { orgId: { in: orgIds } },
    orderBy: [{ department: "asc" }, { code: "asc" }, { version: "asc" }],
  });
  const processes = await prisma.processTemplate.findMany({
    where: { orgId: { in: orgIds }, isActive: true },
    select: { id: true, name: true, isoCode: true },
  });

  const audit = auditRegister(
    documents.map((doc) => ({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      version: doc.version,
      status: doc.status,
      effectiveAt: doc.effectiveAt,
      reviewDueAt: doc.reviewDueAt,
      supersedesId: doc.supersedesId,
      processTemplateId: doc.processTemplateId,
      kind: doc.kind,
    })),
    processes,
    new Date(),
  );

  const serious = audit.findings.filter((finding) => finding.level === "serious");
  const byDept = new Map<string, typeof documents>();
  for (const doc of documents) {
    byDept.set(doc.department, [...(byDept.get(doc.department) ?? []), doc]);
  }

  return (
    <AecModuleShell
      group="Quản trị"
      name="ISO — danh mục tài liệu"
      subtitle="Sổ tay, chính sách, quy trình, hướng dẫn, biểu mẫu của công ty và dự án. Mỗi tài liệu có mã hiệu, phiên bản, ngày hiệu lực và hạn soát xét."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tài liệu</div><div className="mt-1 text-2xl font-bold">{documents.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đang hiệu lực</div><div className="mt-1 text-2xl font-bold">{audit.effective}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Quá hạn soát xét</div><div className={`mt-1 text-2xl font-bold ${audit.overdueReview > 0 ? "text-amber-700" : ""}`}>{audit.overdueReview}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Phát hiện nghiêm trọng</div><div className={`mt-1 text-2xl font-bold ${serious.length > 0 ? "text-rose-700" : ""}`}>{serious.length}</div></CardBody></Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Soát xét danh mục ({audit.findings.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {audit.findings.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
              Không có phát hiện nào.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {audit.findings.map((finding, index) => (
                  <tr key={index} data-testid={`finding-${index}`}>
                    <td className="p-2 w-28">
                      <Badge variant={finding.level === "serious" ? "danger" : "warning"}>
                        {finding.level === "serious" ? "Nghiêm trọng" : "Cảnh báo"}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono text-xs w-32">{finding.code}</td>
                    <td className="p-2 text-xs">{finding.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {[...byDept.entries()].map(([dept, list]) => (
        <Card className="mt-4" key={dept}>
          <CardHeader><CardTitle>{DEPT_LABEL[dept] ?? dept}</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Mã hiệu</th>
                  <th className="p-2 text-left">Tên tài liệu</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Bản</th>
                  <th className="p-2 text-left">Hiệu lực từ</th>
                  <th className="p-2 text-left">Soát xét</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Quy trình chạy được</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {list.map((doc) => {
                  const meta = STATUS[doc.status] ?? { vn: doc.status, variant: "neutral" as const };
                  const overdue = doc.reviewDueAt && doc.reviewDueAt < new Date() && doc.status === "EFFECTIVE";
                  return (
                    <tr key={doc.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`iso-${doc.code}-${doc.version}`}>
                      <td className="p-2 font-mono text-xs">{doc.code}</td>
                      <td className="p-2 text-xs">{doc.title}</td>
                      <td className="p-2 text-xs">{KIND_LABEL[doc.kind] ?? doc.kind}</td>
                      <td className="p-2 text-xs">v{doc.version}</td>
                      <td className="p-2 text-xs">{doc.effectiveAt ? formatDateVn(doc.effectiveAt) : "—"}</td>
                      <td className={`p-2 text-xs ${overdue ? "text-amber-700" : ""}`}>
                        {doc.reviewDueAt ? formatDateVn(doc.reviewDueAt) : "—"}
                        {overdue && <div className="text-[11px]">quá hạn</div>}
                      </td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2 text-xs">
                        {doc.processTemplateId ? (
                          <a className="underline" href="/processes">mở</a>
                        ) : doc.kind === "QUY_TRINH" ? (
                          <span className="text-[rgb(var(--muted))]">chưa có</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}
    </AecModuleShell>
  );
}
