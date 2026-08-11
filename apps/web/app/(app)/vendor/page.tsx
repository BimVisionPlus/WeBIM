import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateContractForm } from "./CreateContractForm";
import { CreateCreditForm } from "./CreateCreditForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const stateMeta: Record<string, { vn: string; variant: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  DRAFT: { vn: "Soạn thảo", variant: "neutral" },
  NEGOTIATING: { vn: "Đàm phán", variant: "warning" },
  ACTIVE: { vn: "Đang hiệu lực", variant: "success" },
  EXPIRED: { vn: "Hết hạn", variant: "neutral" },
  TERMINATED: { vn: "Chấm dứt", variant: "danger" },
};

const typeMeta: Record<string, string> = {
  FRAMEWORK: "Khung",
  SPOT_PO: "Đơn lẻ",
  ANNUAL: "Năm",
  RAMP_UP: "Thử việc",
};

const creditTypeMeta: Record<string, { vn: string; variant: "warning" | "success" | "info" | "neutral"; sign: number }> = {
  PURCHASE: { vn: "Nhập hàng", variant: "warning", sign: 1 },
  PAYMENT: { vn: "Thanh toán", variant: "success", sign: -1 },
  RETURN: { vn: "Trả hàng", variant: "info", sign: -1 },
  ADJUST: { vn: "Điều chỉnh", variant: "neutral", sign: 0 },
};

export default async function VendorPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/vendor");

  const sp = await searchParams;
  const tab = (sp.tab ?? "all") as "all" | "suppliers" | "subcontractors" | "contracts" | "credit";

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const [suppliers, subcontractors, contracts, credit, supplierCount, subCount, activeContractCount, totalContractValue] = await Promise.all([
    prisma.supplier.findMany({
      where: { active: true },
      include: { _count: { select: { items: true, vendorContracts: true, creditEntries: true } } },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      take: 50,
    }),
    prisma.contractorProfile.findMany({
      include: { org: { select: { id: true, name: true, type: true } }, _count: { select: { performances: true } } },
      orderBy: [{ blacklisted: "asc" }, { rating: "desc" }, { legalName: "asc" }],
      take: 50,
    }),
    prisma.vendorContract.findMany({
      where: { orgId: { in: orgIds } },
      include: { vendorOrg: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: [{ state: "asc" }, { startDate: "desc" }],
      take: 50,
    }),
    prisma.vendorCreditEntry.findMany({
      where: { orgId: { in: orgIds } },
      orderBy: { txnDate: "desc" },
      take: 50,
    }),
    prisma.supplier.count({ where: { active: true } }),
    prisma.contractorProfile.count(),
    prisma.vendorContract.count({ where: { orgId: { in: orgIds }, state: "ACTIVE" } }),
    prisma.vendorContract.aggregate({ where: { orgId: { in: orgIds }, state: "ACTIVE" }, _sum: { valueVnd: true } }).then((r) => r._sum.valueVnd ?? BigInt(0)),
  ]);

  // Aggregate credit balance per vendor (sum signed amounts).
  const balances = new Map<string, bigint>();
  for (const c of credit) {
    const key = c.vendorOrgId ?? c.supplierId ?? c.vendorName;
    const sign = creditTypeMeta[c.type]?.sign ?? 0;
    const cur = balances.get(key) ?? BigInt(0);
    balances.set(key, cur + BigInt(sign) * c.amountVnd);
  }
  const totalOutstanding = Array.from(balances.values()).reduce((s, v) => s + (v > 0 ? v : BigInt(0)), BigInt(0));

  const orgsForContract = orgs;
  const vendorOrgs = await prisma.organization.findMany({
    where: { type: { in: ["NHA_THAU_PHU", "TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE"] } },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  return (
    <AecModuleShell group="Vendor" name="Atlas Vendor — Quản lý nhà cung cấp & thầu phụ" subtitle="Sổ supplier + subcontractor, hợp đồng khung, sổ công nợ, đánh giá hiệu suất, chỉ số giá Bộ XD.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Nhà cung cấp vật tư</div><div className="mt-1 text-2xl font-bold text-blue-700">{supplierCount}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Nhà thầu phụ</div><div className="mt-1 text-2xl font-bold text-violet-700">{subCount}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Hợp đồng đang hiệu lực</div><div className="mt-1 text-2xl font-bold text-emerald-700">{activeContractCount}</div><div className="text-[10px] text-[rgb(var(--muted))]">{formatVnd(totalContractValue)}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng công nợ phải trả</div><div className="mt-1 text-xl font-bold text-amber-700">{formatVnd(totalOutstanding)}</div></CardBody></Card>
      </div>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-[rgb(var(--line))]" data-testid="vendor-tabs">
        {[
          { key: "all", label: "Tổng quan" },
          { key: "suppliers", label: "Nhà cung cấp vật tư", count: suppliers.length },
          { key: "subcontractors", label: "Nhà thầu phụ", count: subcontractors.length },
          { key: "contracts", label: "Hợp đồng khung", count: contracts.length },
          { key: "credit", label: "Sổ công nợ", count: credit.length },
        ].map((t) => {
          const isActive = t.key === tab;
          return (
            <Link key={t.key} href={`/vendor?tab=${t.key}`} data-testid={`tab-${t.key}`} className={`relative -mb-px px-3 py-2 text-sm font-medium ${isActive ? "border-b-2 border-blue-600 text-blue-700" : "text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]"}`}>
              {t.label}{typeof t.count === "number" && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-blue-100 text-blue-700" : "bg-[rgb(var(--raised))] text-[rgb(var(--muted))]"}`}>{t.count}</span>}
            </Link>
          );
        })}
      </nav>

      {(tab === "all" || tab === "suppliers") && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Nhà cung cấp vật tư ({suppliers.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {suppliers.length === 0 ? (
              <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có nhà cung cấp. Bấm "Thêm hợp đồng" để bắt đầu.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr><th className="p-2 text-left">Tên</th><th className="p-2 text-left">MST</th><th className="p-2 text-left">Liên hệ</th><th className="p-2 text-right">Vật tư</th><th className="p-2 text-right">HĐ khung</th><th className="p-2 text-left">Rating</th></tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-supplier-${s.id}`}>
                      <td className="p-2 font-medium">{s.name}</td>
                      <td className="p-2 font-mono text-xs">{s.mst ?? "—"}</td>
                      <td className="p-2 text-xs">{s.phone ?? "—"} {s.email && <span className="text-[rgb(var(--muted-2))]">· {s.email}</span>}</td>
                      <td className="p-2 text-right text-xs">{s._count.items}</td>
                      <td className="p-2 text-right text-xs">{s._count.vendorContracts}</td>
                      <td className="p-2 text-xs">{s.rating ? `${s.rating.toFixed(1)} ⭐` : <span className="text-[rgb(var(--muted-2))]">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {(tab === "all" || tab === "subcontractors") && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Nhà thầu phụ ({subcontractors.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            {subcontractors.length === 0 ? (
              <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có hồ sơ năng lực thầu phụ nào.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                  <tr><th className="p-2 text-left">Đơn vị</th><th className="p-2 text-left">Hạng</th><th className="p-2 text-left">Phạm vi</th><th className="p-2 text-right">DA đã làm</th><th className="p-2 text-right">Đánh giá</th><th className="p-2 text-left">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {subcontractors.map((c) => (
                    <tr key={c.id} className={`hover:bg-[rgb(var(--raised))] ${c.blacklisted ? "bg-rose-50/40" : ""}`} data-testid={`row-sub-${c.id}`}>
                      <td className="p-2"><div className="font-medium">{c.legalName}</div><div className="text-[10px] text-[rgb(var(--muted))] font-mono">{c.mst ?? "—"}</div></td>
                      <td className="p-2"><Badge variant={c.capabilityClass === "HANG_I" ? "info" : c.capabilityClass === "HANG_II" ? "warning" : "neutral"}>{c.capabilityClass.replace("HANG_", "Hạng ")}</Badge></td>
                      <td className="p-2 text-xs line-clamp-1">{c.capabilityScope.join(", ") || "—"}</td>
                      <td className="p-2 text-right text-xs">{c.pastProjects}</td>
                      <td className="p-2 text-right text-xs">{c.rating ? `${Number(c.rating).toFixed(1)} ⭐` : <span className="text-[rgb(var(--muted-2))]">—</span>}</td>
                      <td className="p-2">{c.blacklisted ? <Badge variant="danger">Blacklist</Badge> : <Badge variant="success">OK</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {(tab === "all" || tab === "contracts") && (
        <>
          <div className="mt-6"><CreateContractForm orgs={orgsForContract} vendorOrgs={vendorOrgs} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} /></div>
          <Card className="mt-4">
            <CardHeader><CardTitle>Hợp đồng khung ({contracts.length})</CardTitle></CardHeader>
            <CardBody className="p-0">
              {contracts.length === 0 ? (
                <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có hợp đồng nhà cung cấp / thầu phụ.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                    <tr><th className="p-2 text-left">Số HĐ</th><th className="p-2 text-left">Loại</th><th className="p-2 text-left">Bên bán</th><th className="p-2 text-left">Hiệu lực</th><th className="p-2 text-right">Giá trị</th><th className="p-2 text-left">Trạng thái</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--line))]">
                    {contracts.map((c) => {
                      const s = stateMeta[c.state] ?? { vn: c.state, variant: "neutral" as const };
                      return (
                        <tr key={c.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-contract-${c.id}`}>
                          <td className="p-2 font-mono text-xs">{c.contractNo}</td>
                          <td className="p-2"><Badge variant="neutral">{typeMeta[c.type]}</Badge></td>
                          <td className="p-2"><div className="font-medium">{c.vendorName}</div><div className="text-[10px] text-[rgb(var(--muted))]">{c.scope?.slice(0, 80) ?? ""}</div></td>
                          <td className="p-2 text-xs">{formatDateVn(c.startDate)} → {c.endDate ? formatDateVn(c.endDate) : "—"}</td>
                          <td className="p-2 text-right font-medium">{c.valueVnd ? formatVnd(c.valueVnd) : "—"}</td>
                          <td className="p-2"><Badge variant={s.variant}>{s.vn}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {(tab === "all" || tab === "credit") && (
        <>
          <div className="mt-6"><CreateCreditForm orgs={orgsForContract} vendorOrgs={vendorOrgs} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} contracts={contracts.map((c) => ({ id: c.id, contractNo: c.contractNo, vendorName: c.vendorName }))} /></div>
          <Card className="mt-4">
            <CardHeader><CardTitle>Sổ công nợ ({credit.length})</CardTitle></CardHeader>
            <CardBody className="p-0">
              {credit.length === 0 ? (
                <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có giao dịch công nợ.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                    <tr><th className="p-2 text-left">Ngày</th><th className="p-2 text-left">Số phiếu</th><th className="p-2 text-left">Đối tác</th><th className="p-2 text-left">Loại</th><th className="p-2 text-right">Số tiền</th><th className="p-2 text-left">Ghi chú</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--line))]">
                    {credit.map((e) => {
                      const m = creditTypeMeta[e.type] ?? { vn: e.type, variant: "neutral" as const, sign: 0 };
                      return (
                        <tr key={e.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-credit-${e.id}`}>
                          <td className="p-2 text-xs">{formatDateVn(e.txnDate)}</td>
                          <td className="p-2 font-mono text-xs">{e.txnNo ?? "—"}</td>
                          <td className="p-2 font-medium">{e.vendorName}</td>
                          <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td>
                          <td className={`p-2 text-right font-medium ${m.sign > 0 ? "text-amber-700" : m.sign < 0 ? "text-emerald-700" : "text-[rgb(var(--ink-2))]"}`}>{m.sign > 0 ? "+" : m.sign < 0 ? "−" : ""}{formatVnd(e.amountVnd)}</td>
                          <td className="p-2 text-xs text-[rgb(var(--muted))] line-clamp-1">{e.notes ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </AecModuleShell>
  );
}
