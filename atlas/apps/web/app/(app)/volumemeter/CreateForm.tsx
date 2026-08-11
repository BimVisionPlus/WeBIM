"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ projectId: projects[0]?.id ?? "", code: "", title: "", scope: "", source: "MANUAL", notes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
    const res = await fetch("/api/volumemeter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Tạo phiếu thất bại"); return; }
    setOpen(false); setForm({ ...form, code: "", title: "", scope: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700" data-testid="open-create-form">+ Tạo phiếu QTO</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="volumemeter-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Phiếu bóc khối lượng mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span>
          <select required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}</select>
        </label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã phiếu</span>
          <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="QTO-VHGP-S9-XXX-001" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm font-mono" name="code" />
        </label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm" name="title" />
        </label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Phạm vi (hạng mục/trục/tầng)</span>
          <input required value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm" name="scope" />
        </label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Nguồn dữ liệu</span>
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm" name="source">
            <option value="MANUAL">Thủ công</option><option value="IFC_AUTO">IFC tự động</option><option value="HYBRID">IFC + thủ công</option><option value="IMPORTED">Import Excel</option>
          </select>
        </label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700 disabled:opacity-50" data-testid="submit-create">{busy ? "Đang tạo…" : "Tạo phiếu"}</button></div>
    </form>
  );
}
