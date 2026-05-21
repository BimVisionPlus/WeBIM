"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

const today = () => new Date().toISOString().slice(0, 10);

const ACTIONS: Record<string, { action: string; label: string }[]> = {
  DRAFT: [{ action: "TVGS_SIGN", label: "TVGS ký" }],
  TVGS_SIGNED: [{ action: "NT_SIGN", label: "NT ký" }],
  NT_SIGNED: [{ action: "CDT_SIGN", label: "CĐT ký" }],
  CDT_SIGNED: [{ action: "FINALIZE", label: "Chốt entry" }],
  FINALIZED: [],
};

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", logDate: today(), shift: "DAY", weather: "", workItems: "", qualityNotes: "", safetyNotes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/supervise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, workItems: "", qualityNotes: "", safetyNotes: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Nhật ký TVGS hôm nay</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="supervise-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Nhật ký TVGS mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Ngày</span><input required type="date" value={f.logDate} onChange={(e) => setF({ ...f, logDate: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="logDate" /></label>
        <label className="text-xs"><span className="block text-slate-600">Ca</span><select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="shift"><option value="DAY">Ngày</option><option value="NIGHT">Đêm</option><option value="FULL">Cả ngày</option></select></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Thời tiết</span><input value={f.weather} onChange={(e) => setF({ ...f, weather: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="weather" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Công việc thi công</span><textarea required value={f.workItems} onChange={(e) => setF({ ...f, workItems: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="workItems" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Quan sát chất lượng</span><textarea value={f.qualityNotes} onChange={(e) => setF({ ...f, qualityNotes: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="qualityNotes" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Quan sát ATLĐ</span><textarea value={f.safetyNotes} onChange={(e) => setF({ ...f, safetyNotes: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="safetyNotes" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo"}</button></div>
    </form>
  );
}

export function RowActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const actions = ACTIONS[state] ?? [];
  if (actions.length === 0) return <span className="text-[10px] text-slate-400">—</span>;

  async function go(action: string) {
    setBusy(action);
    const res = await fetch(`/api/supervise/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
    </div>
  );
}
