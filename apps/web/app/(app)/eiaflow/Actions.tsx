"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "danger" | "success" }[]> = {
  DRAFT: [{ action: "START_CONSULT", label: "Bắt đầu tham vấn CĐ", tone: "primary" }],
  CONSULTING: [{ action: "SUBMIT_AUTHORITY", label: "Trình cơ quan thẩm định", tone: "primary" }],
  AUTHORITY_REVIEW: [{ action: "APPROVE", label: "QĐ phê duyệt", tone: "success" }, { action: "REJECT", label: "Từ chối", tone: "danger" }],
  APPROVED: [], REJECTED: [],
};

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", type: "DTM", code: "", authority: "Sở TNMT TP. HCM" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch("/api/eiaflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, code: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Tạo hồ sơ ĐTM</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="eiaflow-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Hồ sơ ĐTM/GPMT mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="type"><option value="DTM">ĐTM</option><option value="DKDT">ĐKĐT</option><option value="GPMT">GPMT</option><option value="BAO_CAO_DK">Báo cáo định kỳ</option></select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã</span><input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="DTM-2026-XXX" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="code" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Cơ quan thẩm định</span><input required value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="authority" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo"}</button></div>
    </form>
  );
}

export function RowActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const actions = ACTIONS[state] ?? [];
  if (actions.length === 0) return <span className="text-[10px] text-[rgb(var(--muted-2))]">—</span>;

  async function go(action: string) {
    setBusy(action);
    const body: Record<string, unknown> = { action };
    if (action === "APPROVE") { const ref = window.prompt("Số QĐ phê duyệt:"); if (!ref) { setBusy(null); return; } body.decisionRef = ref; }
    if (action === "REJECT") { const n = window.prompt("Lý do:"); if (!n) { setBusy(null); return; } body.notes = n; }
    const res = await fetch(`/api/eiaflow/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : a.tone === "success" ? "bg-emerald-600 text-[rgb(var(--inverse-ink))]" : "bg-blue-600 text-[rgb(var(--inverse-ink))]"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
    </div>
  );
}
