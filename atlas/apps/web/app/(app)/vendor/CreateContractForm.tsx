"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

export function CreateContractForm({
  orgs,
  vendorOrgs,
  suppliers,
}: {
  orgs: Array<{ id: string; name: string }>;
  vendorOrgs: Array<{ id: string; name: string; type: string }>;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [contractNo, setContractNo] = useState("");
  const [type, setType] = useState("FRAMEWORK");
  const [vendorType, setVendorType] = useState<"supplier" | "subcontractor" | "external">("supplier");
  const [vendorOrgId, setVendorOrgId] = useState("");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [vendorName, setVendorName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [valueVnd, setValueVnd] = useState("");
  const [scope, setScope] = useState("");
  const [state, setState] = useState("ACTIVE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const name =
      vendorType === "supplier" ? suppliers.find((s) => s.id === supplierId)?.name ?? vendorName :
      vendorType === "subcontractor" ? vendorOrgs.find((o) => o.id === vendorOrgId)?.name ?? vendorName :
      vendorName;
    const body: any = {
      orgId, contractNo, type, vendorName: name,
      startDate, endDate: endDate || null,
      valueVnd: valueVnd.replace(/\D/g, "") || null,
      scope: scope || undefined, state,
    };
    if (vendorType === "supplier") body.supplierId = supplierId;
    if (vendorType === "subcontractor") body.vendorOrgId = vendorOrgId;
    const res = await fetch("/api/vendor/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Không tạo được"); return; }
    setOpen(false);
    setContractNo(""); setVendorName(""); setValueVnd(""); setScope("");
    r.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700">+ Thêm hợp đồng khung</button>;

  return (
    <Card>
      <CardHeader><CardTitle>Hợp đồng khung mới</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="create-contract-form">
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Bên mua (tổ chức)</span>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số HĐ</span>
            <input value={contractNo} onChange={(e) => setContractNo(e.target.value)} required placeholder="HD-VT-2026/001" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              <option value="FRAMEWORK">Khung</option><option value="ANNUAL">Năm</option><option value="SPOT_PO">Đơn lẻ</option><option value="RAMP_UP">Thử việc</option>
            </select>
          </label>
          <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Bên bán</span>
            <div className="mt-1 flex gap-2">
              {(["supplier", "subcontractor", "external"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setVendorType(t)} className={`rounded border px-2 py-1 text-xs ${vendorType === t ? "border-blue-600 bg-blue-50 text-blue-700" : "border-[rgb(var(--line-2))] text-[rgb(var(--muted))]"}`}>
                  {t === "supplier" ? "Nhà cung cấp vật tư" : t === "subcontractor" ? "Nhà thầu phụ" : "Bên ngoài (free-text)"}
                </button>
              ))}
            </div>
          </label>
          {vendorType === "supplier" && (
            <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Chọn supplier</span>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          {vendorType === "subcontractor" && (
            <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Chọn thầu phụ</span>
              <select value={vendorOrgId} onChange={(e) => setVendorOrgId(e.target.value)} required className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
                <option value="">— Chọn —</option>
                {vendorOrgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}
              </select>
            </label>
          )}
          {vendorType === "external" && (
            <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Tên bên bán</span>
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required placeholder="CTCP Vận tải Đại Nam" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
            </label>
          )}
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Bắt đầu</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Kết thúc (tuỳ chọn)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Giá trị (VND)</span>
            <input value={valueVnd} onChange={(e) => setValueVnd(e.target.value.replace(/\D/g, ""))} placeholder="5000000000" inputMode="numeric" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Phạm vi cung cấp</span>
            <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Cung cấp thép cuộn CB400-V D6-D32" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Trạng thái</span>
            <select value={state} onChange={(e) => setState(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              <option value="DRAFT">Soạn thảo</option><option value="NEGOTIATING">Đàm phán</option><option value="ACTIVE">Đang hiệu lực</option>
            </select>
          </label>
          {err && <div className="md:col-span-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{err}</div>}
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-[rgb(var(--line-2))] px-3 py-1 text-xs">Huỷ</button>
            <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{busy ? "…" : "Lưu"}</button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
