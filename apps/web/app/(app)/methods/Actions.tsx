"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };
export type TemplateOpt = { id: string; code: string; category: string };

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "danger" }[]> = {
  DRAFT: [{ action: "NT_SUBMIT", label: "NT trình", tone: "primary" }],
  NT_SUBMITTED: [{ action: "TVGS_REVIEW", label: "TVGS xem", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  TVGS_REVIEW: [{ action: "TVGS_APPROVE", label: "TVGS duyệt", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  CDT_REVIEW: [{ action: "CDT_APPROVE", label: "CĐT duyệt", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  APPROVED: [{ action: "START_EXEC", label: "Bắt đầu TC", tone: "primary" }],
  EXECUTING: [{ action: "CLOSE", label: "Đóng", tone: "primary" }],
  REJECTED: [], CLOSED: [],
};

export function CreateForm({ projects, templates }: { projects: ProjectOpt[]; templates: TemplateOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", code: "", category: "COC", title: "", scope: "", templateId: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, code: "", title: "", scope: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Tạo BPTC</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="methods-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Biện pháp thi công mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Mã</span><input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="BPTC-XXX-001" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono" name="code" /></label>
        <label className="text-xs"><span className="block text-slate-600">Loại</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="category"><option value="COC">Cọc</option><option value="DAO_DAT">Đào đất/nền</option><option value="BE_TONG_KHOI">BT khối lớn</option><option value="KET_CAU">Kết cấu BTCT</option><option value="KET_CAU_THEP">Kết cấu thép</option><option value="MEP">MEP</option><option value="HOAN_THIEN">Hoàn thiện</option><option value="CAU_GIANG_GIO">Cẩu/giàn giáo</option><option value="HAN_CO_DIEN">Hàn nguy cơ cháy</option><option value="KHAC">Khác</option></select></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="title" /></label>
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Phạm vi</span><input required value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="scope" /></label>
        <label className="text-xs"><span className="block text-slate-600">Template (optional)</span><select value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="templateId"><option value="">Không dùng</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label>
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
    if (action === "REJECT") { const n = window.prompt("Lý do trả về:"); if (!n) { setBusy(null); return; } body.rejectionNote = n; }
    const res = await fetch(`/api/methods/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : "bg-blue-600 text-white"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
    </div>
  );
}
