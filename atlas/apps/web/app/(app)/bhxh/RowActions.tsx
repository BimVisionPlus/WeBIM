"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
import { GenericEditDrawer } from "@/components/generic-edit-drawer";

const statuses = [
  { value: "CHO_DANG_KY", label: "Chờ đăng ký" },
  { value: "DANG_DONG", label: "Đang đóng" },
  { value: "TAM_DUNG", label: "Tạm dừng" },
  { value: "DA_NGHI", label: "Đã nghỉ" },
  { value: "KHAC", label: "Khác" },
];

export function RowActions({ id, status, initial }: { id: string; status: string; initial: { employeeName: string; employeeIdNo: string | null; bhxhNumber: string | null; monthlyBaseVnd: string | null; startedAt: string | null; note: string | null } }) {
  const router = useRouter();
  const [v, setV] = useState(status);
  const [busy, setBusy] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const prev = v; const next = e.target.value; setV(next); setBusy(true);
    const r = await fetch(`/api/bhxh/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    if (!r.ok) { setV(prev); return; }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <select value={v} onChange={onChange} disabled={busy} className="rounded border border-[rgb(var(--line-2))] px-1 py-0.5 text-[10px]" data-testid={`bhxh-status-${id}`}>
        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <GenericEditDrawer
        url={`/api/bhxh/${id}`}
        title="Sửa bản ghi BHXH"
        fields={[
          { key: "employeeName", label: "Họ tên NLĐ", type: "text", initial: initial.employeeName, required: true, colSpan: 2 },
          { key: "employeeIdNo", label: "CCCD", type: "text", initial: initial.employeeIdNo ?? "" },
          { key: "bhxhNumber", label: "Số sổ BHXH", type: "text", initial: initial.bhxhNumber ?? "" },
          { key: "monthlyBaseVnd", label: "Mức đóng/tháng", type: "money", initial: initial.monthlyBaseVnd ?? "" },
          { key: "startedAt", label: "Bắt đầu đóng", type: "date", initial: initial.startedAt ?? "" },
          { key: "note", label: "Ghi chú", type: "textarea", initial: initial.note ?? "" },
        ]}
      />
      <DeleteAction url={`/api/bhxh/${id}`} label="bản ghi BHXH" testId={`delete-${id}`} />
    </span>
  );
}
