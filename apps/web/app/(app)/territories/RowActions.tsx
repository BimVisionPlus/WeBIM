"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

export function RowActions({ id, initial }: { id: string; initial: { name: string; province: string | null; scope: string | null; active: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: initial.name, province: initial.province ?? "", scope: initial.scope ?? "", active: initial.active });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch(`/api/territories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline">Sửa</button>
      <DeleteAction url={`/api/territories/${id}`} label="địa bàn" testId={`delete-${id}`} soft />
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--inverse-bg))]/40 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-lg bg-[rgb(var(--surface))] p-5 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold">Sửa địa bàn</h3>
            <div className="space-y-3">
              <label className="block text-xs"><span className="text-[rgb(var(--muted))]">Tên</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
              <label className="block text-xs"><span className="text-[rgb(var(--muted))]">Tỉnh trọng tâm</span><input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
              <label className="block text-xs"><span className="text-[rgb(var(--muted))]">Phạm vi</span><textarea value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span className="text-[rgb(var(--ink-2))]">Đang hoạt động</span></label>
            </div>
            {err && <div className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</div>}
            <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded border border-[rgb(var(--line-2))] px-3 py-1 text-xs">Huỷ</button><button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{busy ? "…" : "Lưu"}</button></div>
          </form>
        </div>
      )}
    </span>
  );
}
