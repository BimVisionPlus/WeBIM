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

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Cập nhật tình hình</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="status-update-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Cập nhật tình hình mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Đã hoàn thành đổ bê tông tầng 5" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">% hoàn thành (tổng)</span><input value={f.pctComplete} onChange={(e) => setF({ ...f, pctComplete: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="—" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Nội dung</span><textarea required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={3} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu cập nhật"}</button></div>
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
        {value ? <div className="whitespace-pre-line text-sm text-[rgb(var(--ink-2))]">{value}</div> : <div className="text-sm italic text-[rgb(var(--muted-2))]">Chưa có nội dung. Bấm "Sửa" để bổ sung.</div>}
        <button onClick={() => setEditing(true)} className="mt-2 text-xs text-blue-600 hover:underline" data-testid="contract-scope-edit">Sửa</button>
      </div>
    );
  }

  return (
    <div data-testid="contract-scope-editor">
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder="Mô tả nội dung công việc theo hợp đồng…" className="w-full rounded border border-[rgb(var(--line-2))] px-3 py-2 text-sm" />
      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
      <div className="mt-2 flex gap-2"><button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{busy ? "…" : "Lưu"}</button><button onClick={() => { setEditing(false); setValue(initial ?? ""); }} className="rounded border border-[rgb(var(--line-2))] px-3 py-1.5 text-xs">Hủy</button></div>
    </div>
  );
}

export function SummarizeButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  async function run() {
    setBusy(true); setSummary(null);
    const r = await fetch("/api/ai/summarize-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
    setBusy(false);
    const j = await r.json();
    if (j.ok) { setSummary(j.summary); setModel(j.model ?? null); }
    else setSummary(j.summary ?? "AI không phản hồi.");
  }
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3" data-testid="status-summary">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-violet-800">Tóm tắt AI từ 5 cập nhật gần nhất</span>
        <button onClick={run} disabled={busy} className="rounded border border-violet-300 bg-[rgb(var(--surface))] px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50" data-testid="summary-run">{busy ? "AI đang viết…" : summary ? "Tóm tắt lại" : "✨ Tóm tắt"}</button>
      </div>
      {summary && <pre className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--ink-2))]" data-testid="summary-text">{summary}</pre>}
      {model && <div className="mt-1 text-[10px] text-[rgb(var(--muted))]">Mô hình: {model}</div>}
    </div>
  );
}

export function StatusUpdateRowActions({ projectId, updateId }: { projectId: string; updateId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onDelete() {
    if (!confirm("Xoá cập nhật này?")) return;
    setBusy(true);
    const r = await fetch(`/api/projects/${projectId}/status-updates/${updateId}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return <button onClick={onDelete} disabled={busy} className="text-[10px] text-rose-600 hover:underline disabled:opacity-50" data-testid={`delete-update-${updateId}`}>{busy ? "…" : "Xoá"}</button>;
}
