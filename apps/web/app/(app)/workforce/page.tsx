import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, CheckinAction } from "./Actions";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

const methodLabel: Record<string, string> = { QR: "QR", FACE: "Face", GPS: "GPS", MANUAL: "Thủ công" };

export default async function WorkforcePage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/workforce");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const [workers, todayAttendance, accessibleProjects] = await Promise.all([
    prisma.siteWorker.findMany({
      where: { OR: [{ orgId: { in: orgIds } }, { project: projectFilter }] },
      include: { org: { select: { name: true } }, project: { select: { key: true } }, _count: { select: { attendance: true } } },
      orderBy: [{ state: "asc" }, { fullName: "asc" }],
      take: 100,
    }),
    prisma.attendance.findMany({
      where: { project: projectFilter, checkInAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      include: { worker: { select: { fullName: true, workerCode: true, trade: true } }, project: { select: { key: true } } },
      orderBy: { checkInAt: "desc" },
      take: 50,
    }),
    prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } }),
  ]);

  const now = new Date();
  const active = workers.filter((w) => w.state === "ACTIVE").length;
  const hseExpired = workers.filter((w) => w.hseCertExpiry && w.hseCertExpiry <= now).length;
  const proExpiring = workers.filter((w) => w.proLicenseExpiry && (w.proLicenseExpiry.getTime() - now.getTime()) / 86400000 <= 60 && w.proLicenseExpiry > now).length;
  const todayInCount = todayAttendance.length;

  return (
    <AecModuleShell
      group="Pháp lý"
      name="WorkforceHub — Nhân lực công trường"
      subtitle="Sổ NLĐ + chứng chỉ hành nghề HĐXD (KTS/KS theo Luật XD 50/2014). Thẻ QR ra vào + GPS check-in + face match InsightFace (OSS)."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">NLĐ đang làm</div><div className="mt-1 text-2xl font-bold text-emerald-700">{active}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Có mặt hôm nay</div><div className="mt-1 text-2xl font-bold">{todayInCount}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Chứng chỉ ATLĐ hết hạn</div><div className="mt-1 text-2xl font-bold text-rose-700">{hseExpired}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">CC hành nghề sắp hết ≤60d</div><div className="mt-1 text-2xl font-bold text-amber-700">{proExpiring}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Danh sách NLĐ ({workers.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {workers.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có nhân lực. Bấm “Thêm NLĐ” để đăng ký công nhân.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã NLĐ</th>
                  <th className="p-2 text-left">Họ tên</th>
                  <th className="p-2 text-left">Nghề / Bậc</th>
                  <th className="p-2 text-left">Tổ chức</th>
                  <th className="p-2 text-left">CC ATLĐ</th>
                  <th className="p-2 text-left">CC hành nghề</th>
                  <th className="p-2 text-right">Ngày công</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w) => {
                  const hseOk = w.hseCertExpiry && w.hseCertExpiry > now;
                  const proOk = !w.proLicenseExpiry || w.proLicenseExpiry > now;
                  return (
                    <tr key={w.id} className="hover:bg-slate-50" data-testid={`worker-${w.workerCode}`}>
                      <td className="p-2 font-mono text-xs">{w.workerCode}</td>
                      <td className="p-2 text-xs"><div className="font-medium">{w.fullName}</div>{w.idNo && <div className="text-[10px] text-slate-500">{w.idNo}</div>}</td>
                      <td className="p-2 text-xs">{w.trade}{w.level && <div className="text-[10px] text-slate-500">{w.level}</div>}</td>
                      <td className="p-2 text-xs">{w.org.name}</td>
                      <td className="p-2 text-xs">{w.hseCertNumber ? <><span className={hseOk ? "text-emerald-700" : "text-rose-700"}>{w.hseCertNumber}</span><div className="text-[10px] text-slate-500">{w.hseCertExpiry ? `hết ${formatDateVn(w.hseCertExpiry)}` : ""}</div></> : <span className="text-slate-400">Chưa có</span>}</td>
                      <td className="p-2 text-xs">{w.proLicenseNo ? <><span className={proOk ? "text-emerald-700" : "text-amber-700"}>{w.proLicenseNo}</span><div className="text-[10px] text-slate-500">{w.proLicenseExpiry ? formatDateVn(w.proLicenseExpiry) : ""}</div></> : <span className="text-slate-400">—</span>}</td>
                      <td className="p-2 text-right text-xs">{w._count.attendance}</td>
                      <td className="p-2"><div className="flex items-center gap-2"><CheckinAction id={w.id} /><RowActions id={w.id} hasAttendance={w._count.attendance > 0} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Check-in hôm nay ({todayAttendance.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {todayAttendance.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Hôm nay chưa có check-in nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Giờ</th>
                  <th className="p-2 text-left">Mã NLĐ</th>
                  <th className="p-2 text-left">Tên</th>
                  <th className="p-2 text-left">Cổng</th>
                  <th className="p-2 text-left">Phương thức</th>
                  <th className="p-2 text-left">PPE (YOLO)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayAttendance.map((a) => {
                  const ppe = a.ppeStatus as Record<string, boolean> | null;
                  const ppeIssue = ppe && Object.values(ppe).some((v) => !v);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-2 text-xs">{a.checkInAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-2 font-mono text-xs">{a.worker.workerCode}</td>
                      <td className="p-2 text-xs">{a.worker.fullName} <span className="text-[10px] text-slate-500">· {a.worker.trade}</span></td>
                      <td className="p-2 text-xs">{a.gateCode ?? "—"}</td>
                      <td className="p-2 text-xs">{methodLabel[a.method]}{a.faceMatchScore && <span className="text-[10px] text-slate-500"> · {Number(a.faceMatchScore).toFixed(3)}</span>}</td>
                      <td className="p-2 text-xs">{ppe ? <span className={ppeIssue ? "text-rose-700" : "text-emerald-700"}>{Object.entries(ppe).filter(([, v]) => v).map(([k]) => k).join(", ")}{ppeIssue ? " ⚠️" : " ✓"}</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-2 text-[11px] text-slate-500">
        OSS face match: <code>InsightFace</code> ArcFace 512-dim embedding, cosine similarity ≥0.6 = match.
        PPE check qua SiteEye (Qwen2.5-VL / YOLOv8) khi check-in.
      </div>
    </AecModuleShell>
  );
}
