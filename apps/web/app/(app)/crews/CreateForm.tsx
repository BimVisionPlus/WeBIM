"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", name: "", trade: "Thép", foremanName: "", headcount: 10 });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/crews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, name: "", foremanName: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm tổ đội</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="crews-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Tổ đội mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Tên tổ</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tổ thép #1" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="name" /></label>
        <label className="text-xs"><span className="block text-slate-600">Nghề</span><input required value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="trade" /></label>
        <label className="text-xs"><span className="block text-slate-600">Tổ trưởng</span><input value={f.foremanName} onChange={(e) => setF({ ...f, foremanName: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="foremanName" /></label>
        <label className="text-xs"><span className="block text-slate-600">Quân số</span><input type="number" min={0} value={f.headcount} onChange={(e) => setF({ ...f, headcount: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="headcount" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Thêm tổ"}</button></div>
    </form>
  );
}
