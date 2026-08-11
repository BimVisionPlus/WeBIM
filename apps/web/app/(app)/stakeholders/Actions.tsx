"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type AgencyOpt = { id: string; code: string; name: string };
export type ProjectOpt = { id: string; key: string; name: string };

const today = () => new Date().toISOString().slice(0, 10);

export function CreateDocForm({ agencies, projects }: { agencies: AgencyOpt[]; projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ agencyId: agencies[0]?.id ?? "", projectId: projects[0]?.id ?? "", direction: "INCOMING", docNo: "", docDate: today(), subject: "", category: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/stakeholders/document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, docNo: "", subject: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Ghi nhận văn bản</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="stakeholders-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Văn bản đi/đến mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Cơ quan</span><select required value={f.agencyId} onChange={(e) => setF({ ...f, agencyId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="agencyId">{agencies.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Hướng</span><select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="direction"><option value="INCOMING">VB đến</option><option value="OUTGOING">VB đi</option></select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số VB</span><input required value={f.docNo} onChange={(e) => setF({ ...f, docNo: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="docNo" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ngày VB</span><input required type="date" value={f.docDate} onChange={(e) => setF({ ...f, docDate: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="docDate" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span><input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Yêu cầu báo cáo" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="category" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Chủ đề</span><input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="subject" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu"}</button></div>
    </form>
  );
}

export function RespondAction({ id, hasResponded }: { id: string; hasResponded: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (hasResponded) return <span className="text-[10px] text-emerald-700">✓</span>;

  async function go() {
    const n = window.prompt("Ghi chú trả lời (optional):");
    setBusy(true);
    const res = await fetch(`/api/stakeholders/document/${id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: n ?? undefined }) });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return <button onClick={go} disabled={busy} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="action-RESPOND">{busy ? "…" : "Đánh dấu trả lời"}</button>;
}
