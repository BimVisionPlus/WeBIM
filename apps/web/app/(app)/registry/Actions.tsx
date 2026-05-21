"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string; mst: string | null };

export function CreateForm({ orgs }: { orgs: OrgOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", legalName: orgs[0]?.name ?? "", mst: orgs[0]?.mst ?? "", capabilityClass: "HANG_II", capabilityNo: "", charteredEng: 5, totalStaff: 40, pastProjects: 10, yearsExperience: 5 });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload: Record<string, unknown> = { ...f, capabilityScope: [] };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });
    const res = await fetch("/api/registry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Đăng ký năng lực</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="registry-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Đăng ký năng lực DN</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Tổ chức</span><select required value={f.orgId} onChange={(e) => { const o = orgs.find((x) => x.id === e.target.value); setF({ ...f, orgId: e.target.value, legalName: o?.name ?? "", mst: o?.mst ?? "" }); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="orgId">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Tên pháp lý</span><input required value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="legalName" /></label>
        <label className="text-xs"><span className="block text-slate-600">MST</span><input value={f.mst} onChange={(e) => setF({ ...f, mst: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="mst" /></label>
        <label className="text-xs"><span className="block text-slate-600">Hạng</span><select value={f.capabilityClass} onChange={(e) => setF({ ...f, capabilityClass: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="capabilityClass"><option value="HANG_I">Hạng I</option><option value="HANG_II">Hạng II</option><option value="HANG_III">Hạng III</option><option value="CHUA_PHAN_HANG">Chưa phân hạng</option></select></label>
        <label className="text-xs"><span className="block text-slate-600">Số CCNL</span><input value={f.capabilityNo} onChange={(e) => setF({ ...f, capabilityNo: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="capabilityNo" /></label>
        <label className="text-xs"><span className="block text-slate-600">KS chính</span><input type="number" min={0} value={f.charteredEng} onChange={(e) => setF({ ...f, charteredEng: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="charteredEng" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu"}</button></div>
    </form>
  );
}

export function RowActions({ id, blacklisted }: { id: string; blacklisted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function go(action: string) {
    setBusy(action);
    const body: Record<string, unknown> = { action };
    if (action === "BLACKLIST") { const n = window.prompt("Lý do blacklist:"); if (!n) { setBusy(null); return; } body.reason = n; }
    if (action === "UPDATE_RATING") { const r = window.prompt("Rating mới (0-5):"); if (!r) { setBusy(null); return; } body.rating = r; }
    const res = await fetch(`/api/registry/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {!blacklisted && <button onClick={() => go("BLACKLIST")} disabled={busy === "BLACKLIST"} className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800 disabled:opacity-50" data-testid="action-BLACKLIST">{busy === "BLACKLIST" ? "…" : "Blacklist"}</button>}
      {blacklisted && <button onClick={() => go("UNBLACKLIST")} disabled={busy === "UNBLACKLIST"} className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 disabled:opacity-50" data-testid="action-UNBLACKLIST">{busy === "UNBLACKLIST" ? "…" : "Bỏ blacklist"}</button>}
      <button onClick={() => go("UPDATE_RATING")} disabled={busy === "UPDATE_RATING"} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium disabled:opacity-50" data-testid="action-UPDATE_RATING">{busy === "UPDATE_RATING" ? "…" : "Sửa rating"}</button>
    </div>
  );
}
