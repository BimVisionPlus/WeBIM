"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgOpt = { id: string; name: string };
export type ProjectOpt = { id: string; key: string; name: string };

const today = () => new Date().toISOString().slice(0, 10);

export function CreateForm({ orgs, projects }: { orgs: OrgOpt[]; projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", projectId: projects[0]?.id ?? "", workerName: "", role: "KS giám sát", workDate: today(), hours: "8", description: "", rateVndPerHour: "850000", billable: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload: Record<string, unknown> = { ...f };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });
    const res = await fetch("/api/consult", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, workerName: "", description: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Chấm công tư vấn</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="consult-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Timesheet mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Tổ chức tư vấn</span><select required value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="orgId">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Ngày</span><input required type="date" value={f.workDate} onChange={(e) => setF({ ...f, workDate: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="workDate" /></label>
        <label className="text-xs"><span className="block text-slate-600">Họ tên</span><input required value={f.workerName} onChange={(e) => setF({ ...f, workerName: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="workerName" /></label>
        <label className="text-xs"><span className="block text-slate-600">Vai trò</span><input required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="role" /></label>
        <label className="text-xs"><span className="block text-slate-600">Giờ</span><input required value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} pattern="\d+(\.\d+)?" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="hours" /></label>
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Công việc</span><input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="description" /></label>
        <label className="text-xs"><span className="block text-slate-600">Rate VND/h</span><input value={f.rateVndPerHour} onChange={(e) => setF({ ...f, rateVndPerHour: e.target.value })} pattern="\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="rateVndPerHour" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu"}</button></div>
    </form>
  );
}
