"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string };

function nowLocal() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}

export function CreateForm({ orgs }: { orgs: OrgOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", vehiclePlate: "", driverName: "", purpose: "", startAt: nowLocal(), endAt: "", status: "SCHEDULED" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload: any = { ...f, startAt: new Date(f.startAt).toISOString() };
    if (f.endAt) payload.endAt = new Date(f.endAt).toISOString(); else delete payload.endAt;
    const res = await fetch("/api/vehicledispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, vehiclePlate: "", driverName: "", purpose: "", endAt: "", startAt: nowLocal() }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Điều xe</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="vehicledispatch-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Lệnh điều xe mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tổ chức</span><select required value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Biển số</span><input required value={f.vehiclePlate} onChange={(e) => setF({ ...f, vehiclePlate: e.target.value })} placeholder="30A-12345" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tài xế</span><input required value={f.driverName} onChange={(e) => setF({ ...f, driverName: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Mục đích</span><input required value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Đưa khách hàng đi tham quan công trình" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Bắt đầu</span><input required type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Kết thúc (dự kiến)</span><input type="datetime-local" value={f.endAt} onChange={(e) => setF({ ...f, endAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Trạng thái</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5"><option value="SCHEDULED">Đã đặt lịch</option><option value="IN_USE">Đang sử dụng</option><option value="RETURNED">Đã trả</option><option value="CANCELLED">Hủy</option></select></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu lệnh"}</button></div>
    </form>
  );
}
