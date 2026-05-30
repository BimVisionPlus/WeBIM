"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function StatusUpdateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", body: "", pctComplete: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload: any = { title: f.title, body: f.body };
    if (f.pctComplete !== "") payload.pctComplete = Number(f.pctComplete);
    const res = await fetch(`/api/projects/${projectId}/status-updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ title: "", body: "", pctComplete: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Cập nhật tình hình</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="status-update-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Cập nhật tình hình mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Đã hoàn thành đổ bê tông tầng 5" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-slate-600">% hoàn thành (tổng)</span><input value={f.pctComplete} onChange={(e) => setF({ ...f, pctComplete: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="—" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Nội dung</span><textarea required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={3} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu cập nhật"}</button></div>
    </form>
  );
}

export function ContractScopeEditor({ projectId, initial }: { projectId: string; initial: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/projects/${projectId}/contract-scope`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractScope: value || null }) });
    setBusy(false);
    if (!res.ok) { setErr("Không lưu được"); return; }
    setEditing(false); router.refresh();
  }

  if (!editing) {
    return (
      <div data-testid="contract-scope-view">
        {value ? <div className="whitespace-pre-line text-sm text-slate-800">{value}</div> : <div className="text-sm italic text-slate-400">Chưa có nội dung. Bấm "Sửa" để bổ sung.</div>}
        <button onClick={() => setEditing(true)} className="mt-2 text-xs text-blue-600 hover:underline" data-testid="contract-scope-edit">Sửa</button>
      </div>
    );
  }

  return (
    <div data-testid="contract-scope-editor">
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder="Mô tả nội dung công việc theo hợp đồng…" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
      <div className="mt-2 flex gap-2"><button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "…" : "Lưu"}</button><button onClick={() => { setEditing(false); setValue(initial ?? ""); }} className="rounded border border-slate-300 px-3 py-1.5 text-xs">Hủy</button></div>
    </div>
  );
}
