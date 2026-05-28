"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", title: "", reason: "", scopeChange: "", costDeltaVnd: "0", scheduleDeltaDays: 0, priority: "HIGH" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch("/api/change-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, title: "", reason: "", scopeChange: "", costDeltaVnd: "0" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Tạo lệnh thay đổi</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="changeorder-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Lệnh thay đổi mới (CO)</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="title" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Lý do phát sinh</span><textarea required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="reason" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Thay đổi phạm vi</span><textarea required value={f.scopeChange} onChange={(e) => setF({ ...f, scopeChange: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="scopeChange" /></label>
        <label className="text-xs"><span className="block text-slate-600">Δ chi phí (VND, +/-)</span><input required value={f.costDeltaVnd} onChange={(e) => setF({ ...f, costDeltaVnd: e.target.value })} pattern="-?\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="costDeltaVnd" /></label>
        <label className="text-xs"><span className="block text-slate-600">Δ tiến độ (ngày)</span><input type="number" value={f.scheduleDeltaDays} onChange={(e) => setF({ ...f, scheduleDeltaDays: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="scheduleDeltaDays" /></label>
        <label className="text-xs"><span className="block text-slate-600">Ưu tiên</span><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="priority"><option value="LOW">Thấp</option><option value="MEDIUM">Vừa</option><option value="HIGH">Cao</option><option value="CRITICAL">Khẩn</option></select></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo CO"}</button></div>
    </form>
  );
}
