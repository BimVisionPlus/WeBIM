"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", code: "", name: "", discipline: "", zone: "", plannedStart: today(), plannedEnd: today(), pctComplete: "0", isCritical: false });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = {
      projectId: f.projectId,
      code: f.code,
      name: f.name,
      plannedStart: f.plannedStart,
      plannedEnd: f.plannedEnd,
      pctComplete: Number(f.pctComplete) || 0,
      isCritical: f.isCritical,
      ...(f.discipline ? { discipline: f.discipline } : {}),
      ...(f.zone ? { zone: f.zone } : {}),
    };
    const res = await fetch("/api/schedule/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, code: "", name: "", zone: "", pctComplete: "0", isCritical: false }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm công việc (task)</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="schedule-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Công việc lịch thi công mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Mã WBS</span><input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="T1.2.3" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="code" /></label>
        <label className="text-xs"><span className="block text-slate-600">Bộ môn</span><input value={f.discipline} onChange={(e) => setF({ ...f, discipline: e.target.value })} placeholder="Kết cấu / MEP / Hoàn thiện" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="discipline" /></label>
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tên công việc</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Đổ bê tông sàn tầng 5" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="name" /></label>
        <label className="text-xs"><span className="block text-slate-600">Khu vực</span><input value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} placeholder="Tầng 5 — Khu B" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="zone" /></label>
        <label className="text-xs"><span className="block text-slate-600">Bắt đầu (kế hoạch)</span><input required type="date" value={f.plannedStart} onChange={(e) => setF({ ...f, plannedStart: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="plannedStart" /></label>
        <label className="text-xs"><span className="block text-slate-600">Kết thúc (kế hoạch)</span><input required type="date" value={f.plannedEnd} onChange={(e) => setF({ ...f, plannedEnd: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="plannedEnd" /></label>
        <label className="text-xs"><span className="block text-slate-600">% hoàn thành</span><input value={f.pctComplete} onChange={(e) => setF({ ...f, pctComplete: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="pctComplete" /></label>
        <label className="flex items-center gap-2 text-xs md:col-span-3"><input type="checkbox" checked={f.isCritical} onChange={(e) => setF({ ...f, isCritical: e.target.checked })} name="isCritical" /><span className="text-slate-600">Nằm trên đường găng (Critical Path)</span></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Thêm công việc"}</button></div>
    </form>
  );
}
