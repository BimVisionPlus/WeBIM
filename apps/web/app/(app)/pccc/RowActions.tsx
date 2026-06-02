"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

const states = [
  { value: "DRAFT", label: "Nháp" },
  { value: "SUBMITTED", label: "Đã nộp" },
  { value: "REVIEWING", label: "Đang thẩm tra" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "WITHDRAWN", label: "Rút" },
];

export function RowActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [v, setV] = useState(state);
  const [busy, setBusy] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setV(e.target.value); setBusy(true);
    const r = await fetch(`/api/pccc/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: e.target.value }) });
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-1" data-testid={`row-actions-${id}`}>
      <select value={v} onChange={onChange} disabled={busy} className="rounded border border-slate-300 px-1 py-0.5 text-[10px]">
        {states.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <DeleteAction url={`/api/pccc/${id}`} label="hồ sơ PCCC" testId={`delete-${id}`} />
    </span>
  );
}
