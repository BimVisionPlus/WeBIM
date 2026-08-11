"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", unitCode: "", category: "THAM_DOT", severity: "MEDIUM", title: "", description: "", reporterName: "", reporterPhone: "", warrantyType: "PHAN_CHINH" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/handover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, title: "", description: "", unitCode: "", reporterName: "", reporterPhone: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Tạo yêu cầu bảo hành</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="handover-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Yêu cầu bảo hành mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã căn/đơn vị</span><input value={f.unitCode} onChange={(e) => setF({ ...f, unitCode: e.target.value })} placeholder="S9-12-03" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="unitCode" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại lỗi</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="category"><option value="THAM_DOT">Thấm dột</option><option value="NUT_TUONG">Nứt tường</option><option value="DIEN_GIAT">Điện</option><option value="CAP_THOAT_NUOC">Cấp thoát nước</option><option value="HVAC">ĐHKK</option><option value="SON_HOAN_THIEN">Sơn/hoàn thiện</option><option value="CUA_KHOA">Cửa/khoá</option><option value="AN_NINH">An ninh</option><option value="KHAC">Khác</option></select></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="title" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Mô tả</span><textarea required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="description" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Người báo</span><input required value={f.reporterName} onChange={(e) => setF({ ...f, reporterName: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="reporterName" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">SĐT</span><input value={f.reporterPhone} onChange={(e) => setF({ ...f, reporterPhone: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="reporterPhone" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại bảo hành</span><select value={f.warrantyType} onChange={(e) => setF({ ...f, warrantyType: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="warrantyType"><option value="PHAN_PHU">Phần phụ (12th)</option><option value="PHAN_CHINH">Phần chính (24th)</option><option value="HA_TANG">Hạ tầng (60th)</option></select></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Gửi yêu cầu"}</button></div>
    </form>
  );
}
