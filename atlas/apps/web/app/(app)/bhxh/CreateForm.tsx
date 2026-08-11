"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string };

const statuses = [
  { value: "CHO_DANG_KY", label: "Chờ đăng ký" },
  { value: "DANG_DONG", label: "Đang đóng" },
  { value: "TAM_DUNG", label: "Tạm dừng" },
  { value: "DA_NGHI", label: "Đã nghỉ" },
  { value: "KHAC", label: "Khác" },
];

export function CreateForm({ orgs }: { orgs: OrgOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", employeeName: "", employeeIdNo: "", bhxhNumber: "", status: "DANG_DONG", monthlyBaseVnd: "", startedAt: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/bhxh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    setOpen(false); setF({ ...f, employeeName: "", employeeIdNo: "", bhxhNumber: "", monthlyBaseVnd: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Thêm bản ghi BHXH</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="bhxh-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Bản ghi BHXH mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tổ chức</span><select required value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Họ tên NLĐ</span><input required value={f.employeeName} onChange={(e) => setF({ ...f, employeeName: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">CCCD</span><input value={f.employeeIdNo} onChange={(e) => setF({ ...f, employeeIdNo: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số sổ BHXH</span><input value={f.bhxhNumber} onChange={(e) => setF({ ...f, bhxhNumber: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Trạng thái</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5">{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mức đóng/tháng (VND)</span><input value={f.monthlyBaseVnd} onChange={(e) => setF({ ...f, monthlyBaseVnd: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Bắt đầu đóng</span><input type="date" value={f.startedAt} onChange={(e) => setF({ ...f, startedAt: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu"}</button></div>
    </form>
  );
}
