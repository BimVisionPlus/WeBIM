"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

export function CreateCreditForm({
  orgs,
  vendorOrgs,
  suppliers,
  contracts,
}: {
  orgs: Array<{ id: string; name: string }>;
  vendorOrgs: Array<{ id: string; name: string; type: string }>;
  suppliers: Array<{ id: string; name: string }>;
  contracts: Array<{ id: string; contractNo: string; vendorName: string }>;
}) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [contractId, setContractId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorType, setVendorType] = useState<"supplier" | "subcontractor" | "external">("supplier");
  const [vendorOrgId, setVendorOrgId] = useState("");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [txnNo, setTxnNo] = useState("");
  const [type, setType] = useState("PURCHASE");
  const [amountVnd, setAmountVnd] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const name = contractId ? (contracts.find((c) => c.id === contractId)?.vendorName ?? vendorName) :
      vendorType === "supplier" ? suppliers.find((s) => s.id === supplierId)?.name ?? vendorName :
      vendorType === "subcontractor" ? vendorOrgs.find((o) => o.id === vendorOrgId)?.name ?? vendorName :
      vendorName;
    const body: any = { orgId, contractId: contractId || null, vendorName: name, txnDate, txnNo: txnNo || undefined, type, amountVnd: amountVnd.replace(/\D/g, "") || "0", notes: notes || undefined };
    if (vendorType === "supplier") body.supplierId = supplierId;
    if (vendorType === "subcontractor") body.vendorOrgId = vendorOrgId;
    const res = await fetch("/api/vendor/credit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Không tạo được"); return; }
    setOpen(false);
    setTxnNo(""); setAmountVnd(""); setNotes("");
    r.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] hover:bg-emerald-700">+ Ghi giao dịch công nợ</button>;

  return (
    <Card>
      <CardHeader><CardTitle>Giao dịch công nợ</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tổ chức</span>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ngày</span>
            <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số phiếu</span>
            <input value={txnNo} onChange={(e) => setTxnNo(e.target.value)} placeholder="PN-2026/001" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Hợp đồng liên quan (tuỳ chọn)</span>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              <option value="">— Không gắn với HĐ —</option>
              {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNo} — {c.vendorName}</option>)}
            </select>
          </label>
          {!contractId && (
            <>
              <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Đối tác</span>
                <div className="mt-1 flex gap-2">
                  {(["supplier", "subcontractor", "external"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setVendorType(t)} className={`rounded border px-2 py-1 text-xs ${vendorType === t ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-[rgb(var(--line-2))] text-[rgb(var(--muted))]"}`}>
                      {t === "supplier" ? "Nhà cung cấp" : t === "subcontractor" ? "Thầu phụ" : "Bên ngoài"}
                    </button>
                  ))}
                </div>
              </label>
              {vendorType === "supplier" && (
                <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Supplier</span>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}
              {vendorType === "subcontractor" && (
                <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Thầu phụ</span>
                  <select value={vendorOrgId} onChange={(e) => setVendorOrgId(e.target.value)} required className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
                    <option value="">— Chọn —</option>
                    {vendorOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
              )}
              {vendorType === "external" && (
                <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Tên đối tác</span>
                  <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
                </label>
              )}
            </>
          )}
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              <option value="PURCHASE">Nhập hàng (phát sinh nợ)</option><option value="PAYMENT">Thanh toán (trả tiền)</option><option value="RETURN">Trả hàng</option><option value="ADJUST">Điều chỉnh</option>
            </select>
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số tiền (VND)</span>
            <input value={amountVnd} onChange={(e) => setAmountVnd(e.target.value.replace(/\D/g, ""))} required inputMode="numeric" placeholder="120000000" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ghi chú</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Đợt thép tháng 6/2026" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          {err && <div className="md:col-span-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{err}</div>}
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-[rgb(var(--line-2))] px-3 py-1 text-xs">Huỷ</button>
            <button type="submit" disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{busy ? "…" : "Lưu"}</button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
