"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

const stages: { value: string; label: string }[] = [
  { value: "THAM_DUYET_THIET_KE", label: "Thẩm duyệt thiết kế PCCC" },
  { value: "NGHIEM_THU_PCCC", label: "Nghiệm thu PCCC" },
  { value: "CAP_GIAY_DU_DIEU_KIEN", label: "Cấp Giấy chứng nhận đủ điều kiện" },
];

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", stage: "THAM_DUYET_THIET_KE", applicationCode: "", submittedAt: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/pccc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, applicationCode: "", submittedAt: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Tạo hồ sơ PCCC</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="pccc-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Hồ sơ thẩm duyệt / nghiệm thu PCCC (NĐ 136/2020)</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Giai đoạn</span><select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="stage">{stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Mã hồ sơ (PC07/C06)</span><input value={f.applicationCode} onChange={(e) => setF({ ...f, applicationCode: e.target.value })} placeholder="để trống nếu chưa có" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="applicationCode" /></label>
        <label className="text-xs"><span className="block text-slate-600">Ngày nộp (nếu đã nộp)</span><input type="date" value={f.submittedAt} onChange={(e) => setF({ ...f, submittedAt: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="submittedAt" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo hồ sơ"}</button></div>
    </form>
  );
}
