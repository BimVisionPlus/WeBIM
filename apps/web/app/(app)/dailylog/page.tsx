import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

export default async function DailyLogOrgPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/dailylog");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [
      { ownerOrgId: { in: orgIds } },
      { stakeholders: { some: { orgId: { in: orgIds } } } },
    ],
  };

  const [logs, projects] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { project: projectFilter },
      include: { author: { select: { name: true } }, project: { select: { key: true, name: true } } },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.project.findMany({ where: projectFilter, select: { id: true, key: true } }),
  ]);

  const totalProjects = projects.length;
  const signed = logs.filter((l) => l.signedAt).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = logs.filter((l) => {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;

  return (
    <AecModuleShell
      group="Thi công"
      name="Nhật ký công trình"
      subtitle="NĐ 06/2021 Điều 10 — nhật ký bắt buộc hàng ngày. Mobile-first, offline-capable, voice-to-text Whisper.cpp."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng nhật ký</div><div className="mt-1 text-2xl font-bold">{logs.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Hôm nay</div><div className="mt-1 text-2xl font-bold text-blue-700">{todayCount}/{totalProjects}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã GS ký</div><div className="mt-1 text-2xl font-bold text-emerald-700">{signed}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Dự án theo dõi</div><div className="mt-1 text-2xl font-bold">{totalProjects}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Nhật ký gần nhất ({logs.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có nhật ký công trình. App mobile (Capacitor) gửi qua{" "}
              <code className="rounded bg-slate-100 px-1">POST /api/daily-logs</code>.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {logs.slice(0, 40).map((l) => (
                <li key={l.id} className="p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-600">{l.project.key}</span>
                    <span className="text-xs text-slate-500">{formatDateVn(l.date)}</span>
                    <Badge variant={l.shift === "NIGHT" ? "violet" : "neutral"}>{l.shift === "NIGHT" ? "Ca đêm" : "Ca ngày"}</Badge>
                    {l.weather && <span className="text-xs text-slate-500">· {l.weather}</span>}
                    {l.signedAt && <Badge variant="success">Đã GS ký</Badge>}
                  </div>
                  <div className="mt-1 text-slate-900">{l.workDone.slice(0, 200)}{l.workDone.length > 200 ? "…" : ""}</div>
                  {l.safetyNotes && (
                    <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">⚠ {l.safetyNotes.slice(0, 150)}</div>
                  )}
                  <div className="text-[11px] text-slate-500">{l.author.name}</div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
