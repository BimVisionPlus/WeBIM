"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };
export type ItpOpt = { id: string; code: string; title: string };

export function CreateForm({ projects, itps }: { projects: ProjectOpt[]; itps: ItpOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", templateId: itps[0]?.id ?? "", location: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/qaqc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, location: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Lên lịch check ITP</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="qaqc-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Check ITP mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">ITP template</span><select value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="templateId">{itps.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Vị trí</span><input required value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Cọc P14 trục 3-A" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="location" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo"}</button></div>
    </form>
  );
}

export function ResultActions({ id, result }: { id: string; result: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (result !== "PENDING") return <span className="text-[10px] text-slate-400">—</span>;

  async function go(r: string) {
    setBusy(r);
    const body: Record<string, unknown> = { result: r };
    if (r === "FAIL") { const n = window.prompt("Mô tả lỗi (sẽ tạo NCR):"); if (!n) { setBusy(null); return; } body.notes = n; }
    const res = await fetch(`/api/qaqc/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`result-actions-${id}`}>
      <button onClick={() => go("PASS")} disabled={busy === "PASS"} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-PASS">{busy === "PASS" ? "…" : "Pass"}</button>
      <button onClick={() => go("FAIL")} disabled={busy === "FAIL"} className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-FAIL">{busy === "FAIL" ? "…" : "Fail → NCR"}</button>
      <button onClick={() => go("REWORK")} disabled={busy === "REWORK"} className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-REWORK">{busy === "REWORK" ? "…" : "Rework"}</button>
      <button onClick={() => go("WAIVED")} disabled={busy === "WAIVED"} className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium disabled:opacity-50" data-testid="action-WAIVED">{busy === "WAIVED" ? "…" : "Miễn"}</button>
    </div>
  );
}
