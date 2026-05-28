"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };
type Line = { code: string; description: string; unit: string; qty: string; unitPriceVnd: string; category: string };

const emptyLine: Line = { code: "", description: "", unit: "", qty: "", unitPriceVnd: "", category: "" };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [contractValueVnd, setContractValueVnd] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { ...emptyLine }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));

  const computedTotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPriceVnd) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = {
      projectId,
      name,
      contractValueVnd: contractValueVnd || String(Math.round(computedTotal)),
      lines: lines.map((l) => ({
        code: l.code,
        description: l.description,
        unit: l.unit,
        qty: Number(l.qty) || 0,
        unitPriceVnd: l.unitPriceVnd || "0",
        ...(l.category ? { category: l.category } : {}),
      })),
    };
    const res = await fetch("/api/costpulse/boq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu — kiểm tra mã, đơn vị, khối lượng từng dòng"); return; }
    setOpen(false); setName(""); setContractValueVnd(""); setLines([{ ...emptyLine }]); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Tạo bảng khối lượng (BoQ)</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="costpulse-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Bảng khối lượng mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-slate-600">Dự án</span><select required value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-slate-600">Tên BoQ</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="BoQ gói thầu thi công" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="name" /></label>
        <label className="text-xs"><span className="block text-slate-600">Giá trị hợp đồng (VND)</span><input value={contractValueVnd} onChange={(e) => setContractValueVnd(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={`mặc định = ${Math.round(computedTotal).toLocaleString("vi-VN")}`} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="contractValueVnd" /></label>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-slate-600">Dòng khối lượng</span><button type="button" onClick={addLine} className="text-xs text-blue-600">+ Thêm dòng</button></div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2" data-testid={`boq-line-${i}`}>
              <input required value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} placeholder="Mã" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" />
              <input required value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Diễn giải công việc" className="col-span-3 rounded border border-slate-300 px-2 py-1 text-xs" />
              <input required value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} placeholder="ĐV" className="col-span-1 rounded border border-slate-300 px-2 py-1 text-xs" />
              <input required value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="KL" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" />
              <input required value={l.unitPriceVnd} onChange={(e) => setLine(i, { unitPriceVnd: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="Đơn giá" className="col-span-3 rounded border border-slate-300 px-2 py-1 text-xs" />
              <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-xs text-rose-600" aria-label="Xóa dòng">✕</button>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-xs text-slate-600">Tổng tạm tính: <span className="font-semibold">{Math.round(computedTotal).toLocaleString("vi-VN")} đ</span></div>
      </div>

      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu BoQ"}</button></div>
    </form>
  );
}
