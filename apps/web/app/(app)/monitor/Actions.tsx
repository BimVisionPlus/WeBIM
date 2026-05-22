"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", pointCode: "", monitorType: "SETTLEMENT", description: "", unit: "mm", thresholdWarn: "8", thresholdAlert: "15" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/monitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, pointCode: "", description: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm điểm quan trắc</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="monitor-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Điểm quan trắc mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Mã điểm</span><input required value={f.pointCode} onChange={(e) => setF({ ...f, pointCode: e.target.value })} placeholder="SET-A-001" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono" name="pointCode" /></label>
        <label className="text-xs"><span className="block text-slate-600">Loại</span><select value={f.monitorType} onChange={(e) => setF({ ...f, monitorType: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="monitorType"><option value="SETTLEMENT">Lún</option><option value="TILT">Nghiêng</option><option value="PIEZOMETER">Áp lực nước</option><option value="STRAIN">Biến dạng</option><option value="CRACK">Khe nứt</option><option value="VIBRATION">Rung</option><option value="TEMPERATURE">Nhiệt độ BT</option></select></label>
        <label className="text-xs md:col-span-3"><span className="block text-slate-600">Mô tả vị trí</span><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="description" /></label>
        <label className="text-xs"><span className="block text-slate-600">Đơn vị</span><input required value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="unit" /></label>
        <label className="text-xs"><span className="block text-slate-600">Ngưỡng cảnh báo</span><input value={f.thresholdWarn} onChange={(e) => setF({ ...f, thresholdWarn: e.target.value })} pattern="\d+(\.\d+)?" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="thresholdWarn" /></label>
        <label className="text-xs"><span className="block text-slate-600">Ngưỡng nguy hiểm</span><input value={f.thresholdAlert} onChange={(e) => setF({ ...f, thresholdAlert: e.target.value })} pattern="\d+(\.\d+)?" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="thresholdAlert" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Thêm"}</button></div>
    </form>
  );
}

export function MeasureAction({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    const v = window.prompt("Giá trị đo (số):");
    if (!v || !/^-?\d+(\.\d+)?$/.test(v)) return;
    setBusy(true);
    const res = await fetch(`/api/monitor/${id}/measurement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: v }) });
    setBusy(false);
    if (res.ok) router.refresh();
  }
  return <button onClick={go} disabled={busy} className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50" data-testid="action-MEASURE">{busy ? "…" : "Nhập số đo"}</button>;
}
