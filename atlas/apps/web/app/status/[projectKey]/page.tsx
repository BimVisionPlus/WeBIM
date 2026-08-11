/**
 * Public "Site Status" page — Statuspage-style read-only view for CĐT /
 * shareholders. No login required. Read-only.
 *
 *   /status/VHGP-S9
 */

import { notFound } from "next/navigation";
import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVndShort, formatDateVn, computeEvm } from "@atlas/lib";

export const dynamic = "force-dynamic";

export default async function SiteStatusPage({ params }: { params: { projectKey: string } }) {
  const project = await prisma.project.findUnique({
    where: { key: params.projectKey },
    include: {
      ownerOrg: { select: { name: true, slug: true } },
      stakeholders: { include: { org: { select: { name: true } } } },
      _count: {
        select: {
          issues: true,
          rfis: true,
          ncrs: true,
          acceptances: true,
          payments: true,
        },
      },
      boqs: { where: { isCurrent: true }, include: { lines: true } },
      payments: { where: { state: { in: ["APPROVED", "PAID"] } } },
      acceptances: { orderBy: { conductedAt: "desc" }, take: 5 },
    },
  });
  if (!project) notFound();

  // EVM if we have BoQ data
  let progress: number | null = null;
  let cpi: number | null = null;
  if (project.boqs[0]) {
    const lines = project.boqs[0].lines.map((l) => ({
      qty: l.qty,
      qtyCompleted: l.qtyCompleted,
      unitPriceVnd: l.unitPriceVnd,
    }));
    const ac = project.payments.reduce((s, p) => s + p.workDoneVnd, 0n);
    const evm = computeEvm({ lines, actualCostVnd: ac });
    cpi = evm.cpi;
    if (evm.bac > 0n) {
      progress = Number((evm.ev * 10000n) / evm.bac) / 100;
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--raised))]">
      <header className="border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Tiến độ công trình</div>
          <h1 className="mt-1 text-2xl font-bold text-[rgb(var(--ink))]">{project.name}</h1>
          <div className="mt-1 text-sm text-[rgb(var(--muted))]">
            {project.ownerOrg.name} · {project.province} · {project.permitNumber ?? "—"}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Badge variant={project.status === "IN_PROGRESS" ? "info" : "neutral"}>{project.status}</Badge>
            {progress !== null && (
              <Badge variant={progress >= 80 ? "success" : progress >= 40 ? "info" : "warning"}>
                Tiến độ {progress.toFixed(0)}%
              </Badge>
            )}
            {cpi !== null && (
              <Badge variant={cpi >= 1 ? "success" : cpi >= 0.9 ? "warning" : "danger"}>
                CPI {cpi.toFixed(2)}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">Giá trị hợp đồng</div>
              <div className="mt-1 text-xl font-bold">{formatVndShort(project.contractValueVnd)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">Khởi công</div>
              <div className="mt-1 text-lg font-semibold">{formatDateVn(project.startDate)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">Hoàn thành dự kiến</div>
              <div className="mt-1 text-lg font-semibold">{formatDateVn(project.endDate)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">Nghiệm thu</div>
              <div className="mt-1 text-xl font-bold">{project._count.acceptances}</div>
              <div className="text-[11px] text-[rgb(var(--muted))]">BBNT đã tạo</div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Bên tham gia</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            {project.stakeholders.map((s) => (
              <div key={s.id} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
                <div className="text-xs text-[rgb(var(--muted))]">{s.role}</div>
                <div className="mt-1 font-medium text-[rgb(var(--ink))]">{s.org.name}</div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hoạt động gần nhất</CardTitle></CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--line))] p-0">
            {project.acceptances.length === 0 ? (
              <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có biên bản nghiệm thu công bố.</div>
            ) : (
              project.acceptances.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-[rgb(var(--muted))]">{a.code} · {a.type}</div>
                  </div>
                  <div className="text-right text-xs text-[rgb(var(--muted))]">
                    {a.conductedAt ? formatDateVn(a.conductedAt) : a.scheduledAt ? `Dự kiến ${formatDateVn(a.scheduledAt)}` : "—"}
                    <div><Badge variant="neutral">{a.state}</Badge></div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <p className="text-center text-xs text-[rgb(var(--muted))]">
          Trang công khai — dữ liệu cập nhật trực tiếp từ Atlas. Không yêu cầu đăng nhập.
        </p>
      </main>
    </div>
  );
}
