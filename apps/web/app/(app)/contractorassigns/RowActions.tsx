"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

const statuses = [
  { value: "ACTIVE", label: "Đang khoán" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "ON_HOLD", label: "Tạm dừng" },
  { value: "CANCELLED", label: "Huỷ" },
];

export function RowActions({ id, status, pctComplete }: { id: string; status: string; pctComplete: number }) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [pct, setPct] = useState(String(Math.round(pctComplete)));
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch(`/api/contractorassigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <select value={s} onChange={(e) => { setS(e.target.value); patch({ status: e.target.value }); }} disabled={busy} className="rounded border border-slate-300 px-1 py-0.5 text-[10px]">
        {statuses.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
      </select>
      <input value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ""))} onBlur={() => { const n = Number(pct); if (!isNaN(n) && n !== Math.round(pctComplete)) patch({ pctComplete: n }); }} className="w-10 rounded border border-slate-300 px-1 py-0.5 text-[10px]" title="% hoàn thành" />
      <span className="text-[10px] text-slate-500">%</span>
      <DeleteAction url={`/api/contractorassigns/${id}`} label="bảng giao khoán" testId={`delete-${id}`} />
    </span>
  );
}
