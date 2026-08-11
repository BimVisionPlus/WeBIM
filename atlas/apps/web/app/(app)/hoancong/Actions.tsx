"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "neutral" | "danger" }[]> = {
  DRAFT: [{ action: "START_ASSEMBLE", label: "Bắt đầu tập hợp", tone: "primary" }],
  ASSEMBLING: [{ action: "NT_SIGN", label: "NT ký", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  NT_REVIEW: [{ action: "TVGS_SIGN", label: "TVGS ký", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  TVGS_REVIEW: [{ action: "CDT_SIGN", label: "CĐT ký", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  CDT_REVIEW: [{ action: "COMPILE_PDFA", label: "Đóng cuốn PDF/A", tone: "primary" }],
  COMPILED: [{ action: "SUBMIT_QLNN", label: "Gửi Sở XD", tone: "primary" }],
  SUBMITTED_QLNN: [{ action: "ACCEPT", label: "QLNN chấp thuận", tone: "primary" }],
  ACCEPTED: [],
};

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", code: "", title: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch("/api/hoancong", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, code: "", title: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Khởi tạo hồ sơ hoàn công</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="hoancong-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Hồ sơ hoàn công mới (13 nhóm VIIIb)</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã</span><input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="HC-VHGP-S9-2026" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="code" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="title" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Khởi tạo"}</button></div>
    </form>
  );
}

export function DossierActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const actions = ACTIONS[state] ?? [];
  if (actions.length === 0) return null;

  async function go(action: string) {
    setBusy(action); setErr(null);
    const body: Record<string, unknown> = { action };
    if (action === "ACCEPT") { const ref = window.prompt("Số văn bản chấp thuận QLNN:"); if (!ref) { setBusy(null); return; } body.qlnnRef = ref; }
    if (action === "REJECT") { const n = window.prompt("Lý do trả về:"); if (!n) { setBusy(null); return; } body.notes = n; }
    const res = await fetch(`/api/hoancong/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-3 py-1.5 text-xs font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : a.tone === "primary" ? "bg-blue-600 text-[rgb(var(--inverse-ink))]" : "bg-[rgb(var(--raised))] text-[rgb(var(--ink-2))]"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
      {err && <span className="text-[10px] text-rose-700">{err}</span>}
    </div>
  );
}
