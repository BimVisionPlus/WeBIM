"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

const categories: { value: string; label: string }[] = [
  { value: "AN_TOAN_LAO_DONG", label: "An toàn lao động" },
  { value: "CHAY_NO", label: "Cháy nổ" },
  { value: "SUP_DO", label: "Sụp đổ" },
  { value: "ROI_NGA", label: "Rơi/ngã" },
  { value: "DIEN_GIAT", label: "Điện giật" },
  { value: "HOA_CHAT", label: "Hóa chất" },
  { value: "MOI_TRUONG", label: "Môi trường" },
  { value: "KHAC", label: "Khác" },
];
const severities: { value: string; label: string }[] = [
  { value: "NEAR_MISS", label: "Suýt xảy ra" },
  { value: "MINOR", label: "Nhẹ" },
  { value: "MAJOR", label: "Nghiêm trọng" },
  { value: "CRITICAL", label: "Đặc biệt nghiêm trọng" },
];

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", occurredAt: nowLocal(), category: "AN_TOAN_LAO_DONG", severity: "NEAR_MISS", description: "", location: "", injured: "0", immediateAction: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = {
      projectId: f.projectId,
      occurredAt: new Date(f.occurredAt).toISOString(),
      category: f.category,
      severity: f.severity,
      description: f.description,
      injured: Number(f.injured) || 0,
      ...(f.location ? { location: f.location } : {}),
      ...(f.immediateAction ? { immediateAction: f.immediateAction } : {}),
    };
    const res = await fetch("/api/siteeye/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, description: "", location: "", injured: "0", immediateAction: "", occurredAt: nowLocal() }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Ghi nhận sự cố ATVSLĐ</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-rose-200 bg-rose-50/50 p-4" data-testid="siteeye-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Sự cố / tai nạn lao động mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Thời điểm xảy ra</span><input required type="datetime-local" value={f.occurredAt} onChange={(e) => setF({ ...f, occurredAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="occurredAt" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Vị trí</span><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Tầng 8 — trục C3" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="location" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại sự cố</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="category">{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mức độ</span><select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="severity">{severities.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số người bị thương</span><input value={f.injured} onChange={(e) => setF({ ...f, injured: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="injured" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Mô tả diễn biến</span><textarea required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} placeholder="Mô tả sự việc, nguyên nhân ban đầu…" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="description" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Biện pháp xử lý ngay</span><textarea value={f.immediateAction} onChange={(e) => setF({ ...f, immediateAction: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="immediateAction" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-rose-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lập biên bản"}</button></div>
    </form>
  );
}
