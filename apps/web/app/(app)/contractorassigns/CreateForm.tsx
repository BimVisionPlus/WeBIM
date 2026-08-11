"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

function today() { return new Date().toISOString().slice(0,10); }

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", contractorName: "", scope: "", amountVnd: "", startDate: today(), endDate: today(), pctComplete: "0", status: "ACTIVE" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/contractorassigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, contractorName: "", scope: "", amountVnd: "", pctComplete: "0" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Giao khoán</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="contractor-assign-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Bảng giao khoán cho đơn vị</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tên đơn vị nhận khoán</span><input required value={f.contractorName} onChange={(e) => setF({ ...f, contractorName: e.target.value })} placeholder="Đội thi công Trần Văn A" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Phạm vi công việc khoán</span><textarea required value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Giá trị khoán (VND)</span><input required value={f.amountVnd} onChange={(e) => setF({ ...f, amountVnd: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Bắt đầu</span><input required type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Kết thúc</span><input required type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">% hoàn thành</span><input value={f.pctComplete} onChange={(e) => setF({ ...f, pctComplete: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Trạng thái</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5"><option value="ACTIVE">Đang khoán</option><option value="COMPLETED">Hoàn thành</option><option value="ON_HOLD">Tạm dừng</option><option value="CANCELLED">Hủy</option></select></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu giao khoán"}</button></div>
    </form>
  );
}
