"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function IndexForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ sourceType: "TCVN", title: "", body: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch("/api/docchat/corpus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, title: "", body: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Index tài liệu vào corpus</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="docchat-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Index tài liệu mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại nguồn</span>
          <select value={f.sourceType} onChange={(e) => setF({ ...f, sourceType: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="sourceType">
            <option value="HOP_DONG">Hợp đồng</option><option value="BBNT">BBNT</option><option value="CV_QLNN">CV QLNN</option>
            <option value="THIET_KE">Thiết kế</option><option value="TCVN">TCVN/QCVN</option><option value="BPTC">BPTC</option>
            <option value="RFI">RFI</option><option value="EMAIL">Email</option><option value="KHAC">Khác</option>
          </select>
        </label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="title" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Nội dung (toàn văn)</span><textarea required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="body" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "Đang index…" : "Index (bge-m3)"}</button></div>
    </form>
  );
}
