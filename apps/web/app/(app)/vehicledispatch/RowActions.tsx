"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
import { GenericEditDrawer } from "@/components/generic-edit-drawer";

const statuses = [
  { value: "SCHEDULED", label: "Đã đặt" },
  { value: "IN_USE", label: "Đang dùng" },
  { value: "RETURNED", label: "Đã trả" },
  { value: "CANCELLED", label: "Huỷ" },
];

export function RowActions({ id, status, initial }: { id: string; status: string; initial: { vehiclePlate: string; driverName: string; purpose: string; startAt: string; endAt: string | null; note: string | null } }) {
  const router = useRouter();
  const [v, setV] = useState(status);
  const [busy, setBusy] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const prev = v; const next = e.target.value; setV(next); setBusy(true);
    const r = await fetch(`/api/vehicledispatch/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    if (!r.ok) { setV(prev); return; }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <select value={v} onChange={onChange} disabled={busy} className="rounded border border-slate-300 px-1 py-0.5 text-[10px]">
        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <GenericEditDrawer
        url={`/api/vehicledispatch/${id}`}
        title="Sửa lệnh điều xe"
        fields={[
          { key: "vehiclePlate", label: "Biển số", type: "text", initial: initial.vehiclePlate, required: true },
          { key: "driverName", label: "Tài xế", type: "text", initial: initial.driverName, required: true, colSpan: 2 },
          { key: "purpose", label: "Mục đích", type: "text", initial: initial.purpose, required: true, colSpan: 3 },
          { key: "startAt", label: "Bắt đầu", type: "datetime-local", initial: initial.startAt },
          { key: "endAt", label: "Kết thúc", type: "datetime-local", initial: initial.endAt ?? "" },
          { key: "note", label: "Ghi chú", type: "textarea", initial: initial.note ?? "" },
        ]}
      />
      <DeleteAction url={`/api/vehicledispatch/${id}`} label="lệnh điều xe" testId={`delete-${id}`} />
    </span>
  );
}
