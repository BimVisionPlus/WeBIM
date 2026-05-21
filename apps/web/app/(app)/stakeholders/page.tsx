import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  BO_XAY_DUNG: "Bộ XD", SO_XAY_DUNG: "Sở XD", SO_QHKT: "Sở QHKT", SO_TNMT: "Sở TNMT",
  SO_CONG_THUONG: "Sở CT", KBNN: "Kho bạc", CONG_AN_PCCC: "PC07", UBND: "UBND",
  CO_QUAN_THUE: "Cục thuế", KHAC: "Khác",
};

const dirLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" }> = {
  INCOMING: { vn: "VB đến", variant: "info" },
  OUTGOING: { vn: "VB đi", variant: "warning" },
};

export default async function StakeholdersPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/stakeholders");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const [agencies, docs, appts] = await Promise.all([
    prisma.govAgency.findMany({ include: { _count: { select: { documents: true, appointments: true } } }, orderBy: { name: "asc" } }),
    prisma.agencyDocument.findMany({
      where: { OR: [{ projectId: null }, { project: projectFilter }] },
      include: { agency: { select: { name: true, code: true, agencyType: true } }, project: { select: { key: true } } },
      orderBy: { docDate: "desc" },
      take: 30,
    }),
    prisma.agencyAppointment.findMany({
      where: { OR: [{ projectId: null }, { project: projectFilter }], scheduledAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      include: { agency: { select: { name: true, code: true } }, project: { select: { key: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 15,
    }),
  ]);

  const pendingDocs = docs.filter((d) => d.status === "Đang xử lý" || (d.direction === "INCOMING" && !d.respondedAt)).length;
  const overdueDocs = docs.filter((d) => d.dueAt && d.dueAt < new Date() && !d.respondedAt).length;
  const upcomingAppts = appts.filter((a) => a.scheduledAt >= new Date() && a.status === "SCHEDULED").length;

  return (
    <AecModuleShell
      group="Pháp lý"
      name="StakeholderMap — Đối ngoại QLNN"
      subtitle="Quan hệ cơ quan QLNN: Sở XD, QHKT, BXD, KBNN, PC07, UBND. Văn bản đi-đến + lịch hẹn + hồ sơ pháp lý theo agency."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Cơ quan</div><div className="mt-1 text-2xl font-bold">{agencies.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Văn bản đang xử lý</div><div className="mt-1 text-2xl font-bold text-amber-700">{pendingDocs}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Quá hạn trả lời</div><div className="mt-1 text-2xl font-bold text-rose-700">{overdueDocs}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Lịch hẹn sắp tới</div><div className="mt-1 text-2xl font-bold text-violet-700">{upcomingAppts}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Cơ quan QLNN ({agencies.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {agencies.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Seed: <code>scripts/seed-stakeholders.ts</code></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Tên</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Cấp</th>
                  <th className="p-2 text-right">Văn bản</th>
                  <th className="p-2 text-right">Lịch hẹn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agencies.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{a.code}</td>
                    <td className="p-2 text-xs">{a.name}</td>
                    <td className="p-2 text-xs">{typeLabel[a.agencyType]}</td>
                    <td className="p-2 text-xs">{a.level} — {a.province}</td>
                    <td className="p-2 text-right text-xs">{a._count.documents}</td>
                    <td className="p-2 text-right text-xs">{a._count.appointments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Văn bản đi-đến ({docs.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {docs.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">Chưa có văn bản.</div> : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="p-2 text-left">Số</th><th className="p-2 text-left">Hướng</th><th className="p-2 text-left">Chủ đề</th><th className="p-2 text-left">Hạn</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docs.map((d) => {
                    const dm = dirLabel[d.direction] ?? { vn: d.direction, variant: "neutral" as const };
                    const overdue = d.dueAt && d.dueAt < new Date() && !d.respondedAt;
                    return (
                      <tr key={d.id} className={`hover:bg-slate-50 ${overdue ? "bg-rose-50" : ""}`}>
                        <td className="p-2 font-mono text-xs">{d.docNo}<div className="text-[10px] text-slate-500">{formatDateVn(d.docDate)}</div></td>
                        <td className="p-2"><Badge variant={dm.variant}>{dm.vn}</Badge></td>
                        <td className="p-2 text-xs"><div className="font-medium line-clamp-1">{d.subject}</div><div className="text-[10px] text-slate-500">{d.agency.name}</div></td>
                        <td className="p-2 text-xs">{d.dueAt ? <span className={overdue ? "text-rose-700" : ""}>{formatDateVn(d.dueAt)}</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lịch hẹn ({appts.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {appts.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">Không có lịch hẹn 7 ngày qua/tới.</div> : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="p-2 text-left">Thời gian</th><th className="p-2 text-left">Cơ quan</th><th className="p-2 text-left">Mục đích</th><th className="p-2 text-left">TT</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-2 text-xs">{formatDateVn(a.scheduledAt)}<div className="text-[10px] text-slate-500">{a.scheduledAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ({a.duration}p)</div></td>
                      <td className="p-2 text-xs">{a.agency.name}</td>
                      <td className="p-2 text-xs"><div className="line-clamp-1">{a.purpose}</div></td>
                      <td className="p-2 text-xs">{a.status === "DONE" ? <Badge variant="success">Xong</Badge> : a.status === "CANCELLED" ? <Badge variant="neutral">Huỷ</Badge> : <Badge variant="info">Đặt lịch</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
