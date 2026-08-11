"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

const cats = [
  { value: "QUYET_DINH", label: "Quyết định" }, { value: "THONG_BAO", label: "Thông báo" },
  { value: "QUY_CHE", label: "Quy chế" }, { value: "QUY_TRINH", label: "Quy trình" },
  { value: "BIEN_BAN", label: "Biên bản" }, { value: "KHAC", label: "Khác" },
];

export function RowActions({ id, initial }: { id: string; initial: { title: string; category: string; issuedAt: string; body: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ title: initial.title, category: initial.category, issuedAt: initial.issuedAt, body: initial.body ?? "" });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch(`/api/internaldocs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline" data-testid={`edit-${id}`}>Sửa</button>
      <DeleteAction url={`/api/internaldocs/${id}`} label="văn bản" testId={`delete-${id}`} />
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--inverse-bg))]/40 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-lg bg-[rgb(var(--surface))] p-5 shadow-2xl" data-testid="edit-internaldoc">
            <h3 className="mb-3 text-sm font-semibold">Sửa văn bản nội bộ</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
              <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5">{cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
              <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ngày ban hành</span><input type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
              <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Nội dung</span><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={3} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
            </div>
            {err && <div className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-700" data-testid="edit-error">{err}</div>}
            <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded border border-[rgb(var(--line-2))] px-3 py-1 text-xs">Huỷ</button><button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="edit-save">{busy ? "…" : "Lưu"}</button></div>
          </form>
        </div>
      )}
    </span>
  );
}
