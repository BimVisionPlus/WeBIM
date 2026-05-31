import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

function fmtShort(n: bigint) { return formatVnd(n); }

function weekStart(d: Date) { const w = new Date(d); w.setHours(0,0,0,0); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return w; } // Monday

export default async function CashForecastPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/tckt/cash-forecast");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const accessFilter = { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] };
  const today = new Date(); today.setHours(0,0,0,0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + 90);

  // Pull pending outflows: AdvanceTransaction (PENDING|APPROVED), ContractorAssignment milestones
  // Pull pending inflows: PaymentApplication (cdtApproved but not paid) — approx as inflow due
  const [advancesOut, assignmentsDue, paymentsIn] = await Promise.all([
    prisma.advanceTransaction.findMany({
      where: { orgId: { in: orgIds }, status: { in: ["PENDING", "APPROVED"] }, type: { in: ["TAM_UNG", "THANH_TOAN"] }, txnDate: { gte: today, lte: horizon } },
      select: { id: true, payeeName: true, amountVnd: true, txnDate: true, type: true },
    }),
    prisma.contractorAssignment.findMany({
      where: { project: accessFilter, status: "ACTIVE", endDate: { gte: today, lte: horizon } },
      select: { id: true, contractorName: true, amountVnd: true, endDate: true, pctComplete: true },
    }),
    prisma.paymentApplication.findMany({
      where: { project: accessFilter, state: { in: ["CDT_APPROVED", "KBNN_SUBMITTED"] }, cdtApprovedAt: { not: null } },
      select: { id: true, code: true, netPayableVnd: true, cdtApprovedAt: true },
    }),
  ]);

  // Bucket by week (Mon-Sun)
  type Bucket = { weekLabel: string; weekStart: Date; out: number; in: number; items: { kind: string; label: string; amount: number; due: Date }[] };
  const buckets = new Map<string, Bucket>();
  const bucket = (d: Date) => {
    const ws = weekStart(d);
    const key = ws.toISOString().slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, { weekLabel: `Tuần ${ws.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`, weekStart: ws, out: 0, in: 0, items: [] });
    return buckets.get(key)!;
  };
  for (const a of advancesOut) {
    const b = bucket(a.txnDate);
    const amt = Number(a.amountVnd);
    b.out += amt; b.items.push({ kind: a.type === "TAM_UNG" ? "Tạm ứng" : "Thanh toán", label: a.payeeName, amount: amt, due: a.txnDate });
  }
  for (const ass of assignmentsDue) {
    const b = bucket(ass.endDate);
    const remaining = Number(ass.amountVnd) * Math.max(0, (100 - ass.pctComplete) / 100);
    b.out += remaining; b.items.push({ kind: "Giao khoán", label: ass.contractorName, amount: remaining, due: ass.endDate });
  }
  for (const pm of paymentsIn) {
    if (!pm.cdtApprovedAt) continue;
    const dueEst = new Date(pm.cdtApprovedAt); dueEst.setDate(dueEst.getDate() + 14); // payment within 2 weeks of CDT approval
    if (dueEst < today || dueEst > horizon) continue;
    const b = bucket(dueEst);
    const amt = Number(pm.netPayableVnd);
    b.in += amt; b.items.push({ kind: "Thu HĐ", label: pm.code, amount: amt, due: dueEst });
  }

  const ordered = Array.from(buckets.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  let running = 0;
  for (const b of ordered) { running += b.in - b.out; (b as Bucket & { net: number; running: number }).net = b.in - b.out; (b as Bucket & { net: number; running: number }).running = running; }
  const totalOut = ordered.reduce((s, b) => s + b.out, 0);
  const totalIn = ordered.reduce((s, b) => s + b.in, 0);
  const net = totalIn - totalOut;

  return (
    <AecModuleShell group="Tài chính kế toán" name="Dự báo dòng tiền 90 ngày" subtitle="Tạm ứng + thanh toán + bàn giao khoán − thu hợp đồng. Phân bổ theo tuần.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng chi 90d</div><div className="mt-1 text-xl font-bold text-rose-700">{fmtShort(BigInt(Math.round(totalOut)))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng thu 90d</div><div className="mt-1 text-xl font-bold text-emerald-700">{fmtShort(BigInt(Math.round(totalIn)))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Net 90d</div><div className={`mt-1 text-xl font-bold ${net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{net >= 0 ? "+" : ""}{fmtShort(BigInt(Math.round(net)))}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tuần thiếu hụt</div><div className="mt-1 text-xl font-bold text-amber-700">{ordered.filter((b) => (b as Bucket & { net: number }).net < 0).length}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Theo tuần ({ordered.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {ordered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có dòng tiền dự kiến trong 90 ngày tới.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="p-2 text-left">Tuần</th><th className="p-2 text-right">Chi</th><th className="p-2 text-right">Thu</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Tích lũy</th><th className="p-2 text-left">Khoản chính</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordered.map((b) => {
                  const wk = b as Bucket & { net: number; running: number };
                  return (
                    <tr key={wk.weekStart.toISOString()} className={`hover:bg-slate-50 ${wk.net < 0 ? "bg-rose-50/30" : ""}`} data-testid={`week-${wk.weekStart.toISOString().slice(0,10)}`}>
                      <td className="p-2 text-xs font-medium">{wk.weekLabel}</td>
                      <td className="p-2 text-right text-xs text-rose-700">-{fmtShort(BigInt(Math.round(wk.out)))}</td>
                      <td className="p-2 text-right text-xs text-emerald-700">+{fmtShort(BigInt(Math.round(wk.in)))}</td>
                      <td className={`p-2 text-right text-xs font-medium ${wk.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{wk.net >= 0 ? "+" : ""}{fmtShort(BigInt(Math.round(wk.net)))}</td>
                      <td className={`p-2 text-right text-xs ${wk.running >= 0 ? "" : "text-rose-700 font-medium"}`}>{wk.running >= 0 ? "" : "-"}{fmtShort(BigInt(Math.round(Math.abs(wk.running))))}</td>
                      <td className="p-2 text-[11px] text-slate-600 line-clamp-1">{wk.items.slice(0, 2).map((it) => `${it.kind}: ${it.label}`).join(" · ")}{wk.items.length > 2 && ` +${wk.items.length - 2}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 text-[11px] text-slate-500">
        Phương pháp: chi = tạm ứng + thanh toán (pending/approved) + giá trị giao khoán còn lại tại endDate. Thu = PaymentApplication đã CĐT duyệt — ước nhận trong 14 ngày.
      </div>
    </AecModuleShell>
  );
}
