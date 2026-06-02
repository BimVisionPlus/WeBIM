"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

const states = [
  { value: "PLANNED", label: "Kế hoạch" },
  { value: "IN_PROGRESS", label: "Đang TC" },
  { value: "ON_HOLD", label: "Tạm dừng" },
  { value: "DONE", label: "Xong" },
  { value: "CANCELLED", label: "Huỷ" },
];

export function RowActions({ id, state, pctComplete }: { id: string; state: string; pctComplete: number }) {
  const router = useRouter();
  const [v, setV] = useState(state);
  const [pct, setPct] = useState(String(Math.round(pctComplete)));
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch(`/api/schedule/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-1" data-testid={`row-actions-${id}`}>
      <select value={v} onChange={(e) => { setV(e.target.value); patch({ state: e.target.value }); }} disabled={busy} className="rounded border border-slate-300 px-1 py-0.5 text-[10px]">
        {states.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <input value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ""))} onBlur={() => { const n = Number(pct); if (!isNaN(n) && n !== Math.round(pctComplete)) patch({ pctComplete: n }); }} className="w-9 rounded border border-slate-300 px-1 py-0.5 text-[10px]" />
      <DeleteAction url={`/api/schedule/tasks/${id}`} label="công việc" testId={`delete-${id}`} />
    </span>
  );
}
