"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", source: "OTHER", sourceId: "manual-" + Date.now(), title: "", summary: "", priority: "NORMAL", amountVnd: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, title: "", summary: "", amountVnd: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Trình duyệt CĐT</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="portal-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Phiếu trình duyệt CĐT mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Nguồn</span><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="source"><option value="PAYMENT">Thanh toán</option><option value="CHANGEORDER">Lệnh thay đổi</option><option value="METHOD">BPTC</option><option value="QAQC">QAQC</option><option value="ACCEPTANCE">Nghiệm thu</option><option value="MATERIAL">Vật liệu</option><option value="PERMIT">Giấy phép</option><option value="TENDER">Đấu thầu</option><option value="OTHER">Khác</option></select></label>
        <label className="text-xs"><span className="block text-slate-600">Ưu tiên</span><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="priority"><option value="LOW">Thấp</option><option value="NORMAL">Thường</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn</option></select></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Tiêu đề</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="title" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Tóm tắt</span><textarea required value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="summary" /></label>
        <label className="text-xs"><span className="block text-slate-600">Giá trị (VND)</span><input value={f.amountVnd} onChange={(e) => setF({ ...f, amountVnd: e.target.value })} pattern="-?\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="amountVnd" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Gửi CĐT"}</button></div>
    </form>
  );
}

export function DecideActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!["PENDING", "IN_REVIEW"].includes(state)) return <span className="text-[10px] text-slate-400">—</span>;

  async function go(decision: string) {
    setBusy(decision);
    const body: Record<string, unknown> = { decision };
    if (decision === "REJECT") { const n = window.prompt("Lý do từ chối:"); if (!n) { setBusy(null); return; } body.note = n; }
    const res = await fetch(`/api/portal/${id}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`decide-${id}`}>
      <button onClick={() => go("APPROVE")} disabled={busy === "APPROVE"} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-APPROVE">{busy === "APPROVE" ? "…" : "Duyệt"}</button>
      <button onClick={() => go("REJECT")} disabled={busy === "REJECT"} className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-REJECT">{busy === "REJECT" ? "…" : "Từ chối"}</button>
    </div>
  );
}
