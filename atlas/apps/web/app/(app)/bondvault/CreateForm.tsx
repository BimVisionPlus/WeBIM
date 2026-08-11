"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };
const today = new Date().toISOString().slice(0, 10);
const plus1y = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    projectId: projects[0]?.id ?? "", bondNumber: "", type: "BAO_LANH_THUC_HIEN",
    issuerBank: "Vietcombank", beneficiary: "", amountVnd: "", pctOfContract: "",
    contractRef: "", issuedAt: today, effectiveFrom: today, expiresAt: plus1y, feeVnd: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    // Strip empty-string optionals — zod regex rejects "" for optional string fields.
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/bondvault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : JSON.stringify(j.error)); return; }
    setOpen(false); setF({ ...f, bondNumber: "", amountVnd: "", beneficiary: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Thêm bảo lãnh</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="bondvault-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Bảo lãnh mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số bảo lãnh</span><input required value={f.bondNumber} onChange={(e) => setF({ ...f, bondNumber: e.target.value })} placeholder="BL-VCB-2026-XXXXX" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="bondNumber" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="type">
            <option value="BAO_LANH_THUC_HIEN">BL Thực hiện HĐ</option>
            <option value="BAO_LANH_TAM_UNG">BL Tạm ứng</option>
            <option value="BAO_LANH_BAO_HANH">BL Bảo hành</option>
            <option value="BAO_LANH_DU_THAU">BL Dự thầu</option>
          </select>
        </label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ngân hàng</span><input required value={f.issuerBank} onChange={(e) => setF({ ...f, issuerBank: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="issuerBank" /></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Bên thụ hưởng</span><input required value={f.beneficiary} onChange={(e) => setF({ ...f, beneficiary: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="beneficiary" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Giá trị (VND)</span><input required value={f.amountVnd} onChange={(e) => setF({ ...f, amountVnd: e.target.value })} pattern="\d+" placeholder="28500000000" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="amountVnd" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">% HĐ</span><input value={f.pctOfContract} onChange={(e) => setF({ ...f, pctOfContract: e.target.value })} placeholder="10" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="pctOfContract" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số HĐ</span><input value={f.contractRef} onChange={(e) => setF({ ...f, contractRef: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="contractRef" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ngày cấp</span><input required type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="issuedAt" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Hiệu lực từ</span><input required type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="effectiveFrom" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Hết hạn</span><input required type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="expiresAt" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo"}</button></div>
    </form>
  );
}
