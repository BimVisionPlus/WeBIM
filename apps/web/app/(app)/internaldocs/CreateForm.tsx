"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string };

const categories = [
  { value: "QUYET_DINH", label: "Quyết định" },
  { value: "THONG_BAO", label: "Thông báo" },
  { value: "QUY_CHE", label: "Quy chế" },
  { value: "QUY_TRINH", label: "Quy trình" },
  { value: "BIEN_BAN", label: "Biên bản nội bộ" },
  { value: "KHAC", label: "Khác" },
];

export function CreateForm({ orgs }: { orgs: OrgOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", docNo: "", category: "THONG_BAO", title: "", body: "", issuedAt: new Date().toISOString().slice(0,10) });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/internaldocs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, docNo: "", title: "", body: "" }); router.refresh();
  }

  // Auto-classify when user types a title ≥ 8 chars (debounced)
  const classifyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClassifiedRef = useRef<string>("");
  useEffect(() => {
    if (classifyRef.current) clearTimeout(classifyRef.current);
    const t = f.title.trim();
    if (t.length < 8 || lastClassifiedRef.current === t) return;
    classifyRef.current = setTimeout(async () => {
      const r = await fetch("/api/ai/classify-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
      if (!r.ok) return;
      const j = await r.json();
      if (j.ok && j.category) {
        lastClassifiedRef.current = t;
        setF((s) => ({ ...s, category: j.category }));
      }
    }, 900);
    return () => { if (classifyRef.current) clearTimeout(classifyRef.current); };
  }, [f.title]);

  async function ocr(file: File) {
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.append("image", file);
    const res = await fetch("/api/ai/extract-doc", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) { setErr("AI OCR không phản hồi"); return; }
    const j = await res.json();
    if (!j.ok || !j.extracted) { setErr("Không trích xuất được — nhập tay"); return; }
    const x = j.extracted;
    setF((s) => ({
      ...s,
      docNo: x.docNo ?? s.docNo,
      title: x.title ?? s.title,
      category: x.category ?? s.category,
      issuedAt: x.issuedAt ?? s.issuedAt,
    }));
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm văn bản nội bộ</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="internaldoc-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Văn bản nội bộ mới</h3>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100">
            ✨ AI OCR từ ảnh
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) ocr(f); }} data-testid="ocr-upload" />
          </label>
          <button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Tổ chức</span><select required value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="orgId">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Số văn bản</span><input required value={f.docNo} onChange={(e) => setF({ ...f, docNo: e.target.value })} placeholder="QĐ-12/2026" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="docNo" /></label>
        <label className="text-xs"><span className="block text-slate-600">Loại</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="category">{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="title" /></label>
        <label className="text-xs"><span className="block text-slate-600">Ngày ban hành</span><input type="date" value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="issuedAt" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Nội dung</span><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={3} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="body" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu"}</button></div>
    </form>
  );
}
