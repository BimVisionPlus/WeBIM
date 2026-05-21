"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", workerCode: "", fullName: "", idNo: "", trade: "Thợ", level: "Thợ bậc 4/7", isStaff: false, hseGroup: "N4" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload: Record<string, unknown> = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "" && v !== false));
    if (f.isStaff) payload.isStaff = true;
    const res = await fetch("/api/workforce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, workerCode: "", fullName: "", idNo: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm NLĐ</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="workforce-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">NLĐ mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Mã NLĐ</span><input required value={f.workerCode} onChange={(e) => setF({ ...f, workerCode: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono" name="workerCode" /></label>
        <label className="text-xs"><span className="block text-slate-600">Họ tên</span><input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="fullName" /></label>
        <label className="text-xs"><span className="block text-slate-600">CCCD</span><input value={f.idNo} onChange={(e) => setF({ ...f, idNo: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="idNo" /></label>
        <label className="text-xs"><span className="block text-slate-600">Nghề</span><input required value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="trade" /></label>
        <label className="text-xs"><span className="block text-slate-600">Bậc</span><input value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="level" /></label>
        <label className="text-xs"><span className="block text-slate-600">Nhóm ATLĐ</span><select value={f.hseGroup} onChange={(e) => setF({ ...f, hseGroup: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="hseGroup"><option>N1</option><option>N2</option><option>N3</option><option>N4</option><option>N5</option><option>N6</option></select></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.isStaff} onChange={(e) => setF({ ...f, isStaff: e.target.checked })} name="isStaff" />Cán bộ (không phải thợ thời vụ)</label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Thêm"}</button></div>
    </form>
  );
}

export function CheckinAction({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const res = await fetch(`/api/workforce/${id}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "QR", gateCode: "Cổng A" }) });
    setBusy(false);
    if (res.ok) router.refresh();
  }
  return <button onClick={go} disabled={busy} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-CHECKIN">{busy ? "…" : "Check-in"}</button>;
}
