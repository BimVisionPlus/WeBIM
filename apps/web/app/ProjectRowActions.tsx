"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

export function ProjectRowActions({ id, initial }: { id: string; initial: { name: string; province: string | null; endDate: string | null; status: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: initial.name, province: initial.province ?? "", endDate: initial.endDate ?? "", status: initial.status });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid={`project-row-actions-${id}`}>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline" data-testid={`edit-project-${id}`} title="Sửa dự án">✎</button>
      <DeleteAction url={`/api/projects/${id}`} label="dự án" testId={`delete-project-${id}`} soft />
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" data-testid="edit-project-form">
            <h3 className="mb-3 text-sm font-semibold">Sửa dự án</h3>
            <div className="space-y-3">
              <label className="block text-xs"><span className="text-slate-600">Tên</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
              <label className="block text-xs"><span className="text-slate-600">Tỉnh</span><input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
              <label className="block text-xs"><span className="text-slate-600">Deadline</span><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" /></label>
              <label className="block text-xs"><span className="text-slate-600">Trạng thái</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"><option value="PLANNING">Chuẩn bị</option><option value="IN_PROGRESS">Đang thi công</option><option value="HANDOVER">Bàn giao</option><option value="WARRANTY">Bảo hành</option><option value="CLOSED">Đã đóng</option></select></label>
            </div>
            {err && <div className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</div>}
            <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Huỷ</button><button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">{busy ? "…" : "Lưu"}</button></div>
          </form>
        </div>
      )}
    </span>
  );
}
