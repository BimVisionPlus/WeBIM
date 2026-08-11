import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatVnd, formatVndShort, formatDateVn, computeEvm, severityFromEvm } from "@atlas/lib";
import { BoQLineEdit } from "@/components/boq-line-edit";

export const dynamic = "force-dynamic";

export default async function CostPulsePage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  const [boq, payments, materials] = await Promise.all([
    prisma.boQ.findFirst({
      where: { projectId: params.projectId, isCurrent: true },
      include: { lines: { orderBy: { code: "asc" }, take: 50 } },
    }),
    prisma.progressPayment.findMany({
      where: { projectId: params.projectId },
      orderBy: { period: "desc" },
    }),
    prisma.materialPriceIndex.findMany({
      where: { province: project?.province ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const actualCost = payments.filter((p) => p.state === "APPROVED" || p.state === "PAID").reduce((s, p) => s + p.workDoneVnd, 0n);

  let plannedPct: number | undefined;
  if (project?.startDate && project.endDate) {
    const now = Date.now();
    const s = project.startDate.getTime();
    const e = project.endDate.getTime();
    plannedPct = e > s ? Math.max(0, Math.min(1, (now - s) / (e - s))) : undefined;
  }

  const evm = boq
    ? computeEvm({
        lines: boq.lines.map((l) => ({
          qty: l.qty,
          qtyCompleted: l.qtyCompleted,
          unitPriceVnd: l.unitPriceVnd,
        })),
        actualCostVnd: actualCost,
        plannedPctComplete: plannedPct,
      })
    : null;

  const sev = evm ? severityFromEvm(evm) : null;
  const upcomingPayments = payments.filter((p) => p.state !== "PAID").slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">CostPulse — Cost Intelligence</h2>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          BoQ tracking + EVM (BAC/EV/AC/CPI/SPI) + payment milestones (VBHN 06/VBHN-BXD) + chỉ số giá vật liệu Bộ XD.
        </p>
      </div>

      {evm && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">BAC (Budget)</div>
              <div className="mt-1 text-2xl font-bold">{formatVndShort(evm.bac)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">EV (Earned)</div>
              <div className="mt-1 text-2xl font-bold">{formatVndShort(evm.ev)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">AC (Actual)</div>
              <div className="mt-1 text-2xl font-bold">{formatVndShort(evm.ac)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">CPI</div>
              <div className={`mt-1 text-2xl font-bold ${evm.cpi >= 1 ? "text-emerald-700" : evm.cpi >= 0.9 ? "text-amber-700" : "text-rose-700"}`}>
                {evm.cpi.toFixed(2)}
              </div>
              {sev && <Badge variant={sev === "WATCH" ? "warning" : "danger"}>{sev}</Badge>}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <div className="text-xs text-[rgb(var(--muted))]">EAC (Forecast)</div>
              <div className="mt-1 text-2xl font-bold">{formatVndShort(evm.eac)}</div>
              <div className="text-[11px] text-[rgb(var(--muted))]">VAC: {formatVndShort(evm.vac)}</div>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>BoQ — {boq?.name ?? "Chưa có"}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {!boq ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có BoQ. POST danh mục khối lượng qua <code className="rounded bg-[rgb(var(--raised))] px-1">/api/costpulse/boq</code>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Hạng mục</th>
                  <th className="p-2 text-center">ĐVT</th>
                  <th className="p-2 text-right">KL</th>
                  <th className="p-2 text-right">Đơn giá</th>
                  <th className="p-2 text-right">Thành tiền</th>
                  <th className="p-2 text-center">% xong</th>
                  <th className="p-2 text-right">Sửa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {boq.lines.map((l) => {
                  const pct = l.qty > 0 ? Math.round((l.qtyCompleted / l.qty) * 100) : 0;
                  return (
                    <tr key={l.id} className="relative hover:bg-[rgb(var(--raised))]">
                      <td className="p-2 font-mono text-xs">{l.code}</td>
                      <td className="p-2">{l.description}</td>
                      <td className="p-2 text-center">{l.unit}</td>
                      <td className="p-2 text-right">{l.qty.toLocaleString("vi-VN")}</td>
                      <td className="p-2 text-right">{formatVndShort(l.unitPriceVnd)}</td>
                      <td className="p-2 text-right font-medium">{formatVndShort(l.totalVnd)}</td>
                      <td className="p-2 text-center">
                        <div className="inline-flex w-20 items-center gap-1">
                          <div className="h-1.5 w-full overflow-hidden rounded bg-[rgb(var(--line))]">
                            <div
                              className={`h-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{pct}%</span>
                        </div>
                      </td>
                      <td className="relative p-2 text-right">
                        <BoQLineEdit
                          line={{
                            id: l.id,
                            code: l.code,
                            description: l.description,
                            unit: l.unit,
                            qty: l.qty,
                            qtyCompleted: l.qtyCompleted,
                            unitPriceVnd: l.unitPriceVnd.toString(),
                            category: l.category,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thanh toán giai đoạn (VBHN 06/VBHN-BXD)</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {payments.length === 0 ? (
              <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có kỳ thanh toán nào.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr>
                    <th className="p-3 text-left">Kỳ</th>
                    <th className="p-3 text-right">Khối lượng</th>
                    <th className="p-3 text-right">VAT</th>
                    <th className="p-3 text-right">Bảo lưu</th>
                    <th className="p-3 text-left">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 font-mono">{p.period}</td>
                      <td className="p-3 text-right font-medium">{formatVndShort(p.workDoneVnd)}</td>
                      <td className="p-3 text-right">{formatVndShort(p.vatVnd)}</td>
                      <td className="p-3 text-right">{formatVndShort(p.retentionVnd)}</td>
                      <td className="p-3"><Badge variant={stateBadgeVariant(p.state)}>{p.state}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chỉ số giá vật liệu</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {materials.length === 0 ? (
              <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
                Chưa có dữ liệu chỉ số giá. Import từ Sở XD {project?.province ?? "địa phương"}.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr>
                    <th className="p-3 text-left">Vật liệu</th>
                    <th className="p-3 text-right">Đơn giá</th>
                    <th className="p-3 text-left">Kỳ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td className="p-3">{m.material}<div className="text-[11px] text-[rgb(var(--muted))]">{m.unit}</div></td>
                      <td className="p-3 text-right font-medium">{formatVnd(m.priceVnd)}</td>
                      <td className="p-3 text-xs">{m.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
