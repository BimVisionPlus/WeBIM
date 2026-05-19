import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatVndShort, issueTypeMeta, relativeDateVn, orgTypeLabel } from "@atlas/lib";
import Link from "next/link";

export default async function ProjectOverview({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const [issuesByType, recentIssues, dailyLogs, acceptances, payments, stakeholders] = await Promise.all([
    prisma.issue.groupBy({
      by: ["type", "state"],
      where: { projectId },
      _count: true,
    }),
    prisma.issue.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { assignee: true },
    }),
    prisma.dailyLog.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      take: 3,
    }),
    prisma.acceptance.findMany({
      where: { projectId },
      orderBy: { scheduledAt: "desc" },
      take: 5,
    }),
    prisma.progressPayment.findMany({
      where: { projectId },
      orderBy: { period: "desc" },
      take: 3,
    }),
    prisma.projectStakeholder.findMany({
      where: { projectId },
      include: { org: true },
    }),
  ]);

  // Count by type
  const typeCounts = new Map<string, number>();
  for (const row of issuesByType) {
    typeCounts.set(row.type, (typeCounts.get(row.type) ?? 0) + row._count);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {(["RFI", "SUBMITTAL", "NCR", "PUNCH", "CHANGE_ORDER", "TASK"] as const).map((t) => {
          const meta = issueTypeMeta[t];
          return (
            <Card key={t}>
              <CardBody className="py-3">
                <div className="text-xs text-slate-500">{meta?.label ?? t}</div>
                <div className="mt-1 text-2xl font-bold">{typeCounts.get(t) ?? 0}</div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cập nhật gần đây</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-slate-100 p-0">
            {recentIssues.map((i) => (
              <Link
                key={i.id}
                href={`/projects/${projectId}/site/issues/${i.key}`}
                className="flex items-center justify-between gap-4 p-3 transition hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] text-white"
                    style={{ background: issueTypeMeta[i.type]?.color }}
                  >
                    {issueTypeMeta[i.type]?.prefix}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{i.key}</span>
                  <span className="truncate text-sm text-slate-900">{i.title}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <Badge variant={stateBadgeVariant(i.state)}>{i.state}</Badge>
                  <span>{i.assignee?.name ?? "—"}</span>
                  <span>{relativeDateVn(i.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Các bên tham gia</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              {stakeholders.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-slate-700">{s.org.name}</span>
                  <Badge variant="neutral">{orgTypeLabel[s.role] ?? s.role}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Nhật ký thi công</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              {dailyLogs.map((l) => (
                <div key={l.id} className="flex justify-between text-xs">
                  <span className="text-slate-700">{relativeDateVn(l.date)}</span>
                  <span className="text-slate-500">{l.weather}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Nghiệm thu & Thanh toán</CardTitle></CardHeader>
            <CardBody className="space-y-3 text-sm">
              {acceptances.map((a) => (
                <div key={a.id} className="flex justify-between text-xs">
                  <span className="text-slate-700">{a.code}</span>
                  <Badge variant={stateBadgeVariant(a.state)}>{a.state}</Badge>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-slate-700">Kỳ {p.period}</span>
                    <span className="font-medium">{formatVndShort(p.workDoneVnd)}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
