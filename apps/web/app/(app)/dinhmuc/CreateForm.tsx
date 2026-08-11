"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", chapter: "ZX - CUSTOM", section: "ZX.1 - Nội bộ", title: "", unit: "m3", source: "CUSTOM" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/dinhmuc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setForm({ ...form, code: "", title: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700" data-testid="open-create-form">+ Thêm mã định mức nội bộ</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="dinhmuc-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Định mức nội bộ mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ZX.99001" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="code" /></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="title" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Chương</span><input required value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="chapter" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mục</span><input required value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="section" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Đơn vị</span><input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="unit" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "Đang…" : "Tạo"}</button></div>
    </form>
  );
}
