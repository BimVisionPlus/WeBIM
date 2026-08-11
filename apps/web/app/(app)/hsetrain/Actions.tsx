"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type CourseOpt = { id: string; code: string; group: string };

export function CreateForm({ courses }: { courses: CourseOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ courseId: courses[0]?.id ?? "", workerName: "", workerIdNo: "", testScore: 85 });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/hsetrain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, workerName: "", workerIdNo: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Cấp chứng chỉ ATLĐ</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="hsetrain-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Cấp chứng chỉ mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Khoá</span><select required value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="courseId">{courses.map((c) => <option key={c.id} value={c.id}>{c.code} ({c.group})</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Họ tên NLĐ</span><input required value={f.workerName} onChange={(e) => setF({ ...f, workerName: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="workerName" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">CCCD</span><input value={f.workerIdNo} onChange={(e) => setF({ ...f, workerIdNo: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="workerIdNo" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Điểm kiểm tra (%)</span><input type="number" min={0} max={100} value={f.testScore} onChange={(e) => setF({ ...f, testScore: Number(e.target.value) })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="testScore" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Cấp"}</button></div>
    </form>
  );
}

export function CertActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (state !== "ACTIVE") return <span className="text-[10px] text-[rgb(var(--muted-2))]">—</span>;

  async function revoke() {
    const n = window.prompt("Lý do thu hồi:");
    if (!n) return;
    setBusy(true);
    const res = await fetch(`/api/hsetrain/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REVOKE", note: n }) });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return <button onClick={revoke} disabled={busy} className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800 disabled:opacity-50" data-testid="action-REVOKE">{busy ? "…" : "Thu hồi"}</button>;
}
