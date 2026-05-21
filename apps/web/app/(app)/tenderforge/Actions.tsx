"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string };

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "danger" | "success" }[]> = {
  DRAFT: [{ action: "REVIEW", label: "Rà soát", tone: "primary" }, { action: "CANCEL", label: "Huỷ", tone: "danger" }],
  REVIEWING: [{ action: "READY", label: "Sẵn sàng", tone: "primary" }, { action: "CANCEL", label: "Huỷ", tone: "danger" }],
  READY: [{ action: "SUBMIT", label: "Nộp eGP", tone: "primary" }, { action: "CANCEL", label: "Huỷ", tone: "danger" }],
  SUBMITTED: [{ action: "AWARDED", label: "Trúng", tone: "success" }, { action: "LOST", label: "Trượt", tone: "danger" }],
  AWARDED: [], LOST: [], CANCELLED: [],
};

export function CreateForm({ orgs }: { orgs: OrgOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", code: "", perspective: "NHA_THAU", title: "", packageType: "Xây lắp", selectionMethod: "Đấu thầu rộng rãi qua mạng", estimatedValueVnd: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/tenderforge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, code: "", title: "", estimatedValueVnd: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Tạo gói thầu</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="tenderforge-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Gói thầu mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Tổ chức</span><select required value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="orgId">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Vai trò</span><select value={f.perspective} onChange={(e) => setF({ ...f, perspective: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="perspective"><option value="NHA_THAU">HSDT (Nhà thầu)</option><option value="BEN_MOI">HSMT (Bên mời)</option></select></label>
        <label className="text-xs"><span className="block text-slate-600">Mã</span><input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="HSDT-2026-XXX" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono" name="code" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="title" /></label>
        <label className="text-xs"><span className="block text-slate-600">Loại gói</span><input required value={f.packageType} onChange={(e) => setF({ ...f, packageType: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="packageType" /></label>
        <label className="text-xs"><span className="block text-slate-600">Hình thức</span><input required value={f.selectionMethod} onChange={(e) => setF({ ...f, selectionMethod: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="selectionMethod" /></label>
        <label className="text-xs"><span className="block text-slate-600">Giá trị (VND)</span><input value={f.estimatedValueVnd} onChange={(e) => setF({ ...f, estimatedValueVnd: e.target.value })} pattern="\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="estimatedValueVnd" /></label>
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
    const body: Record<string, unknown> = { action };
    if (action === "SUBMIT") { const ref = window.prompt("Mã giao dịch eGP (optional):"); if (ref) body.submissionRef = ref; }
    const res = await fetch(`/api/tenderforge/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : a.tone === "success" ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
    </div>
  );
}
