"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
import { GenericEditDrawer } from "@/components/generic-edit-drawer";

const statuses = [
  { value: "ACTIVE", label: "Đang khoán" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "ON_HOLD", label: "Tạm dừng" },
  { value: "CANCELLED", label: "Huỷ" },
];

export function RowActions({ id, status, pctComplete, initial }: { id: string; status: string; pctComplete: number; initial: { contractorName: string; scope: string; amountVnd: string; startDate: string; endDate: string } }) {
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
      <GenericEditDrawer
        url={`/api/contractorassigns/${id}`}
        title="Sửa bảng giao khoán"
        fields={[
          { key: "contractorName", label: "Đơn vị nhận khoán", type: "text", initial: initial.contractorName, required: true, colSpan: 3 },
          { key: "scope", label: "Phạm vi", type: "textarea", initial: initial.scope, required: true, colSpan: 3 },
          { key: "amountVnd", label: "Giá trị khoán", type: "money", initial: initial.amountVnd, required: true },
          { key: "startDate", label: "Bắt đầu", type: "date", initial: initial.startDate, required: true },
          { key: "endDate", label: "Kết thúc", type: "date", initial: initial.endDate, required: true },
        ]}
      />
      <DeleteAction url={`/api/contractorassigns/${id}`} label="bảng giao khoán" testId={`delete-${id}`} />
    </span>
  );
}
