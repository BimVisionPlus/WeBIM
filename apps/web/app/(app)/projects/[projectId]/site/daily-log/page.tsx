import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { DailyLogForm } from "./form";
import { DailyLogControls } from "@/components/daily-log-controls";

export default async function DailyLogPage({ params }: { params: { projectId: string } }) {
  const logs = await prisma.dailyLog.findMany({
    where: { projectId: params.projectId },
    orderBy: { date: "desc" },
    include: { author: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Nhật ký công trình</h2>
          <p className="text-xs text-[rgb(var(--muted))]">
            NĐ 06/2021 Điều 10 — Nhật ký thi công xây dựng phải lập hàng ngày, có chữ ký các bên.
          </p>
        </div>
        <DailyLogForm projectId={params.projectId} />
      </div>

      <div className="space-y-3">
        {logs.map((l) => (
          <Card key={l.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {formatDateVn(l.date)} · Ca {l.shift === "DAY" ? "ngày" : "đêm"}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                  <span>{l.weather}</span>
                  <DailyLogControls
                    log={{
                      id: l.id,
                      weather: l.weather,
                      workforce: Array.isArray(l.workforce) ? (l.workforce as { trade: string; count: number }[]) : [],
                      workDone: l.workDone,
                      workTomorrow: l.workTomorrow,
                      safetyNotes: l.safetyNotes,
                      signoffByCdtId: l.signoffByCdtId,
                      signoffByGsId: l.signoffByGsId,
                      signedAt: l.signedAt ? l.signedAt.toISOString() : null,
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">Nhân lực</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Array.isArray(l.workforce) &&
                    (l.workforce as any[]).map((w, idx) => (
                      <Badge key={idx} variant="info">
                        {w.trade}: {w.count}
                      </Badge>
                    ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
                  Công việc đã làm
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[rgb(var(--ink-2))]">{l.workDone}</p>
              </div>
              {l.workTomorrow && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
                    Kế hoạch ngày mai
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[rgb(var(--ink-2))]">{l.workTomorrow}</p>
                </div>
              )}
              {l.safetyNotes && (
                <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                  <div className="font-semibold">An toàn / Ghi chú</div>
                  <p className="mt-0.5">{l.safetyNotes}</p>
                </div>
              )}
              <div className="border-t border-[rgb(var(--line))] pt-2 text-xs text-[rgb(var(--muted))]">
                Người lập: {l.author.name}
              </div>
            </CardBody>
          </Card>
        ))}
        {logs.length === 0 && (
          <Card>
            <CardBody className="py-10 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có nhật ký nào.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
