"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string };
export type TerritoryOpt = { id: string; name: string };

export function CreateForm({ orgs, territories }: { orgs: OrgOpt[]; territories: TerritoryOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", territoryId: "", name: "", clientName: "", province: "", estValueVnd: "", source: "", status: "POTENTIAL", nextActionAt: "", note: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, name: "", clientName: "", province: "", estValueVnd: "", source: "", nextActionAt: "", note: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm cơ hội</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="lead-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Cơ hội / dự án mới đang theo dõi</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Tổ chức</span><select required value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Địa bàn (tùy chọn)</span><select value={f.territoryId} onChange={(e) => setF({ ...f, territoryId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"><option value="">— Chưa phân —</option>{territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Trạng thái</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"><option value="POTENTIAL">Tiềm năng</option><option value="TRACKING">Đang theo dõi</option><option value="WON">Đã trúng</option><option value="LOST">Không trúng</option><option value="ARCHIVED">Lưu trữ</option></select></label>
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tên dự án / gói thầu</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-slate-600">Tỉnh</span><input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-slate-600">Khách hàng</span><input value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-slate-600">Giá trị dự kiến (VND)</span><input value={f.estValueVnd} onChange={(e) => setF({ ...f, estValueVnd: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-slate-600">Nguồn</span><input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="muasamcong / giới thiệu / báo chí" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-slate-600">Hành động tiếp theo</span><input type="date" value={f.nextActionAt} onChange={(e) => setF({ ...f, nextActionAt: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Ghi chú</span><textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu"}</button></div>
    </form>
  );
}
