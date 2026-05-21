import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, CertActions } from "./Actions";

export const dynamic = "force-dynamic";

const groupLabel: Record<string, string> = {
  N1: "Nhóm 1 — Quản lý phụ trách",
  N2: "Nhóm 2 — Cán bộ chuyên trách",
  N3: "Nhóm 3 — Công việc nghiêm ngặt",
  N4: "Nhóm 4 — NLĐ thường",
  N5: "Nhóm 5 — Y tế",
  N6: "Nhóm 6 — AT-VS viên",
};

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  ACTIVE: { vn: "Hiệu lực", variant: "success" },
  EXPIRED: { vn: "Hết hạn", variant: "danger" },
  REVOKED: { vn: "Thu hồi", variant: "neutral" },
};

function daysBetween(a: Date, b: Date) { return Math.ceil((b.getTime() - a.getTime()) / 86400000); }

export default async function HseTrainPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/hsetrain");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const [courses, certs] = await Promise.all([
    prisma.hseCourse.findMany({ include: { _count: { select: { certificates: true } } }, orderBy: { group: "asc" } }),
    prisma.hseCertificate.findMany({
      where: { OR: [{ orgId: { in: orgIds } }, { user: { memberships: { some: { orgId: { in: orgIds } } } } }] },
      include: { course: true, org: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
      take: 200,
    }),
  ]);

  const now = new Date();
  const active = certs.filter((c) => c.state === "ACTIVE" && c.expiresAt > now).length;
  const expiring30 = certs.filter((c) => c.state === "ACTIVE" && c.expiresAt > now && daysBetween(now, c.expiresAt) <= 30).length;
  const expired = certs.filter((c) => c.expiresAt <= now).length;
  const byGroup = new Map<string, number>();
  certs.forEach((c) => byGroup.set(c.course.group, (byGroup.get(c.course.group) ?? 0) + 1));

  return (
    <AecModuleShell
      group="Pháp lý"
      name="HSE-Train — Huấn luyện ATLĐ"
      subtitle="NĐ 44/2016 + TT 31/2018. 6 nhóm đối tượng, LMS test online, thẻ ATLĐ QR. Alert chứng chỉ hết hạn trong 30 ngày."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang hiệu lực</div><div className="mt-1 text-2xl font-bold text-emerald-700">{active}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Hết hạn ≤30d</div><div className="mt-1 text-2xl font-bold text-amber-700">{expiring30}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã hết hạn</div><div className="mt-1 text-2xl font-bold text-rose-700">{expired}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Khoá đào tạo</div><div className="mt-1 text-2xl font-bold">{courses.length}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm courses={courses.map((c) => ({ id: c.id, code: c.code, group: c.group }))} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Khoá huấn luyện ({courses.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {courses.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có khoá nào. Seed: <code>scripts/seed-hsetrain.ts</code></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Nhóm</th>
                  <th className="p-2 text-left">Tiêu đề</th>
                  <th className="p-2 text-right">Số giờ</th>
                  <th className="p-2 text-right">Hiệu lực</th>
                  <th className="p-2 text-right">Đã cấp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{c.code}</td>
                    <td className="p-2 text-xs">{groupLabel[c.group]}</td>
                    <td className="p-2 text-xs"><div className="font-medium">{c.title}</div>{c.isOnline && <span className="text-[10px] text-blue-700">📱 LMS online</span>}</td>
                    <td className="p-2 text-right text-xs">{c.durationHours}h</td>
                    <td className="p-2 text-right text-xs">{c.validityMonths} tháng</td>
                    <td className="p-2 text-right text-xs">{c._count.certificates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Chứng chỉ gần đây ({certs.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {certs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có chứng chỉ nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Số CC</th>
                  <th className="p-2 text-left">Họ tên</th>
                  <th className="p-2 text-left">Khoá</th>
                  <th className="p-2 text-left">Tổ chức</th>
                  <th className="p-2 text-left">Cấp / Hết hạn</th>
                  <th className="p-2 text-right">Điểm</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certs.map((c) => {
                  const meta = stateLabel[c.state] ?? { vn: c.state, variant: "neutral" as const };
                  const dLeft = daysBetween(now, c.expiresAt);
                  const exp = c.state === "ACTIVE" && dLeft <= 30 && dLeft > 0;
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 ${exp ? "bg-amber-50" : ""}`} data-testid={`cert-${c.certNumber}`}>
                      <td className="p-2 font-mono text-xs">{c.certNumber}</td>
                      <td className="p-2 text-xs"><div className="font-medium">{c.workerName}</div>{c.workerIdNo && <div className="text-[10px] text-slate-500">{c.workerIdNo}</div>}</td>
                      <td className="p-2 text-xs">{c.course.code} ({c.course.group})</td>
                      <td className="p-2 text-xs">{c.org?.name ?? "—"}</td>
                      <td className="p-2 text-xs">{formatDateVn(c.issuedAt)} → {formatDateVn(c.expiresAt)}<div className={`text-[10px] ${dLeft < 0 ? "text-rose-700" : exp ? "text-amber-700" : "text-slate-500"}`}>{dLeft < 0 ? `Quá ${-dLeft}d` : `Còn ${dLeft}d`}</div></td>
                      <td className="p-2 text-right text-xs">{c.testScore ?? "—"}{c.testScore ? "%" : ""}</td>
                      <td className="p-2" data-testid={`state-${c.certNumber}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><CertActions id={c.id} state={c.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-2 text-[11px] text-slate-500">
        Phân bố theo nhóm: {Array.from(byGroup.entries()).map(([k, v]) => `${k}: ${v}`).join(" · ")}.
        OSS LMS dùng <code>Moodle</code> hoặc <code>Open edX</code> backend; QR thẻ <code>node-qrcode</code>.
      </div>
    </AecModuleShell>
  );
}
